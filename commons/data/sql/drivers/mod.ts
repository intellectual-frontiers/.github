// Spec: 0056-sql-drivers FR-001, FR-002, FR-003
/**
 * Driver adapters (commons data 0056-sql-drivers): the `Driver` of the library (`exec` and `query`, both of one text) made from the client a caller already has. Each adapter is typed by the shape of the client it
 * takes, not by its package, so that this library depends on none of them: `node:sqlite`'s `DatabaseSync` (and `bun:sqlite`'s `Database`), a `pg` client or pool, PGlite, DuckDB's `node-api` connection and Bun's
 * `SQL`. `driverFor` picks the adapter from the shape. A row is a plain object, and a wide integer a number.
 *
 * @example
 * ```ts
 * import { DatabaseSync } from "node:sqlite";
 * const driver = sqliteDriver(new DatabaseSync(":memory:"));
 * await driver.exec("CREATE TABLE t (id INTEGER)");
 * ```
 *
 * @module
 */
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";

/** A row, as a driver gives it. */
export type Row = Readonly<Record<string, unknown>>;

/** A row as a plain object whose wide integers are numbers. */
export const plain = (r: Row): Record<string, unknown> => Object.fromEntries(Object.entries({ ...r }).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));

/** What `node:sqlite` and `bun:sqlite` give: statements run by `exec`, rows read by a prepared statement. */
export interface SqliteClient {
  exec(sql: string): unknown;
  prepare(sql: string): { all(): readonly Row[] };
}
/** The driver of a SQLite database. */
export const sqliteDriver = (db: SqliteClient): Driver => ({
  exec: async (sql) => void db.exec(sql),
  query: async (sql) => db.prepare(sql).all().map(plain),
});

/** What `pg`'s `Client` and `Pool` give: one `query` of text, whose result has `rows` (an array of results where the text had several statements). */
export interface PgClient {
  query(sql: string): PromiseLike<{ readonly rows: readonly Row[] } | readonly { readonly rows: readonly Row[] }[]>;
}
const rowsOf = (r: { readonly rows: readonly Row[] } | readonly { readonly rows: readonly Row[] }[]): readonly Row[] => (Array.isArray(r) ? ((r as readonly { rows: readonly Row[] }[]).at(-1)?.rows ?? []) : (r as { rows: readonly Row[] }).rows);
/** The driver of a PostgreSQL connection made by `pg`. */
export const pgDriver = (client: PgClient): Driver => ({
  exec: async (sql) => void (await client.query(sql)),
  query: async (sql) => rowsOf(await client.query(sql)).map(plain),
});

/** What PGlite gives: `exec` for text of many statements, `query` for one. */
export interface PgliteClient {
  exec(sql: string): PromiseLike<unknown>;
  query(sql: string): PromiseLike<{ readonly rows: readonly Row[] }>;
}
/** The driver of a PGlite database. */
export const pgliteDriver = (db: PgliteClient): Driver => ({
  exec: async (sql) => void (await db.exec(sql)),
  query: async (sql) => (await db.query(sql)).rows.map(plain),
});

/** What DuckDB's `node-api` connection gives. */
export interface DuckdbClient {
  run(sql: string): PromiseLike<unknown>;
  runAndReadAll(sql: string): PromiseLike<{ getRowObjectsJson(): readonly Row[] }>;
}
/** The driver of a DuckDB connection. */
export const duckdbDriver = (conn: DuckdbClient): Driver => ({
  exec: async (sql) => void (await conn.run(sql)),
  query: async (sql) => (await conn.runAndReadAll(sql)).getRowObjectsJson().map(plain),
});

/** What Bun's `SQL` gives: `unsafe` runs text and gives rows. */
export interface BunSqlClient {
  unsafe(sql: string): PromiseLike<readonly Row[]>;
}
/** The driver of a connection made by Bun's `SQL`. */
export const bunSqlDriver = (sql: BunSqlClient): Driver => ({
  exec: async (text) => void (await sql.unsafe(text)),
  query: async (text) => (await sql.unsafe(text)).map(plain),
});

/** A client that `driverFor` knows by its shape. */
export type AnyClient = SqliteClient | PgClient | PgliteClient | DuckdbClient | BunSqlClient;

const has = (o: object, ...names: string[]): boolean => names.every((n) => typeof (o as Record<string, unknown>)[n] === "function");

/**
 * The driver for a client, by its shape: DuckDB's (`runAndReadAll`), Bun's (`unsafe`), SQLite's (`prepare` and `exec`), PGlite's (`exec` and `query`) or `pg`'s (`query`).
 *
 * @throws where the client is of none of these shapes
 */
export function driverFor(client: AnyClient): Driver {
  if (has(client, "runAndReadAll", "run")) return duckdbDriver(client as DuckdbClient);
  if (has(client, "unsafe")) return bunSqlDriver(client as BunSqlClient);
  if (has(client, "prepare", "exec")) return sqliteDriver(client as SqliteClient);
  if (has(client, "exec", "query")) return pgliteDriver(client as PgliteClient);
  if (has(client, "query")) return pgDriver(client as PgClient);
  throw new TypeError("the client is of no shape that a driver is made for: it has none of runAndReadAll, unsafe, prepare, exec or query");
}
