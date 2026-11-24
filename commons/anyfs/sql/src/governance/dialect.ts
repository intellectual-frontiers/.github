// Spec: 0002-sql-governance FR-001
/**
 * The dialects of SQL the stores speak, a closed list, and the largest object each holds. A dialect is a way of writing the same statements (how a name is quoted, how a parameter is written, what a
 * binary column is called), never a different store: the library of the language of SQL (`lang-sql`) knows how each is written, and the driver of a database says which one it speaks.
 *
 * @example
 * ```ts
 * import { DIALECTS, defaultMaxObject } from "./dialect.ts";
 * DIALECTS; // ["sqlite", "postgres", "duckdb"]
 * defaultMaxObject("sqlite"); // 67108864
 * ```
 *
 * @module
 */

/** The dialects: SQLite (and every driver of it: a file, libSQL, Turso, D1), PostgreSQL and DuckDB. */
export const DIALECTS = ["sqlite", "postgres", "duckdb"] as const;
/** One dialect of SQL. */
export type SqlDialect = (typeof DIALECTS)[number];

/** Whether a text is the name of a dialect. */
export function isDialect(text: string): text is SqlDialect {
  return (DIALECTS as readonly string[]).includes(text);
}

/** The most a store holds of one object by default, in bytes: 64 MiB, far below what any of the engines holds in one value, so that a body is never cut and a refusal comes before the engine's own. */
export const DEFAULT_MAX_OBJECT = 64 * 1024 * 1024;

/** The hard limit of one value of a dialect, in bytes: what the engine itself holds, which an option cannot raise. */
export const HARD_MAX_OBJECT: Readonly<Record<SqlDialect, number>> = {
  sqlite: 1_000_000_000,
  postgres: 1_073_741_823,
  duckdb: 4_000_000_000,
};

/** The default largest object of a dialect. */
export const defaultMaxObject = (_dialect: SqlDialect): number => DEFAULT_MAX_OBJECT;
