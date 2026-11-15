/**
 * What a database holds, read from its own catalog: the tables with their columns and whether each may be null, the views, the indexes,
 * and the steps ISLM's ledger says were applied (commons 0009-sql-aide FR-035, FR-040). Each dialect is asked in its own way:
 * `information_schema` and `pg_indexes` in PostgreSQL, `information_schema` and `duckdb_indexes()` in DuckDB, `sqlite_master` and
 * `pragma_table_info` in SQLite. Types are not read: a plan does not compare them.
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Runner } from "../test/assert.ts";

/** A column as the catalog has it. */
export interface CatalogColumn {
  /** Whether the column refuses null. */
  readonly notNull: boolean;
}

/** What a database holds, by qualified name (`schema.name`; SQLite's schema is `main`). */
export interface Catalog {
  /** The schema a name without one is in. */
  readonly defaultSchema: string;
  /** The tables, each with its columns by name. */
  readonly tables: ReadonlyMap<string, ReadonlyMap<string, CatalogColumn>>;
  /** The views, materialized or not. */
  readonly views: ReadonlySet<string>;
  /** The indexes, by schema and the index's own name, each with the qualified name of its table. */
  readonly indexes: ReadonlyMap<string, string>;
  /** The steps the ledger says were applied, each with the hash of its last content applied. */
  readonly applied: ReadonlyMap<string, string>;
}

/** Why the catalog could not be read. */
export type InspectError = { readonly kind: "inspect"; readonly message: string };

/** The name of ISLM's ledger table. */
export const LEDGER = "ifcsql_ledger";

const s = (v: unknown): string => (typeof v === "string" ? v : String(v));

/**
 * Reads a database's catalog.
 *
 * @param runner - what runs a query in the database
 * @param ctx - the context of the database's dialect
 */
export async function inspect(runner: Runner, ctx: EmitContext): Promise<Result<Catalog, InspectError>> {
  try {
    const dialect = ctx.dialect.name;
    const tables = new Map<string, Map<string, CatalogColumn>>();
    const views = new Set<string>();
    const indexes = new Map<string, string>();
    let defaultSchema = "main";
    const column = (schema: string, table: string, name: string, notNull: boolean): void => {
      const key = `${schema}.${table}`;
      const t = tables.get(key) ?? new Map<string, CatalogColumn>();
      t.set(name, { notNull });
      tables.set(key, t);
    };
    if (dialect === "sqlite") {
      for (const r of await runner.query(
        `SELECT name, type, tbl_name FROM sqlite_master WHERE type IN ('table', 'view', 'index') AND name NOT LIKE 'sqlite_%'`,
      )) {
        if (r["type"] === "view") views.add(`main.${s(r["name"])}`);
        else if (r["type"] === "index") indexes.set(`main.${s(r["name"])}`, `main.${s(r["tbl_name"])}`);
        else tables.set(`main.${s(r["name"])}`, new Map());
      }
      const columns = await runner.query(
        `SELECT m.name AS t, p.name AS c, p."notnull" AS nn FROM sqlite_master AS m JOIN pragma_table_info(m.name) AS p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'`,
      );
      for (const r of columns) column("main", s(r["t"]), s(r["c"]), Number(r["nn"]) === 1);
    } else {
      defaultSchema = s((await runner.query(`SELECT current_schema() AS s`))[0]?.["s"] ?? "public");
      const where =
        dialect === "duckdb"
          ? `table_catalog = current_database() AND table_schema NOT IN ('information_schema', 'pg_catalog')`
          : `table_schema NOT IN ('information_schema', 'pg_catalog') AND table_schema NOT LIKE 'pg_toast%'`;
      for (const r of await runner.query(
        `SELECT table_schema AS sc, table_name AS t, table_type AS ty FROM information_schema.tables WHERE ${where}`,
      )) {
        const key = `${s(r["sc"])}.${s(r["t"])}`;
        if (s(r["ty"]) === "VIEW") views.add(key);
        else tables.set(key, new Map());
      }
      const columns = await runner.query(
        `SELECT table_schema AS sc, table_name AS t, column_name AS c, is_nullable AS n FROM information_schema.columns WHERE ${where}`,
      );
      for (const r of columns) if (tables.has(`${s(r["sc"])}.${s(r["t"])}`)) column(s(r["sc"]), s(r["t"]), s(r["c"]), s(r["n"]) === "NO");
      if (dialect === "postgres") {
        for (const r of await runner.query(`SELECT schemaname AS sc, matviewname AS v FROM pg_matviews`))
          views.add(`${s(r["sc"])}.${s(r["v"])}`);
        for (const r of await runner.query(`SELECT schemaname AS sc, indexname AS i, tablename AS t FROM pg_indexes`))
          indexes.set(`${s(r["sc"])}.${s(r["i"])}`, `${s(r["sc"])}.${s(r["t"])}`);
      } else {
        for (const r of await runner.query(
          `SELECT schema_name AS sc, index_name AS i, table_name AS t FROM duckdb_indexes() WHERE database_name = current_database()`,
        ))
          indexes.set(`${s(r["sc"])}.${s(r["i"])}`, `${s(r["sc"])}.${s(r["t"])}`);
      }
    }
    const applied = new Map<string, string>();
    const ledger = ctx.naming.table(LEDGER, undefined);
    if (tables.has(`${ledger.length > 1 ? (ledger[0] ?? defaultSchema) : defaultSchema}.${ledger.at(-1) ?? LEDGER}`)) {
      const name = ledger.map((p) => ctx.dialect.quoteName(p)).join(".");
      for (const r of await runner.query(`SELECT step, hash FROM ${name} WHERE outcome = 'ok' ORDER BY started_at, entry_id`))
        applied.set(s(r["step"]), s(r["hash"]));
    }
    return ok({ defaultSchema, tables, views, indexes, applied });
  } catch (thrown) {
    return err({ kind: "inspect", message: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}
