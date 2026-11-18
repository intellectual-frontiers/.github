// Spec: 0024-sql-queries FR-001
/**
 * Queries (commons data 0024-sql-queries): a catalog of named, read-only queries over the names of a schema, with typed parameters that enter only as literals, run in a transaction that is rolled
 * back, verified against a database, and compared between versions of a schema.
 *
 * @example
 * ```ts
 * const c = must(queries(schema, [{ name: "by name", params: { name: "text" },
 *   sql: (r, p) => `SELECT ${r.column("author", "id")} FROM ${r.table("author")} WHERE ${r.column("author", "name")} = ${p("name")}` }], { dialect }));
 * const rows = await run(driver, c.get("by name")!, { name: "Ann" });
 * ```
 *
 * @module
 */
export {
  type Catalog,
  type CatalogOptions,
  impact,
  type Impact,
  type ParamError,
  type ParamSpec,
  type ParamType,
  type Query,
  type QueryError,
  type QuerySpec,
  queries,
  readOnly,
} from "./catalog.ts";
export { type Finding, run, type RunError, verify } from "./run.ts";
