/**
 * Tests of `kernel/signals.ts`: what a registry lets compile (and what it does not), span trees exact to the id and the nanosecond with a
 * fixed clock and deterministic random bytes, the status a span ends with (a result, a thrown exception, a promise, a shutdown), the
 * parent taken from the context or a `traceparent`, sampling, redaction and limits applied to what is recorded, the processors (memory,
 * simple, batch) in order, with drops counted and flushes that end in time whatever the exporter does, and cumulative metrics.
 *
 * @module
 */
import {
  extractContext,
  type LogRecord,
  type Metric,
  SEVERITY,
  type SpanData,
  type SpanId,
  type TraceId,
  DEFAULT_HISTOGRAM_BOUNDS,
} from "../../kernel/otel.ts";
import { countSignals } from "../../kernel/otlp.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import {
  type AttributesOf,
  batchProcessor,
  createTelemetry,
  declarationOf,
  defineSignals,
  describeError,
  type Exporter,
  type ExportResult,
  type KindOf,
  memoryProcessor,
  type Processor,
  roleOf,
  simpleProcessor,
  type Source,
  type TelemetryOptions,
  type Timer,
} from "../../kernel/signals.ts";
import { type Equal, expectType } from "../../kernel/types.ts";
import { assert, assertEquals, assertRejects, assertThrows, proves } from "../../runtime/test.ts";

const REGISTRY = "0006-signals FR-009";
const SPANS = "0006-signals FR-010";
const EXACT = "0006-signals FR-011";
const PIPELINE = "0006-signals FR-012";
const METRICS = "0006-signals FR-013";

const registry = defineSignals({
  "build.run": { signal: "span", role: "step", attributes: { target: "string", "files?": "int" } },
  "build.step": {
    signal: "span",
    role: "detail",
    spanKind: "client",
    attributes: { name: "string", "token?": "string" },
    secret: ["token"],
  },
  "build.warning": { signal: "log", role: "warning", severity: SEVERITY.WARN, attributes: { path: "string" } },
  "build.files": { signal: "counter", role: "none", unit: "{file}", attributes: { target: "string" } },
  "build.queue": { signal: "updown", role: "none", unit: "{job}", attributes: {} },
  "build.memory": { signal: "gauge", role: "none", unit: "By", attributes: {} },
  "build.duration": { signal: "histogram", role: "none", unit: "ms", attributes: { "ok?": "boolean" } },
  "build.size": { signal: "histogram", role: "none", unit: "By", bounds: [10, 100], attributes: {} },
});
type R = typeof registry.kinds;

const resource = { attributes: { "service.name": "build" } };
const scope = { name: "build", version: "1.0.0" };

/** A telemetry whose clock counts from 1000 ns, and whose n-th call for random bytes gives bytes all equal to n. */
function fixture(options: Partial<TelemetryOptions<R>> = {}) {
  let t = 1000n;
  let call = 0;
  const memory = memoryProcessor();
  const telemetry = createTelemetry({
    registry,
    resource,
    scope,
    clock: () => t++,
    random: (n) => new Uint8Array(n).fill(++call),
    processors: [memory],
    ...options,
  });
  return { telemetry, memory };
}

/** The id whose bytes are all `n`. */
const traceId = (n: number): TraceId => n.toString(16).padStart(2, "0").repeat(16) as TraceId;
const spanId = (n: number): SpanId => n.toString(16).padStart(2, "0").repeat(8) as SpanId;

const span = (fields: Partial<SpanData> & Pick<SpanData, "name" | "context" | "startTime" | "endTime">): SpanData => ({
  kind: "internal",
  attributes: {},
  events: [],
  links: [],
  status: { kind: "ok" },
  droppedAttributesCount: 0,
  droppedEventsCount: 0,
  droppedLinksCount: 0,
  ...fields,
});

const context = (trace: number, id: number, flags = 1) => ({
  traceId: traceId(trace),
  spanId: spanId(id),
  traceFlags: flags,
  traceState: [],
  isRemote: false,
});

