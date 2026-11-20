/**
 * Tests of `runtime/otel.ts` (commons 0006-signals FR-014 to FR-019), all against servers on 127.0.0.1 that the test starts or a `fetch`
 * it gives: the OTLP/HTTP JSON exporter (the request it sends, retries after `Retry-After` and growing waits, partial success, failures
 * that never throw and are said once), the probe of the default endpoint and the capped wait at exit, the rotated journal, the context
 * carried across `await` and the parent from `TRACEPARENT`, the runtime's own spans for `proc`, the HTTP client and `serve` (and nothing
 * where no pipeline is installed), and the receiver's answers.
 *
 * @module
 */
import { existsSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import process from "node:process";
import {
  commandShape,
  type ExporterConfig,
  formatTraceparent,
  type OtelConfig,
  parseSpanId,
  parseTraceId,
  type SignalName,
  signalEndpoint,
  SEVERITY,
  type SpanData,
} from "../../kernel/otel.ts";
import { decodeTraces, encodeTraces, type LogBatch, type MetricBatch, type TraceBatch } from "../../kernel/otlp.ts";
import { ok } from "@intellectual-frontiers/core";
import { batchProcessor, defineSignals, memoryProcessor } from "../../kernel/signals.ts";
import { withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { liveTransport } from "../../runtime/http-client.ts";
import { join } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";
import { serve, type Server } from "../../runtime/serve.ts";
import {
  asyncContextManager,
  createPipeline,
  environmentParent,
  EXIT_WAIT_MS,
  installed,
  journalExporter,
  otlpExporter,
  otlpReceiver,
  PROBE_TIMEOUT_MS,
  type Started,
  startTelemetry,
  systemClock,
  untraced,
} from "../../runtime/otel.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";

const EXPORT = "0006-signals FR-014";
const PROBE = "0006-signals FR-015";
const JOURNAL = "0006-signals FR-016";
const CONTEXT = "0006-signals FR-017";
const OWN = "0006-signals FR-018";
const RECEIVER = "0006-signals FR-019";

const registry = defineSignals({
  "test.step": { signal: "span", role: "step", attributes: { target: "string" } },
  "test.note": { signal: "log", role: "detail", severity: SEVERITY.INFO, attributes: { path: "string" } },
  "test.files": { signal: "counter", role: "none", unit: "{file}", attributes: {} },
});

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";
const TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`;

/** The exporter configuration of every signal, at `base` (or none, to probe). */
function exporters(base: string | undefined, over: Partial<ExporterConfig> = {}): OtelConfig["exporters"] {
  const one = (s: SignalName): ExporterConfig => ({
    enabled: true,
    endpoint: base === undefined ? undefined : signalEndpoint(base, s),
    headers: {},
    timeoutMs: 2000,
    ...over,
  });
  return { traces: one("traces"), logs: one("logs"), metrics: one("metrics") };
}

/** One small trace batch, whose span has the given name. */
function traceBatch(name: string): TraceBatch {
  const memory = memoryProcessor();
  let t = 1_000n;
  const started = startTelemetry({
    registry,
    env: { OTEL_SDK_DISABLED: "true" },
    processors: [memory],
    install: false,
    clock: () => t++,
    random: (n) => new Uint8Array(n).fill(9),
  });
  started.telemetry.span("test.step", { target: name }, () => ok(undefined));
  const span = memory.spans[0];
  assert(span !== undefined);
  return { resource: started.pipeline.resource, scope: { name: "test" }, spans: [span] };
}

type Received = {
  readonly server: Server;
  readonly base: string;
  readonly traces: TraceBatch[];
  readonly logs: LogBatch[];
  readonly metrics: MetricBatch[];
  readonly headers: Headers[];
};

/** A receiver on 127.0.0.1 that keeps what it decodes and the headers of each request. */
async function receiver(answer?: () => Response | undefined): Promise<Received> {
  const traces: TraceBatch[] = [];
  const logs: LogBatch[] = [];
  const metrics: MetricBatch[] = [];
  const headers: Headers[] = [];
  const handle = otlpReceiver({
    onTraces: (b) => void traces.push(...b),
    onLogs: (b) => void logs.push(...b),
    onMetrics: (b) => void metrics.push(...b),
  });
  // The wrapper is marked as the receiver is, so that a pipeline exporting here never traces its own exports.
  const server = await serve(
    { port: 0, hostname: "127.0.0.1" },
    untraced((req: Request) => {
      headers.push(req.headers);
      return answer?.() ?? handle(req);
    }),
  );
  return { server, base: `http://127.0.0.1:${server.addr.port}`, traces, logs, metrics, headers };
}

/** A `fetch` that never answers, but rejects when its signal aborts; it says whether it was aborted. */
function hangingFetch(): { readonly fetch: typeof fetch; readonly calls: number; readonly aborted: boolean } {
  const state = { calls: 0, aborted: false };
  const f = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    state.calls++;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        state.aborted = true;
        reject(new Error("aborted"));
      });
    });
  };
  return {
    fetch: f,
    get calls() {
      return state.calls;
    },
    get aborted() {
      return state.aborted;
    },
  };
}

