// Spec: 0001-telemetry FR-014
/**
 * OpenTelemetry on the host (commons 0001-telemetry FR-014 to FR-019): the OTLP/HTTP JSON exporter over `fetch` (headers, timeout, retries on
 * 429, 502, 503 and 504 after `Retry-After` or a growing wait, partial success counted, never throwing, a failure said once), the probe of
 * `http://localhost:4318` where no endpoint is configured, the journal (every export request also one line of OTLP JSON in a rotated
 * file), the current span carried across `await` by `AsyncLocalStorage` and the parent read from `TRACEPARENT` and `TRACESTATE`, the
 * pipeline a process installs (`startTelemetry`), the runtime's own signals (`process`, `http.client`, `http.server`) that `proc`, the HTTP
 * client and `serve` make through the hooks below (no-ops while nothing is installed), and an OTLP/HTTP JSON receiver over `serve`.
 *
 * This module imports only `node:` builtins and the kernel, so that `proc.ts`, `http-client.ts` and `serve.ts` can import its hooks.
 *
 * @example
 * ```ts
 * import { defineSignals } from "@intellectual-frontiers/telemetry/signals";
 * import { ok } from "@intellectual-frontiers/core";
 * import { startTelemetry } from "./otel.ts";
 * const registry = defineSignals({ "build.step": { signal: "span", role: "step", attributes: { target: "string" } } });
 * const run = startTelemetry({ registry, service: "build" }); // OTEL_* from the environment; installed for proc, the client and serve
 * await run.telemetry.span("build.step", { target: "site" }, async () => ok(undefined));
 * await run.pipeline.shutdown(); // at most one second
 * const warning = run.pipeline.warning(); // what to say, once and dimmed, at the end of the run (FR-024)
 * ```
 *
 * @module
 */
import { AsyncLocalStorage } from "node:async_hooks";
import * as nfs from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { absurd, formatDecodeError, err, ok, type Result } from "@intellectual-frontiers/core";
import { retryAfterMs } from "@intellectual-frontiers/formats/http";
import { newLimiter, take as takeAllowance, type SourceLimits } from "@intellectual-frontiers/telemetry/limits";
import { accept as acceptBatch, type EnvelopeSigner, openEnvelope, type SeenLedger, TELEMETRY_PAYLOAD_TYPE } from "@intellectual-frontiers/telemetry/envelope";
import {
  type AttributeValue,
  commandShape,
  DEFAULT_OTLP_ENDPOINT,
  extractContext,
  type Limits,
  type OtelConfig,
  redactText,
  redactUrl,
  type Resource,
  resolveConfig,
  type Sampler,
  type Scope,
  SEVERITY,
  type SignalName,
  signalEndpoint,
  type LogRecord,
  type SpanContext,
  type SpanData,
} from "@intellectual-frontiers/telemetry/otel";
import {
  decodeLogs,
  decodeMetrics,
  decodeResponse,
  decodeTraces,
  encodeLogs,
  encodeMetrics,
  encodeResponse,
  encodeTraces,
  type ExportResponse,
  type LogBatch,
  type MetricBatch,
  type TraceBatch,
} from "@intellectual-frontiers/telemetry/otlp";
import {
  batchProcessor,
  type BatchOptions,
  type ContextManager,
  createTelemetry,
  type Declarations,
  defineSignals,
  type ExportingProcessor,
  type Exporter,
  type ExportResult,
  type FlushResult,
  type Processor,
  type ProcessorStats,
  type Registry,
  type SignalStats,
  type Source,
  type Telemetry,
} from "@intellectual-frontiers/telemetry/signals";
import { setProcessTracer } from "@intellectual-frontiers/system/proc";

/** The longest a probe of the default endpoint waits for an answer (FR-015). */
export const PROBE_TIMEOUT_MS = 150;

/** The longest the runtime waits at exit for what is left to be sent (FR-015). */
export const EXIT_WAIT_MS = 1000;

/** The statuses an export is retried on (FR-014). */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

// ---------------------------------------------------------------------------------------------------------------------------------
// Time, randomness, context (FR-011, FR-017)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A clock of nanoseconds since the Unix epoch, from `performance.timeOrigin` and `performance.now()`: monotonic within the process. */
export function systemClock(): () => bigint {
  const origin = BigInt(Math.round(performance.timeOrigin * 1000)) * 1000n;
  return () => origin + BigInt(Math.round(performance.now() * 1e6));
}

