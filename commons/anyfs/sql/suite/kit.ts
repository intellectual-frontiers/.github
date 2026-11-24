/**
 * What the tests share: the engines the stores run on, each real where it can run (SQLite of the runtime, PGlite which is PostgreSQL itself, DuckDB itself), the paths and bytes as values, and a store opened
 * on each. A driver whose client needs a server this environment does not run (libSQL, `pg`) is a fake of the client's shape over a real engine, and the test that uses it says so in its name.
 *
 * @module
 */
import { type Path, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { type CoreCapability, type ReplicaId, replicaIdOfBytes } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { path as osPath, fs } from "@intellectual-frontiers/system";
import { Gate } from "../src/physical/adapters/common.ts";
import { type LibsqlClient, type LibsqlExecutor, type LibsqlTransaction, libsqlPort } from "../src/physical/adapters/libsql.ts";
import { type PgPool, type PgPoolClient, pgPort } from "../src/physical/adapters/pg.ts";
import { type SqliteDatabase, openSqliteFile } from "../src/physical/adapters/sqlite.ts";
import { type SqlOptions, type SqlPort, type SqlStore, type SqlValue, openSqlStore } from "../src/mod.ts";

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

/** A SQLite database in memory, opened by the module of the runtime. */
export async function sqliteMemory(): Promise<SqlPort> {
  const r = await openSqliteFile(":memory:");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** A SQLite file in a folder of its own, opened by the module of the runtime. */
export async function sqliteFile(file: string): Promise<SqlPort> {
  const r = await openSqliteFile(file);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** PostgreSQL, run in the process by PGlite: the real engine. */
export async function pgliteMemory(): Promise<SqlPort & { readonly raw: unknown }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pglitePort } = await import("../src/physical/adapters/pglite.ts");
  // Initialising a PGlite takes about two seconds and starting from the data directory of one that was initialised takes a quarter of that, so the first is made once in this process
  // and each engine starts from its directory, with a database of its own.
  // Node 26 does not end a test file that started a PGlite from a data directory, so the backup runtime initialises each as it always did.
  if (process.versions["bun"] === undefined) {
    const plain = new PGlite();
    await plain.waitReady;
    return { ...pglitePort(plain as never), raw: plain };
  }
  template ??= (async () => {
    const first = new PGlite();
    await first.waitReady;
    const dump = await first.dumpDataDir("none");
    await first.close();
    return dump;
  })();
  const db = new PGlite({ loadDataDir: await template });
  await db.waitReady;
  return { ...pglitePort(db as never), raw: db };
}

let template: Promise<Blob | File> | undefined;

/** DuckDB in memory: the real engine. */
export async function duckdbMemory(): Promise<SqlPort> {
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const { duckdbPort } = await import("../src/physical/adapters/duckdb.ts");
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  return duckdbPort(connection as never, async () => connection.closeSync());
}

/** The raw SQLite connection of the module the runtime has, for the fakes below. */
async function rawSqlite(): Promise<SqliteDatabase> {
  const bun = typeof Reflect.get(globalThis, "Bun") !== "undefined";
  const module: unknown = await import(bun ? "bun:sqlite" : "node:sqlite");
  const Database = Reflect.get(module as object, bun ? "Database" : "DatabaseSync") as new (file: string) => SqliteDatabase;
  return new Database(":memory:");
}

/**
 * A FAKE of a libSQL client over a real SQLite: it has the shape of the client (`execute` with `args`, `transaction`, blobs that arrive as array buffers, rows that are objects) and runs the statements on SQLite
 * itself. The real client needs a server or a native module this environment does not have.
 */
export async function libsqlFake(): Promise<SqlPort> {
  const db = await rawSqlite();
  const arrayBufferOf = (v: unknown): unknown => (v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v);
  const executor: LibsqlExecutor = {
    async execute({ sql, args }) {
      const stmt = db.prepare(sql);
      const rows = args.length === 0 && !/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA)/iu.test(sql) ? (db.exec(sql), []) : stmt.all(...args);
      return { rows: rows.map((r) => Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k, arrayBufferOf(v)]))) };
    },
  };
  const client: LibsqlClient = {
    ...executor,
    async transaction(): Promise<LibsqlTransaction> {
      db.exec("BEGIN IMMEDIATE");
      return { ...executor, commit: async () => void db.exec("COMMIT"), rollback: async () => void db.exec("ROLLBACK"), close: () => undefined };
    },
    close: () => void db.close(),
  };
  return libsqlPort(client);
}