/** A `fetch` that answers from a list of responses, one per call, and records each request. */
function scriptedFetch(responses: readonly (() => Response)[]): { readonly fetch: typeof fetch; readonly requests: RequestInit[] } {
  const requests: RequestInit[] = [];
  let i = 0;
  const f = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push(init ?? {});
    const next = responses[Math.min(i++, responses.length - 1)];
    return next === undefined ? Promise.reject(new Error("no response")) : Promise.resolve(next());
  };
  return { fetch: f, requests };
}

async function withStarted<T>(
  options: Parameters<typeof startTelemetry<typeof registry.kinds>>[0],
  f: (s: Started<typeof registry.kinds>) => Promise<T>,
): Promise<T> {
  const s = startTelemetry(options);
  try {
    return await f(s);
  } finally {
    await s.pipeline.shutdown(200);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-014
// ---------------------------------------------------------------------------------------------------------------------------------

proves(
  [EXPORT, RECEIVER],
  "an export is a POST of OTLP JSON with the configured headers, and the receiver gets the same batch back",
  async () => {
    const r = await receiver();
    try {
      const exporter = otlpExporter(exporters(r.base, { headers: { "x-team": "a" } }));
      const batch = traceBatch("site");
      assertEquals(await exporter.exportTraces([batch]), { kind: "success" });
      assertEquals(r.traces, [batch]);
      assertEquals(r.headers[0]?.get("content-type"), "application/json");
      assertEquals(r.headers[0]?.get("x-team"), "a");
      await exporter.shutdown(100);
    } finally {
      await r.server.shutdown();
    }
  },
);

proves([EXPORT], "a partial success is read and counted as rejected by the processor", async () => {
  const handle = otlpReceiver({ onTraces: () => ({ rejected: 1, errorMessage: "one span too old" }) });
  const server = await serve({ port: 0, hostname: "127.0.0.1" }, handle);
  try {
    const exporter = otlpExporter(exporters(`http://127.0.0.1:${server.addr.port}`));
    const batch = traceBatch("site");
    assertEquals(await exporter.exportTraces([batch]), { kind: "partial", rejected: 1, message: "one span too old" });
    const p = batchProcessor(exporter);
    const span = batch.spans[0];
    assert(span !== undefined);
    p.onEnd?.(span, { resource: batch.resource, scope: batch.scope });
    p.onEnd?.(span, { resource: batch.resource, scope: batch.scope });
    await p.shutdown(1000);
    assertEquals(p.stats().traces, { exported: 1, failed: 0, rejected: 1, dropped: 0, lastError: "one span too old" });
  } finally {
    await server.shutdown();
  }
});

proves([EXPORT], "503 with Retry-After: 1 is sent again after a second; 429, 502 and 504 without it after growing waits", async () => {
  const waits: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    waits.push(ms);
    return Promise.resolve();
  };
  const once = scriptedFetch([() => new Response("", { status: 503, headers: { "retry-after": "1" } }), () => new Response("{}")]);
  const a = otlpExporter(exporters("http://127.0.0.1:1"), { fetch: once.fetch, sleep });
  assertEquals(await a.exportLogs([]), { kind: "success" });
  assertEquals(once.requests.length, 2);
  assertEquals(waits, [1000]);

  waits.length = 0;
  const statuses = [429, 502, 504].map((status) => () => new Response("busy", { status }));
  const growing = scriptedFetch([...statuses, () => new Response("")]);
  const b = otlpExporter(exporters("http://127.0.0.1:1"), { fetch: growing.fetch, sleep, retryBaseMs: 10 });
  assertEquals(await b.exportMetrics([]), { kind: "success" });
  assertEquals(waits, [10, 20, 40]);
});

proves([EXPORT], "a real 503 then 200 from a server on 127.0.0.1 is retried and succeeds", async () => {
  let n = 0;
  const handle = otlpReceiver({});
  const server = await serve({ port: 0, hostname: "127.0.0.1" }, (req) =>
    n++ === 0 ? new Response("", { status: 503, headers: { "retry-after": "0" } }) : handle(req),
  );
  try {
    const exporter = otlpExporter(exporters(`http://127.0.0.1:${server.addr.port}`));
    assertEquals(await exporter.exportTraces([traceBatch("x")]), { kind: "success" });
    assertEquals(n, 2);
  } finally {
    await server.shutdown();
  }
});

proves([EXPORT], "failures never throw, give up when the wait would pass the timeout, and are said once", async () => {
  const warnings: string[] = [];
  const onWarning = (m: string): void => void warnings.push(m);
  const late = scriptedFetch([() => new Response("", { status: 503, headers: { "retry-after": "5" } })]);
  const a = otlpExporter(exporters("http://127.0.0.1:1", { timeoutMs: 500 }), { fetch: late.fetch, onWarning });
  const r = await a.exportTraces([]);
  assertEquals(r.kind, "failure");
  assertEquals(late.requests.length, 1);

  const bad = scriptedFetch([() => new Response("no", { status: 400 })]);
  const b = otlpExporter(exporters("http://user:pw@127.0.0.1:1"), { fetch: bad.fetch, onWarning });
  const r2 = await b.exportTraces([]);
  assertEquals(r2.kind, "failure");
  if (r2.kind === "failure") {
    assertStringIncludes(r2.message, "HTTP 400");
    assert(!r2.message.includes("pw"), "the endpoint's credential is never said");
  }
  assertEquals(bad.requests.length, 1, "400 is not retried");

  const thrown = (): Promise<Response> => Promise.reject(new Error("connection refused"));
  const c = otlpExporter(exporters("http://127.0.0.1:1"), { fetch: thrown, onWarning });
  assertEquals((await c.exportLogs([])).kind, "failure");
  assertEquals((await c.exportLogs([])).kind, "failure");
  assertEquals(c.warning()?.includes("connection refused"), true);
  assertEquals(warnings.length, 3, "one warning for each exporter, however many exports fail");
});

proves([EXPORT], "a pipeline whose exports fail says one warning for the run, as a warning signal too", async () => {
  const memory = memoryProcessor();
  const fail = (): Promise<Response> => Promise.reject(new Error("refused"));
  await withStarted(
    {
      registry,
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:1" },
      processors: [memory],
      install: false,
      exporter: { fetch: fail },
    },
    async (s) => {
      const heard: string[] = [];
      s.pipeline.onWarning((m) => void heard.push(m));
      s.telemetry.span("test.step", { target: "a" }, () => ok(undefined));
      s.telemetry.log("test.note", { path: "x" });
      await s.pipeline.forceFlush(1000);
      s.telemetry.span("test.step", { target: "b" }, () => ok(undefined));
      await s.pipeline.forceFlush(1000);
      assertEquals(heard.length, 1);
      assertStringIncludes(s.pipeline.warning() ?? "", "refused");
      assertEquals(memory.logs.filter((l) => l.eventName === "otel.warning").length, 1);
      assert(s.pipeline.stats().traces.failed >= 2);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-015
// ---------------------------------------------------------------------------------------------------------------------------------

proves(
  [PROBE],
  "with no endpoint and nothing answering, the probe gives up within 150 ms, nothing is sent, and it is said once",
  async () => {
    assertEquals(PROBE_TIMEOUT_MS, 150);
    const hang = hangingFetch();
    const warnings: string[] = [];
    const exporter = otlpExporter(exporters(undefined), { fetch: hang.fetch, onWarning: (m) => void warnings.push(m) });
    const started = Date.now();
    assertEquals((await exporter.exportTraces([])).kind, "failure");
    const took = Date.now() - started;
    assert(took >= 100 && took < 1000, `the probe took ${took} ms`);
    assertEquals((await exporter.exportLogs([])).kind, "failure");
    assertEquals(hang.calls, 1, "one probe, and no export");
    assertEquals(warnings.length, 1);
    assertStringIncludes(warnings[0] ?? "", "http://localhost:4318");

    // A port nothing listens on: refused at once.
    const closed = await serve({ port: 0, hostname: "127.0.0.1" }, () => new Response(""));
    await closed.shutdown();
    const none = otlpExporter(exporters(undefined), { defaultEndpoint: `http://127.0.0.1:${closed.addr.port}` });
    assertEquals((await none.exportTraces([])).kind, "failure");
  },
);

proves([PROBE], "with no endpoint and a collector answering at the default, the export goes there", async () => {
  const r = await receiver();
  try {
    const exporter = otlpExporter(exporters(undefined), { defaultEndpoint: r.base });
    const batch = traceBatch("probed");
    assertEquals(await exporter.exportTraces([batch]), { kind: "success" });
    assertEquals(r.traces, [batch], "the probe's empty request adds no batch");
    assertEquals(r.headers.length, 2, "the probe, then the export");
  } finally {
    await r.server.shutdown();
  }
});

proves([PROBE, EXPORT], "a collector that never answers: the wait at exit is at most a second, then it gives up and says so", async () => {
  assertEquals(EXIT_WAIT_MS, 1000);
  const hang = hangingFetch();
  const s = startTelemetry({
    registry,
    env: { OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:1" },
    install: false,
    exporter: { fetch: hang.fetch },
  });
  s.telemetry.span("test.step", { target: "a" }, () => ok(undefined));
  const started = Date.now();
  const r = await s.pipeline.shutdown();
  const took = Date.now() - started;
  assertEquals(r, { kind: "timeout" });
  assert(took >= 900 && took < 1500, `the wait at exit took ${took} ms`);
  assertStringIncludes(s.pipeline.warning() ?? "", "given up");
  for (let i = 0; i < 100 && !hang.aborted; i++) await proc.sleep(10);
  assert(hang.aborted, "the export in flight is aborted, so nothing keeps the process alive");
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-016
// ---------------------------------------------------------------------------------------------------------------------------------

proves([JOURNAL], "the journal writes one OTLP JSON line per export and rotates past its size, keeping the given number", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "logs", "run.jsonl");
    const journal = journalExporter({ path, maxBytes: 100, keep: 2 });
    const batches = ["a", "b", "c", "d", "e"].map(traceBatch);
    for (const b of batches) assertEquals(await journal.exportTraces([b]), { kind: "success" });
    const read = (p: string): readonly TraceBatch[] => {
      const lines = readFileSync(p, "utf8")
        .split("\n")
        .filter((l) => l !== "");
      assertEquals(lines.length, 1);
      const d = decodeTraces(JSON.parse(lines[0] ?? ""));
      assert(d.kind === "ok");
      return d.value;
    };
    const [, , c, d, e] = batches;
    assert(c !== undefined && d !== undefined && e !== undefined);
    assertEquals(read(path), [e]);
    assertEquals(read(`${path}.1`), [d]);
    assertEquals(read(`${path}.2`), [c]);
    assert(!existsSync(`${path}.3`));
    assertEquals(JSON.parse(readFileSync(path, "utf8")), encodeTraces([e]));
  });
});

proves(
  [JOURNAL],
  "a journal with a maximum age removes the files last written before it, when it starts and at each rotation",
  async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "run.jsonl");
      const day = 24 * 60 * 60 * 1000;
      let now = Date.now();
      const writtenAgo = (file: string, days: number): void => {
        writeFileSync(file, "{}\n");
        const at = (now - days * day) / 1000;
        utimesSync(file, at, at);
      };
      writtenAgo(path, 40);
      writtenAgo(`${path}.1`, 10);
      writtenAgo(`${path}.2`, 31);
      const journal = journalExporter({ path, maxBytes: 100, keep: 3, maxAgeDays: 30, now: () => now });
      assertEquals(await journal.exportTraces([traceBatch("a")]), { kind: "success" });
      assertEquals([existsSync(`${path}.1`), existsSync(`${path}.2`)], [true, false]);
      assertEquals(readFileSync(path, "utf8").split("\n").length, 2, "the file of 40 days was removed, so the journal holds one line");
      now += 25 * day;
      assertEquals(await journal.exportTraces([traceBatch("b")]), { kind: "success" });
      // rotated: run.jsonl.1 (10 days, now 35) became run.jsonl.2 and was removed; the line of today became run.jsonl.1
      assertEquals([existsSync(path), existsSync(`${path}.1`), existsSync(`${path}.2`)], [true, true, false]);
    });
  },
);

