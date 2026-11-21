// Spec: 0003-sql-port FR-001
/**
 * The port of a database: the least a store asks of a driver. A value is null, a number, a wide integer, a text or bytes; a row is its values by the name of the column; a runner runs one statement of
 * text with parameters; a port is a runner that also keeps a transaction (all or none) and closes. It is a type of data and of functions, so that any driver, a client a caller already has, fits it by its shape.
 *
 * @example
 * ```ts
 * import type { SqlPort } from "./values.ts";
 * declare const port: SqlPort;
 * await port.query("SELECT 1 AS one", []); // [{ one: 1 }]
 * ```
 *
 * @module
 */
import type { SqlDialect } from "./dialect.ts";

/** What a column holds, as a driver gives it and takes it. */
export type SqlValue = null | bigint | number | string | Uint8Array;
/** A row: its values by the name of the column. */
export type SqlRow = Readonly<Record<string, SqlValue>>;

/** Runs one statement. A statement is text with parameters written as the dialect writes them, in the order they appear. */
export type SqlRunner = {
  /** Runs a statement and gives the rows it returns (none for one that returns none). */
  query(sql: string, params: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  /** Runs a statement, or several with no parameters, and gives nothing. */
  exec(sql: string, params: readonly SqlValue[]): Promise<void>;
};

/** A database: the dialect it speaks, a runner for one statement, and a transaction. */
export type SqlPort = SqlRunner & {
  readonly dialect: SqlDialect;
  /** Runs the function in a transaction that holds until it returns and is undone where it throws; no other statement of this port runs in between, where the driver has one connection. */
  transaction<T>(run: (tx: SqlRunner) => Promise<T>): Promise<T>;
  /** Brings what the engine holds in a log back into the file, so that the file alone is the whole database: a file copied after it is complete. Only a port of an engine that keeps a log has it (SQLite in write-ahead mode). */
  checkpoint?(): Promise<void>;
  close(): Promise<void>;
};