proves(
  [REGISTRY, "0005-typescript-runtime FR-014"],
  "a kind not declared, a wrong attribute type or a missing attribute does not compile",
  () => {
    const { telemetry } = fixture();
    expectType<Equal<KindOf<R, "span">, "build.run" | "build.step">>();
    expectType<Equal<KindOf<R, "counter" | "updown">, "build.files" | "build.queue">>();
    expectType<Equal<AttributesOf<R, "build.run">, { readonly target: string; readonly files?: number | bigint }>>();
    expectType<Equal<AttributesOf<R, "build.duration">, { readonly ok?: boolean }>>();
    const neverRun = (): void => {
      // @ts-expect-error a kind that is not declared
      telemetry.span("build.nothing", {}, () => ok(1));
      // @ts-expect-error a required attribute is missing
      telemetry.span("build.run", {}, () => ok(1));
      // @ts-expect-error an attribute declared as an integer is given a string
      telemetry.span("build.run", { target: "a", files: "3" }, () => ok(1));
      // @ts-expect-error an attribute that is not declared
      telemetry.span("build.run", { target: "a", other: 1 }, () => ok(1));
      // @ts-expect-error a log kind is not a span
      telemetry.span("build.warning", { path: "a" }, () => ok(1));
      // @ts-expect-error a gauge is set, not added to
      telemetry.add("build.memory", 1, {});
      // @ts-expect-error a span kind is not a log
      telemetry.log("build.run", { target: "a" });
      // @ts-expect-error a handle sets only its kind's attributes
      telemetry.span("build.run", { target: "a" }, (run) => run.set({ name: "x" }));
    };
    assertEquals(typeof neverRun, "function");
    assertEquals(
      [roleOf(registry, "build.run"), roleOf(registry, "build.warning"), roleOf(registry, "toString")],
      ["step", "warning", undefined],
    );
    assertEquals(declarationOf(registry, "build.size")?.signal, "histogram");
    assertThrows(
      () => defineSignals({ x: { signal: "span", role: "none", attributes: { a: "string" }, secret: ["b"] } }),
      Error,
      "not declared",
    );
    assertThrows(
      () => defineSignals({ x: { signal: "histogram", role: "none", unit: "ms", bounds: [2, 1], attributes: {} } }),
      Error,
      "increase",
    );
    // @ts-expect-error an attribute type that does not exist
    assertThrows(() => defineSignals({ x: { signal: "span", role: "none", attributes: { a: "date" } } }), Error, "does not exist");
  },
);

proves([REGISTRY], "a log record has its kind's severity unless the call gives one of its own, in the span or out of it", () => {
  const { telemetry, memory } = fixture();
  telemetry.log("build.warning", { path: "a" });
  telemetry.log("build.warning", { path: "b" }, undefined, { severity: SEVERITY.FATAL });
  telemetry.log("build.warning", { path: "c" }, "body", {});
  telemetry.span("build.run", { target: "site" }, (span) => {
    span.log("build.warning", { path: "d" }, "in the span", { severity: 18 });
    return ok(undefined);
  });
  assertEquals(
    memory.logs.map((r) => [r.eventName, r.severityNumber, r.severityText]),
    [
      ["build.warning", 13, "WARN"],
      ["build.warning", 21, "FATAL"],
      ["build.warning", 13, "WARN"],
      ["build.warning", 18, "ERROR2"],
    ],
  );
  // @ts-expect-error a severity is a number from 1 to 24
  telemetry.log("build.warning", { path: "e" }, undefined, { severity: 25 });
});

/** The tree every run of it gives: a run with an event, a child through the context, and a child through the handle. */
function tree() {
  const { telemetry, memory } = fixture();
  const out = telemetry.span("build.run", { target: "site" }, (run) => {
    run.event("note", { k: "v" });
    const a = telemetry.span("build.step", { name: "compile", token: "s3cret" }, () => {
      telemetry.log("build.warning", { path: "https://user:pw@example.com/x" }, "deprecated");
      return ok(1);
    });
    const b = run.span("build.step", { name: "link" }, () => err({ kind: "missing", message: "not found" }));
    run.set({ files: 3 });
    return a.kind === "ok" && b.kind === "err" ? ok("built") : err("unexpected");
  });
  return { out, memory };
}