proves([JOURNAL], "a run keeps a journal of its spans, logs and metrics even with no collector", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "journal.jsonl");
    const s = startTelemetry({ registry, env: { OTEL_SDK_DISABLED: "true" }, journal: { path }, install: false });
    s.telemetry.span("test.step", { target: "kept" }, () => {
      s.telemetry.log("test.note", { path: "a.txt" });
      s.telemetry.add("test.files", 2, {});
      return ok(undefined);
    });
    assertEquals(await s.pipeline.shutdown(), { kind: "done" });
    const lines = readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l !== "");
    const text = lines.join("\n");
    assertStringIncludes(text, '"resourceSpans"');
    assertStringIncludes(text, '"resourceLogs"');
    assertStringIncludes(text, '"resourceMetrics"');
    assertStringIncludes(text, "kept");
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-017
// ---------------------------------------------------------------------------------------------------------------------------------

proves([CONTEXT], "AsyncLocalStorage carries the current span across await, each async path its own", async () => {
  const cm = asyncContextManager();
  const a = environmentParent({ TRACEPARENT });
  const b = environmentParent({ TRACEPARENT: `00-${TRACE_ID}-${"1".repeat(16)}-01` });
  assert(a !== undefined && b !== undefined);
  const seen = await Promise.all([
    cm.with(a, async () => {
      await proc.sleep(5);
      return cm.active();
    }),
    cm.with(b, async () => {
      await proc.sleep(1);
      return cm.active();
    }),
  ]);
  assertEquals(seen, [a, b]);
  assertEquals(cm.active(), undefined);
});

