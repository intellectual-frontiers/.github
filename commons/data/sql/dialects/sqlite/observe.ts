// Spec: 0055-sql-introspect FR-001
/**
 * What this engine's catalog says of a database (commons data 0055-sql-introspect): tables, columns, keys, unique constraints, foreign keys and indexes, read with queries only.
 *
 * @module
 */
import type { ObservedTable, Query } from "@intellectual-frontiers/data/sql/physical";

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const yes = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "t" || v === "true" || v === "YES" || v === "yes";

export async function observe(query: Query): Promise<readonly ObservedTable[]> {
  const names = (await query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => str(r["name"]));
  const out: ObservedTable[] = [];
  for (const t of names) {
    const cols = await query(`SELECT name, type, "notnull" AS nn, dflt_value AS d, pk FROM pragma_table_info(${q(t)}) ORDER BY cid`);
    const pk = [...cols].filter((c) => Number(c["pk"]) > 0).sort((a, b) => Number(a["pk"]) - Number(b["pk"])).map((c) => str(c["name"]));
    const fks = new Map<number, { table: string; from: string[]; to: string[] }>();
    for (const f of await query(`SELECT id, "table" AS ref, "from" AS f, "to" AS t FROM pragma_foreign_key_list(${q(t)}) ORDER BY id, seq`)) {
      const id = Number(f["id"]);
      const e = fks.get(id) ?? { table: str(f["ref"]), from: [], to: [] };
      e.from.push(str(f["f"]));
      e.to.push(str(f["t"]));
      fks.set(id, e);
    }
    const uniques: { columns: string[] }[] = [];
    const indexes: { name: string; columns: string[]; unique: boolean }[] = [];
    for (const ix of await query(`SELECT name, "unique" AS u, origin FROM pragma_index_list(${q(t)})`)) {
      const columns = (await query(`SELECT name FROM pragma_index_info(${q(str(ix["name"]))}) ORDER BY seqno`)).map((c) => str(c["name"]));
      if (str(ix["origin"]) === "u") uniques.push({ columns });
      else if (str(ix["origin"]) === "c") indexes.push({ name: str(ix["name"]), columns, unique: yes(ix["u"]) });
    }
    out.push({
      name: t,
      columns: cols.map((c) => ({ name: str(c["name"]), type: str(c["type"]).toLowerCase(), nullable: !(yes(c["nn"]) || Number(c["pk"]) > 0), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk,
      uniques,
      foreignKeys: [...fks.values()].map((f) => ({ columns: f.from, references: { table: f.table, columns: f.to } })),
      indexes,
    });
  }
  return out;
}
