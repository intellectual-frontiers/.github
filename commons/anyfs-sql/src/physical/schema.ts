// Spec: 0004-sql-schema FR-001, FR-002, FR-003
/**
 * The tables of a store, made and changed by code: the migrations in order, each one inside one transaction with the version it reaches written in the same transaction, so that a database is at a
 * version or at the one before it and never between. A migration only adds. A database of a newer version than the library knows is refused and left as it is, and a migration that would take
 * something away is refused unless the caller says so. The index of search is made where the engine has one (the words of a text in an FTS5 table for SQLite, a `tsvector` and a GIN index for PostgreSQL)
 * and the library says whether it did; DuckDB has none that keeps itself current, and so has no search.
 *
 * @example
 * ```ts
 * import { migrate } from "./schema.ts";
 * const done = await migrate(port, naming, { search: "auto" });
 * done.kind === "ok" && done.value.version; // 2
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { MIGRATION_PLAN, type Naming, SCHEMA_VERSION, type SqlPort, type SqlRunner, tableOf, indexOf } from "@intellectual-frontiers/anyfs-sql/governance";
import { sqlFor, textOf } from "./sql.ts";

/** What a migration may be asked. */
export type MigrateOptions = {
  /** Whether to make the index of search: `auto` makes it where the engine has one, `require` fails where it cannot, `off` never makes it. */
  readonly search?: "auto" | "require" | "off";
  /** The version to stop at: the latest where not given. */
  readonly target?: number;
  /** Whether a migration that takes something away may run. */
  readonly destructive?: boolean;
  /** The plan of the migrations: the library's own where not given (a test gives its own to hold the refusal of a destructive step). */
  readonly plan?: typeof MIGRATION_PLAN;
};

/** What a migration did: the version the database was at, the version it is at, and whether it has the index of search. */
export type Migrated = { readonly from: number; readonly version: number; readonly search: boolean };

async function tableExists(tx: SqlRunner, port: SqlPort, naming: Naming): Promise<boolean> {
  const sql = sqlFor(port.dialect, naming);
  const name = tableOf(naming, "meta");
  const q = sql.query();
  if (port.dialect === "sqlite") {
    q.text("SELECT name FROM ");
    if (naming.schema !== undefined) q.name(naming.schema).text(".");
    q.text("sqlite_master WHERE type = 'table' AND name = ").param(name);
  } else {
    q.text("SELECT table_name FROM information_schema.tables WHERE table_name = ").param(name).text(" AND table_schema = ");
    if (naming.schema === undefined) q.text("current_schema()");
    else q.param(naming.schema);
  }
  const st = q.done();
  return (await tx.query(st.text, st.params)).length > 0;
}

/** The version of the layout the database is at: 0 where it has none. */
export async function layoutVersion(port: SqlPort, naming: Naming): Promise<number> {
  return versionOf(port, port, naming);
}

async function versionOf(tx: SqlRunner, port: SqlPort, naming: Naming): Promise<number> {
  if (!(await tableExists(tx, port, naming))) return 0;
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("SELECT value FROM ").table("meta").text(" WHERE key = ").param("schema_version").done();
  const rows = await tx.query(st.text, st.params);
  const first = rows[0];
  return first === undefined ? 0 : Number(textOf(first["value"] ?? null));
}

async function setFact(tx: SqlRunner, port: SqlPort, naming: Naming, key: string, value: string): Promise<void> {
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("INSERT INTO ").table("meta").text(" (key, value) VALUES (").param(key).text(", ").param(value).text(") ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value").done();
  await tx.exec(st.text, st.params);
}

/** The statements of one version of the layout. */
function statementsOf(version: number, port: SqlPort, naming: Naming): readonly string[] {
  const sql = sqlFor(port.dialect, naming);
  const t = sql.type;
  const meta = sql.table("meta");
  const objects = sql.table("objects");
  const revisions = sql.table("revisions");
  switch (version) {
    case 1:
      return [
        `CREATE TABLE IF NOT EXISTS ${meta} (key ${t("text")} PRIMARY KEY, value ${t("text")} NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS ${objects} (path ${t("path")} PRIMARY KEY, rev ${t("text")} NOT NULL, size ${t("integer")} NOT NULL, media_type ${t("text")}, modified ${t("text")} NOT NULL, body ${t("bytes")} NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS ${revisions} (path ${t("path")} NOT NULL, seq ${t("integer")} NOT NULL, rev ${t("text")} NOT NULL, size ${t("integer")} NOT NULL, modified ${t("text")} NOT NULL, PRIMARY KEY (path, seq))`,
      ];
    case 2:
      return [
        `CREATE INDEX IF NOT EXISTS ${sql.name(indexOf(naming, "objects", "modified"))} ON ${objects} (modified)`,
        `CREATE INDEX IF NOT EXISTS ${sql.name(indexOf(naming, "objects", "media"))} ON ${objects} (media_type)`,
      ];
    default:
      return [];
  }
}

