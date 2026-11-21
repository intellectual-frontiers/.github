// Spec: 0003-sql-port FR-007
/**
 * The port of a PGlite database: PostgreSQL itself, run in the process, which is what the tests of PostgreSQL use where there is no server. It is typed by the shape of PGlite's `query`, `exec` and `transaction`.
 * PGlite has one connection and runs one transaction at a time, so a statement outside a transaction waits for it.
 *
 * @example
 * ```ts
 * import { pglitePort } from "@intellectual-frontiers/anyfs-sql/pglite";
 * // const port = pglitePort(new PGlite());
 * ```
 *
 * @module
 */
import type { SqlPort, SqlRow, SqlRunner, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";
import { rowOf } from "./common.ts";

/** What `query` gives. */
export interface PgliteResult {
  readonly rows: readonly unknown[];
}
/** What runs one statement: the database, or a transaction of it. */
export interface PgliteQueryable {
  query(sql: string, params?: readonly SqlValue[]): Promise<PgliteResult>;
}
/** A PGlite database. */
export interface PgliteDatabase extends PgliteQueryable {
  transaction<T>(work: (tx: PgliteQueryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const runnerOf = (db: PgliteQueryable): SqlRunner => ({
  async query(sql, params): Promise<readonly SqlRow[]> {
    return (await db.query(sql, params)).rows.map(rowOf);
  },
  async exec(sql, params): Promise<void> {
    await db.query(sql, params);
  },
});

/** The port of a PGlite database. */
export function pglitePort(db: PgliteDatabase): SqlPort {
  return {
    dialect: "postgres",
    ...runnerOf(db),
    transaction: <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> => db.transaction((tx) => work(runnerOf(tx))),
    close: () => db.close(),
  };
}
