/**
 * Real engines for the tests of the physical schema: SQLite (the runtime's `node:sqlite`), DuckDB (its own Node client) and PostgreSQL (PGlite, in process), in memory, with the library's
 * dialect for each, a way to load the statements `bind` makes, and a way to read back what the engine holds. Not a test itself.
 *
 * @module
 */
import { DatabaseSync } from "node:sqlite";
import { DuckDBInstance } from "@duckdb/node-api";
import { PGlite } from "@electric-sql/pglite";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import type { Dialect, Physical } from "@intellectual-frontiers/data/sql/physical";

/** A row, by column. */
export type Row = Record<string, unknown>;

/** An open engine. */
export interface Engine {
  readonly name: "sqlite" | "duckdb" | "postgres";
  readonly dialect: Dialect;
  run(sql: string): Promise<void>;
  rows(sql: string): Promise<Row[]>;
  close(): Promise<void>;
}

/** The three dialects, by engine. */
export const DIALECTS = [
  { name: "sqlite", dialect: sqlite },
  { name: "duckdb", dialect: duckdb },
  { name: "postgres", dialect: postgres },
] as const;

const plain = (r: Row): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));

let template: Promise<Blob | File> | undefined;
/** A PGlite of its own, started from the data directory of one that was initialised once in this process: initialising takes about two seconds, starting from the directory a quarter of one. */
async function newPglite(): Promise<PGlite> {
  template ??= (async () => {
    const first = new PGlite();
    await first.waitReady;
    const dump = await first.dumpDataDir("none");
    await first.close();
    return dump;
  })();
  const db = new PGlite({ loadDataDir: await template });
  await db.waitReady;
  return db;
}

/** Opens an engine in memory. */
export async function openEngine(name: Engine["name"]): Promise<Engine> {
  switch (name) {
    case "sqlite": {
      const db = new DatabaseSync(":memory:");
      db.exec("PRAGMA foreign_keys = ON");
      return {
        name,
        dialect: sqlite,
        run: async (sql) => void db.exec(sql),
        rows: async (sql) =>
          db
            .prepare(sql)
            .all()
            .map((r) => plain({ ...r })),
        close: async () => db.close(),
      };
    }
    case "duckdb": {
      const instance = await DuckDBInstance.create(":memory:");
      const conn = await instance.connect();
      return {
        name,
        dialect: duckdb,
        run: async (sql) => void (await conn.run(sql)),
        rows: async (sql) => ((await conn.runAndReadAll(sql)).getRowObjectsJson() as Row[]).map(plain),
        close: async () => {
          conn.closeSync();
          instance.closeSync();
        },
      };
    }
    case "postgres": {
      const db = await newPglite();
      return {
        name,
        dialect: postgres,
        run: async (sql) => void (await db.exec(sql)),
        rows: async (sql) => ((await db.query(sql)).rows as Row[]).map(plain),
        close: async () => db.close(),
      };
    }
  }
}

/** Runs the statements of a bound schema, one by one. */
export async function load(engine: Engine, physical: Physical, groups?: readonly string[]): Promise<void> {
  for (const s of physical.statements) if (groups === undefined || groups.includes(s.group)) await engine.run(s.sql);
}

/** Whether the engine refuses a statement. */
export async function refuses(engine: Engine, sql: string): Promise<boolean> {
  try {
    await engine.run(sql);
    return false;
  } catch {
    return true;
  }
}

/** What an engine holds, as the tests compare it: tables with their columns' nullability and primary key, and the indexes made by `CREATE INDEX`. */
export interface Structure {
  readonly tables: Readonly<
    Record<string, { readonly columns: Readonly<Record<string, boolean>>; readonly primaryKey: readonly string[] }>
  >;
  readonly indexes: readonly string[];
}

const build = (cols: { t: string; c: string; nullable: boolean }[], pks: { t: string; c: string }[], indexes: string[]): Structure => {
  const tables: Record<string, { columns: Record<string, boolean>; primaryKey: string[] }> = {};
  for (const x of cols) (tables[x.t] ??= { columns: {}, primaryKey: [] }).columns[x.c] = x.nullable;
  for (const k of pks) tables[k.t]?.primaryKey.push(k.c);
  for (const t of Object.values(tables)) t.primaryKey.sort();
  return { tables, indexes: [...indexes].sort() };
};

/** Reads back what an engine holds. */
export async function structure(engine: Engine): Promise<Structure> {
  switch (engine.name) {
    case "sqlite": {
      const names = (await engine.rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) =>
        String(r["name"]),
      );
      const cols: { t: string; c: string; nullable: boolean }[] = [];
      const pks: { t: string; c: string }[] = [];
      for (const t of names) {
        for (const c of await engine.rows(`PRAGMA table_info("${t}")`)) {
          cols.push({ t, c: String(c["name"]), nullable: c["notnull"] === 0 });
          if (Number(c["pk"]) > 0) pks.push({ t, c: String(c["name"]) });
        }
      }
      const idx = (await engine.rows("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE '%\\_idx' ESCAPE '\\'")).map((r) =>
        String(r["name"]),
      );
      return build(cols, pks, idx);
    }
    case "duckdb": {
      const cols = (await engine.rows("SELECT table_name t, column_name c, is_nullable n FROM duckdb_columns() WHERE NOT internal")).map(
        (r) => ({ t: String(r["t"]), c: String(r["c"]), nullable: r["n"] === true }),
      );
      const pks = (
        await engine.rows("SELECT table_name t, constraint_column_names c FROM duckdb_constraints() WHERE constraint_type = 'PRIMARY KEY'")
      ).flatMap((r) => (r["c"] as string[]).map((c) => ({ t: String(r["t"]), c })));
      const idx = (await engine.rows("SELECT index_name n FROM duckdb_indexes()")).map((r) => String(r["n"]));
      return build(cols, pks, idx);
    }
    case "postgres": {
      const cols = (
        await engine.rows("SELECT table_name t, column_name c, is_nullable n FROM information_schema.columns WHERE table_schema = 'public'")
      ).map((r) => ({ t: String(r["t"]), c: String(r["c"]), nullable: r["n"] === "YES" }));
      const pks = (
        await engine.rows(
          "SELECT tc.table_name t, kcu.column_name c FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'",
        )
      ).map((r) => ({ t: String(r["t"]), c: String(r["c"]) }));
      const idx = (await engine.rows("SELECT indexname n FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%\\_idx'")).map(
        (r) => String(r["n"]),
      );
      return build(cols, pks, idx);
    }
  }
}