proves([SPANS, EXACT], "a span tree is exact: the same ids, times, parents, statuses and order every run", () => {
  const { out, memory } = tree();
  assertEquals(out, ok("built"));
  const compile = span({
    name: "build.step",
    context: context(1, 3),
    parentSpanId: spanId(2),
    kind: "client",
    startTime: 1002n,
    endTime: 1004n,
    attributes: { name: "compile" },
  });
  const link = span({
    name: "build.step",
    context: context(1, 4),
    parentSpanId: spanId(2),
    kind: "client",
    startTime: 1005n,
    endTime: 1006n,
    attributes: { name: "link" },
    status: { kind: "error", message: "not found" },
  });
  const run = span({
    name: "build.run",
    context: context(1, 2),
    startTime: 1000n,
    endTime: 1007n,
    attributes: { target: "site", files: 3n },
    events: [{ name: "note", time: 1001n, attributes: { k: "v" }, droppedAttributesCount: 0 }],
  });
  assertEquals(memory.spans, [compile, link, run]);
  const log: LogRecord = {
    time: 1003n,
    observedTime: 1003n,
    severityNumber: 13,
    severityText: "WARN",
    body: "deprecated",
    attributes: { path: "https://REDACTED:REDACTED@example.com/x" },
    droppedAttributesCount: 0,
    eventName: "build.warning",
    traceId: traceId(1),
    spanId: spanId(3),
    traceFlags: 1,
  };
  assertEquals(memory.logs, [log]);
  assertEquals(
    memory.entries.map((e) => [e.kind, e.kind === "log" ? e.record.eventName : e.kind === "metrics" ? "" : e.span.name]),
    [
      ["start", "build.run"],
      ["event", "build.run"],
      ["start", "build.step"],
      ["log", "build.warning"],
      ["end", "build.step"],
      ["start", "build.step"],
      ["end", "build.step"],
      ["end", "build.run"],
    ],
  );
  assertEquals(memory.entries[0], {
    kind: "start",
    span: { name: "build.run", context: context(1, 2), kind: "internal", startTime: 1000n, attributes: { target: "site" } },
    source: { resource, scope },
  });
  assertEquals(tree().memory.entries, memory.entries);
});

proves([SPANS], "a function that throws ends its span with an exception event and error, and the exception is thrown on", () => {
  const { telemetry, memory } = fixture();
  assertThrows(
    () =>
      telemetry.span("build.run", { target: "x" }, () => {
        throw new TypeError("boom");
      }),
    TypeError,
    "boom",
  );
  const [s] = memory.spans;
  assertEquals(s?.status, { kind: "error", message: "boom" });
  assertEquals(
    s?.events.map((e) => [e.name, e.attributes["exception.type"], e.attributes["exception.message"]]),
    [["exception", "TypeError", "boom"]],
  );
  assert(String(s?.events[0]?.attributes["exception.stacktrace"]).includes("boom"));
  assertEquals(
    telemetry.span("build.run", { target: "v" }, () => 42),
    42,
  );
  assertEquals(memory.spans[1]?.status, { kind: "unset" });
  assertEquals(
    [describeError("x"), describeError(new Error("e")), describeError({ kind: "decode", path: "$" }), describeError(7)],
    ["x", "e", '{"kind":"decode","path":"$"}', "7"],
  );
});

proves([SPANS], "an asynchronous span ends when its promise settles, with its result's status, and a rejection is thrown on", async () => {
  const { telemetry, memory } = fixture();
  const r = await telemetry.span("build.run", { target: "a" }, async (run) => {
    await Promise.resolve();
    return run.span("build.step", { name: "x" }, async () => {
      await Promise.resolve();
      return ok(2);
    });
  });
  assertEquals(r, ok(2));
  assertEquals(
    memory.spans.map((s) => [s.name, s.parentSpanId, s.status.kind]),
    [
      ["build.step", spanId(2), "ok"],
      ["build.run", undefined, "ok"],
    ],
  );
  await assertRejects(
    () =>
      telemetry.span("build.run", { target: "b" }, async () => {
        await Promise.resolve();
        throw new RangeError("late");
      }),
    RangeError,
    "late",
  );
  assertEquals(memory.spans[2]?.status, { kind: "error", message: "late" });
  assertEquals(memory.spans[2]?.events[0]?.attributes["exception.type"], "RangeError");
});

proves([SPANS, PIPELINE], "shutdown ends an open span as error, a span ends once, and nothing is recorded after", async () => {
  const { telemetry, memory } = fixture();
  let release: ((r: Result<number, string>) => void) | undefined;
  const pending = telemetry.span(
    "build.run",
    { target: "open" },
    () => new Promise<Result<number, string>>((resolve) => (release = resolve)),
  );
  assertEquals(await telemetry.shutdown(1000), { kind: "done" });
  assertEquals(
    memory.spans.map((s) => s.status),
    [{ kind: "error", message: "the span was still open at shutdown" }],
  );
  release?.(ok(1));
  assertEquals(await pending, ok(1));
  const before = memory.entries.length;
  assertEquals(
    telemetry.span("build.run", { target: "late" }, (h) => [h.recording, ok(1)]),
    [false, ok(1)],
  );
  telemetry.log("build.warning", { path: "p" });
  assertEquals(telemetry.add("build.files", 1, { target: "t" }), ok(undefined));
  assertEquals(memory.entries.length, before);
});

