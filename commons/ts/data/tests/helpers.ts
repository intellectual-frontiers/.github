/**
 * What the tests of the data libraries share: committed (golden) files, and the engines a test loads SQL into.
 *
 * @module
 */
import { fs, proc } from "../../runtime/mod.ts";
import { assertEquals } from "../../runtime/test.ts";

/**
 * Holds text to a committed file: the test fails where they differ, so that a change to what is emitted shows as a diff of SQL. With
 * `IFCSQL_UPDATE_GOLDEN=1` the file is written instead.
 *
 * @param file - the committed file, as a URL beside the test
 * @param actual - the text emitted now
 */
export async function golden(file: URL, actual: string): Promise<void> {
  if (proc.env.get("IFCSQL_UPDATE_GOLDEN") === "1") {
    await fs.writeTextFile(file, actual);
    return;
  }
  let committed: string;
  try {
    committed = await fs.readTextFile(file);
  } catch {
    committed = "";
  }
  assertEquals(actual, committed, `${file.pathname} is not what is emitted now; run with IFCSQL_UPDATE_GOLDEN=1 and read the diff`);
}

/** An engine a test loads SQL into: a script run whole, and a query that gives rows. */
export interface Engine {
  /** The engine's name, for the name of a test. */
  readonly name: "sqlite" | "duckdb" | "pglite" | "postgres";
  /** The dialect its SQL is written in. */
  readonly dialect: "sqlite" | "duckdb" | "postgres";
  /** Runs a script of one or more statements. */
  readonly exec: (script: string) => Promise<void>;
  /** Runs a query and gives its rows as objects. */
  readonly query: (text: string, params?: readonly unknown[]) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  /** Lets the engine go. */
  readonly close: () => Promise<void>;
}

/** An in-memory SQLite, through the runtime's own `node:sqlite`. */
export async function sqliteEngine(): Promise<Engine> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return {
    name: "sqlite",
    dialect: "sqlite",
    exec: (script) => Promise.resolve(db.exec(script)),
    query: (text, params = []) => Promise.resolve(db.prepare(text).all(...(params as never[])) as Readonly<Record<string, unknown>>[]),
    close: () => Promise.resolve(db.close()),
  };
}

/** An in-memory DuckDB. */
export async function duckdbEngine(): Promise<Engine> {
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  return {
    name: "duckdb",
    dialect: "duckdb",
    exec: async (script) => {
      await connection.run(script);
    },
    query: async (text, params = []) => {
      const reader = await connection.runAndReadAll(text, params as never[]);
      return reader.getRowObjectsJson() as Readonly<Record<string, unknown>>[];
    },
    close: () => {
      connection.closeSync();
      return Promise.resolve();
    },
  };
}

/** PostgreSQL in process, as PGlite. */
export async function pgliteEngine(): Promise<Engine> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  return {
    name: "pglite",
    dialect: "postgres",
    exec: async (script) => {
      await db.exec(script);
    },
    query: async (text, params = []) => (await db.query<Readonly<Record<string, unknown>>>(text, [...params])).rows,
    close: () => db.close(),
  };
}

/** The address of the PostgreSQL server given for the run (`IFCSQL_PG_URL`), or `undefined` where none is. */
export const postgresUrl = (): string | undefined => proc.env.get("IFCSQL_PG_URL");

/**
 * A database made for one test on the PostgreSQL server given for the run, and dropped when the engine is closed: nothing a test does
 * outlives it. `undefined` where no server is given.
 */
export async function postgresEngine(): Promise<Engine | undefined> {
  const url = postgresUrl();
  if (url === undefined) return undefined;
  const pg = (await import("pg")).default;
  const database = `ifcsql_test_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  const target = new URL(url);
  target.pathname = `/${database}`;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  return {
    name: "postgres",
    dialect: "postgres",
    exec: async (script) => {
      await client.query(script);
    },
    query: async (text, params = []) => (await client.query<Readonly<Record<string, unknown>>>(text, [...params])).rows,
    close: async () => {
      await client.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    },
  };
}

/** Every engine at hand: SQLite, DuckDB and PGlite always, and the PostgreSQL server where one is given. */
export async function engines(): Promise<readonly Engine[]> {
  const server = await postgresEngine();
  return [await sqliteEngine(), await duckdbEngine(), await pgliteEngine(), ...(server === undefined ? [] : [server])];
}
