/**
 * The conformance of `runtime/otel.ts` with the OpenTelemetry Collector (commons 0006-signals FR-020): where `IFC_OTELCOL` names a
 * collector binary (the contrib distribution, pinned with its SHA-256 in commons' pins, which CI downloads and verifies), the test writes
 * its configuration (an OTLP/HTTP receiver on a free port of 127.0.0.1, the file exporter writing JSON, a pipeline for each signal, its
 * own telemetry quiet), starts it, waits until it answers, sends a span tree, log records and metrics with the runtime's exporter, stops
 * it with SIGTERM, reads the file it wrote (one OTLP JSON export request per line) with the kernel's decoders, and finds every span, log
 * record and metric sent with the same ids, attributes and values. Without `IFC_OTELCOL` it is skipped, and says why.
 *
 * @module
 */
import { createServer } from "node:net";
import { type ExporterConfig, type OtelConfig, SEVERITY, type SignalName, signalEndpoint } from "../../kernel/otel.ts";
import { decodeLogs, decodeMetrics, decodeTraces, type LogBatch, type MetricBatch, type TraceBatch } from "../../kernel/otlp.ts";
import { err, ok } from "../../kernel/result.ts";
import { createTelemetry, defineSignals, memoryProcessor } from "../../kernel/signals.ts";
import { readTextFile, withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { otlpExporter, systemClock, systemRandom } from "../../runtime/otel.ts";
import { join } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0006-signals FR-020";
const COLLECTOR = proc.env.get("IFC_OTELCOL");

const registry = defineSignals({
  "conformance.run": { signal: "span", role: "step", attributes: { suite: "string", "count?": "int" } },
  "conformance.step": {
    signal: "span",
    role: "detail",
    spanKind: "client",
    attributes: { name: "string", ratio: "double", ok: "boolean" },
  },
  "conformance.note": { signal: "log", role: "detail", severity: SEVERITY.WARN, attributes: { path: "string", tags: "string[]" } },
  "conformance.files": { signal: "counter", role: "none", unit: "{file}", attributes: { kind: "string" } },
  "conformance.depth": { signal: "gauge", role: "none", unit: "{level}", attributes: {} },
  "conformance.duration": { signal: "histogram", role: "none", unit: "ms", attributes: {} },
});

/** A port of 127.0.0.1 that was free a moment ago. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** The collector's configuration: the OTLP/HTTP receiver, the file exporter (JSON), one pipeline per signal, its own telemetry quiet. */
function collectorConfig(port: number, file: string): string {
  return [
    "receivers:",
    "  otlp:",
    "    protocols:",
    "      http:",
    `        endpoint: 127.0.0.1:${port}`,
    "exporters:",
    "  file:",
    `    path: ${JSON.stringify(file)}`,
    "    format: json",
    "service:",
    "  telemetry:",
    "    logs:",
    "      level: warn",
    "    metrics:",
    "      level: none",
    "  pipelines:",
    "    traces:",
    "      receivers: [otlp]",
    "      exporters: [file]",
    "    logs:",
    "      receivers: [otlp]",
    "      exporters: [file]",
    "    metrics:",
    "      receivers: [otlp]",
    "      exporters: [file]",
    "",
  ].join("\n");
}

/** Waits until something answers HTTP at `url`, for at most `ms`. */
async function answers(url: string, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(500),
      });
      await res.body?.cancel();
      return true;
    } catch {
      await proc.sleep(100);
    }
  }
  return false;
}