/** `n` random bytes from Web Crypto. */
export function systemRandom(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** A context manager on `AsyncLocalStorage` (FR-017): the current span is carried across `await`, timers and callbacks. */
export function asyncContextManager(): ContextManager {
  const storage = new AsyncLocalStorage<SpanContext | undefined>();
  return {
    active: () => storage.getStore(),
    with<T>(context: SpanContext | undefined, fn: () => T): T {
      return storage.run(context, fn);
    },
  };
}

/** The parent a process takes from its environment's `TRACEPARENT` and `TRACESTATE` (FR-017); undefined where there is no valid one. */
export function environmentParent(env: Readonly<Record<string, string | undefined>> = process.env): SpanContext | undefined {
  return extractContext(env["TRACEPARENT"], env["TRACESTATE"]);
}

function runtimeName(): string {
  const v: Readonly<Record<string, string | undefined>> = process.versions;
  return v["bun"] !== undefined ? "bun" : "node";
}

const OS_TYPES: Readonly<Record<string, string>> = { win32: "windows", sunos: "solaris" };
const HOST_ARCHES: Readonly<Record<string, string>> = { x64: "amd64", ia32: "x86", arm: "arm32", ppc64: "ppc64", s390x: "s390x" };

/**
 * The attributes of the process that describe where it runs, by the semantic conventions: `process.runtime.name` and `.version`,
 * `os.type` and `host.arch`. Never a host's or a person's name.
 */
export function processAttributes(): Readonly<Record<string, AttributeValue>> {
  const name = runtimeName();
  const v: Readonly<Record<string, string | undefined>> = process.versions;
  return {
    "process.runtime.name": name,
    "process.runtime.version": v[name] ?? process.version.replace(/^v/, ""),
    "os.type": OS_TYPES[process.platform] ?? process.platform,
    "host.arch": HOST_ARCHES[process.arch] ?? process.arch,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The OTLP/HTTP JSON exporter (FR-014, FR-015)
// ---------------------------------------------------------------------------------------------------------------------------------

/** How the OTLP exporter sends. Everything here is for a test or a special host; the defaults are the specification's. */
export type OtlpExporterOptions = {
  /** The `fetch` to use (the platform's by default). */
  readonly fetch?: typeof fetch;
  /** Told once, the first time an export fails or no collector answers (FR-014, FR-024). */
  readonly onWarning?: (message: string) => void;
  /** The base endpoint probed where a signal has none configured (`http://localhost:4318`). */
  readonly defaultEndpoint?: string;
  /** How long the probe waits (150 ms). */
  readonly probeTimeoutMs?: number;
  /** The first wait before a retry with no `Retry-After`; each next one doubles (100 ms). */
  readonly retryBaseMs?: number;
  /** How a wait is spent (a timer by default); it rejects when `signal` aborts. */
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

/** The OTLP exporter: an `Exporter`, and the warning it gave, if any. */
export type OtlpExporter = Exporter & {
  /** The warning said, once, if an export failed or no collector answered. */
  readonly warning: () => string | undefined;
};

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("the exporter is shut down"));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(t);
      reject(new Error("the exporter is shut down"));
    };
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function describeThrown(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause instanceof Error ? `: ${e.cause.message}` : "";
  return redactText(`${e.message}${cause}`);
}

/**
 * The OTLP/HTTP JSON exporter over `fetch` (FR-014): each export is a `POST` of the request as JSON to the signal's endpoint, with
 * `content-type: application/json` and the configured headers, within the signal's timeout; 429, 502, 503 and 504 are retried after the
 * server's `Retry-After` or a doubling wait, as long as the wait ends within the timeout; a partial success is read and returned. An
 * export never throws. Where a signal has no endpoint configured, the default is probed for at most 150 ms before the first export, and
 * nothing is sent where nothing answers (FR-015). The first failure is told to `onWarning`, once. `shutdown` waits for the exports in
 * flight within its time, then aborts them, so nothing keeps the process alive.
 */
export function otlpExporter(exporters: OtelConfig["exporters"], options: OtlpExporterOptions = {}): OtlpExporter {
  const fetcher = options.fetch ?? fetch;
  const base = options.defaultEndpoint ?? DEFAULT_OTLP_ENDPOINT;
  const probeTimeout = options.probeTimeoutMs ?? PROBE_TIMEOUT_MS;
  const retryBase = options.retryBaseMs ?? 100;
  const sleep = options.sleep ?? abortableSleep;
  const stop = new AbortController();
  const inflight = new Set<Promise<ExportResult>>();
  let warned: string | undefined;
  let probed: Promise<boolean> | undefined;

  const warn = (message: string): void => {
    if (warned !== undefined) return;
    warned = message;
    try {
      options.onWarning?.(message);
    } catch {
      /* a listener never breaks an export */
    }
  };
  const failure = (message: string): ExportResult => {
    warn(`OpenTelemetry signals were not exported: ${message}`);
    return { kind: "failure", message };
  };

  // Any HTTP answer counts: an OTLP receiver answers an empty export request with 200, anything else with some status.
  const probe = (): Promise<boolean> => {
    probed ??= (async () => {
      try {
        const res = await fetcher(signalEndpoint(base, "traces"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          signal: AbortSignal.any([AbortSignal.timeout(probeTimeout), stop.signal]),
        });
        await res.body?.cancel().catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    })();
    return probed;
  };

  const endpointOf = async (signal: SignalName): Promise<Result<string, string>> => {
    const configured = exporters[signal].endpoint;
    if (configured !== undefined) return ok(configured);
    if (await probe()) return ok(signalEndpoint(base, signal));
    return err(`no OpenTelemetry collector answered at ${redactUrl(base)} within ${probeTimeout} ms`);
  };

  const post = async (signal: SignalName, body: string): Promise<ExportResult> => {
    const config = exporters[signal];
    if (!config.enabled) return { kind: "success" };
    if (stop.signal.aborted) return failure("the exporter is shut down");
    const endpoint = await endpointOf(signal);
    if (endpoint.kind === "err") {
      warn(`${endpoint.error}; signals were not exported`);
      return { kind: "failure", message: endpoint.error };
    }
    const url = endpoint.value;
    const shown = redactUrl(url);
    const deadline = Date.now() + config.timeoutMs;
    for (let attempt = 0; ; attempt++) {
      const left = deadline - Date.now();
      if (left <= 0) return failure(`${shown} did not answer within ${config.timeoutMs} ms`);
      let res: Response;
      try {
        res = await fetcher(url, {
          method: "POST",
          headers: { ...config.headers, "content-type": "application/json" },
          body,
          signal: AbortSignal.any([AbortSignal.timeout(left), stop.signal]),
        });
      } catch (e) {
        if (stop.signal.aborted) return failure(`the export to ${shown} was given up at exit`);
        return failure(`${shown}: ${describeThrown(e)}`);
      }
      if (res.ok) {
        const text = await res.text().catch(() => "");
        if (text.trim() === "") return { kind: "success" };
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return { kind: "success" };
        }
        const decoded = decodeResponse(signal, parsed);
        if (decoded.kind === "err" || decoded.value.rejected === 0) return { kind: "success" };
        return { kind: "partial", rejected: decoded.value.rejected, message: decoded.value.errorMessage };
      }
      await res.body?.cancel().catch(() => undefined);
      if (!RETRYABLE_STATUSES.has(res.status)) return failure(`${shown}: HTTP ${res.status}`);
      const wait = retryAfterMs(res.headers.get("retry-after"), Date.now()) ?? retryBase * 2 ** attempt;
      if (Date.now() + wait >= deadline) return failure(`${shown}: HTTP ${res.status}, and no time is left to retry`);
      try {
        await sleep(wait, stop.signal);
      } catch {
        return failure(`the export to ${shown} was given up at exit`);
      }
    }
  };

  const send = (signal: SignalName, body: () => string): Promise<ExportResult> => {
    const p = (async (): Promise<ExportResult> => {
      try {
        return await post(signal, body());
      } catch (e) {
        return failure(describeThrown(e));
      }
    })();
    inflight.add(p);
    void p.finally(() => inflight.delete(p));
    return p;
  };

  return {
    exportTraces: (batches: readonly TraceBatch[]) => send("traces", () => JSON.stringify(encodeTraces(batches))),
    exportLogs: (batches: readonly LogBatch[]) => send("logs", () => JSON.stringify(encodeLogs(batches))),
    exportMetrics: (batches: readonly MetricBatch[]) => send("metrics", () => JSON.stringify(encodeMetrics(batches))),
    async shutdown(timeoutMs: number): Promise<void> {
      if (inflight.size > 0) {
        let handle: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          Promise.allSettled([...inflight]),
          new Promise<void>((resolve) => {
            handle = setTimeout(resolve, Math.max(0, timeoutMs));
          }),
        ]);
        clearTimeout(handle);
      }
      stop.abort();
    },
    warning: () => warned,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The journal (FR-016)
// ---------------------------------------------------------------------------------------------------------------------------------

/** Where and how a journal is kept. */
export type JournalOptions = {
  /** The file; the older ones are `<path>.1` (the newest) to `<path>.<keep>`. */
  readonly path: string;
  /** The size past which the file is rotated before the next line (10 MiB by default). */
  readonly maxBytes?: number;
  /** How many older files are kept (3 by default; 0 keeps none). */
  readonly keep?: number;
  /** Where given, a journal file last written more than this many days ago is removed when the journal starts and at each rotation. */
  readonly maxAgeDays?: number;
  /** The clock that ages files, in milliseconds since the epoch (`Date.now` by default; a test gives its own). */
  readonly now?: () => number;
};

function sizeOf(path: string): number {
  try {
    return nfs.statSync(path).size;
  } catch {
    return 0;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Each journal file (the current one and `<path>.1` to `<path>.<keep>`) last written before `oldest` removed. */
function removeAged(path: string, keep: number, oldest: number): void {
  for (const file of [path, ...Array.from({ length: keep }, (_, i) => `${path}.${i + 1}`)]) {
    try {
      if (nfs.statSync(file).mtimeMs < oldest) nfs.rmSync(file, { force: true });
    } catch {
      // not there: nothing to remove
    }
  }
}

function rotate(path: string, keep: number): void {
  if (keep <= 0) {
    nfs.rmSync(path, { force: true });
    return;
  }
  nfs.rmSync(`${path}.${keep}`, { force: true });
  for (let i = keep - 1; i >= 1; i--) if (nfs.existsSync(`${path}.${i}`)) nfs.renameSync(`${path}.${i}`, `${path}.${i + 1}`);
  nfs.renameSync(path, `${path}.1`);
}

/**
 * An exporter that writes each export request as one line of OTLP JSON to a file (FR-016), appended synchronously so that what a run made
 * is kept even where it ends abruptly. Before a line is written to a file that already holds `maxBytes` or more, the file is rotated:
 * `<path>.<keep>` removed, each `<path>.<i>` renamed `<path>.<i+1>`, and the file renamed `<path>.1`. Where `maxAgeDays` is given, a
 * journal file last written longer ago than that is removed before the first line and after each rotation. A write that fails is a
 * failure result, never a throw.
 */
export function journalExporter(options: JournalOptions): Exporter {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const keep = Math.max(0, Math.floor(options.keep ?? 3));
  let stopped = false;
  let ready = false;
  const write = (line: () => string): Promise<ExportResult> => {
    if (stopped) return Promise.resolve({ kind: "failure", message: "the journal is closed" });
    try {
      const age = (): void => {
        if (options.maxAgeDays !== undefined) removeAged(options.path, keep, (options.now ?? Date.now)() - options.maxAgeDays * DAY_MS);
      };
      if (!ready) {
        nfs.mkdirSync(dirname(options.path), { recursive: true });
        age();
        ready = true;
      }
      if (sizeOf(options.path) >= maxBytes) {
        rotate(options.path, keep);
        age();
      }
      nfs.appendFileSync(options.path, `${line()}\n`);
      return Promise.resolve({ kind: "success" });
    } catch (e) {
      return Promise.resolve({ kind: "failure", message: `the journal ${options.path} could not be written: ${describeThrown(e)}` });
    }
  };
  return {
    exportTraces: (batches) => write(() => JSON.stringify(encodeTraces(batches))),
    exportLogs: (batches) => write(() => JSON.stringify(encodeLogs(batches))),
    exportMetrics: (batches) => write(() => JSON.stringify(encodeMetrics(batches))),
    shutdown: () => {
      stopped = true;
      return Promise.resolve();
    },
  };
}

/** A batch processor that keeps a journal (FR-016): spans and log records batched as `options` says, metric collections as they come. */
export function journalProcessor(options: JournalOptions & BatchOptions): ExportingProcessor {
  return batchProcessor(journalExporter(options), options);
}

/** A processor that hands on only the signals named: the others never reach `processor`. */
export function onlySignals(processor: ExportingProcessor, signals: Iterable<SignalName>): ExportingProcessor {
  const s = new Set(signals);
  return {
    ...(s.has("traces") ? { onEnd: (span, source) => processor.onEnd?.(span, source) } : {}),
    ...(s.has("logs") ? { onLog: (record, source) => processor.onLog?.(record, source) } : {}),
    ...(s.has("metrics") ? { onMetrics: (metrics, source) => processor.onMetrics?.(metrics, source) } : {}),
    forceFlush: (timeoutMs) => processor.forceFlush(timeoutMs),
    shutdown: (timeoutMs) => processor.shutdown(timeoutMs),
    stats: () => processor.stats(),
  } satisfies ExportingProcessor;
}

/**
 * An exporter shared by `users` processors: its `shutdown` stops the exporter only when the last of them shuts it down, so that one
 * processor's shutdown never aborts another's exports in flight.
 */
export function shareExporter(exporter: Exporter, users: number): Exporter {
  let left = Math.max(1, users);
  return {
    exportTraces: (batches) => exporter.exportTraces(batches),
    exportLogs: (batches) => exporter.exportLogs(batches),
    exportMetrics: (batches) => exporter.exportMetrics(batches),
    shutdown: (timeoutMs) => (--left <= 0 ? exporter.shutdown(timeoutMs) : Promise.resolve()),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The pipeline a process installs
// ---------------------------------------------------------------------------------------------------------------------------------

/** The signals the runtime itself makes (FR-018), and the warning that signals were not sent (FR-014). */
export const RUNTIME_SIGNALS = defineSignals({
  process: {
    signal: "span",
    spanKind: "client",
    role: "detail",
    description: "A program run by proc: its name and option names alone (FR-006), and its exit status.",
    attributes: { "process.executable.name": "string", "process.command_args": "string[]", "process.exit.code?": "int" },
  },
  "http.client": {
    signal: "span",
    spanKind: "client",
    role: "detail",
    description: "A request made by the HTTP client; the URL redacted (FR-006).",
    attributes: {
      "http.request.method": "string",
      "url.full": "string",
      "server.address": "string",
      "server.port?": "int",
      "http.response.status_code?": "int",
      "error.type?": "string",
    },
  },
  "http.server": {
    signal: "span",
    spanKind: "server",
    role: "detail",
    description: "A request answered by serve; its parent is the request's traceparent.",
    attributes: {
      "http.request.method": "string",
      "url.path": "string",
      "url.scheme": "string",
      "server.address?": "string",
      "server.port?": "int",
      "http.response.status_code?": "int",
    },
  },
  "otel.warning": {
    signal: "log",
    severity: SEVERITY.WARN,
    // The console says this once, at the end of the run (FR-024), from `Pipeline.warning()`, not as it happens.
    role: "none",
    description: "Signals were not sent: an export failed, no collector answered, or the wait at exit ran out.",
    attributes: {},
  },
});

/** The kinds of the runtime's own registry. */
export type RuntimeKinds = (typeof RUNTIME_SIGNALS)["kinds"];

/** The scope of the runtime's own signals. */
export const RUNTIME_SCOPE: Scope = { name: "ifc-ts/runtime" };

/** What a pipeline is made from. Everything but the resource has a default for a real process. */
export type PipelineOptions = {
  readonly resource: Resource;
  /** The processors every signal goes to; more may be added with `addProcessor`. */
  readonly processors?: readonly Processor[];
  /** `AsyncLocalStorage` by default (FR-017). */
  readonly context?: ContextManager;
  /** The parent of a span started with no current one (`environmentParent()` in `startTelemetry`). */
  readonly parent?: SpanContext;
  readonly clock?: () => bigint;
  readonly random?: (n: number) => Uint8Array;
  readonly sampler?: Sampler;
  readonly limits?: Limits;
  /** How often the metrics are collected and handed on (never where 0 or absent). */
  readonly metricIntervalMs?: number;
  /** Told once, with the first warning. */
  readonly onWarning?: (message: string) => void;
  /** What a processor threw. */
  readonly onError?: (error: unknown) => void;
};

/** A finished span or a log record handed to a pipeline whole. */
export type PipelineItem = { readonly kind: "span"; readonly span: SpanData } | { readonly kind: "log"; readonly record: LogRecord };

/** The signals of a process: one resource, one context, the processors, and the telemetries made on them. */
export interface Pipeline {
  /** The resource every signal carries. */
  readonly resource: Resource;
  /** The context manager every telemetry of the pipeline shares. */
  readonly context: ContextManager;
  /** The parent of a span started with no current one. */
  readonly parent: SpanContext | undefined;
  /** A telemetry of a registry and scope on this pipeline: its signals go to every processor of the pipeline. */
  telemetry<const R extends Declarations>(registry: Registry<R>, scope: Scope): Telemetry<R>;
  /** Adds a processor (a console's renderer, a memory processor); returns what removes it. */
  addProcessor(processor: Processor): () => void;
  /**
   * Hands a span or a log record made elsewhere, with its own ids and times (a test's, commons 0008-test-evidence FR-004), to every
   * processor as a telemetry hands its own (`onEnd`, `onLog`), with the resource and scope it came from; nothing once shut down.
   */
  emit(item: PipelineItem, source: Source): void;
  /** Says a warning; only the first of a run is kept, told to the listeners and recorded as an `otel.warning` log record. */
  warn(message: string): void;
  /** The warning of the run, if any: what the console says once, dimmed, at the end (FR-024). */
  warning(): string | undefined;
  /** Calls `listener` with the warning when it is said (at once, if it already has been); returns what removes it. */
  onWarning(listener: (message: string) => void): () => void;
  /** What the exporting processors did, by signal, summed. */
  stats(): ProcessorStats;
  /** Collects the metrics and flushes every processor, within `timeoutMs`. */
  forceFlush(timeoutMs?: number): Promise<FlushResult>;
  /**
   * Ends what is open, collects the metrics, and shuts every processor down within `timeoutMs` (at most one second by default, FR-015);
   * where that time runs out, gives up and says so as the run's warning. Uninstalls the pipeline where it is installed.
   */
  shutdown(timeoutMs?: number): Promise<FlushResult>;
}

type Stoppable = { forceFlush(timeoutMs: number): Promise<FlushResult>; shutdown(timeoutMs: number): Promise<FlushResult> };

async function within<T>(promise: Promise<T>, ms: number): Promise<{ readonly value: T } | undefined> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value) => ({ value })),
      new Promise<undefined>((resolve) => {
        handle = setTimeout(() => resolve(undefined), Math.max(0, ms));
      }),
    ]);
  } finally {
    clearTimeout(handle);
  }
}

