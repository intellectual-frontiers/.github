// Spec: 0002-telemetry-query FR-004, FR-005
/**
 * The journal of signals, read for a question (commons telemetry 0002-telemetry-query FR-004, FR-005): each line of the journal files is one OTLP/JSON export request (`resourceSpans`, `resourceLogs` or `resourceMetrics`), decoded as the
 * exporter encoded it, and a line that does not decode is counted and left out. `main` is the command line `[--limit N] [--json] FILE... -- "SELECT ..."`: the answer as a table or JSON; it writes nothing.
 *
 * @example
 * ```sh
 * bun tools/query.ts ~/.cache/app/telemetry.jsonl -- "SELECT name, duration_ms FROM spans ORDER BY duration_ms DESC LIMIT 5"
 * ```
 *
 * @module
 */
import { readTextOr } from "@intellectual-frontiers/system/fs";
import { decodeLogs, decodeMetrics, decodeTraces, type LogBatch, type MetricBatch, type TraceBatch } from "../otlp.ts";
import { type Answer, querySignals, type Signals } from "../query.ts";

/** What a journal gave: the signals, and how many lines did not decode. */
export type Journal = { readonly signals: Signals; readonly skipped: number };

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The signals of the text of journal files: a line of each kind decodes with its own decoder; a blank line is nothing, and any other line is skipped. */
export function parseJournal(texts: readonly string[]): Journal {
  const traces: TraceBatch[] = [];
  const logs: LogBatch[] = [];
  const metrics: MetricBatch[] = [];
  let skipped = 0;
  for (const text of texts) {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line === "") continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        skipped++;
        continue;
      }
      if (!isRecord(value)) {
        skipped++;
        continue;
      }
      if ("resourceSpans" in value) {
        const d = decodeTraces(value);
        if (d.kind === "ok") traces.push(...d.value);
        else skipped++;
      } else if ("resourceLogs" in value) {
        const d = decodeLogs(value);
        if (d.kind === "ok") logs.push(...d.value);
        else skipped++;
      } else if ("resourceMetrics" in value) {
        const d = decodeMetrics(value);
        if (d.kind === "ok") metrics.push(...d.value);
        else skipped++;
      } else skipped++;
    }
  }
  return { signals: { traces, logs, metrics }, skipped };
}

/** The signals of journal files, read in the order given (a file that is not there is empty). */
export async function readJournal(paths: readonly string[]): Promise<Journal> {
  return parseJournal(await Promise.all(paths.map((p) => readTextOr(p, ""))));
}

/** The rows as aligned text: a header, then a row for each. */
export function tableText(answer: Answer): string {
  const text = answer.rows.map((r) => r.map((v) => (v === null ? "" : String(v))));
  const width = answer.columns.map((c, i) => Math.max(c.length, ...text.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]): string => r.map((c, i) => c.padEnd(width[i] ?? 0)).join("  ").trimEnd();
  return [line(answer.columns), ...text.map(line)].join("\n");
}

/** The command line: the exit status (0 an answer, 1 a refused question, 2 a line that does not fit) and what to print. */
export async function main(argv: readonly string[]): Promise<{ readonly code: 0 | 1 | 2; readonly lines: readonly string[] }> {
  const usage = { code: 2 as const, lines: ['usage: query [--limit N] [--json] FILE... -- "SELECT ..."'] };
  const split = argv.indexOf("--");
  if (split < 0) return usage;
  const sql = argv.slice(split + 1);
  const options = argv.slice(0, split);
  const files: string[] = [];
  let limit: number | undefined;
  let json = false;
  for (let i = 0; i < options.length; i++) {
    const a = options[i] ?? "";
    if (a === "--limit") limit = Number(options[++i]);
    else if (a === "--json") json = true;
    else files.push(a);
  }
  if (sql.length !== 1 || files.length === 0 || (limit !== undefined && (!Number.isInteger(limit) || limit < 0))) return usage;
  const journal = await readJournal(files);
  const answer = querySignals(journal.signals, sql[0] ?? "", limit === undefined ? {} : { limit });
  if (answer.kind === "err") return { code: 1, lines: [answer.error] };
  const note = journal.skipped > 0 ? [`(${journal.skipped} journal line${journal.skipped === 1 ? "" : "s"} did not decode)`] : [];
  return { code: 0, lines: [json ? JSON.stringify(answer.value) : tableText(answer.value), ...(answer.value.truncated ? [`(cut at ${limit ?? 1000} rows)`] : []), ...note] };
}