proves(
  [FR],
  "the OpenTelemetry Collector receives every span, log record and metric sent, with the same ids, attributes and values",
  async () => {
    assert(COLLECTOR !== undefined);
    await withTempDir(async (dir) => {
      const port = await freePort();
      const file = join(dir, "received.jsonl");
      const config = join(dir, "collector.yaml");
      await writeTextFile(config, collectorConfig(port, file));
      const stop = new AbortController();
      const running = proc.output([COLLECTOR, `--config=${config}`], { signal: stop.signal, killAfterMs: 10_000 });
      let stopped = false;
      try {
        const base = `http://127.0.0.1:${port}`;
        assert(await answers(signalEndpoint(base, "traces"), 30_000), "the collector did not start listening within 30 s");

        // What is sent: a span tree (a root, two children, one an error), two log records in it, and a counter, a gauge and a histogram.
        const memory = memoryProcessor();
        const telemetry = createTelemetry({
          registry,
          resource: { attributes: { "service.name": "ifc-ts-conformance", "deployment.environment.name": "ci" } },
          scope: { name: "ifc-ts/conformance", version: "1.0.0" },
          clock: systemClock(),
          random: systemRandom,
          processors: [memory],
        });
        telemetry.span("conformance.run", { suite: "otel", count: 2 }, (run) => {
          run.span("conformance.step", { name: "first", ratio: 0.25, ok: true }, (step) => {
            step.event("checkpoint", { at: 1n });
            step.log("conformance.note", { path: "a/b.txt", tags: ["x", "y"] }, { said: "hello", n: 3n });
            return ok(undefined);
          });
          run.span("conformance.step", { name: "second", ratio: 1.5, ok: false }, () => err("not found"));
          run.log("conformance.note", { path: "c.txt", tags: [] }, "plain text");
          return ok(undefined);
        });
        telemetry.add("conformance.files", 3, { kind: "ts" });
        telemetry.add("conformance.files", 4, { kind: "md" });
        telemetry.set("conformance.depth", 7, {});
        for (const v of [1, 12, 120]) telemetry.record("conformance.duration", v, {});
        const metrics = telemetry.collect();
        const source = telemetry.source;
        const sentTraces: TraceBatch[] = [{ ...source, spans: memory.spans }];
        const sentLogs: LogBatch[] = [{ ...source, records: memory.logs }];
        const sentMetrics: MetricBatch[] = [{ ...source, metrics }];

        const one = (s: SignalName): ExporterConfig => ({
          enabled: true,
          endpoint: signalEndpoint(base, s),
          headers: {},
          timeoutMs: 10_000,
        });
        const exporters: OtelConfig["exporters"] = { traces: one("traces"), logs: one("logs"), metrics: one("metrics") };
        const exporter = otlpExporter(exporters);
        assertEquals(await exporter.exportTraces(sentTraces), { kind: "success" });
        assertEquals(await exporter.exportLogs(sentLogs), { kind: "success" });
        assertEquals(await exporter.exportMetrics(sentMetrics), { kind: "success" });
        await exporter.shutdown(1000);

        stop.abort();
        stopped = true;
        const exited = await running;
        assert(
          exited.code === 0 || exited.signal === "SIGTERM",
          `the collector ended with ${exited.code}: ${new TextDecoder().decode(exited.stderr)}`,
        );

        const received = { traces: [] as TraceBatch[], logs: [] as LogBatch[], metrics: [] as MetricBatch[] };
        for (const line of (await readTextFile(file)).split("\n")) {
          if (line.trim() === "") continue;
          const request: unknown = JSON.parse(line);
          assert(typeof request === "object" && request !== null);
          if ("resourceSpans" in request) {
            const d = decodeTraces(request);
            assert(d.kind === "ok", JSON.stringify(d));
            received.traces.push(...d.value);
          } else if ("resourceLogs" in request) {
            const d = decodeLogs(request);
            assert(d.kind === "ok", JSON.stringify(d));
            received.logs.push(...d.value);
          } else if ("resourceMetrics" in request) {
            const d = decodeMetrics(request);
            assert(d.kind === "ok", JSON.stringify(d));
            received.metrics.push(...d.value);
          }
        }

        for (const b of [...received.traces, ...received.logs, ...received.metrics]) {
          assertEquals(b.resource.attributes["service.name"], "ifc-ts-conformance");
          assertEquals(b.resource.attributes["deployment.environment.name"], "ci");
          assertEquals(b.scope.name, "ifc-ts/conformance");
          assertEquals(b.scope.version, "1.0.0");
        }

        const spans = received.traces.flatMap((b) => b.spans);
        assertEquals(spans.length, memory.spans.length);
        for (const sent of memory.spans) {
          const got = spans.find((s) => s.context.spanId === sent.context.spanId);
          assert(got !== undefined, `the span ${sent.name} ${sent.context.spanId} was not received`);
          assertEquals(got.context.traceId, sent.context.traceId);
          assertEquals(got.parentSpanId, sent.parentSpanId);
          assertEquals(got.name, sent.name);
          assertEquals(got.kind, sent.kind);
          assertEquals(got.startTime, sent.startTime);
          assertEquals(got.endTime, sent.endTime);
          assertEquals(got.attributes, sent.attributes);
          assertEquals(got.status, sent.status);
          assertEquals(
            got.events.map((e) => [e.name, e.time, e.attributes]),
            sent.events.map((e) => [e.name, e.time, e.attributes]),
          );
        }

        const records = received.logs.flatMap((b) => b.records);
        assertEquals(records.length, memory.logs.length);
        for (const sent of memory.logs) {
          const got = records.find((r) => r.time === sent.time && r.spanId === sent.spanId);
          assert(got !== undefined, `the log record at ${sent.time} was not received`);
          assertEquals(got.traceId, sent.traceId);
          assertEquals(got.severityNumber, sent.severityNumber);
          assertEquals(got.severityText, sent.severityText);
          assertEquals(got.body, sent.body);
          assertEquals(got.attributes, sent.attributes);
        }

        const gotMetrics = received.metrics.flatMap((b) => b.metrics);
        assertEquals(gotMetrics.length, metrics.length);
        for (const sent of metrics) {
          const got = gotMetrics.find((m) => m.name === sent.name);
          assert(got !== undefined, `the metric ${sent.name} was not received`);
          assertEquals(got.unit, sent.unit);
          assertEquals(got.data, sent.data);
        }
      } finally {
        if (!stopped) {
          stop.abort();
          await running.catch(() => undefined);
        }
      }
    });
  },
  { skip: COLLECTOR === undefined ? "IFC_OTELCOL does not name an OpenTelemetry Collector binary (CI sets it)" : false, timeout: 120_000 },
);
