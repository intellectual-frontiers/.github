/**
 * Typed signals and the pipeline they go through (commons 0006-signals FR-009 to FR-013). `defineSignals` declares each kind of signal
 * once (a span, a log event, or a counter, up-down counter, gauge or histogram), with its attributes and their types, a log event's
 * severity, a metric's unit and bounds, the attributes that are secret, and its presentation role; emitting a kind that is not declared,
 * an attribute of the wrong type or a missing required attribute does not compile. `createTelemetry` makes the tracer, logger and meter of
 * one resource and scope from what the caller gives (a clock, a source of random bytes, a context manager, a parent), so a span tree is
 * the same every run; it redacts (FR-006), applies the limits (FR-007) and samples (FR-008), and hands every signal, in the order it was
 * made, to its processors: the in-memory one, the simple one and the batch one, whose `forceFlush` and `shutdown` resolve within their
 * time whatever an exporter does.
 *
 * @example
 * ```ts
 * import { createTelemetry, defineSignals, memoryProcessor } from "./signals.ts";
 * import { ok } from "./result.ts";
 * const registry = defineSignals({
 *   "build.step": { signal: "span", role: "step", attributes: { target: "string", "jobs?": "int" } },
 *   "build.files": { signal: "counter", role: "none", unit: "{file}", attributes: { target: "string" } },
 * });
 * const memory = memoryProcessor();
 * let t = 0n;
 * const telemetry = createTelemetry({
 *   registry, resource: { attributes: { "service.name": "build" } }, scope: { name: "build" },
 *   clock: () => t++, random: (n) => new Uint8Array(n).fill(7), processors: [memory],
 * });
 * telemetry.span("build.step", { target: "site" }, () => {
 *   telemetry.add("build.files", 3, { target: "site" });
 *   return ok("built");
 * });
 * memory.spans[0]?.status; // { kind: "ok" }
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { toBase64 } from "./base64.ts";
import {
  type AnyValue,
  type Attributes,
  type AttributeValue,
  DEFAULT_HISTOGRAM_BOUNDS,
  DEFAULT_LIMITS,
  DEFAULT_SAMPLER,
  formatTraceparent,
  formatTracestate,
  type HistogramPoint,
  type Limits,
  limitAttributes,
  type LogRecord,
  mergeAttributes,
  type Metric,
  type NumberPoint,
  redactAnyValue,
  redactAttributes,
  type Resource,
  SAMPLED,
  type Sampler,
  type Scope,
  type SeverityNumber,
  severityText,
  shouldSample,
  type SignalName,
  type SpanContext,
  type SpanData,
  type SpanEvent,
  type SpanId,
  spanIdFrom,
  type SpanKind,
  type SpanLink,
  type SpanStatus,
  type TraceId,
  traceIdFrom,
  type TraceState,
} from "./otel.ts";
import { countSignals, type LogBatch, type MetricBatch, type TraceBatch } from "./otlp.ts";
import { err, ok, type Result } from "./result.ts";

// ---------------------------------------------------------------------------------------------------------------------------------
// The registry (FR-009)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The type of a declared attribute. `int` takes a `number` (cut to an integer) or a `bigint`, and is written as an OTLP integer. */
export type AttributeType = "string" | "boolean" | "int" | "double" | "bytes" | "string[]" | "boolean[]" | "int[]" | "double[]";

/** The attributes a kind declares: a name (ending in `?` where it is optional) to its type. */
export type AttributeSchema = Readonly<Record<string, AttributeType>>;

/** The value an attribute of a type takes. */
export type AttributeValueOf = {
  readonly string: string;
  readonly boolean: boolean;
  readonly int: number | bigint;
  readonly double: number;
  readonly bytes: Uint8Array;
  readonly "string[]": readonly string[];
  readonly "boolean[]": readonly boolean[];
  readonly "int[]": readonly (number | bigint)[];
  readonly "double[]": readonly number[];
};

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The attributes object a schema asks for: its required names, and its optional ones (declared with `?`) without the `?`. */
export type AttributesFor<S extends AttributeSchema> = Simplify<
  { readonly [K in keyof S & string as K extends `${string}?` ? never : K]: AttributeValueOf[S[K]] } & {
    readonly [K in keyof S & string as K extends `${infer N}?` ? N : never]?: AttributeValueOf[S[K]];
  }
>;

/** How a kind is presented to a person: the renderer shows every role but `none`. */
export type Role = "step" | "detail" | "progress" | "result" | "hint" | "warning" | "error" | "none";

type Common = {
  /** The kind's attributes and their types. */
  readonly attributes: AttributeSchema;
  /** How a renderer presents it. */
  readonly role: Role;
  /** What the kind is, for a reader of the registry. */
  readonly description?: string;
  /** Attributes that are secret: never written anywhere (FR-006). */
  readonly secret?: readonly string[];
};

/** A kind of span; its span kind is `internal` unless said. */
export type SpanDeclaration = Common & { readonly signal: "span"; readonly spanKind?: SpanKind };

/** A kind of log event, with its severity. */
export type LogDeclaration = Common & { readonly signal: "log"; readonly severity: SeverityNumber };

/** A kind of counter (monotonic), up-down counter or gauge, with its unit (UCUM, as `ms`, `By`, `{file}`). */
export type InstrumentDeclaration = Common & { readonly signal: "counter" | "updown" | "gauge"; readonly unit: string };

/** A kind of histogram, with its unit and, optionally, its explicit bucket bounds (OpenTelemetry's defaults otherwise). */
export type HistogramDeclaration = Common & { readonly signal: "histogram"; readonly unit: string; readonly bounds?: readonly number[] };

/** The declaration of one kind of signal. */
export type SignalDeclaration = SpanDeclaration | LogDeclaration | InstrumentDeclaration | HistogramDeclaration;

