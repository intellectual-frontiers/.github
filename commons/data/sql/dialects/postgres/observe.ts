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
  const cols = await query(
    `SELECT c.relname AS t, a.attname AS n, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nl, pg_get_expr(d.adbin, d.adrelid) AS d FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace ns ON ns.oid = c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p') AND ns.nspname = ${s} ORDER BY c.relname, a.attnum`,
  );
  const cons = await query(
    `SELECT t.relname AS t, c.contype AS k, array_to_string(ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY u(n, o) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.n ORDER BY u.o), chr(31)) AS cols, rt.relname AS rt, array_to_string(ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY u(n, o) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.n ORDER BY u.o), chr(31)) AS rcols FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace LEFT JOIN pg_class rt ON rt.oid = c.confrelid WHERE ns.nspname = ${s} AND c.contype IN ('p', 'u', 'f')`,
  );
  const idx = await query(
    `SELECT t.relname AS t, i.relname AS n, ix.indisunique AS u, array_to_string(ARRAY(SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY k(n, o) JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.n ORDER BY k.o), chr(31)) AS cols FROM pg_index ix JOIN pg_class t ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace WHERE ns.nspname = ${s} AND NOT ix.indisprimary AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = ix.indexrelid AND k.contype IN ('u', 'p'))`,
  );
  const tables = [...new Set(cols.map((c) => str(c["t"])))];
  return tables.map((t) => {
    const mine = cons.filter((c) => str(c["t"]) === t);
    const pk = mine.find((c) => str(c["k"]) === "p");
    return {
      name: t,
      columns: cols.filter((c) => str(c["t"]) === t).map((c) => ({ name: str(c["n"]), type: str(c["type"]).toLowerCase(), nullable: yes(c["nl"]), ...(c["d"] === null || c["d"] === undefined ? {} : { default: str(c["d"]) }) })),
      primaryKey: pk === undefined ? [] : split(pk["cols"]),
      uniques: mine.filter((c) => str(c["k"]) === "u").map((c) => ({ columns: split(c["cols"]) })),
      foreignKeys: mine.filter((c) => str(c["k"]) === "f").map((c) => ({ columns: split(c["cols"]), references: { table: str(c["rt"]), columns: split(c["rcols"]) } })),
      indexes: idx.filter((i) => str(i["t"]) === t).map((i) => ({ name: str(i["n"]), columns: split(i["cols"]), unique: yes(i["u"]) })),
    };
  });
}
