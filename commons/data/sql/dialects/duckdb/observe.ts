// Spec: 0055-sql-introspect FR-001
/**
 * What this engine's catalog says of a database (commons data 0055-sql-introspect): tables, columns, keys, unique constraints, foreign keys and indexes, read with queries only.
 *
 * @module
 */
import type { ObservedTable, Query } from "@intellectual-frontiers/data/sql/physical";

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const SEP = "\u001f";
const split = (v: unknown): string[] => (v === null || v === undefined || String(v) === "" ? [] : String(v).split(SEP));
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const yes = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "t" || v === "true" || v === "YES" || v === "yes";

export async function observe(query: Query, schema?: string): Promise<readonly ObservedTable[]> {
  const s = schema === undefined ? "current_schema()" : q(schema);
  const names = (await query(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${s} AND table_type = 'BASE TABLE' ORDER BY table_name`)).map((r) => str(r["t"]));
  const cons = await query(
    `SELECT table_name AS t, constraint_type AS k, array_to_string(constraint_column_names, chr(31)) AS cols, referenced_table AS rt, array_to_string(referenced_column_names, chr(31)) AS rcols FROM duckdb_constraints() WHERE schema_name = ${s}`,
  );
  const idx = await query(`SELECT table_name AS t, index_name AS n, is_unique AS u, expressions AS e FROM duckdb_indexes() WHERE schema_name = ${s}`);
  const out: ObservedTable[] = [];
  for (const t of names) {
    const cols = await query(`SELECT column_name AS n, data_type AS type, is_nullable AS nl, column_default AS d FROM information_schema.columns WHERE table_schema = ${s} AND table_name = ${q(t)} ORDER BY ordinal_position`);
    const mine = cons.filter((c) => str(c["t"]) === t);
    const pk = mine.find((c) => str(c["k"]) === "PRIMARY KEY");
    out.push({
      name: t,
      columns: cols.map((c) => ({ name: str(c["n"]), type: str(c["type"]).toLowerCase(), nullable: yes(c["nl"]), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk === undefined ? [] : split(pk["cols"]),
      uniques: mine.filter((c) => str(c["k"]) === "UNIQUE").map((c) => ({ columns: split(c["cols"]) })),
      foreignKeys: mine.filter((c) => str(c["k"]) === "FOREIGN KEY").map((c) => ({ columns: split(c["cols"]), references: { table: str(c["rt"]), columns: split(c["rcols"]) } })),
      indexes: idx
        .filter((i) => str(i["t"]) === t)
        .map((i) => ({ name: str(i["n"]), columns: str(i["e"]).replace(/^\[|\]$/g, "").split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter((x) => x !== ""), unique: yes(i["u"]) })),
    });
  }
  return out;
}