/** What a declaration declares: `span`, `log`, `counter`, `updown`, `gauge` or `histogram`. */
export type SignalType = SignalDeclaration["signal"];

/** The declarations of a registry, by kind name. */
export type Declarations = Readonly<Record<string, SignalDeclaration>>;

/** A registry of signal kinds, made by `defineSignals`. */
export type Registry<R extends Declarations> = { readonly kinds: R };

/** The names of the kinds of a registry's declarations that declare one of the signal types `S`. */
export type KindOf<R extends Declarations, S extends SignalType> = {
  [K in keyof R & string]: R[K]["signal"] extends S ? K : never;
}[keyof R & string];

/** The attributes object a kind asks for. */
export type AttributesOf<R extends Declarations, K extends keyof R> = AttributesFor<R[K]["attributes"]>;

const ATTRIBUTE_TYPES: ReadonlySet<string> = new Set([
  "string",
  "boolean",
  "int",
  "double",
  "bytes",
  "string[]",
  "boolean[]",
  "int[]",
  "double[]",
]);

/**
 * A registry of signal kinds (FR-009). The declarations are checked once here, and a mistake in them is a programming error that throws:
 * an attribute type that does not exist, a secret attribute that is not declared, histogram bounds that do not increase.
 */
export function defineSignals<const R extends Declarations>(kinds: R): Registry<R> {
  for (const [name, d] of Object.entries(kinds)) {
    const declared = new Set(Object.keys(d.attributes).map((k) => k.replace(/\?$/, "")));
    for (const [k, t] of Object.entries(d.attributes)) {
      if (!ATTRIBUTE_TYPES.has(t)) throw new Error(`${name}: the attribute ${k} has the type ${t}, which does not exist`);
    }
    for (const s of d.secret ?? []) if (!declared.has(s)) throw new Error(`${name}: the secret attribute ${s} is not declared`);
    if (d.signal === "histogram" && d.bounds !== undefined) {
      const b = d.bounds;
      if (b.some((x, i) => !Number.isFinite(x) || (i > 0 && x <= (b[i - 1] ?? -Infinity)))) {
        throw new Error(`${name}: the histogram bounds do not increase`);
      }
    }
  }
  return { kinds };
}

/** The presentation role of a kind, by its name (a span's name, a log record's `eventName`, a metric's name); undefined where not declared. */
export function roleOf(registry: Registry<Declarations>, name: string): Role | undefined {
  return Object.hasOwn(registry.kinds, name) ? registry.kinds[name]?.role : undefined;
}