/**
 * A FAKE of a `pg` pool over a real PostgreSQL (PGlite): it has the shape of the pool (`query` with values, `connect` giving a client with `release`), gives a `BIGINT` as text and bytes as buffers, as `pg` does,
 * and lets one connection use the database at a time. The real client needs a server this environment does not run.
 */
export async function pgFake(): Promise<SqlPort> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const gate = new Gate();
  const asPg = (rows: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (k === "size" || k === "seq") && (typeof v === "number" || typeof v === "bigint") ? String(v) : v instanceof Uint8Array ? Buffer.from(v) : v])));
  const query = async (sql: string, values?: SqlValue[]): Promise<{ readonly rows: readonly unknown[] }> => ({ rows: asPg((await db.query(sql, values as never)).rows as never) });
  const pool: PgPool = {
    query: (sql, values) => gate.run(() => query(sql, values)),
    async connect(): Promise<PgPoolClient> {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => void gate.run(async () => (resolve(), await held)));
      await ready;
      return { query, release: () => release() };
    },
    end: () => db.close(),
  };
  return pgPort(pool);
}

/** A store on a port. */
export async function storeOn(port: SqlPort, options: SqlOptions = {}): Promise<SqlStore> {
  const r = await openSqlStore(port, options);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The store of a fresh database as the suite of the laws takes it. */
export const asCore = (s: SqlStore): Store<CoreCapability> => s.store as unknown as Store<CoreCapability>;

/** A temporary folder, gone when `use` ends. */
export async function withTemp<T>(use: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.makeTempDir({ prefix: "anyfs-sql-" });
  try {
    return await use(dir);
  } finally {
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  }
}

export { osPath };

/** The engines a store that merges is tried on, each the real engine: SQLite of the runtime, PostgreSQL itself (PGlite) and DuckDB. Search is there where the engine has an index that keeps itself current. */
export const ENGINES: readonly { readonly name: string; readonly make: () => Promise<SqlPort>; readonly search: boolean }[] = [
  { name: "sqlite", make: sqliteMemory, search: true },
  { name: "postgres", make: pgliteMemory, search: true },
  { name: "duckdb", make: duckdbMemory, search: false },
];

/** A replica identity from a number: the same number is the same identity. */
export const replicaOf = (n: number): ReplicaId => {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n + 1));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** A clock that gives a later millisecond at every call, from a start: so that the ids of a test are in the order it makes them. */
export const monotone = (start = 1_700_000_000_000): (() => number) => {
  let t = start;
  return () => (t += 1);
};

/** A database of a REAL PostgreSQL server reached by `pg`: the database is made, and its port closes the pool. */
export async function realPostgres(server: { readonly host: string; readonly port: number; readonly user: string; createDatabase(name: string): Promise<{ readonly database: string }> }, name: string): Promise<SqlPort> {
  const { Pool } = await import("pg");
  const { database } = await server.createDatabase(name);
  const pool = new Pool({ host: server.host, port: server.port, user: server.user, database, max: 4 });
  // a connection the server ends while the pool is idle is the pool's to drop, never an error of the test
  pool.on("error", () => undefined);
  pools.add(pool);
  return pgPort(pool as never);
}

const pools = new Set<{ end(): Promise<void> }>();

/** Ends every pool the tests opened on a real server, before the server is stopped. */
export async function closePools(): Promise<void> {
  const open = [...pools];
  pools.clear();
  await Promise.all(open.map((pool) => pool.end().catch(() => undefined)));
}
