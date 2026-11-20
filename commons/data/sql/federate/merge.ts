// Spec: 0059-sql-federate FR-005, FR-006, FR-007
/**
 * Merging (commons data 0059-sql-federate): the rows of a fan-out are loaded, tagged with the target they came from, into tables of an engine the caller gives (DuckDB is the one meant for it), where the merge is SQL: a
 * `fleet_rows` table with a column for each column of the answers (the type they all agree on, or text where they do not), the target, when it was collected and a key that is the same for the same row; and a
 * `fleet_targets` table with what each target answered. Counting by a column and finding the targets that differ are given as queries over those tables.
 *
 * @module
 */
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { runLoad, fromRows } from "@intellectual-frontiers/data/sql/loads";
import { defineTable, type Runner, type Table } from "@intellectual-frontiers/data/sql/typed";
import type { FanOut, Row } from "./fanout.ts";

/** The type a column of the merged rows has. */
export type ColumnType = "text" | "integer" | "decimal" | "boolean";

/** A column of the merged rows. */
export interface MergedColumn {
  readonly name: string;
  readonly type: ColumnType;
  /** Whether the targets gave it in more than one type, and it is text for that. */
  readonly mixed: boolean;
}

const typeOf = (v: unknown): ColumnType | undefined =>
  v === null || v === undefined ? undefined : typeof v === "boolean" ? "boolean" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "decimal") : "text";

/** The columns of the answers and the type each has: the one every non-null value has, `decimal` where numbers are whole and not, and text where they disagree. */
export function columnsOf(result: FanOut): readonly MergedColumn[] {
  const seen = new Map<string, Set<ColumnType>>();
  for (const o of result.outcomes)
    if (o.status === "ok")
      for (const r of o.rows)
        for (const [k, v] of Object.entries(r)) {
          const s = seen.get(k) ?? new Set<ColumnType>();
          const t = typeOf(v);
          if (t !== undefined) s.add(t);
          seen.set(k, s);
        }
  return [...seen].map(([name, types]) => {
    const ts = [...types];
    if (ts.length <= 1) return { name, type: ts[0] ?? "text", mixed: false };
    if (ts.every((t) => t === "integer" || t === "decimal")) return { name, type: "decimal" as const, mixed: false };
    return { name, type: "text" as const, mixed: true };
  });
}

const SQL_TYPE: Readonly<Record<ColumnType, string>> = { text: "TEXT", integer: "BIGINT", decimal: "DOUBLE", boolean: "BOOLEAN" };
const keyOf = (r: Row, cols: readonly MergedColumn[]): string => sha256Hex(JSON.stringify(cols.map((c) => (r[c.name] === undefined ? null : r[c.name]))));

/** The tables of a merge. */
export interface Merged {
  readonly columns: readonly MergedColumn[];
  /** `fleet_rows`: the rows of every target that answered. */
  readonly rows: Table<Record<string, unknown>, Record<string, unknown>, "fleet_rows">;
  /** `fleet_targets`: what each target answered. */
  readonly targets: Table<TargetRow, TargetRow, "fleet_targets">;
  /** Runs SQL on the engine the merge is in. */
  readonly on: Runner;
}

/** A row of `fleet_targets`. */
export interface TargetRow {
  readonly target: string;
  readonly status: string;
  readonly error: string | null;
  readonly rows: number;
  readonly durationMs: number;
  readonly collectedAt: string;
}

const q = (on: Runner, s: string): string => on.dialect.quote(s);

/**
 * Loads a fan-out into `fleet_rows` and `fleet_targets` of an engine; tables of those names that are there are replaced.
 *
 * @param result - the fan-out
 * @param on - the engine and its dialect (DuckDB, where the merge is analytical)
 */
export async function mergeInto(result: FanOut, on: Runner): Promise<Merged> {
  const columns = columnsOf(result);
  for (const n of ["fleet_rows", "fleet_targets"]) await on.driver.exec(`DROP TABLE IF EXISTS ${q(on, n)}`);
  const own = new Set(["target", "collected_at", "row_key"]);
  for (const c of columns) if (own.has(c.name)) throw new TypeError(`a column of the answers is named ${c.name}, which the merge uses: name it otherwise in the query`);
  await on.driver.exec(
    `CREATE TABLE ${q(on, "fleet_rows")} (${[`${q(on, "target")} TEXT NOT NULL`, `${q(on, "collected_at")} TEXT NOT NULL`, `${q(on, "row_key")} TEXT NOT NULL`, ...columns.map((c) => `${q(on, c.name)} ${SQL_TYPE[c.type]}`)].join(", ")})`,
  );
  await on.driver.exec(
    `CREATE TABLE ${q(on, "fleet_targets")} (${q(on, "target")} TEXT PRIMARY KEY, ${q(on, "status")} TEXT NOT NULL, ${q(on, "error")} TEXT, ${q(on, "rows")} BIGINT NOT NULL, ${q(on, "duration_ms")} BIGINT NOT NULL, ${q(on, "collected_at")} TEXT NOT NULL)`,
  );
  const rowKeys = ["target", "collectedAt", "rowKey", ...columns.map((c) => c.name)];
  const rows = defineTable<Record<string, unknown>, Record<string, unknown>, "fleet_rows">({
    alias: "fleet_rows",
    name: "fleet_rows",
    columns: Object.fromEntries(rowKeys.map((k) => [k, k === "collectedAt" ? "collected_at" : k === "rowKey" ? "row_key" : k])) as never,
  });
  const targets = defineTable<TargetRow, TargetRow, "fleet_targets">({ alias: "fleet_targets", name: "fleet_targets", columns: { target: "target", status: "status", error: "error", rows: "rows", durationMs: "duration_ms", collectedAt: "collected_at" }, primaryKey: ["target"] });
  const tagged = result.outcomes.flatMap((o) => (o.status === "ok" ? o.rows.map((r) => ({ target: o.target, collectedAt: o.collectedAt, rowKey: keyOf(r, columns), ...Object.fromEntries(columns.map((c) => [c.name, r[c.name] === undefined ? null : c.type === "text" && r[c.name] !== null ? String(r[c.name]) : r[c.name]])) })) : []));
  const a = await runLoad({ name: "fleet_rows", source: fromRows(tagged), target: rows, batchSize: 200 }, on);
  if (a.status !== "loaded") throw new Error(`the rows could not be loaded: ${a.message ?? a.status}`);
  const b = await runLoad(
    {
      name: "fleet_targets",
      source: fromRows(result.outcomes.map((o): TargetRow => ({ target: o.target, status: o.status, error: o.status === "error" ? o.error.kind : null, rows: o.status === "ok" ? o.rows.length : 0, durationMs: o.durationMs, collectedAt: o.collectedAt }))),
      target: targets,
    },
    on,
  );
  if (b.status !== "loaded") throw new Error(`the targets could not be loaded: ${b.message ?? b.status}`);
  return { columns, rows: rows as Merged["rows"], targets, on };
}