/** The declaration of a kind, by its name; undefined where not declared. */
export function declarationOf(registry: Registry<Declarations>, name: string): SignalDeclaration | undefined {
  return Object.hasOwn(registry.kinds, name) ? registry.kinds[name] : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Context (FR-010, FR-011)
// ---------------------------------------------------------------------------------------------------------------------------------

/** Where the current span's context is kept: a synchronous stack here, `AsyncLocalStorage` in the runtime. */
export interface ContextManager {
  /** The current context, if any. */
  active(): SpanContext | undefined;
  /** Runs `fn` with `context` current, and restores the previous one after it returns or throws. */
  with<T>(context: SpanContext | undefined, fn: () => T): T;
}

/**
 * A context manager on a synchronous stack: correct for synchronous code and up to the first `await` of an asynchronous function. Past it,
 * use the span handle's own `span` and `log`, which name their parent, or the runtime's `AsyncLocalStorage` manager.
 */
export function stackContextManager(): ContextManager {
  let current: SpanContext | undefined;
  return {
    active: () => current,
    with<T>(context: SpanContext | undefined, fn: () => T): T {
      const previous = current;
      current = context;
      try {
        return fn();
      } finally {
        current = previous;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Processors and exporters (FR-012)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The resource and scope a signal came from; one object per telemetry, so a processor may group by it. */
export type Source = { readonly resource: Resource; readonly scope: Scope };

/** A span as it starts: what a renderer needs to show it in progress. */
export type SpanStart = {
  readonly name: string;
  readonly context: SpanContext;
  readonly parentSpanId?: SpanId;
  readonly kind: SpanKind;
  readonly startTime: bigint;
  readonly attributes: Attributes;
};

/** How a flush or a shutdown ended: everything handed on, or the time given ran out. */
export type FlushResult = { readonly kind: "done" } | { readonly kind: "timeout" };

/** What a pipeline hands its signals to, in the order they were made. */
export interface Processor {
  /** A span started. */
  onStart?(span: SpanStart, source: Source): void;
  /** A span in progress recorded an event (`progress` among them). */
  onEvent?(span: SpanStart, event: SpanEvent, source: Source): void;
  /** A span ended. */
  onEnd?(span: SpanData, source: Source): void;
  /** A log record was emitted. */
  onLog?(record: LogRecord, source: Source): void;
  /** Metrics were collected. */
  onMetrics?(metrics: readonly Metric[], source: Source): void;
  /** Hands on everything held, within `timeoutMs`. */
  forceFlush(timeoutMs: number): Promise<FlushResult>;
  /** Hands on everything held and stops, within `timeoutMs`. */
  shutdown(timeoutMs: number): Promise<FlushResult>;
}

/** How an export went. `partial`: the receiver rejected some signals. */
export type ExportResult =
  | { readonly kind: "success" }
  | { readonly kind: "partial"; readonly rejected: number; readonly message: string }
  | { readonly kind: "failure"; readonly message: string };

/** What sends batches somewhere (the runtime's OTLP/HTTP exporter, a test's fake). It may be slow, fail or never answer. */
export interface Exporter {
  /** Sends trace batches. */
  exportTraces(batches: readonly TraceBatch[]): Promise<ExportResult>;
  /** Sends log batches. */
  exportLogs(batches: readonly LogBatch[]): Promise<ExportResult>;
  /** Sends metric batches. */
  exportMetrics(batches: readonly MetricBatch[]): Promise<ExportResult>;
  /** Stops, within `timeoutMs`. */
  shutdown(timeoutMs: number): Promise<void>;
}

/** What a processor did with one signal: spans, log records or metric data points exported, failed, rejected by a partial success, or dropped. */
export type SignalStats = {
  readonly exported: number;
  readonly failed: number;
  readonly rejected: number;
  readonly dropped: number;
  readonly lastError?: string;
};

/** What an exporting processor did, by signal. */
export type ProcessorStats = { readonly [S in SignalName]: SignalStats };

/** A processor that exports, and says what it did. */
export type ExportingProcessor = Processor & { stats(): ProcessorStats };

/** A recorded signal, in the order the memory processor received it. */
export type MemoryEntry =
  | { readonly kind: "start"; readonly span: SpanStart; readonly source: Source }
  | { readonly kind: "event"; readonly span: SpanStart; readonly event: SpanEvent; readonly source: Source }
  | { readonly kind: "end"; readonly span: SpanData; readonly source: Source }
  | { readonly kind: "log"; readonly record: LogRecord; readonly source: Source }
  | { readonly kind: "metrics"; readonly metrics: readonly Metric[]; readonly source: Source };

/** A processor that keeps everything, for tests and the renderer. */
export type MemoryProcessor = Processor & {
  /** Every signal, in order. */
  readonly entries: readonly MemoryEntry[];
  /** The finished spans, in the order they ended. */
  readonly spans: readonly SpanData[];
  /** The log records, in order. */
  readonly logs: readonly LogRecord[];
  /** The metric collections, in order. */
  readonly metrics: readonly (readonly Metric[])[];
  /** Forgets everything kept. */
  clear(): void;
};

/** A processor that keeps every signal it receives (FR-012). */
export function memoryProcessor(): MemoryProcessor {
  const entries: MemoryEntry[] = [];
  const done = (): Promise<FlushResult> => Promise.resolve({ kind: "done" });
  return {
    onStart: (span, source) => void entries.push({ kind: "start", span, source }),
    onEvent: (span, event, source) => void entries.push({ kind: "event", span, event, source }),
    onEnd: (span, source) => void entries.push({ kind: "end", span, source }),
    onLog: (record, source) => void entries.push({ kind: "log", record, source }),
    onMetrics: (metrics, source) => void entries.push({ kind: "metrics", metrics, source }),
    forceFlush: done,
    shutdown: done,
    get entries() {
      return entries;
    },
    get spans() {
      return entries.flatMap((e) => (e.kind === "end" ? [e.span] : []));
    },
    get logs() {
      return entries.flatMap((e) => (e.kind === "log" ? [e.record] : []));
    },
    get metrics() {
      return entries.flatMap((e) => (e.kind === "metrics" ? [e.metrics] : []));
    },
    clear: () => void entries.splice(0),
  };
}

/** A timer, so that a batch processor's schedule can be driven by a test. */
export type Timer = { readonly set: (fn: () => void, ms: number) => unknown; readonly clear: (handle: unknown) => void };

/** The host's timer; a scheduled export never keeps a process alive (`unref` where the host has it). */
export const systemTimer: Timer = {
  set: (fn, ms) => {
    const handle: unknown = setTimeout(fn, ms);
    const unref: unknown = typeof handle === "object" && handle !== null ? Reflect.get(handle, "unref") : undefined;
    if (typeof unref === "function") Reflect.apply(unref, handle, []);
    return handle;
  },
  // The handle is what `setTimeout` gave; its type differs between the DOM and Node.
  clear: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
};

/** A promise's value, or `undefined` once `ms` have passed, whichever comes first; the timer is cleared either way. */
async function within<T>(promise: Promise<T>, ms: number): Promise<{ readonly value: T } | undefined> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    handle = setTimeout(() => resolve(undefined), Math.max(0, ms));
  });
  try {
    return await Promise.race([promise.then((value) => ({ value })), timeout]);
  } finally {
    clearTimeout(handle);
  }
}

function describeThrown(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type MutableStats = { exported: number; failed: number; rejected: number; dropped: number; lastError?: string };

function newStats(): { [S in SignalName]: MutableStats } {
  const one = (): MutableStats => ({ exported: 0, failed: 0, rejected: 0, dropped: 0 });
  return { traces: one(), logs: one(), metrics: one() };
}

function snapshot(stats: { [S in SignalName]: MutableStats }): ProcessorStats {
  return { traces: { ...stats.traces }, logs: { ...stats.logs }, metrics: { ...stats.metrics } };
}

/** The exports of a processor: one at a time, in order, each within its timeout, never throwing, counted. */
function exportQueue(exportTimeoutMs: number) {
  const stats = newStats();
  let tail: Promise<void> = Promise.resolve();
  const send = async (signal: SignalName, count: number, run: () => Promise<ExportResult>): Promise<void> => {
    const s = stats[signal];
    let result: ExportResult;
    try {
      const r = await within(run(), exportTimeoutMs);
      result = r === undefined ? { kind: "failure", message: `the export took more than ${exportTimeoutMs} ms` } : r.value;
    } catch (e) {
      result = { kind: "failure", message: describeThrown(e) };
    }
    switch (result.kind) {
      case "success":
        s.exported += count;
        return;
      case "partial":
        s.exported += count - result.rejected;
        s.rejected += result.rejected;
        s.lastError = result.message;
        return;
      case "failure":
        s.failed += count;
        s.lastError = result.message;
        return;
      default:
        absurd(result);
    }
  };
  return {
    stats,
    /** Sends one export now. */
    send,
    /** Queues an export after those already queued. */
    push(signal: SignalName, count: number, run: () => Promise<ExportResult>): void {
      tail = tail.then(() => send(signal, count, run));
    },
    /** Settles when every export queued so far has. */
    idle: (): Promise<void> => tail,
  };
}

function byTraceBatch(items: readonly { readonly span: SpanData; readonly source: Source }[]): TraceBatch[] {
  const out = new Map<Source, SpanData[]>();
  for (const i of items) out.set(i.source, [...(out.get(i.source) ?? []), i.span]);
  return [...out].map(([source, spans]) => ({ resource: source.resource, scope: source.scope, spans }));
}

function byLogBatch(items: readonly { readonly record: LogRecord; readonly source: Source }[]): LogBatch[] {
  const out = new Map<Source, LogRecord[]>();
  for (const i of items) out.set(i.source, [...(out.get(i.source) ?? []), i.record]);
  return [...out].map(([source, records]) => ({ resource: source.resource, scope: source.scope, records }));
}

async function shutdownWithin(flushed: Promise<FlushResult>, exporter: Exporter, timeoutMs: number): Promise<FlushResult> {
  const started = Date.now();
  const first = await flushed;
  const left = Math.max(0, timeoutMs - (Date.now() - started));
  const stopped = await within(
    exporter.shutdown(left).catch(() => undefined),
    left,
  );
  return first.kind === "done" && stopped !== undefined ? first : { kind: "timeout" };
}

/** A processor that exports each signal as it comes, one export at a time (FR-012). */
export function simpleProcessor(exporter: Exporter, options: { readonly exportTimeoutMs?: number } = {}): ExportingProcessor {
  const queue = exportQueue(options.exportTimeoutMs ?? 30000);
  let stopped = false;
  const flush = async (timeoutMs: number): Promise<FlushResult> =>
    (await within(queue.idle(), timeoutMs)) === undefined ? { kind: "timeout" } : { kind: "done" };
  return {
    onEnd: (span, source) => {
      if (stopped) return void queue.stats.traces.dropped++;
      queue.push("traces", 1, () => exporter.exportTraces([{ resource: source.resource, scope: source.scope, spans: [span] }]));
    },
    onLog: (record, source) => {
      if (stopped) return void queue.stats.logs.dropped++;
      queue.push("logs", 1, () => exporter.exportLogs([{ resource: source.resource, scope: source.scope, records: [record] }]));
    },
    onMetrics: (metrics, source) => {
      const batches: MetricBatch[] = [{ resource: source.resource, scope: source.scope, metrics }];
      if (stopped) return void (queue.stats.metrics.dropped += countSignals(batches));
      queue.push("metrics", countSignals(batches), () => exporter.exportMetrics(batches));
    },
    forceFlush: flush,
    shutdown: (timeoutMs) => {
      stopped = true;
      return shutdownWithin(flush(timeoutMs), exporter, timeoutMs);
    },
    stats: () => snapshot(queue.stats),
  };
}

/** The settings of a batch processor, as `OTEL_BSP_*` and `OTEL_BLRP_*` give them (`BatchConfig` of `./otel.ts`), and its timer. */
export type BatchOptions = {
  readonly maxQueueSize?: number;
  readonly maxExportBatchSize?: number;
  readonly scheduleDelayMs?: number;
  readonly exportTimeoutMs?: number;
  readonly timer?: Timer;
};

/**
 * A processor that queues spans and log records (each at most `maxQueueSize`; what does not fit is dropped and counted, never blocking
 * the caller) and exports them in batches of at most `maxExportBatchSize`: as soon as a full batch is waiting, else `scheduleDelayMs` after
 * the first one queued. Metric collections are exported as they come. Exports run one at a time, each within `exportTimeoutMs`, and a
 * batch leaves its queue only when it is sent (FR-012).
 */
export function batchProcessor(exporter: Exporter, options: BatchOptions = {}): ExportingProcessor {
  const maxQueueSize = Math.max(1, options.maxQueueSize ?? 2048);
  const maxBatch = Math.max(1, Math.min(options.maxExportBatchSize ?? 512, maxQueueSize));
  const delay = options.scheduleDelayMs ?? 5000;
  const timer = options.timer ?? systemTimer;
  const queue = exportQueue(options.exportTimeoutMs ?? 30000);
  const spans: { readonly span: SpanData; readonly source: Source }[] = [];
  const logs: { readonly record: LogRecord; readonly source: Source }[] = [];
  const metrics: MetricBatch[][] = [];
  let scheduled: { readonly handle: unknown } | undefined;
  let pumping: Promise<void> | undefined;
  let all = false;
  let stopped = false;

  // The one worker: it takes a batch from a queue only when it is about to send it, so that a slow exporter fills the queues (and what
  // does not fit is dropped) rather than memory.
  const work = async (): Promise<void> => {
    // First let `pump` keep this promise, so that the end below, which runs with no pause after the last check, clears it.
    await Promise.resolve();
    for (;;) {
      if (spans.length > 0 && (all || spans.length >= maxBatch)) {
        const items = spans.splice(0, maxBatch);
        await queue.send("traces", items.length, () => exporter.exportTraces(byTraceBatch(items)));
      } else if (logs.length > 0 && (all || logs.length >= maxBatch)) {
        const items = logs.splice(0, maxBatch);
        await queue.send("logs", items.length, () => exporter.exportLogs(byLogBatch(items)));
      } else {
        const batches = metrics.shift();
        if (batches === undefined) break;
        await queue.send("metrics", countSignals(batches), () => exporter.exportMetrics(batches));
      }
    }
    all = false;
    pumping = undefined;
    if (spans.length > 0 || logs.length > 0) arm();
  };
  const pump = (): Promise<void> => {
    pumping ??= work();
    return pumping;
  };
  const arm = (): void => {
    if (scheduled !== undefined || stopped) return;
    scheduled = {
      handle: timer.set(() => {
        scheduled = undefined;
        all = true;
        void pump();
      }, delay),
    };
  };
  const disarm = (): void => {
    if (scheduled !== undefined) timer.clear(scheduled.handle);
    scheduled = undefined;
  };
  const enqueue = <T>(items: T[], item: T, stats: MutableStats): void => {
    if (stopped || items.length >= maxQueueSize) {
      stats.dropped++;
      return;
    }
    items.push(item);
    if (items.length >= maxBatch) void pump();
    else arm();
  };
  const flush = async (timeoutMs: number): Promise<FlushResult> => {
    disarm();
    all = true;
    const r = await within(pump(), timeoutMs);
    return r === undefined ? { kind: "timeout" } : { kind: "done" };
  };
  return {
    onEnd: (span, source) => enqueue(spans, { span, source }, queue.stats.traces),
    onLog: (record, source) => enqueue(logs, { record, source }, queue.stats.logs),
    onMetrics: (collected, source) => {
      const batches: MetricBatch[] = [{ resource: source.resource, scope: source.scope, metrics: collected }];
      if (stopped || metrics.length >= maxQueueSize) return void (queue.stats.metrics.dropped += countSignals(batches));
      metrics.push(batches);
      void pump();
    },
    forceFlush: flush,
    shutdown: (timeoutMs) => {
      const flushed = flush(timeoutMs);
      stopped = true;
      disarm();
      return shutdownWithin(flushed, exporter, timeoutMs);
    },
    stats: () => snapshot(queue.stats),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Telemetry (FR-010, FR-011, FR-013)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A link a new span makes to another span's context. */
export type LinkInput = {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly traceFlags: number;
  readonly traceState: TraceState;
  readonly attributes?: Attributes;
};

/** How a span starts: its parent (`null` for a new trace; the current context by default) and its links. */
export type SpanOptions = { readonly parent?: SpanContext | null; readonly links?: readonly LinkInput[] };

/** How one log record is emitted: a severity of its own instead of its kind's (a finding's, say, where one kind has many severities). */
export type LogOptions = { readonly severity?: SeverityNumber };

/** A span in progress, as the function it runs sees it. */
export interface SpanHandle<R extends Declarations, K extends keyof R> {
  /** The span's context. */
  readonly context: SpanContext;
  /** Whether the span is recorded (sampled, and the telemetry not shut down). */
  readonly recording: boolean;
  /** The W3C `traceparent` to give what this span calls (a child process, an HTTP request). */
  readonly traceparent: string;
  /** The W3C `tracestate` to give with it. */
  readonly tracestate: string;
  /** Sets declared attributes of the span. */
  set(attributes: Partial<AttributesOf<R, K>>): void;
  /** Records an event. */
  event(name: string, attributes?: Attributes): void;
  /** Records how far the work has come, as a `progress` event (`progress.done`, `progress.total`). */
  progress(done: number, total?: number): void;
  /** Runs a child span of this one. */
  span<C extends KindOf<R, "span">, T>(
    kind: C,
    attributes: AttributesOf<R, C>,
    fn: (span: SpanHandle<R, C>) => T,
    options?: SpanOptions,
  ): T;
  /** Emits a log record in this span; its severity is the kind's unless `options.severity` gives another. */
  log<L extends KindOf<R, "log">>(kind: L, attributes: AttributesOf<R, L>, body?: AnyValue, options?: LogOptions): void;
}

/** The tracer, logger and meter of one resource and scope, typed by a registry. */
export interface Telemetry<R extends Declarations> {
  /** The registry the kinds come from. */
  readonly registry: Registry<R>;
  /** The resource and scope every signal carries. */
  readonly source: Source;
  /** The current span's context, or the initial parent, if any. */
  active(): SpanContext | undefined;
  /**
   * Runs `fn` in a new span, the child of the current one (FR-010), and returns what it returns. The span ends once: `ok` for an `Ok`
   * result, `error` with the error's description for an `Err`, unset for any other value (a promise is waited for); a function that
   * throws ends it with an `exception` event and `error`, and the exception is thrown on.
   */
  span<K extends KindOf<R, "span">, T>(
    kind: K,
    attributes: AttributesOf<R, K>,
    fn: (span: SpanHandle<R, K>) => T,
    options?: SpanOptions,
  ): T;
  /** Emits a log record of a kind, in the current span; its `eventName` is the kind, its severity the kind's unless `options.severity` gives another. */
  log<K extends KindOf<R, "log">>(kind: K, attributes: AttributesOf<R, K>, body?: AnyValue, options?: LogOptions): void;
  /** Adds to a counter (a negative or non-finite increment is refused) or an up-down counter. */
  add<K extends KindOf<R, "counter" | "updown">>(kind: K, value: number, attributes: AttributesOf<R, K>): Result<void, string>;
  /** Sets a gauge. */
  set<K extends KindOf<R, "gauge">>(kind: K, value: number, attributes: AttributesOf<R, K>): Result<void, string>;
  /** Records a value in a histogram. */
  record<K extends KindOf<R, "histogram">>(kind: K, value: number, attributes: AttributesOf<R, K>): Result<void, string>;
  /** The metrics as they stand, cumulative since each series began (FR-013), also handed to every processor. */
  collect(): readonly Metric[];
  /** Collects the metrics and flushes every processor, within `timeoutMs`. */
  forceFlush(timeoutMs: number): Promise<FlushResult>;
  /** Ends every open span as `error`, collects the metrics and shuts every processor down, within `timeoutMs`; nothing is recorded after. */
  shutdown(timeoutMs: number): Promise<FlushResult>;
}

/** What a telemetry is made from (FR-011): everything that varies is the caller's. */
export type TelemetryOptions<R extends Declarations> = {
  readonly registry: Registry<R>;
  readonly resource: Resource;
  readonly scope: Scope;
  /** Nanoseconds since the Unix epoch. */
  readonly clock: () => bigint;
  /** `n` random bytes. */
  readonly random: (n: number) => Uint8Array;
  readonly processors: readonly Processor[];
  /** A stack by default; the runtime gives `AsyncLocalStorage`. */
  readonly context?: ContextManager;
  /** The parent of a span started with no current span (from `TRACEPARENT`, say). */
  readonly parent?: SpanContext;
  readonly sampler?: Sampler;
  readonly limits?: Limits;
  /** What a processor threw; processors never break the program. */
  readonly onError?: (error: unknown) => void;
};

/** The description of an error for a span's status: a string as it is, an `Error`'s message, an object's `message`, else its JSON. */
export function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
    try {
      return JSON.stringify(error, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    } catch {
      return "an object that cannot be written as JSON";
    }
  }
  return String(error);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null && "then" in value && typeof value.then === "function"
  );
}

function statusOf(value: unknown): SpanStatus {
  if (typeof value !== "object" || value === null || !("kind" in value)) return { kind: "unset" };
  if (value.kind === "ok" && "value" in value) return { kind: "ok" };
  if (value.kind === "err" && "error" in value) return { kind: "error", message: describeError(value.error) };
  return { kind: "unset" };
}

function toInt(v: number | bigint): bigint | undefined {
  if (typeof v === "bigint") return v;
  return Number.isFinite(v) ? BigInt(Math.trunc(v)) : undefined;
}

/** Typed attributes as OpenTelemetry attributes, by the schema: an `int` as a `bigint`; an undeclared or absent attribute left out. */
export function toAttributes(schema: AttributeSchema, attributes: object): Attributes {
  const out: Record<string, AttributeValue> = {};
  const given: Readonly<Record<string, unknown>> = { ...attributes };
  for (const [declared, type] of Object.entries(schema)) {
    const name = declared.replace(/\?$/, "");
    const v = given[name];
    if (v === undefined) continue;
    if (type === "int" && (typeof v === "number" || typeof v === "bigint")) {
      const i = toInt(v);
      if (i !== undefined) out[name] = i;
    } else if (type === "int[]" && Array.isArray(v)) {
      out[name] = v.flatMap((e: unknown) => {
        const i = typeof e === "number" || typeof e === "bigint" ? toInt(e) : undefined;
        return i === undefined ? [] : [i];
      });
    } else if (isAttributeValue(v)) out[name] = v;
  }
  return out;
}

function isAttributeValue(v: unknown): v is AttributeValue {
  if (typeof v === "string" || typeof v === "boolean" || typeof v === "bigint" || typeof v === "number" || v instanceof Uint8Array)
    return true;
  if (!Array.isArray(v)) return false;
  const values: readonly unknown[] = v;
  const first = values[0];
  return values.every((e) => typeof e === typeof first && ["string", "boolean", "bigint", "number"].includes(typeof e));
}

/** A canonical key of attributes, the same for equal sets in any order: one metric series for each (FR-013). */
export function attributesKey(attributes: Attributes): string {
  const enc = (v: AttributeValue): unknown => {
    if (typeof v === "bigint") return `${v}n`;
    if (v instanceof Uint8Array) return `b64:${toBase64(v)}`;
    if (Array.isArray(v)) return (v as readonly (string | boolean | bigint | number)[]).map((e) => (typeof e === "bigint" ? `${e}n` : e));
    return typeof v === "string" ? `s:${v}` : v;
  };
  return JSON.stringify(
    Object.keys(attributes)
      .sort()
      .map((k) => [k, enc(attributes[k] ?? "")]),
  );
}

type Series = {
  readonly attributes: Attributes;
  readonly startTime: bigint;
  time: bigint;
  value: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: number[];
};

type Open = {
  readonly start: SpanStart;
  readonly recording: boolean;
  readonly links: readonly SpanLink[];
  readonly droppedLinks: number;
  readonly secret: readonly string[];
  attributes: Attributes;
  droppedAttributes: number;
  readonly events: SpanEvent[];
  droppedEvents: number;
  ended: boolean;
};

/**
 * The tracer, logger and meter of one resource and scope (FR-010 to FR-013). Every signal is redacted (the kind's secret attributes left
 * out, credentials replaced), limited and handed to each processor in the order it was made. Ids come from `random`, times from `clock`.
 */
export function createTelemetry<const R extends Declarations>(options: TelemetryOptions<R>): Telemetry<R> {
  const { registry, clock, random, processors } = options;
  const source: Source = { resource: options.resource, scope: options.scope };
  const context = options.context ?? stackContextManager();
  const sampler = options.sampler ?? DEFAULT_SAMPLER;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const open = new Set<Open>();
  const series = new Map<string, Map<string, Series>>();
  let stopped = false;

  const each = (f: (p: Processor) => void): void => {
    for (const p of processors) {
      try {
        f(p);
      } catch (e) {
        options.onError?.(e);
      }
    }
  };
  const declaration = (kind: string): SignalDeclaration => {
    const d = declarationOf(registry, kind);
    if (d === undefined) throw new Error(`the signal kind ${kind} is not declared`);
    return d;
  };
  const newTraceId = (): TraceId => {
    const bytes = random(16);
    const r = traceIdFrom(bytes);
    if (r.kind === "ok") return r.value;
    const fixed = Uint8Array.from({ length: 16 }, (_, i) => bytes[i] ?? 0);
    fixed[15] = 1;
    const again = traceIdFrom(fixed);
    if (again.kind === "err") throw new Error(again.error);
    return again.value;
  };
  const newSpanId = (): SpanId => {
    const bytes = random(8);
    const r = spanIdFrom(bytes);
    if (r.kind === "ok") return r.value;
    const fixed = Uint8Array.from({ length: 8 }, (_, i) => bytes[i] ?? 0);
    fixed[7] = 1;
    const again = spanIdFrom(fixed);
    if (again.kind === "err") throw new Error(again.error);
    return again.value;
  };
  const clean = (attributes: Attributes, secret: readonly string[]): { readonly attributes: Attributes; readonly dropped: number } =>
    limitAttributes(redactAttributes(attributes, secret), limits);

  const addEvent = (o: Open, name: string, attributes: Attributes): void => {
    if (o.ended || !o.recording) return;
    if (o.events.length >= limits.eventCount) {
      o.droppedEvents++;
      return;
    }
    const a = clean(attributes, []);
    const event: SpanEvent = { name, time: clock(), attributes: a.attributes, droppedAttributesCount: a.dropped };
    o.events.push(event);
    each((p) => p.onEvent?.(o.start, event, source));
  };

  const end = (o: Open, status: SpanStatus): void => {
    if (o.ended) return;
    o.ended = true;
    open.delete(o);
    if (!o.recording) return;
    const s = o.start;
    const data: SpanData = {
      name: s.name,
      context: s.context,
      ...(s.parentSpanId === undefined ? {} : { parentSpanId: s.parentSpanId }),
      kind: s.kind,
      startTime: s.startTime,
      endTime: clock(),
      attributes: o.attributes,
      events: [...o.events],
      links: o.links,
      status,
      droppedAttributesCount: o.droppedAttributes,
      droppedEventsCount: o.droppedEvents,
      droppedLinksCount: o.droppedLinks,
    };
    each((p) => p.onEnd?.(data, source));
  };

  const fail = (o: Open, thrown: unknown): void => {
    const message = describeError(thrown);
    const type = thrown instanceof Error ? thrown.name : typeof thrown;
    const stack = thrown instanceof Error && thrown.stack !== undefined ? { "exception.stacktrace": thrown.stack } : {};
    addEvent(o, "exception", { "exception.type": type, "exception.message": message, ...stack });
    end(o, { kind: "error", message });
  };

  const startSpan = (
    kind: string,
    attributes: object,
    explicitParent: SpanContext | null | undefined,
    links: readonly LinkInput[],
  ): Open => {
    const d = declaration(kind);
    if (d.signal !== "span") throw new Error(`the signal kind ${kind} is not a span`);
    const parent = explicitParent === null ? undefined : (explicitParent ?? context.active() ?? options.parent);
    const traceId = parent?.traceId ?? newTraceId();
    const sampled = !stopped && shouldSample(sampler, traceId, parent);
    const flags = ((parent?.traceFlags ?? 0) & ~SAMPLED) | (sampled ? SAMPLED : 0);
    const spanContext: SpanContext = {
      traceId,
      spanId: newSpanId(),
      traceFlags: flags,
      traceState: parent?.traceState ?? [],
      isRemote: false,
    };
    const secret = d.secret ?? [];
    const a = clean(toAttributes(d.attributes, attributes), secret);
    const kept = links.slice(0, limits.linkCount).map((l): SpanLink => {
      const la = clean(l.attributes ?? {}, []);
      return { ...l, attributes: la.attributes, droppedAttributesCount: la.dropped };
    });
    const start: SpanStart = {
      name: kind,
      context: spanContext,
      ...(parent === undefined ? {} : { parentSpanId: parent.spanId }),
      kind: d.spanKind ?? "internal",
      startTime: clock(),
      attributes: a.attributes,
    };
    const o: Open = {
      start,
      recording: sampled,
      links: kept,
      droppedLinks: Math.max(0, links.length - limits.linkCount),
      secret,
      attributes: a.attributes,
      droppedAttributes: a.dropped,
      events: [],
      droppedEvents: 0,
      ended: false,
    };
    open.add(o);
    if (sampled) each((p) => p.onStart?.(start, source));
    return o;
  };

  const runSpan = <T>(
    kind: string,
    attributes: object,
    fn: (handle: SpanHandle<R, keyof R>) => T,
    spanOptions: SpanOptions | undefined,
    parent: SpanContext | undefined,
  ): T => {
    const o = startSpan(kind, attributes, spanOptions?.parent === undefined ? parent : spanOptions.parent, spanOptions?.links ?? []);
    const handle = makeHandle(o);
    let out: T;
    try {
      out = context.with(o.start.context, () => fn(handle));
    } catch (e) {
      fail(o, e);
      throw e;
    }
    if (isThenable(out)) {
      const pending = out;
      const settled = (async (): Promise<unknown> => {
        try {
          const value = await pending;
          end(o, statusOf(value));
          return value;
        } catch (e) {
          fail(o, e);
          throw e;
        }
      })();
      // `out` is a promise of T's value, and `settled` settles to that same value: it is the same type.
      return settled as T;
    }
    end(o, statusOf(out));
    return out;
  };

  const emitLog = (
    kind: string,
    attributes: object,
    body: AnyValue | undefined,
    active: SpanContext | undefined,
    logOptions: LogOptions | undefined,
  ): void => {
    const d = declaration(kind);
    if (d.signal !== "log") throw new Error(`the signal kind ${kind} is not a log event`);
    if (stopped) return;
    const a = clean(toAttributes(d.attributes, attributes), d.secret ?? []);
    const severity = logOptions?.severity ?? d.severity;
    const time = clock();
    const record: LogRecord = {
      time,
      observedTime: time,
      severityNumber: severity,
      severityText: severityText(severity),
      ...(body === undefined ? {} : { body: redactAnyValue(body) }),
      attributes: a.attributes,
      droppedAttributesCount: a.dropped,
      eventName: kind,
      ...(active === undefined ? {} : { traceId: active.traceId, spanId: active.spanId, traceFlags: active.traceFlags }),
    };
    each((p) => p.onLog?.(record, source));
  };

  const makeHandle = (o: Open): SpanHandle<R, keyof R> => {
    const d = declaration(o.start.name);
    return {
      context: o.start.context,
      recording: o.recording,
      traceparent: formatTraceparent(o.start.context),
      tracestate: formatTracestate(o.start.context.traceState),
      set: (attributes) => {
        if (o.ended || !o.recording) return;
        const added = redactAttributes(toAttributes(d.attributes, attributes), o.secret);
        const merged = mergeAttributes(o.attributes, added, limits);
        o.attributes = merged.attributes;
        o.droppedAttributes += merged.dropped;
      },
      event: (name, attributes = {}) => addEvent(o, name, attributes),
      progress: (done, total) =>
        addEvent(o, "progress", total === undefined ? { "progress.done": done } : { "progress.done": done, "progress.total": total }),
      span: (kind, attributes, fn, spanOptions) => runSpan(kind, attributes, fn, spanOptions, o.start.context),
      log: (kind, attributes, body, logOptions) => emitLog(kind, attributes, body, o.start.context, logOptions),
    };
  };

  const measure = (
    kind: string,
    allowed: readonly SignalDeclaration["signal"][],
    value: number,
    attributes: object,
  ): Result<void, string> => {
    const d = declaration(kind);
    if (!allowed.includes(d.signal)) return err(`the signal kind ${kind} is a ${d.signal}`);
    if (!Number.isFinite(value)) return err(`${kind}: ${value} is not a finite number`);
    if (d.signal === "counter" && value < 0) return err(`${kind}: a counter does not take a negative increment (${value})`);
    if (stopped) return ok(undefined);
    const a = clean(toAttributes(d.attributes, attributes), d.secret ?? []).attributes;
    const key = attributesKey(a);
    let byKey = series.get(kind);
    if (byKey === undefined) {
      byKey = new Map();
      series.set(kind, byKey);
    }
    const time = clock();
    let s = byKey.get(key);
    if (s === undefined) {
      const bounds = d.signal === "histogram" ? (d.bounds ?? DEFAULT_HISTOGRAM_BOUNDS) : [];
      s = {
        attributes: a,
        startTime: time,
        time,
        value: 0,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        buckets: bounds.map(() => 0).concat(0),
      };
      byKey.set(key, s);
    }
    s.time = time;
    switch (d.signal) {
      case "counter":
      case "updown":
        s.value += value;
        break;
      case "gauge":
        s.value = value;
        break;
      case "histogram": {
        const bounds = d.bounds ?? DEFAULT_HISTOGRAM_BOUNDS;
        const i = bounds.findIndex((b) => value <= b);
        const at = i < 0 ? bounds.length : i;
        s.buckets[at] = (s.buckets[at] ?? 0) + 1;
        s.count++;
        s.sum += value;
        s.min = Math.min(s.min, value);
        s.max = Math.max(s.max, value);
        break;
      }
      case "span":
      case "log":
        break;
      default:
        absurd(d);
    }
    return ok(undefined);
  };

  const collect = (): readonly Metric[] => {
    const time = clock();
    const metrics: Metric[] = [];
    for (const [kind, byKey] of series) {
      const d = declaration(kind);
      const all = [...byKey.values()];
      const description = d.description ?? "";
      const numberPoints = (): NumberPoint[] =>
        all.map((s) => ({ attributes: s.attributes, startTime: s.startTime, time, value: s.value }));
      switch (d.signal) {
        case "counter":
        case "updown":
          metrics.push({
            name: kind,
            description,
            unit: d.unit,
            data: { kind: "sum", temporality: "cumulative", monotonic: d.signal === "counter", points: numberPoints() },
          });
          break;
        case "gauge":
          metrics.push({ name: kind, description, unit: d.unit, data: { kind: "gauge", points: numberPoints() } });
          break;
        case "histogram": {
          const bounds = d.bounds ?? DEFAULT_HISTOGRAM_BOUNDS;
          const points = all.map((s): HistogramPoint => ({
            attributes: s.attributes,
            startTime: s.startTime,
            time,
            count: s.count,
            sum: s.sum,
            ...(s.count > 0 ? { min: s.min, max: s.max } : {}),
            bounds,
            bucketCounts: [...s.buckets],
          }));
          metrics.push({ name: kind, description, unit: d.unit, data: { kind: "histogram", temporality: "cumulative", points } });
          break;
        }
        case "span":
        case "log":
          break;
        default:
          absurd(d);
      }
    }
    if (metrics.length > 0) each((p) => p.onMetrics?.(metrics, source));
    return metrics;
  };

  const all = async (run: (p: Processor) => Promise<FlushResult>, timeoutMs: number): Promise<FlushResult> => {
    const settled = processors.map((p) =>
      run(p).catch((e: unknown): FlushResult => {
        options.onError?.(e);
        return { kind: "done" };
      }),
    );
    const r = await within(Promise.all(settled), timeoutMs);
    return r !== undefined && r.value.every((x) => x.kind === "done") ? { kind: "done" } : { kind: "timeout" };
  };

  return {
    registry,
    source,
    active: () => context.active() ?? options.parent,
    span: (kind, attributes, fn, spanOptions) => runSpan(kind, attributes, fn, spanOptions, undefined),
    log: (kind, attributes, body, logOptions) => emitLog(kind, attributes, body, context.active() ?? options.parent, logOptions),
    add: (kind, value, attributes) => measure(kind, ["counter", "updown"], value, attributes),
    set: (kind, value, attributes) => measure(kind, ["gauge"], value, attributes),
    record: (kind, value, attributes) => measure(kind, ["histogram"], value, attributes),
    collect,
    forceFlush: (timeoutMs) => {
      if (!stopped) collect();
      return all((p) => p.forceFlush(timeoutMs), timeoutMs);
    },
    shutdown: (timeoutMs) => {
      if (!stopped) {
        for (const o of [...open]) end(o, { kind: "error", message: "the span was still open at shutdown" });
        collect();
        stopped = true;
      }
      return all((p) => p.shutdown(timeoutMs), timeoutMs);
    },
  };
}
