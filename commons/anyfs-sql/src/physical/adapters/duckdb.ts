// Spec: 0003-sql-port FR-009
/**
 * The port of a DuckDB connection of `@duckdb/node-api`, typed by the shape of `run` and `runAndReadAll`. DuckDB cannot type a binary parameter, so the store gives it bytes as hex (`unhex(?)` and `hex(body)`) and
 * the port never sees a binary value. One connection runs one transaction at a time. DuckDB has no index of search that keeps itself current, so a DuckDB store has no `search`.
 *
 * @example
 * ```ts
 * import { duckdbPort } from "@intellectual-frontiers/anyfs-sql/duckdb";
 * // const connection = await (await DuckDBInstance.create(":memory:")).connect();
 * // const port = duckdbPort(connection);
 * ```
 *
 * @module
 */
import type { SqlPort, SqlRow, SqlRunner, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";
import { Gate, rowOf } from "./common.ts";

/** What `runAndReadAll` gives. */
export interface DuckdbRows {
  getRowObjects(): readonly unknown[];
}
/** A DuckDB connection. */
export interface DuckdbConnection {
  run(sql: string, values?: SqlValue[]): Promise<unknown>;
  runAndReadAll(sql: string, values?: SqlValue[]): Promise<DuckdbRows>;
}

/** The port of a DuckDB connection; `close` is the caller's to give where the connection has one. */
export function duckdbPort(connection: DuckdbConnection, close: () => Promise<void> = async () => undefined): SqlPort {
  const gate = new Gate();
  const runner: SqlRunner = {
    async query(sql, params): Promise<readonly SqlRow[]> {
      return (await connection.runAndReadAll(sql, [...params])).getRowObjects().map(rowOf);
    },
    async exec(sql, params): Promise<void> {
      await connection.run(sql, [...params]);
    },
  };
  return {
    dialect: "duckdb",
    query: (sql, params) => gate.run(() => runner.query(sql, params)),
    exec: (sql, params) => gate.run(() => runner.exec(sql, params)),
    transaction: <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> =>
      gate.run(async () => {
        await connection.run("BEGIN TRANSACTION");
        try {
          const value = await work(runner);
          await connection.run("COMMIT");
          return value;
        } catch (thrown) {
          try {
            await connection.run("ROLLBACK");
          } catch {
            // the transaction is already over
          }
          throw thrown;
        }
      }),
    close,
  };
}