function hasStats(p: Processor): p is ExportingProcessor {
  return "stats" in p && typeof p.stats === "function";
}

function sumStats(all: readonly ProcessorStats[]): ProcessorStats {
  const sum = (s: SignalName): SignalStats => {
    let exported = 0;
    let failed = 0;
    let rejected = 0;
    let dropped = 0;
    let lastError: string | undefined;
    for (const p of all) {
      exported += p[s].exported;
      failed += p[s].failed;
      rejected += p[s].rejected;
      dropped += p[s].dropped;
      lastError = p[s].lastError ?? lastError;
    }
    return { exported, failed, rejected, dropped, ...(lastError === undefined ? {} : { lastError }) };
  };
  return { traces: sum("traces"), logs: sum("logs"), metrics: sum("metrics") };
}

/** The pipeline installed for this process, and the runtime's telemetry on it. */
let current: { readonly pipeline: Pipeline; readonly runtime: Telemetry<RuntimeKinds> } | undefined;

/**
 * A pipeline (FR-012, FR-017): the processors every signal goes to, one `AsyncLocalStorage` context, one clock and source of random
 * bytes, and the telemetries made on it. It is not installed; `install` makes it the process's.
 */
export function createPipeline(options: PipelineOptions): Pipeline {
  const processors: Processor[] = [...(options.processors ?? [])];
  const context = options.context ?? asyncContextManager();
  const clock = options.clock ?? systemClock();
  const random = options.random ?? systemRandom;
  const telemetries: Stoppable[] = [];
  const listeners = new Set<(message: string) => void>();
  let warned: string | undefined;
  let runtime: Telemetry<RuntimeKinds> | undefined;
  let stopped = false;

  // Every telemetry hands its signals to this one processor, which hands them to the pipeline's processors as they are now; flushing
  // and shutting down are the pipeline's, once for every telemetry.
  const fanout: Processor = {
    onStart: (span, source) => processors.forEach((p) => p.onStart?.(span, source)),
    onEvent: (span, event, source) => processors.forEach((p) => p.onEvent?.(span, event, source)),
    onEnd: (span, source) => processors.forEach((p) => p.onEnd?.(span, source)),
    onLog: (record, source) => processors.forEach((p) => p.onLog?.(record, source)),
    onMetrics: (metrics, source) => processors.forEach((p) => p.onMetrics?.(metrics, source)),
    forceFlush: () => Promise.resolve({ kind: "done" }),
    shutdown: () => Promise.resolve({ kind: "done" }),
  };

  const interval =
    options.metricIntervalMs !== undefined && options.metricIntervalMs > 0
      ? setInterval(() => {
          for (const t of telemetries) void t.forceFlush(0);
        }, options.metricIntervalMs)
      : undefined;
  if (interval !== undefined && typeof interval === "object" && "unref" in interval) interval.unref();

  const settle = async (run: (p: Processor) => Promise<FlushResult>, timeoutMs: number): Promise<FlushResult> => {
    const settled = processors.map((p) =>
      run(p).catch((e: unknown): FlushResult => {
        options.onError?.(e);
        return { kind: "done" };
      }),
    );
    const r = await within(Promise.all(settled), timeoutMs);
    return r !== undefined && r.value.every((x) => x.kind === "done") ? { kind: "done" } : { kind: "timeout" };
  };

  const pipeline: Pipeline = {
    resource: options.resource,
    context,
    parent: options.parent,
    telemetry<const R extends Declarations>(registry: Registry<R>, scope: Scope): Telemetry<R> {
      const t = createTelemetry({
        registry,
        resource: options.resource,
        scope,
        clock,
        random,
        processors: [fanout],
        context,
        ...(options.parent === undefined ? {} : { parent: options.parent }),
        ...(options.sampler === undefined ? {} : { sampler: options.sampler }),
        ...(options.limits === undefined ? {} : { limits: options.limits }),
        ...(options.onError === undefined ? {} : { onError: options.onError }),
      });
      telemetries.push(t);
      return t;
    },
    addProcessor(processor) {
      processors.push(processor);
      return () => {
        const i = processors.indexOf(processor);
        if (i >= 0) processors.splice(i, 1);
      };
    },
    emit(item, source) {
      if (stopped) return;
      for (const p of [...processors]) {
        try {
          switch (item.kind) {
            case "span":
              p.onEnd?.(item.span, source);
              break;
            case "log":
              p.onLog?.(item.record, source);
              break;
            default:
              absurd(item);
          }
        } catch (e) {
          options.onError?.(e);
        }
      }
    },
    warn(message) {
      if (warned !== undefined) return;
      warned = message;
      for (const l of [...listeners, ...(options.onWarning === undefined ? [] : [options.onWarning])]) {
        try {
          l(message);
        } catch (e) {
          options.onError?.(e);
        }
      }
      if (!stopped) {
        runtime ??= pipeline.telemetry(RUNTIME_SIGNALS, RUNTIME_SCOPE);
        runtime.log("otel.warning", {}, message);
      }
    },
    warning: () => warned,
    onWarning(listener) {
      if (warned !== undefined) listener(warned);
      else listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    stats: () => sumStats(processors.filter(hasStats).map((p) => p.stats())),
    async forceFlush(timeoutMs = EXIT_WAIT_MS) {
      const started = Date.now();
      await Promise.all(telemetries.map((t) => t.forceFlush(0)));
      return settle((p) => p.forceFlush(Math.max(0, timeoutMs - (Date.now() - started))), Math.max(0, timeoutMs - (Date.now() - started)));
    },
    async shutdown(timeoutMs = EXIT_WAIT_MS) {
      if (current?.pipeline === pipeline) current = undefined;
      if (interval !== undefined) clearInterval(interval);
      const started = Date.now();
      // Every telemetry ends its open spans and hands on its last metrics; its processor is the fan-out, which settles at once.
      await Promise.all(telemetries.map((t) => t.shutdown(0)));
      stopped = true;
      const left = (): number => Math.max(0, timeoutMs - (Date.now() - started));
      const r = await settle((p) => p.shutdown(left()), left());
      if (r.kind === "timeout") pipeline.warn(`not every signal was sent within ${timeoutMs} ms at exit; the rest were given up`);
      return r;
    },
  };
  return pipeline;
}

/** Makes `pipeline` the process's: the runtime's own signals (FR-018) go to it from now on. It replaces any installed before. */
export function install(pipeline: Pipeline): void {
  current = { pipeline, runtime: pipeline.telemetry(RUNTIME_SIGNALS, RUNTIME_SCOPE) };
}

/** Uninstalls the process's pipeline, if any; the runtime's hooks are no-ops again. */
export function uninstall(): void {
  current = undefined;
}

/** The pipeline installed for this process, if any. */
export function installed(): Pipeline | undefined {
  return current?.pipeline;
}

/** How `startTelemetry` starts. */
export type StartOptions<R extends Declarations> = {
  /** The harness's own signals. */
  readonly registry: Registry<R>;
  /** The harness's name: `service.name` where `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` do not say it, and the scope's name. */
  readonly service?: string;
  /** The harness's version, for its scope. */
  readonly version?: string;
  /** The `OTEL_*` variables and `TRACEPARENT` (the process's environment by default). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Keep a journal (FR-016). */
  readonly journal?: JournalOptions;
  /** More processors (the console's renderer, a memory processor). */
  readonly processors?: readonly Processor[];
  /** Install the pipeline as the process's (the default). */
  readonly install?: boolean;
  /** Told once, with the run's warning. */
  readonly onWarning?: (message: string) => void;
  /** For a test: the exporter's `fetch`, default endpoint, retry and sleep (see `OtlpExporterOptions`). */
  readonly exporter?: Omit<OtlpExporterOptions, "onWarning">;
  readonly clock?: () => bigint;
  readonly random?: (n: number) => Uint8Array;
};

/** A started telemetry: the pipeline, the harness's telemetry on it, and the configuration and its warnings. */
export type Started<R extends Declarations> = {
  readonly pipeline: Pipeline;
  readonly telemetry: Telemetry<R>;
  readonly config: OtelConfig;
  /** The `OTEL_*` values that were not valid, each with the default used (FR-005). */
  readonly configWarnings: readonly string[];
};

/**
 * The telemetry of a process, from its environment (FR-005, FR-014 to FR-017): the configuration resolved from the `OTEL_*` variables, a
 * resource (`service.name`, `process.runtime.*`, `os.type`, `host.arch`; never a host's or a person's name), `AsyncLocalStorage` for the
 * current span with the parent from `TRACEPARENT` and `TRACESTATE`, a batch processor exporting spans and one exporting log records and
 * metrics over OTLP/HTTP JSON (none where the SDK is disabled or no signal is exported), a journal where asked, the processors given, and
 * the metrics collected every `OTEL_METRIC_EXPORT_INTERVAL`. Installed as the process's pipeline unless `install` is false.
 */
export function startTelemetry<const R extends Declarations>(options: StartOptions<R>): Started<R> {
  const env = options.env ?? process.env;
  const { config, warnings } = resolveConfig(env);
  const resource: Resource = {
    attributes: {
      "service.name": options.service ?? `unknown_service:${runtimeName()}`,
      "telemetry.sdk.name": "ifc-ts",
      ...processAttributes(),
      ...config.resource,
    },
  };
  const signals = (["traces", "logs", "metrics"] as const).filter((s) => config.exporters[s].enabled);
  const parent = environmentParent(env);
  const pipeline = createPipeline({
    resource,
    processors: options.processors ?? [],
    ...(parent === undefined ? {} : { parent }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.random === undefined ? {} : { random: options.random }),
    sampler: config.sampler,
    limits: config.limits,
    // Metrics are collected on a schedule only where something exports them; otherwise at a flush and at exit.
    ...(signals.includes("metrics") || options.journal !== undefined ? { metricIntervalMs: config.metricExportIntervalMs } : {}),
    ...(options.onWarning === undefined ? {} : { onWarning: options.onWarning }),
  });
  if (signals.length > 0) {
    const rest = signals.filter((s) => s !== "traces");
    const users = (signals.includes("traces") ? 1 : 0) + (rest.length > 0 ? 1 : 0);
    const exporter = shareExporter(otlpExporter(config.exporters, { ...options.exporter, onWarning: (m) => pipeline.warn(m) }), users);
    if (signals.includes("traces")) pipeline.addProcessor(onlySignals(batchProcessor(exporter, config.spanBatch), ["traces"]));
    if (rest.length > 0) pipeline.addProcessor(onlySignals(batchProcessor(exporter, config.logBatch), rest));
  }
  if (options.journal !== undefined) pipeline.addProcessor(journalProcessor({ ...options.journal, ...config.logBatch }));
  const telemetry = pipeline.telemetry(options.registry, {
    name: options.service ?? "ifc-ts",
    ...(options.version === undefined ? {} : { version: options.version }),
  });
  if (options.install !== false) install(pipeline);
  return { pipeline, telemetry, config, configWarnings: warnings };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The runtime's hooks (FR-018): no-ops while no pipeline is installed
// ---------------------------------------------------------------------------------------------------------------------------------

type Carried<T> = Result<T, { readonly value: T; readonly message: string }>;

function carried<T>(r: Carried<T>): T {
  return r.kind === "ok" ? r.value : r.error.value;
}

/**
 * Runs a program in a `process` client span (FR-018): `process.executable.name` and `process.command_args` as `commandShape` gives them
 * (the program and its option names, never a value, FR-006), `process.exit.code`, `error` where it is not 0. `run` is given the
 * `TRACEPARENT` and `TRACESTATE` to add to the program's environment. With no pipeline installed, `run({})` and nothing else.
 */
export function traceProcess<T extends { readonly code: number }>(
  argv: readonly string[],
  run: (env: Readonly<Record<string, string>>) => Promise<T>,
): Promise<T> {
  const c = current;
  if (c === undefined) return run({});
  const shape = commandShape(argv);
  return c.runtime
    .span("process", { "process.executable.name": shape[0] ?? "", "process.command_args": shape }, async (span): Promise<Carried<T>> => {
      const env: Record<string, string> = { TRACEPARENT: span.traceparent };
      if (span.tracestate !== "") env["TRACESTATE"] = span.tracestate;
      const r = await run(env);
      span.set({ "process.exit.code": r.code });
      return r.code === 0 ? ok(r) : err({ value: r, message: `${shape[0] ?? "the program"} exited with ${r.code}` });
    })
    .then(carried);
}

// The system's process runner traces its programs through this module's pipeline once the module is loaded (commons 0032-libraries-by-concern: the system does not import the telemetry).
setProcessTracer(traceProcess);

function portOf(url: URL): number | undefined {
  if (url.port !== "") return Number(url.port);
  return url.protocol === "https:" ? 443 : url.protocol === "http:" ? 80 : undefined;
}

/**
 * Sends a request in an `http.client` span (FR-018): `http.request.method`, `url.full` redacted (FR-006), `server.address`, `server.port`,
 * `http.response.status_code` (`status` of what `send` gives; undefined where no answer came), `error` from 400 up or with no answer.
 * `send` is given the `traceparent` (and `tracestate`) headers to add. With no pipeline installed, `send({})` and nothing else.
 */
export function traceHttpClient<T>(
  method: string,
  url: string,
  send: (headers: Readonly<Record<string, string>>) => Promise<T>,
  status: (value: T) => number | undefined,
): Promise<T> {
  const c = current;
  if (c === undefined) return send({});
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    parsed = undefined;
  }
  const port = parsed === undefined ? undefined : portOf(parsed);
  return c.runtime
    .span(
      "http.client",
      {
        "http.request.method": method,
        "url.full": redactUrl(url),
        "server.address": parsed?.hostname ?? "",
        ...(port === undefined ? {} : { "server.port": port }),
      },
      async (span): Promise<Carried<T>> => {
        const headers: Record<string, string> = { traceparent: span.traceparent };
        if (span.tracestate !== "") headers["tracestate"] = span.tracestate;
        const value = await send(headers);
        const code = status(value);
        if (code === undefined) {
          span.set({ "error.type": "network" });
          return err({ value, message: "no answer" });
        }
        span.set({ "http.response.status_code": code, ...(code >= 400 ? { "error.type": String(code) } : {}) });
        return code >= 400 ? err({ value, message: `HTTP ${code}` }) : ok(value);
      },
    )
    .then(carried);
}

const UNTRACED = new WeakSet<object>();

/** A serve handler (or any function) marked so that `traceServer` makes no span for it: the OTLP receiver, so it never traces itself. */
export function untraced<F extends object>(handler: F): F {
  UNTRACED.add(handler);
  return handler;
}

/**
 * Answers a request in an `http.server` span (FR-018) whose parent is the request's `traceparent` and `tracestate` (the process's own
 * parent where it has none): `http.request.method`, `url.path`, `url.scheme`, `server.address`, `server.port`,
 * `http.response.status_code`, `error` from 500 up. With no pipeline installed, or a handler marked `untraced`, `handle()` and nothing else.
 */
export function traceServer(request: Request, handle: () => Response | Promise<Response>, handler?: object): Response | Promise<Response> {
  const c = current;
  if (c === undefined || (handler !== undefined && UNTRACED.has(handler))) return handle();
  const url = new URL(request.url);
  const port = portOf(url);
  const remote = extractContext(request.headers.get("traceparent") ?? undefined, request.headers.get("tracestate") ?? undefined);
  const parent = remote ?? c.pipeline.parent;
  return c.runtime
    .span(
      "http.server",
      {
        "http.request.method": request.method,
        "url.path": url.pathname,
        "url.scheme": url.protocol.replace(/:$/, ""),
        "server.address": url.hostname,
        ...(port === undefined ? {} : { "server.port": port }),
      },
      async (span): Promise<Carried<Response>> => {
        const response = await handle();
        span.set({ "http.response.status_code": response.status });
        return response.status >= 500 ? err({ value: response, message: `HTTP ${response.status}` }) : ok(response);
      },
      { parent: parent ?? null },
    )
    .then(carried);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The OTLP/HTTP JSON receiver (FR-019)
// ---------------------------------------------------------------------------------------------------------------------------------

/** What a receiver hands decoded requests to; a sink may answer with a partial success (signals it rejected, and why). */
export type ReceiverSinks = {
  readonly onTraces?: (batches: readonly TraceBatch[]) => void | ExportResponse | Promise<void | ExportResponse>;
  readonly onLogs?: (batches: readonly LogBatch[]) => void | ExportResponse | Promise<void | ExportResponse>;
  readonly onMetrics?: (batches: readonly MetricBatch[]) => void | ExportResponse | Promise<void | ExportResponse>;
};

const RECEIVER_PATHS: Readonly<Record<string, SignalName>> = { "/v1/traces": "traces", "/v1/logs": "logs", "/v1/metrics": "metrics" };

function statusResponse(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({ code, message }), { status, headers: { "content-type": "application/json" } });
}

async function bodyText(request: Request): Promise<Result<string, Response>> {
  const encoding = (request.headers.get("content-encoding") ?? "identity").trim().toLowerCase();
  if (encoding === "identity" || encoding === "") return ok(await request.text());
  if (encoding !== "gzip") return err(statusResponse(415, 3, `the content encoding ${encoding} is not supported (gzip is)`));
  if (request.body === null) return ok("");
  try {
    return ok(await new Response(request.body.pipeThrough(new DecompressionStream("gzip"))).text());
  } catch {
    return err(statusResponse(400, 3, "the body is not valid gzip"));
  }
}

/** Who a request was authenticated as: the asset, and the relay that carried it where it came by one (0003-telemetry-reach FR-012). */
export type DeviceIdentity = { readonly assetId?: string; readonly relayId?: string };

/** How a receiver identifies a sender and what it requires (0003-telemetry-reach FR-011, FR-012). */
export type ReceiverPolicy = {
  /** Who a request is, from a bearer token or a client certificate; it answers a refusal where it knows no one. Required for a body that is not an envelope. */
  readonly authenticate?: (request: Request) => Result<DeviceIdentity, string> | Promise<Result<DeviceIdentity, string>>;
  /** The signer that verifies an envelope, and who the key that signed it is (`undefined`: no such enrolled device). */
  readonly signer?: EnvelopeSigner;
  readonly identityOfKey?: (keyId: string) => DeviceIdentity | undefined;
  /** `required`: a body that is not a signed envelope is refused with 401. */
  readonly signatures: "required" | "optional";
  /** What was taken, to drop a replay (FR-007); the receiver updates `current`. */
  readonly ledger?: { current: SeenLedger };
  /** What a source may send (0003-telemetry-reach FR-023): the body it may send is read up to `maxBodyBytes` (413 past it) and the batches it may send are limited by a bucket per source (429 with `Retry-After`, the code `E-TELEM-RATE-LIMITED`); a batch refused is not taken and not marked seen, so the sender keeps it. */
  readonly limits?: { readonly limits: SourceLimits; readonly now?: () => number };
};

/** The answer to a source over its limits: 429, the code, and when to try again. */
function limited(retryAfterMs: number): Response {
  return new Response(JSON.stringify({ code: 8, message: "E-TELEM-RATE-LIMITED: this source is over its limit; send the batch again later" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
  });
}

const ASSET = "if.asset.id";
const RELAY = "if.relay.id";

const stamp = <B extends { readonly resource: Resource }>(batches: readonly B[], who: DeviceIdentity): readonly B[] =>
  batches.map((b) => {
    const attributes: Record<string, AttributeValue> = { ...b.resource.attributes };
    delete attributes[ASSET];
    delete attributes[RELAY];
    if (who.assetId !== undefined) attributes[ASSET] = who.assetId;
    if (who.relayId !== undefined) attributes[RELAY] = who.relayId;
    return { ...b, resource: { attributes } };
  });

/**
 * An OTLP/HTTP JSON receiver, as a handler for `serve` (FR-019): `POST /v1/traces`, `/v1/logs` and `/v1/metrics` with a JSON body
 * (gzip-encoded or not) decoded by the kernel (FR-004) and handed to the sink; 415 for any content type but `application/json` (protobuf
 * among them), 400 with the path where the body does not decode, 404 for another path, 405 for another method, and OTLP's success body
 * (`{}`, or `partialSuccess` where the sink rejected some) otherwise. Errors are `google.rpc.Status` JSON. The handler is `untraced`.
 *
 * With a `policy` (0003-telemetry-reach FR-011, FR-012) the receiver also takes `application/vnd.ifc.telemetry+json` (a signed envelope and its batch), answers 401 where a sender is not identified or a signature is
 * required and absent, sets `if.asset.id` on every resource from what it authenticated and overwrites what the sender wrote (for a relay it sets `if.relay.id` and removes any `if.asset.id`), and drops a batch it
 * already took with a success answer so that the sender removes it from its queue.
 */
export function otlpReceiver(sinks: ReceiverSinks, policy?: ReceiverPolicy): (request: Request) => Promise<Response> {
  let limiter = policy?.limits === undefined ? undefined : newLimiter(policy.limits.limits);
  const clock = policy?.limits?.now ?? Date.now;
  /** Whether the source may send a batch now: a refusal to give, or nothing. */
  const overLimit = (who: DeviceIdentity): Response | undefined => {
    if (limiter === undefined) return undefined;
    const t = takeAllowance(limiter, who.assetId ?? who.relayId ?? "anonymous", clock());
    limiter = t.limiter;
    return t.kind === "limited" ? limited(t.retryAfterMs) : undefined;
  };
  return untraced(async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const signal = Object.hasOwn(RECEIVER_PATHS, path) ? RECEIVER_PATHS[path] : undefined;
    if (signal === undefined) return statusResponse(404, 5, `${path} is not an OTLP path (/v1/traces, /v1/logs, /v1/metrics)`);
    if (request.method !== "POST") return statusResponse(405, 12, `${request.method} is not allowed; OTLP/HTTP is POST`);
    const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    const signed = policy !== undefined && type === TELEMETRY_PAYLOAD_TYPE;
    if (type !== "application/json" && !signed) {
      await request.body?.cancel().catch(() => undefined);
      return statusResponse(415, 3, `the content type ${type === "" ? "(none)" : type} is not supported; send application/json`);
    }
    const cap = policy?.limits?.limits.maxBodyBytes;
    if (cap !== undefined) {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > cap) {
        await request.body?.cancel().catch(() => undefined);
        return statusResponse(413, 3, `the body is larger than the limit of ${cap} bytes`);
      }
    }
    let who: DeviceIdentity | undefined;
    if (policy !== undefined && !signed) {
      if (policy.signatures === "required") {
        await request.body?.cancel().catch(() => undefined);
        return statusResponse(401, 16, "a signed envelope is required on this path");
      }
      const a = policy.authenticate === undefined ? undefined : await policy.authenticate(request);
      if (a === undefined || a.kind === "err") {
        await request.body?.cancel().catch(() => undefined);
        return statusResponse(401, 16, "the sender is not identified");
      }
      who = a.value;
      const over = overLimit(who);
      if (over !== undefined) {
        await request.body?.cancel().catch(() => undefined);
        return over;
      }
    }
    const text = await bodyText(request);
    if (text.kind === "err") return text.error;
    if (cap !== undefined && new TextEncoder().encode(text.value).length > cap) return statusResponse(413, 3, `the body is larger than the limit of ${cap} bytes`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.value);
    } catch (e) {
      return statusResponse(400, 3, `the body is not JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (policy !== undefined && signed) {
      if (policy.signer === undefined || policy.identityOfKey === undefined) return statusResponse(401, 16, "this path takes no signed envelope");
      const opened = await openEnvelope(parsed, policy.signer);
      if (opened.kind === "err") return statusResponse(401, 16, `the envelope is refused: ${opened.error.kind}`);
      const known = policy.identityOfKey(opened.value.keyId);
      if (known === undefined || known.assetId !== opened.value.predicate.device) return statusResponse(401, 16, "the sender is not an enrolled device");
      if (opened.value.predicate.signal !== signal) return statusResponse(400, 3, "the envelope is of another signal than the path");
      who = known;
      const over = overLimit(who);
      if (over !== undefined) return over;
      if (policy.ledger !== undefined) {
        const [verdict, next] = acceptBatch(policy.ledger.current, opened.value.predicate);
        if (verdict.kind === "err") return new Response(JSON.stringify(encodeResponse(signal, { rejected: 0, errorMessage: "" })), { status: 200, headers: { "content-type": "application/json" } });
        policy.ledger.current = next;
      }
      try {
        parsed = JSON.parse(opened.value.batch);
      } catch {
        return statusResponse(400, 3, "the batch is not JSON");
      }
    }
    let answer: void | ExportResponse;
    try {
      switch (signal) {
        case "traces": {
          const d = decodeTraces(parsed);
          if (d.kind === "err") return statusResponse(400, 3, formatDecodeError(d.error));
          answer = await sinks.onTraces?.(who === undefined ? d.value : stamp(d.value, who));
          break;
        }
        case "logs": {
          const d = decodeLogs(parsed);
          if (d.kind === "err") return statusResponse(400, 3, formatDecodeError(d.error));
          answer = await sinks.onLogs?.(who === undefined ? d.value : stamp(d.value, who));
          break;
        }
        case "metrics": {
          const d = decodeMetrics(parsed);
          if (d.kind === "err") return statusResponse(400, 3, formatDecodeError(d.error));
          answer = await sinks.onMetrics?.(who === undefined ? d.value : stamp(d.value, who));
          break;
        }
        default:
          absurd(signal);
      }
    } catch (e) {
      return statusResponse(500, 13, `the receiver failed: ${describeThrown(e)}`);
    }
    const body = encodeResponse(signal, answer ?? { rejected: 0, errorMessage: "" });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
}
