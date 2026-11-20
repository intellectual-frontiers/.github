/**
 * Tests of the runtime's own signals through the HTTP client and `serve` (commons 0001-telemetry FR-018, FR-019): with no pipeline installed `proc`, the client and `serve` make no span and pass no
 * `traceparent`; with one, the client's span sends its `traceparent`, `serve`'s span is its child, the URL is redacted, and the OTLP receiver makes no span of its own, so that a pipeline exporting
 * to it does not feed itself. They are the part of the telemetry's tests that needs the network library, which is lifted later; they stay with it (`runtime/http-client.ts`, `runtime/serve.ts`) until
 * then and move into its suite.
 *
 * @module
 */
import process from "node:process";
import { ok } from "@intellectual-frontiers/core";
import { withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { formatTraceparent, SEVERITY, type SpanData } from "@intellectual-frontiers/telemetry/otel";
import type { LogBatch, MetricBatch, TraceBatch } from "@intellectual-frontiers/telemetry/otlp";
import { defineSignals, memoryProcessor } from "@intellectual-frontiers/telemetry/signals";
import { installed, otlpReceiver, type Started, startTelemetry, untraced } from "@intellectual-frontiers/telemetry/host/otel";
import { liveTransport } from "../src/http-client.ts";
import { serve, type Server } from "../src/serve.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const OWN = "0001-net FR-016";
const RECEIVER = "0001-net FR-016";

const registry = defineSignals({
  "test.step": { signal: "span", role: "step", attributes: { target: "string" } },
  "test.note": { signal: "log", role: "detail", severity: SEVERITY.INFO, attributes: { path: "string" } },
  "test.files": { signal: "counter", role: "none", unit: "{file}", attributes: {} },
});

type Received = {
  readonly server: Server;
  readonly base: string;
  readonly traces: TraceBatch[];
  readonly logs: LogBatch[];
  readonly metrics: MetricBatch[];
  readonly headers: Headers[];
};

/** A receiver on 127.0.0.1 over `serve` that keeps what it decodes and the headers of each request. */
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

const CHILD = `process.stdout.write(process.env.TRACEPARENT ?? "none"); process.exit(Number(process.argv[2] ?? 0));`;

function runtimeArgv(script: string, ...args: string[]): string[] {
  return [proc.execPath(), script, ...args];
}

function spansNamed(spans: readonly SpanData[], name: string): readonly SpanData[] {
  return spans.filter((s) => s.name === name);
}

void ok;

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