proves([CONTEXT], "the parent comes from TRACEPARENT and TRACESTATE, and spans after an await are children of the right span", async () => {
  const parent = environmentParent({ TRACEPARENT, TRACESTATE: "vendor=a" });
  assertEquals(parent?.traceState, [{ key: "vendor", value: "a" }]);
  assertEquals(environmentParent({ TRACEPARENT: TRACEPARENT.toUpperCase() }), undefined);
  const memory = memoryProcessor();
  await withStarted(
    { registry, env: { OTEL_SDK_DISABLED: "true", TRACEPARENT, TRACESTATE: "vendor=a" }, processors: [memory], install: false },
    async (s) => {
      await s.telemetry.span("test.step", { target: "outer" }, async () => {
        await proc.sleep(1);
        s.telemetry.span("test.step", { target: "inner" }, () => ok(undefined));
        return ok(undefined);
      });
      const [inner, outer] = memory.spans;
      assert(inner !== undefined && outer !== undefined);
      assertEquals(outer.context.traceId, TRACE_ID);
      assertEquals(outer.parentSpanId, SPAN_ID);
      assertEquals(outer.context.traceState, [{ key: "vendor", value: "a" }]);
      assertEquals(inner.parentSpanId, outer.context.spanId);
    },
  );
});

proves([CONTEXT], "the clock is nanoseconds since the epoch and never goes back", () => {
  const clock = systemClock();
  const a = clock();
  const b = clock();
  assert(b >= a);
  const now = BigInt(Date.now()) * 1_000_000n;
  assert(a > now - 10_000_000_000n && a < now + 10_000_000_000n);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-018
// ---------------------------------------------------------------------------------------------------------------------------------

const CHILD = `process.stdout.write(process.env.TRACEPARENT ?? "none"); process.exit(Number(process.argv[2] ?? 0));`;

function runtimeArgv(script: string, ...args: string[]): string[] {
  return [proc.execPath(), script, ...args];
}

function spansNamed(spans: readonly SpanData[], name: string): readonly SpanData[] {
  return spans.filter((s) => s.name === name);
}

proves([OWN], "with no pipeline installed, proc, the client and serve make no span and pass no traceparent", async () => {
  assertEquals(installed(), undefined);
  const saved = process.env["TRACEPARENT"];
  Reflect.deleteProperty(process.env, "TRACEPARENT");
  try {
    await withTempDir(async (dir) => {
      const script = join(dir, "child.js");
      await writeTextFile(script, CHILD);
      assertEquals((await proc.run(runtimeArgv(script))).stdout, "none");
    });
    let header: string | null = "unset";
    const server = await serve({ port: 0, hostname: "127.0.0.1" }, (req) => {
      header = req.headers.get("traceparent");
      return new Response("ok");
    });
    try {
      const x = await liveTransport().send({ method: "GET", url: `http://127.0.0.1:${server.addr.port}/`, headers: {} });
      assertEquals(x.kind === "ok" ? x.value.body : "", "ok");
      assertEquals(header, null);
    } finally {
      await server.shutdown();
    }
  } finally {
    if (saved !== undefined) process.env["TRACEPARENT"] = saved;
  }
});

proves(
  [OWN, CONTEXT],
  "proc.run is a client span with the command's shape and exit code, and the program gets its TRACEPARENT",
  async () => {
    const memory = memoryProcessor();
    await withStarted({ registry, env: { OTEL_SDK_DISABLED: "true" }, processors: [memory] }, async (s) => {
      assert(installed() === s.pipeline);
      await withTempDir(async (dir) => {
        const script = join(dir, "child.js");
        await writeTextFile(script, CHILD);
        const argv = runtimeArgv(script, "3");
        const r = await s.telemetry.span("test.step", { target: "run" }, () => proc.run(argv));
        assertEquals(r.code, 3);
        const span = spansNamed(memory.spans, "process")[0];
        const step = spansNamed(memory.spans, "test.step")[0];
        assert(span !== undefined && step !== undefined);
        assertEquals(span.kind, "client");
        assertEquals(span.parentSpanId, step.context.spanId);
        assertEquals(r.stdout, formatTraceparent(span.context), "the child's parent is the process span");
        assertEquals(span.attributes["process.command_args"], commandShape(argv));
        assert(!JSON.stringify(span.attributes["process.command_args"]).includes("child.js"), "never an operand");
        assertEquals(span.attributes["process.executable.name"], commandShape(argv)[0]);
        assertEquals(span.attributes["process.exit.code"], 3n);
        assertEquals(span.status.kind, "error");
      });
    });
    assertEquals(installed(), undefined, "shutting the pipeline down uninstalls it");
  },
);

proves([OWN], "the HTTP client's span sends traceparent, and serve's span is its child; the URL is redacted", async () => {
  const memory = memoryProcessor();
  await withStarted({ registry, env: { OTEL_SDK_DISABLED: "true" }, processors: [memory] }, async () => {
    let header: string | null = null;
    const server = await serve({ port: 0, hostname: "127.0.0.1" }, (req) => {
      header = req.headers.get("traceparent");
      return new Response("fine", { status: new URL(req.url).pathname === "/fail" ? 500 : 200 });
    });
    try {
      const base = `http://127.0.0.1:${server.addr.port}`;
      const http = liveTransport();
      await http.send({ method: "GET", url: `${base}/x?signature=abc&page=2`, headers: {} });
      const client = spansNamed(memory.spans, "http.client")[0];
      const served = spansNamed(memory.spans, "http.server")[0];
      assert(client !== undefined && served !== undefined);
      assertEquals(client.kind, "client");
      assertEquals(served.kind, "server");
      assertEquals(header, formatTraceparent(client.context));
      assertEquals(served.context.traceId, client.context.traceId);
      assertEquals(served.parentSpanId, client.context.spanId);
      assertEquals(client.attributes["url.full"], `${base}/x?signature=REDACTED&page=2`);
      assertEquals(client.attributes["server.address"], "127.0.0.1");
      assertEquals(client.attributes["server.port"], BigInt(server.addr.port));
      assertEquals(client.attributes["http.request.method"], "GET");
      assertEquals(client.attributes["http.response.status_code"], 200n);
      assertEquals(served.attributes["url.path"], "/x");
      assertEquals(served.attributes["http.response.status_code"], 200n);
      assertEquals(client.status.kind, "ok");

      memory.clear();
      await http.send({ method: "GET", url: `${base}/fail`, headers: {} });
      assertEquals(spansNamed(memory.spans, "http.client")[0]?.status, { kind: "error", message: "HTTP 500" });
      assertEquals(spansNamed(memory.spans, "http.server")[0]?.status, { kind: "error", message: "HTTP 500" });
    } finally {
      await server.shutdown();
    }
  });
});

proves([OWN, RECEIVER], "the receiver makes no span of its own, so a pipeline exporting to it does not feed itself", async () => {
  const memory = memoryProcessor();
  const r = await receiver();
  try {
    await withStarted({ registry, env: { OTEL_EXPORTER_OTLP_ENDPOINT: r.base }, processors: [memory] }, async (s) => {
      s.telemetry.span("test.step", { target: "sent" }, () => ok(undefined));
      assertEquals(await s.pipeline.forceFlush(1000), { kind: "done" });
      assertEquals(spansNamed(memory.spans, "http.server").length, 0);
      assertEquals(
        r.traces.flatMap((b) => b.spans.map((x) => x.attributes["target"])),
        ["sent"],
      );
      assertEquals(s.pipeline.warning(), undefined);
    });
  } finally {
    await r.server.shutdown();
  }
});

proves([OWN, EXPORT], "the resource names the service and the runtime, never the host or a person", () => {
  const s = startTelemetry({
    registry,
    service: "build",
    env: { OTEL_SDK_DISABLED: "true", OTEL_BSP_MAX_QUEUE_SIZE: "x" },
    install: false,
  });
  const a = s.pipeline.resource.attributes;
  assertEquals(a["service.name"], "build");
  assertEquals(a["process.runtime.name"], proc.runtimeName());
  assert(typeof a["os.type"] === "string" && typeof a["host.arch"] === "string");
  for (const k of Object.keys(a)) assert(!/host\.name|user|owner/.test(k), k);
  assertEquals(s.configWarnings.length, 1);
  const named = startTelemetry({
    registry,
    service: "build",
    env: { OTEL_SDK_DISABLED: "true", OTEL_SERVICE_NAME: "svc" },
    install: false,
  });
  assertEquals(named.pipeline.resource.attributes["service.name"], "svc");
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-019
// ---------------------------------------------------------------------------------------------------------------------------------

proves([RECEIVER], "the receiver: 415 for protobuf, 400 with the path, 404, 405, and OTLP's success body (gzip too)", async () => {
  const r = await receiver();
  try {
    const post = (path: string, body: BodyInit, headers: Record<string, string>): Promise<Response> =>
      fetch(`${r.base}${path}`, { method: "POST", body, headers });
    const json = { "content-type": "application/json" };

    const proto = await post("/v1/traces", new Uint8Array([10, 0]), { "content-type": "application/x-protobuf" });
    assertEquals(proto.status, 415);
    await proto.body?.cancel();

    const notJson = await post("/v1/logs", "{", json);
    assertEquals(notJson.status, 400);
    await notJson.body?.cancel();

    const bad = await post("/v1/traces", JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: 5 }] }] }] }), json);
    assertEquals(bad.status, 400);
    const status: unknown = await bad.json();
    assert(typeof status === "object" && status !== null && "message" in status && typeof status.message === "string");
    assertStringIncludes(status.message, "$.resourceSpans[0]");

    const other = await post("/v1/profiles", "{}", json);
    assertEquals(other.status, 404);
    await other.body?.cancel();
    const get = await fetch(`${r.base}/v1/traces`);
    assertEquals(get.status, 405);
    await get.body?.cancel();

    const good = await post("/v1/traces", JSON.stringify(encodeTraces([traceBatch("ok")])), {
      "content-type": "application/json; charset=utf-8",
    });
    assertEquals(good.status, 200);
    assertEquals(await good.json(), {});

    const zipped = new Response(
      new Blob([JSON.stringify(encodeTraces([traceBatch("zipped")]))]).stream().pipeThrough(new CompressionStream("gzip")),
    );
    const gz = await post("/v1/traces", new Uint8Array(await zipped.arrayBuffer()), { ...json, "content-encoding": "gzip" });
    assertEquals(gz.status, 200);
    await gz.body?.cancel();
    assertEquals(
      r.traces.flatMap((b) => b.spans.map((s) => s.attributes["target"])),
      ["ok", "zipped"],
    );
  } finally {
    await r.server.shutdown();
  }
});

