// Spec: 0007-physical FR-008
/**
 * The upsert (commons data 0007-physical FR-008): rows inserted, and the row that is there already updated, so that a load run twice leaves the same rows. The three dialects write it alike
 * (`INSERT ... ON CONFLICT (key) DO UPDATE SET ...`), so the statement is made here, for `bind`'s reference data and for the extensions that load tables of their own.
 *
 * @module
 */
import type { Dialect, Literal } from "./dialect.ts";

/**
 * An upsert statement.
 *
 * @param dialect - how the engine writes names and literals
 * @param table - the table, as written
 * @param columns - the columns, as written
 * @param key - the columns of the key, as written; the rest are updated where the key is there
 * @param rows - the values of each row, in the order of the columns
 * @returns the statement, ending in `;`
 */
export function upsert(
  dialect: Dialect,
  table: string,
  columns: readonly string[],
  key: readonly string[],
  rows: readonly (readonly Literal[])[],
): string {
  const q = (n: string): string => dialect.quote(n);
  const set = columns.filter((c) => !key.includes(c)).map((c) => `${q(c)} = excluded.${q(c)}`);
  const values = rows.map((r) => `(${r.map((v) => dialect.literal(v)).join(", ")})`);
  return `INSERT INTO ${q(table)} (${columns.map(q).join(", ")}) VALUES\n${values.join(",\n")}\nON CONFLICT (${key.map(q).join(", ")}) DO ${set.length === 0 ? "NOTHING" : `UPDATE SET ${set.join(", ")}`};`;
}
