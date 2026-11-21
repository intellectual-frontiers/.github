// Spec: 0003-sql-port FR-005
/**
 * The port of a SQLite database: a connection of `node:sqlite` or of `bun:sqlite` (typed by the shape both have, so that this library depends on neither), or a file opened by the runtime that is running. A write
 * is `BEGIN IMMEDIATE`, so that a second writer waits (the busy timeout) and never fails halfway; a file is opened in write-ahead mode, so that readers do not stop the writer. Two connections to one file in one
 * process share a gate, since a connection that waits for the lock of another in the same thread would never get it.
 *
 * @example
 * ```ts
 * import { openSqliteFile } from "@intellectual-frontiers/anyfs-sql/sqlite";
 * const port = await openSqliteFile("fleet.db");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import * as path from "@intellectual-frontiers/system/path";
import * as fs from "@intellectual-frontiers/system/fs";
import type { SqlPort, SqlRow, SqlRunner, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";
import { Gate, gateOfFile, rowOf } from "./common.ts";

/** A prepared statement of `node:sqlite` or `bun:sqlite`. */
export interface SqliteStatement {
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}
/** A connection of `node:sqlite` (`DatabaseSync`) or `bun:sqlite` (`Database`). */
export interface SqliteDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatement;
  close(): unknown;
}

/** What a SQLite port may be given. */
export type SqliteOptions = {
  /** The gate that serializes this connection with others to the same file in this process: made for the connection where not given. */
  readonly gate?: Gate;
  /** How long a writer waits for the lock of another process, in milliseconds (5000 where not given). */
  readonly busyMs?: number;
};

/** The port of a connection of SQLite. */
export function sqlitePort(db: SqliteDatabase, options: SqliteOptions = {}): SqlPort {
  const gate = options.gate ?? new Gate();
  const runner: SqlRunner = {
    async query(sql, params): Promise<readonly SqlRow[]> {
      return db.prepare(sql).all(...params).map(rowOf);
    },
    async exec(sql, params): Promise<void> {
      if (params.length === 0) db.exec(sql);
      else db.prepare(sql).run(...params);
    },
  };
  db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(options.busyMs ?? 5000))}`);
  return {
    dialect: "sqlite",
    query: (sql, params) => gate.run(() => runner.query(sql, params)),
    exec: (sql, params) => gate.run(() => runner.exec(sql, params)),
    transaction: <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> =>
      gate.run(async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const value = await work(runner);
          db.exec("COMMIT");
          return value;
        } catch (thrown) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // the transaction is already over (the engine ended it): the error that matters is the first
          }
          throw thrown;
        }
      }),
    close: async () => void db.close(),
  };
}

type Constructor = new (file: string) => SqliteDatabase;

const constructorOf = (module: unknown, name: string): Constructor | undefined => {
  const found: unknown = typeof module === "object" && module !== null ? Reflect.get(module, name) : undefined;
  return typeof found === "function" ? (found as Constructor) : undefined;
};

/** Opens a SQLite file (or `:memory:`) with the module of the runtime that is running: `bun:sqlite` in Bun and `node:sqlite` in Node. */
export async function openSqliteFile(file: string, options: SqliteOptions = {}): Promise<Result<SqlPort, string>> {
  const bun = typeof Reflect.get(globalThis, "Bun") !== "undefined";
  const specifier = bun ? "bun:sqlite" : "node:sqlite";
  let module: unknown;
  try {
    module = await import(specifier);
  } catch (thrown) {
    return err(`${specifier} could not be loaded: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  const Database = constructorOf(module, bun ? "Database" : "DatabaseSync");
  if (Database === undefined) return err(`${specifier} has no database class`);
  const memory = file === ":memory:";
  const db = new Database(file);
  if (!memory) db.exec("PRAGMA journal_mode = WAL");
  return ok(sqlitePort(db, { ...options, gate: options.gate ?? (memory ? new Gate() : gateOfFile(path.resolve(file))) }));
}

/** A value as a statement takes it: nothing to change for SQLite, which takes every value of the port. */
export type { SqlValue };

/**
 * What tells a copy of a database file from the original: the device and the file of the file system object (`dev:ino`), which `cp` does not keep and a rename does. A database opened with a fingerprint other than the one
 * it holds is a copy and takes a new replica identity. `memory` for a database in memory; where the file system has no file number, the resolved name.
 */
export async function fingerprintOfFile(file: string): Promise<string> {
  if (file === ":memory:") return "memory";
  const resolved = path.resolve(file);
  try {
    const info = await fs.stat(resolved);
    return info.ino === null ? `path:${resolved}` : `${info.dev}:${info.ino}`;
  } catch {
    return `path:${resolved}`;
  }
}
