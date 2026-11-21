// Spec: 0002-mizan-query FR-004
/**
 * A library's trace, read for a question (commons mizan 0002-mizan-query FR-004): the findings of the trace of the sources and tests at `root` to its specifications, the baseline `trace.baseline.txt` and the specifications, answered with
 * `queryTrace`. A command line `--root DIR "SELECT ..."` prints the answer as a table; it writes nothing.
 *
 * @example
 * ```sh
 * bun tools/query.ts "SELECT rule, count(*) AS n FROM findings GROUP BY rule"
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { readTextOr } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { type Answer, queryTrace, type TraceRecords } from "../query.ts";
import { parseBaseline, traceFindings } from "../trace.ts";
import { readSources, readSpecs } from "./trace.ts";

/** The records of the library at `root`: its findings, its baseline and its specifications (in `spec-kit/specs`). */
export async function traceRecords(root: string): Promise<TraceRecords> {
  const specs = await readSpecs(root, "spec-kit/specs");
  const sources = await readSources(root, ["about.ts", "src", "tools"]);
  const tests = await readSources(root, ["suite"]);
  const findings = traceFindings({ specs, sources, tests, ontology: [], specsFolder: "spec-kit/specs" });
  return { findings, baseline: parseBaseline(await readTextOr(join(root, "trace.baseline.txt"), "")), specs };
}

/** One question of the library at `root`. */
export async function queryLibrary(root: string, sql: string, options: { readonly limit?: number } = {}): Promise<Result<Answer, string>> {
  const records = await traceRecords(root);
  return queryTrace(records, sql, options);
}

/** The rows as aligned text: a header, then a row for each. */
export function tableText(answer: Answer): string {
  const text = answer.rows.map((r) => r.map((v) => (v === null ? "" : String(v))));
  const width = answer.columns.map((c, i) => Math.max(c.length, ...text.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]): string => r.map((c, i) => c.padEnd(width[i] ?? 0)).join("  ").trimEnd();
  return [line(answer.columns), ...text.map(line)].join("\n");
}

/** The command line: `[--root DIR] [--limit N] SQL`; the exit status and what to print. */
export async function main(argv: readonly string[], defaultRoot: string): Promise<{ readonly code: 0 | 1 | 2; readonly lines: readonly string[] }> {
  let root = defaultRoot;
  let limit: number | undefined;
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--root") root = argv[++i] ?? root;
    else if (a === "--limit") limit = Number(argv[++i]);
    else words.push(a);
  }
  if (words.length !== 1 || (limit !== undefined && (!Number.isInteger(limit) || limit < 0))) return { code: 2, lines: ["usage: query [--root DIR] [--limit N] \"SELECT ...\""] };
  const answer = await queryLibrary(root, words[0] ?? "", limit === undefined ? {} : { limit });
  if (answer.kind === "err") return { code: 1, lines: [answer.error] };
  return { code: 0, lines: [tableText(answer.value), ...(answer.value.truncated ? [`(cut at ${limit ?? 1000} rows)`] : [])] };
}
