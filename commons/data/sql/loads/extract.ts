// Spec: 0054-sql-loads FR-003
/**
 * Extracts (commons data 0054-sql-loads): the rows of a typed select as CSV (RFC 4180, a header, null as an empty cell) or as lines of JSON. The text is returned and nothing is written, so that the caller
 * puts it in a file, a response or a bucket; a CSV that is extracted is read again by `fromCsv` to the same rows.
 *
 * @module
 */
import type { Runner, Scope, Select } from "@intellectual-frontiers/data/sql/typed";

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV text of the rows of a select, with the keys of its row as the header. */
export async function extractCsv<R>(select: Select<Scope, R>, on: Runner): Promise<string> {
  const rows = (await select.run(on)) as readonly Record<string, unknown>[];
  const keys = rows[0] === undefined ? [] : Object.keys(rows[0]);
  return `${[keys.map(cell).join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\r\n")}\r\n`;
}

/** Lines of JSON, one for each row of a select. */
export async function extractJsonLines<R>(select: Select<Scope, R>, on: Runner): Promise<string> {
  const rows = await select.run(on);
  return rows.map((r) => JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? Number(v) : v))).join("\n") + (rows.length === 0 ? "" : "\n");
}