proves(
  [CONTEXT, "0008-test-evidence FR-004"],
  "a pipeline hands a span or a log record made elsewhere to every processor, with its source, until shut down",
  async () => {
    const first = memoryProcessor();
    const second = memoryProcessor();
    const errors: unknown[] = [];
    const throwing = {
      ...memoryProcessor(),
      onEnd: (): void => {
        throw new Error("a processor that throws");
      },
    };
    const pipeline = createPipeline({
      resource: { attributes: { "service.name": "a" } },
      processors: [first, throwing],
      onError: (e) => errors.push(e),
    });
    pipeline.addProcessor(second);
    const traceId = parseTraceId(TRACE_ID);
    const spanId = parseSpanId(SPAN_ID);
    assert(traceId.kind === "ok" && spanId.kind === "ok");
    const span: SpanData = {
      name: "test",
      context: { traceId: traceId.value, spanId: spanId.value, traceFlags: 1, traceState: [], isRemote: false },
      kind: "internal",
      startTime: 1n,
      endTime: 2n,
      attributes: { "test.case.name": "x" },
      events: [],
      links: [],
      status: { kind: "ok" },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    };
    const source = { resource: { attributes: { "service.name": "ifc-test" } }, scope: { name: "ifc-test" } };
    pipeline.emit({ kind: "span", span }, source);
    pipeline.emit(
      {
        kind: "log",
        record: {
          time: 3n,
          observedTime: 3n,
          severityNumber: SEVERITY.INFO,
          severityText: "INFO",
          body: "b",
          attributes: {},
          droppedAttributesCount: 0,
        },
      },
      source,
    );
    for (const m of [first, second]) {
      assertEquals(m.spans, [span]);
      assertEquals(
        m.logs.map((l) => l.body),
        ["b"],
      );
      assertEquals(m.entries[0]?.source, source);
    }
    assertEquals(errors.length, 1);
    await pipeline.shutdown(100);
    pipeline.emit({ kind: "span", span }, source);
    assertEquals(first.spans.length, 1);
  },
);