/** The statements that make the index of search in a dialect, or none where the dialect has no index. */
function searchStatements(port: SqlPort, naming: Naming): readonly string[] {
  const sql = sqlFor(port.dialect, naming);
  const search = sql.table("search");
  switch (port.dialect) {
    case "sqlite":
      return [`CREATE VIRTUAL TABLE IF NOT EXISTS ${search} USING fts5(path UNINDEXED, text)`];
    case "postgres":
      return [`CREATE TABLE IF NOT EXISTS ${search} (path ${sql.type("path")} PRIMARY KEY, text tsvector NOT NULL)`, `CREATE INDEX IF NOT EXISTS ${sql.name(indexOf(naming, "search", "text"))} ON ${search} USING GIN (text)`];
    case "duckdb":
      return [];
  }
}

/** Whether the database has the table of search. */
export async function hasSearch(port: SqlPort, naming: Naming): Promise<boolean> {
  const sql = sqlFor(port.dialect, naming);
  const name = tableOf(naming, "search");
  const q = sql.query();
  if (port.dialect === "sqlite") {
    q.text("SELECT name FROM ");
    if (naming.schema !== undefined) q.name(naming.schema).text(".");
    q.text("sqlite_master WHERE name = ").param(name);
  } else {
    q.text("SELECT table_name FROM information_schema.tables WHERE table_name = ").param(name).text(" AND table_schema = ");
    if (naming.schema === undefined) q.text("current_schema()");
    else q.param(naming.schema);
  }
  const st = q.done();
  return (await port.query(st.text, st.params)).length > 0;
}

/**
 * Brings the database to the latest version of the layout (or to `target`): each version in its own transaction, the version written with it. A database that is ahead of the library is refused.
 * The index of search is made after the migrations, where the engine has one, and the fact is written.
 */
export async function migrate(port: SqlPort, naming: Naming, options: MigrateOptions = {}): Promise<Result<Migrated, string>> {
  const target = options.target ?? Math.max(SCHEMA_VERSION, ...(options.plan ?? MIGRATION_PLAN).map((m) => m.version));
  const from = await versionOf(port, port, naming);
  if (from > Math.max(SCHEMA_VERSION, ...(options.plan ?? MIGRATION_PLAN).map((m) => m.version))) return err(`the database is at version ${from} of the layout and this library knows version ${SCHEMA_VERSION}: it is not changed`);
  let version = from;
  for (const step of options.plan ?? MIGRATION_PLAN) {
    if (step.version <= from || step.version > target) continue;
    if (step.destructive && options.destructive !== true) return err(`migration ${step.version} (${step.name}) takes something away: it runs only where the caller says so`);
    const statements = statementsOf(step.version, port, naming);
    await port.transaction(async (tx) => {
      for (const s of statements) await tx.exec(s, []);
      if (step.version === 1) await setFact(tx, port, naming, "layout", "anyfs-sql");
      await setFact(tx, port, naming, "schema_version", String(step.version));
    });
    version = step.version;
  }
  let search = false;
  if (version >= 2 && options.search !== "off") {
    const statements = searchStatements(port, naming);
    if (statements.length === 0) {
      if (options.search === "require") return err(`${port.dialect} has no index of search that keeps itself current`);
    } else {
      try {
        for (const s of statements) await port.exec(s, []);
        search = true;
      } catch (thrown) {
        if (options.search === "require") return err(`the index of search could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
      }
    }
  }
  if (search) await port.transaction((tx) => setFact(tx, port, naming, "search", "on"));
  return ok({ from, version, search: options.search === "off" ? false : search || (version >= 2 && (await hasSearch(port, naming))) });
}