/** How many of the rows have each value of a column, and in how many targets: the value, the rows and the targets. */
export async function countBy(m: Merged, column: string): Promise<readonly { readonly value: unknown; readonly rows: number; readonly targets: number }[]> {
  const c = q(m.on, column);
  const rows = await m.on.driver.query(`SELECT ${c} AS value, count(*) AS rows, count(DISTINCT ${q(m.on, "target")}) AS targets FROM ${q(m.on, "fleet_rows")} GROUP BY ${c} ORDER BY count(*) DESC, ${c}`);
  return rows.map((r) => ({ value: r["value"], rows: Number(r["rows"]), targets: Number(r["targets"]) }));
}

/** What differs between a target and the baseline: a row the baseline has and the target lacks, or the target has and the baseline lacks. */
export interface Difference {
  readonly target: string;
  readonly kind: "missing" | "extra";
  readonly row: Row;
}

/**
 * The targets that differ from a baseline, row by row. The baseline is the rows that at least half of the targets that answered have (`majority`, the default), or the rows of one target.
 *
 * @param m - the merge
 * @param baseline - `majority`, or the id of a target
 */
export async function differences(m: Merged, baseline: "majority" | { readonly target: string } = "majority"): Promise<readonly Difference[]> {
  const t = q(m.on, "target");
  const k = q(m.on, "row_key");
  const cols = m.columns.map((c) => q(m.on, c.name)).join(", ");
  const ok = `(SELECT ${q(m.on, "target")} FROM ${q(m.on, "fleet_targets")} WHERE ${q(m.on, "status")} = 'ok')`;
  const base =
    baseline === "majority"
      ? `SELECT ${k} FROM ${q(m.on, "fleet_rows")} GROUP BY ${k} HAVING count(DISTINCT ${t}) * 2 >= (SELECT count(*) FROM ${ok} AS o)`
      : `SELECT ${k} FROM ${q(m.on, "fleet_rows")} WHERE ${t} = ${m.on.dialect.literal(baseline.target)}`;
  const missing = await m.on.driver.query(
    `SELECT tt.${t} AS target, b.* FROM (SELECT ${t} FROM ${q(m.on, "fleet_targets")} WHERE ${q(m.on, "status")} = 'ok'${baseline === "majority" ? "" : ` AND ${t} <> ${m.on.dialect.literal(baseline.target)}`}) AS tt CROSS JOIN (SELECT DISTINCT ${k}, ${cols} FROM ${q(m.on, "fleet_rows")} WHERE ${k} IN (${base})) AS b WHERE NOT EXISTS (SELECT 1 FROM ${q(m.on, "fleet_rows")} r WHERE r.${t} = tt.${t} AND r.${k} = b.${k}) ORDER BY tt.${t}`,
  );
  const extra = await m.on.driver.query(
    `SELECT r.${t} AS target, r.${k}, ${m.columns.map((c) => `r.${q(m.on, c.name)}`).join(", ")} FROM ${q(m.on, "fleet_rows")} r WHERE r.${k} NOT IN (${base})${baseline === "majority" ? "" : ` AND r.${t} <> ${m.on.dialect.literal(baseline.target)}`} ORDER BY r.${t}`,
  );
  const plain = (r: Row): Row => Object.fromEntries(m.columns.map((c) => [c.name, typeof r[c.name] === "bigint" ? Number(r[c.name]) : r[c.name]]));
  return [...missing.map((r): Difference => ({ target: String(r["target"]), kind: "missing", row: plain(r) })), ...extra.map((r): Difference => ({ target: String(r["target"]), kind: "extra", row: plain(r) }))];
}

/** A merge's tables as typed tables for a query of the caller's own (0053): `from(tablesOf(m).rows)...`. */
export const tablesOf = (m: Merged): { readonly rows: Merged["rows"]; readonly targets: Merged["targets"] } => ({ rows: m.rows, targets: m.targets });
