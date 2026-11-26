/**
 * Questions of captured signals in SQL (commons telemetry 0002-telemetry-query): the relations of spans, logs and metric points made from real signals, the questions that are answered and refused, a journal written by the exporter and read back, and the command.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { withTempDir } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { journalExporter } from "../src/physical/otel.ts";
import { main, parseJournal, readJournal } from "../src/physical/query.ts";
import { signalsCatalog, signalsRelations, type Signals, querySignals } from "../src/logical/query.ts";
import { createTelemetry, defineSignals, memoryProcessor } from "../src/logical/signals.ts";

const registry = defineSignals({
  "app.request": { signal: "span", role: "step", attributes: { route: "string", "retries?": "int" } },
  "app.warn": { signal: "log", role: "warning", severity: 13, attributes: { code: "string" } },
  "app.requests": { signal: "counter", role: "none", unit: "{request}", attributes: { route: "string" } },
});

/** A run of two requests, one of which fails, with a warning and a counter, as signals; each tick of the clock is a millisecond. */
function capture(): Signals {
  const memory = memoryProcessor();
  let t = 1_700_000_000_000_000_000n;
  let ids = 0;
  const telemetry = createTelemetry({
    registry,
    resource: { attributes: { "service.name": "shop" } },
    scope: { name: "shop.web" },
    clock: () => (t += 1_000_000n),
    random: (n) => new Uint8Array(n).fill(++ids),
    processors: [memory],
  });
  telemetry.span("app.request", { route: "/cart" }, () => {
    telemetry.add("app.requests", 1, { route: "/cart" });
    return ok("fine");
  });
  telemetry.span("app.request", { route: "/pay", retries: 2 }, () => {
    telemetry.log("app.warn", { code: "slow" }, "payment took long");
    return { kind: "err", error: "declined" } as const;
  });
  telemetry.collect();
  const source = telemetry.source;
  return {
    traces: [{ ...source, spans: memory.spans }],
    logs: [{ ...source, records: memory.logs }],
    metrics: memory.metrics.map((metrics) => ({ ...source, metrics })),
  };
}

const rows = (signals: Signals, sql: string, params: readonly (string | number)[] = []) => {
  const r = querySignals(signals, sql, { params });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-telemetry-query FR-001", "0002-telemetry-query FR-002"], "spans, their attributes and events, log records and metric points are relations with the columns of the catalog, a span's duration is in milliseconds and its start an instant", () => {
  const signals = capture();
  const t = signalsRelations(signals);
  assertEquals(t["spans"]?.rows.length, 2);
  assertEquals(t["logs"]?.rows.length, 1);
  assert((t["metric_points"]?.rows.length ?? 0) >= 1, "a metric point");
  for (const [name, table] of Object.entries(t)) assertEquals(table.columns, Object.keys(signalsCatalog().tables[name]?.columns ?? {}), name);
  const first = rows(signals, "SELECT service, scope, duration_ms, start_time, status FROM spans ORDER BY start_time").rows[0];
  assertEquals(first?.slice(0, 2), ["shop", "shop.web"]);
  assert(typeof first?.[2] === "number" && first[2] > 0, "a duration in milliseconds");
  assert(String(first?.[3]).startsWith("2023-11-1"), "an instant");
  assertEquals(rows(signals, "SELECT value FROM span_attributes WHERE key = 'retries'").rows, [["2"]]);
});

proves(["0002-telemetry-query FR-003"], "questions are one line of SQL each (the errors of a service, the slowest span, the warnings of a trace), a parameter is not SQL, the answer is cut at the limit, and a write, two statements and an unknown column are refused as values", () => {
  const signals = capture();
  assertEquals(rows(signals, "SELECT name, status FROM spans WHERE status = 'error'").rows, [["app.request", "error"]]);
  assertEquals(rows(signals, "SELECT status, count(*) AS n FROM spans GROUP BY status ORDER BY status").rows, [["error", 1], ["ok", 1]]);
  assertEquals(rows(signals, "SELECT body FROM logs WHERE severity >= ?", [13]).rows, [["payment took long"]]);
  assertEquals(rows(signals, "SELECT l.body, s.name FROM logs l JOIN spans s ON s.span_id = l.span_id").rows, [["payment took long", "app.request"]]);
  const cut = querySignals(signals, "SELECT name FROM spans ORDER BY start_time", { limit: 1 });
  assert(cut.kind === "ok" && cut.value.rows.length === 1 && cut.value.truncated, "cut");
  for (const bad of ["DELETE FROM spans", "SELECT 1; SELECT 2", "SELECT nope FROM spans", "SELECT * FROM nowhere"]) assert(querySignals(signals, bad).kind === "err", bad);
  const unknown = querySignals(signals, "SELECT duration_m FROM spans");
  assert(unknown.kind === "err" && unknown.error.includes("duration_ms"), unknown.kind === "err" ? unknown.error : "ok");
});

proves(["0002-telemetry-query FR-004", "0002-telemetry-query FR-005"], "a journal written by the exporter is read back line by line (a line that does not decode is counted and left out), and the command prints a table, gives 1 for a refused question and 2 for a line that does not fit", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.jsonl");
    const signals = capture();
    const journal = journalExporter({ path });
    assertEquals(await journal.exportTraces(signals.traces ?? []), { kind: "success" });
    assertEquals(await journal.exportLogs(signals.logs ?? []), { kind: "success" });
    assertEquals(await journal.exportMetrics(signals.metrics ?? []), { kind: "success" });
    const read = await readJournal([path, join(dir, "missing.jsonl")]);
    assertEquals([read.signals.traces?.length, read.signals.logs?.length, read.skipped], [1, 1, 0]);
    assertEquals(rows(read.signals, "SELECT count(*) AS n FROM spans").rows, [[2]]);
    assertEquals(parseJournal(["not json\n{\"resourceSpans\": 3}\n[1]\n\n{\"other\": 1}\n"]).skipped, 4);
    const ran = await main([path, "--", "SELECT name FROM spans WHERE status = 'error'"]);
    assertEquals(ran.code, 0);
    assert(ran.lines[0]?.startsWith("name"), "a table");
    const json = await main(["--json", path, "--", "SELECT count(*) AS n FROM logs"]);
    assertEquals(json.lines[0], '{"columns":["n"],"rows":[[1]],"truncated":false}');
    assertEquals((await main([path, "--", "DELETE FROM spans"])).code, 1);
    assertEquals((await main(["--", "SELECT 1"])).code, 2);
    assertEquals((await main([path, "SELECT 1"])).code, 2);
  });
});