proves([SPANS, EXACT], "the parent comes from the context, a traceparent or the options, and sampling follows it", () => {
  const remote = extractContext(`00-${"ab".repeat(16)}-${"cd".repeat(8)}-01`, "vendor=x");
  const sampled = fixture(remote === undefined ? {} : { parent: remote });
  const header = sampled.telemetry.span("build.run", { target: "a" }, (h) => [h.traceparent, h.tracestate]);
  assertEquals(header, [`00-${"ab".repeat(16)}-${spanId(1)}-01`, "vendor=x"]);
  assertEquals(sampled.memory.spans[0]?.parentSpanId, "cd".repeat(8));
  assertEquals(sampled.memory.spans[0]?.context.traceState, [{ key: "vendor", value: "x" }]);
  assertEquals(sampled.telemetry.active()?.spanId, "cd".repeat(8));
  // A new trace, asked for.
  sampled.telemetry.span("build.run", { target: "b" }, () => ok(1), { parent: null });
  assertEquals(sampled.memory.spans[1]?.context.traceId, traceId(2));
  assertEquals(sampled.memory.spans[1]?.parentSpanId, undefined);

  const unsampled = extractContext(`00-${"ab".repeat(16)}-${"cd".repeat(8)}-00`, undefined);
  const off = fixture(unsampled === undefined ? {} : { parent: unsampled });
  const seen = off.telemetry.span("build.run", { target: "a" }, (h) => {
    off.telemetry.log("build.warning", { path: "p" });
    return [h.recording, h.traceparent];
  });
  assertEquals(seen, [false, `00-${"ab".repeat(16)}-${spanId(1)}-00`]);
  assertEquals(off.memory.spans, []);
  assertEquals(
    off.memory.logs.map((l) => [l.spanId, l.traceFlags]),
    [[spanId(1), 0]],
  );

  const never = fixture({ sampler: { kind: "always_off" } });
  never.telemetry.span("build.run", { target: "a" }, () => ok(1));
  assertEquals(never.memory.entries, []);
});

proves([SPANS, "0006-signals FR-007", "0006-signals FR-006"], "limits and redaction apply to what a span records", () => {
  const { telemetry, memory } = fixture({ limits: { attributeValueLength: 2, attributeCount: 1, eventCount: 1, linkCount: 1 } });
  const link = { traceId: traceId(9), spanId: spanId(9), traceFlags: 1, traceState: [], attributes: { a: "abc", b: "d" } };
  telemetry.span(
    "build.run",
    { target: "site", files: 1 },
    (run) => {
      run.event("a");
      run.progress(1, 2);
      return ok(1);
    },
    { links: [link, link] },
  );
  const [s] = memory.spans;
  assertEquals(s?.attributes, { target: "si" });
  assertEquals([s?.droppedAttributesCount, s?.droppedEventsCount, s?.droppedLinksCount], [1, 1, 1]);
  assertEquals(s?.links, [
    { traceId: traceId(9), spanId: spanId(9), traceFlags: 1, traceState: [], attributes: { a: "ab" }, droppedAttributesCount: 1 },
  ]);
  const all = fixture();
  all.telemetry.span("build.step", { name: "Bearer abcdefghijkl", token: "s3cret" }, (h) => {
    h.set({ token: "again" });
    h.progress(3, 4);
    return ok(1);
  });
  assertEquals(all.memory.spans[0]?.attributes, { name: "Bearer REDACTED" });
  assertEquals(all.memory.spans[0]?.events[0]?.attributes, { "progress.done": 3, "progress.total": 4 });
});

/** An exporter that records what it is given and answers with `answer`. */
function recordingExporter(answer: (n: number) => Promise<ExportResult> = () => Promise.resolve({ kind: "success" })) {
  const calls: [string, number][] = [];
  const exporter: Exporter = {
    exportTraces: (b) => (calls.push(["traces", countSignals(b)]), answer(calls.length)),
    exportLogs: (b) => (calls.push(["logs", countSignals(b)]), answer(calls.length)),
    exportMetrics: (b) => (calls.push(["metrics", countSignals(b)]), answer(calls.length)),
    shutdown: () => Promise.resolve(),
  };
  return { calls, exporter };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

proves([PIPELINE], "a simple processor exports each signal in order, and counts what failed, never throwing", async () => {
  const { calls, exporter } = recordingExporter((n) =>
    n === 2
      ? Promise.reject(new Error("down"))
      : n === 3
        ? Promise.resolve({ kind: "partial", rejected: 1, message: "old" })
        : Promise.resolve({ kind: "success" }),
  );
  const simple = simpleProcessor(exporter);
  const failing: Processor = {
    onStart: () => {
      throw new Error("renderer bug");
    },
    forceFlush: () => Promise.resolve({ kind: "done" }),
    shutdown: () => Promise.resolve({ kind: "done" }),
  };
  const errors: unknown[] = [];
  const { telemetry, memory } = fixture({ processors: [failing, simple, memoryProcessor()], onError: (e) => errors.push(e) });
  telemetry.span("build.run", { target: "a" }, () => {
    telemetry.log("build.warning", { path: "p" });
    return ok(1);
  });
  telemetry.add("build.files", 1, { target: "a" });
  assertEquals(await telemetry.forceFlush(1000), { kind: "done" });
  assertEquals(calls, [
    ["logs", 1],
    ["traces", 1],
    ["metrics", 1],
  ]);
  assertEquals(simple.stats(), {
    traces: { exported: 0, failed: 1, rejected: 0, dropped: 0, lastError: "down" },
    logs: { exported: 1, failed: 0, rejected: 0, dropped: 0 },
    metrics: { exported: 0, failed: 0, rejected: 1, dropped: 0, lastError: "old" },
  });
  assertEquals(errors.length, 1);
  assertEquals(memory.entries.length, 0);
  assertEquals(await telemetry.shutdown(1000), { kind: "done" });
  simple.onEnd?.(span({ name: "x", context: context(1, 1), startTime: 0n, endTime: 0n }), { resource, scope });
  assertEquals(simple.stats().traces.dropped, 1);
});

proves([PIPELINE], "a batch processor sends full batches, then what waits after its delay, and drops what does not fit", async () => {
  let fire: (() => void) | undefined;
  const timer: Timer = {
    set: (fn) => {
      fire = fn;
      return 1;
    },
    clear: () => {
      fire = undefined;
    },
  };
  let open: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const { calls, exporter } = recordingExporter(async (n) => {
    if (n === 1) await gate;
    return { kind: "success" };
  });
  const batch = batchProcessor(exporter, { maxQueueSize: 3, maxExportBatchSize: 2, scheduleDelayMs: 10, timer });
  const source: Source = { resource, scope };
  const s = (i: number): SpanData => span({ name: `s${i}`, context: context(1, i), startTime: 0n, endTime: 0n });
  batch.onEnd?.(s(1), source);
  assert(fire !== undefined, "the first span arms the timer");
  batch.onEnd?.(s(2), source);
  await tick();
  assertEquals(calls, [["traces", 2]]);
  for (const i of [3, 4, 5, 6]) batch.onEnd?.(s(i), source);
  assertEquals(batch.stats().traces.dropped, 1);
  open?.();
  await tick();
  assertEquals(calls, [
    ["traces", 2],
    ["traces", 2],
  ]);
  fire?.();
  await tick();
  assertEquals(calls.at(-1), ["traces", 1]);
  batch.onLog?.({ time: 0n, observedTime: 0n, severityNumber: 9, severityText: "INFO", attributes: {}, droppedAttributesCount: 0 }, source);
  assertEquals(await batch.forceFlush(1000), { kind: "done" });
  assertEquals(calls.at(-1), ["logs", 1]);
  assertEquals(batch.stats().traces, { exported: 5, failed: 0, rejected: 0, dropped: 1 });
  assertEquals(await batch.shutdown(1000), { kind: "done" });
  batch.onEnd?.(s(7), source);
  assertEquals(batch.stats().traces.dropped, 2);
});

proves([PIPELINE], "forceFlush and shutdown end within their time whatever the exporter does", async () => {
  const never = <T>(): Promise<T> => new Promise<T>(() => undefined);
  const hanging: Exporter = { exportTraces: never, exportLogs: never, exportMetrics: never, shutdown: never };
  const batch = batchProcessor(hanging, { exportTimeoutMs: 100, scheduleDelayMs: 5 });
  const simple = simpleProcessor(hanging, { exportTimeoutMs: 100 });
  const stuck: Processor = { forceFlush: never, shutdown: never };
  const { telemetry } = fixture({ processors: [batch, simple, stuck] });
  telemetry.span("build.run", { target: "a" }, () => ok(1));
  const started = Date.now();
  assertEquals(await telemetry.forceFlush(30), { kind: "timeout" });
  assertEquals(await batch.forceFlush(30), { kind: "timeout" });
  assertEquals(await telemetry.shutdown(30), { kind: "timeout" });
  assert(Date.now() - started < 1000, "every wait ended in its time");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assertEquals(batch.stats().traces.failed, 1);
  assertEquals(simple.stats().traces.failed, 1);
  assertEquals(simple.stats().traces.lastError, "the export took more than 100 ms");
});

proves(
  [METRICS],
  "metrics are cumulative: counters refuse a negative increment, gauges keep the last value, histograms their buckets",
  () => {
    const { telemetry, memory } = fixture();
    telemetry.add("build.files", 2, { target: "a" });
    telemetry.add("build.files", 3, { target: "a" });
    telemetry.add("build.files", 1, { target: "b" });
    assertEquals(telemetry.add("build.files", -1, { target: "a" }).kind, "err");
    assertEquals(telemetry.add("build.files", NaN, { target: "a" }).kind, "err");
    telemetry.add("build.queue", 2, {});
    telemetry.add("build.queue", -3, {});
    telemetry.set("build.memory", 5, {});
    telemetry.set("build.memory", 7, {});
    telemetry.record("build.duration", 3, {});
    telemetry.record("build.duration", 30, { ok: true });
    telemetry.record("build.duration", 20000, { ok: true });
    telemetry.record("build.size", 10, {});
    telemetry.record("build.size", 50, {});
    telemetry.record("build.size", 500, {});
    const buckets = (...at: number[]): number[] =>
      DEFAULT_HISTOGRAM_BOUNDS.map(() => 0)
        .concat(0)
        .map((_, i) => at.filter((x) => x === i).length);
    const expected: Metric[] = [
      {
        name: "build.files",
        description: "",
        unit: "{file}",
        data: {
          kind: "sum",
          temporality: "cumulative",
          monotonic: true,
          points: [
            { attributes: { target: "a" }, startTime: 1000n, time: 1013n, value: 5 },
            { attributes: { target: "b" }, startTime: 1002n, time: 1013n, value: 1 },
          ],
        },
      },
      {
        name: "build.queue",
        description: "",
        unit: "{job}",
        data: {
          kind: "sum",
          temporality: "cumulative",
          monotonic: false,
          points: [{ attributes: {}, startTime: 1003n, time: 1013n, value: -1 }],
        },
      },
      {
        name: "build.memory",
        description: "",
        unit: "By",
        data: { kind: "gauge", points: [{ attributes: {}, startTime: 1005n, time: 1013n, value: 7 }] },
      },
      {
        name: "build.duration",
        description: "",
        unit: "ms",
        data: {
          kind: "histogram",
          temporality: "cumulative",
          points: [
            {
              attributes: {},
              startTime: 1007n,
              time: 1013n,
              count: 1,
              sum: 3,
              min: 3,
              max: 3,
              bounds: DEFAULT_HISTOGRAM_BOUNDS,
              bucketCounts: buckets(1),
            },
            {
              attributes: { ok: true },
              startTime: 1008n,
              time: 1013n,
              count: 2,
              sum: 20030,
              min: 30,
              max: 20000,
              bounds: DEFAULT_HISTOGRAM_BOUNDS,
              bucketCounts: buckets(4, 15),
            },
          ],
        },
      },
      {
        name: "build.size",
        description: "",
        unit: "By",
        data: {
          kind: "histogram",
          temporality: "cumulative",
          points: [
            {
              attributes: {},
              startTime: 1010n,
              time: 1013n,
              count: 3,
              sum: 560,
              min: 10,
              max: 500,
              bounds: [10, 100],
              bucketCounts: [1, 1, 1],
            },
          ],
        },
      },
    ];
    assertEquals(telemetry.collect(), expected);
    telemetry.add("build.files", 1, { target: "a" });
    const again = telemetry.collect();
    assertEquals(again[0]?.data.points[0], { attributes: { target: "a" }, startTime: 1000n, time: 1015n, value: 6 });
    assertEquals(memory.metrics.length, 2);
    assertEquals(memory.metrics[0], expected);
  },
);
