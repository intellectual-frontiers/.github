// Spec: 0004-sql-schema FR-001, FR-002, FR-003
/**
 * The tables and views of a store that merges, made and changed by code: the migrations in order, each one inside one transaction with the version it reaches written in the same transaction, so that a database is at a
 * version or at the one before it and never between. A database of a newer version than the library knows is refused and left as it is, and so is a database of an earlier layout, which is not migrated. The version rows
 * and the blobs are the mergeable tables (a key with `ON CONFLICT IGNORE` and no row id, so that replaying a dump of them is replaying a union); the facts of the copy, its trust, its epochs and its caches are local and
 * never in a dump; the heads, the files, the siblings and the version vector are views of the rows. The index of search is made where the engine has one (the words of a text in an FTS5 table for SQLite) and the library
 * says whether it did. The statements are written for SQLite and every driver of it; PostgreSQL and DuckDB are refused with a sentence until their layouts are made.
 *
 * @example
 * ```ts
 * import { migrate } from "./schema.ts";
 * const done = await migrate(port, naming, { search: "auto" });
 * done.kind === "ok" && done.value.version; // 3
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { LAYOUT_NAME, MIGRATION_PLAN, type Naming, SCHEMA_VERSION, type SqlPort, type SqlRunner, tableOf } from "@intellectual-frontiers/anyfs-sql/governance";
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

/** Why a dialect has no layout yet, or nothing where it has one. */
export function dialectProblem(port: SqlPort): string | undefined {
  return port.dialect === "sqlite" ? undefined : `the layout of a store that merges is made for SQLite and its drivers: ${port.dialect} has none yet`;
}

async function tableExists(tx: SqlRunner, port: SqlPort, naming: Naming, role: "meta" | "search"): Promise<boolean> {
  const sql = sqlFor(port.dialect, naming);
  const q = sql.query().text("SELECT name FROM ");
  if (naming.schema !== undefined) q.name(naming.schema).text(".");
  q.text("sqlite_master WHERE name = ").param(tableOf(naming, role));
  const st = q.done();
  return (await tx.query(st.text, st.params)).length > 0;
}

/** The version of the layout the database is at: 0 where it has none. */
export async function layoutVersion(port: SqlPort, naming: Naming): Promise<number> {
  return versionOf(port, port, naming);
}

async function versionOf(tx: SqlRunner, port: SqlPort, naming: Naming): Promise<number> {
  if (!(await tableExists(tx, port, naming, "meta"))) return 0;
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("SELECT value FROM ").table("meta").text(" WHERE key = ").param("schema_version").done();
  const first = (await tx.query(st.text, st.params))[0];
  return first === undefined ? 0 : Number(textOf(first["value"] ?? null));
}

async function setFact(tx: SqlRunner, port: SqlPort, naming: Naming, key: string, value: string): Promise<void> {
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("INSERT INTO ").table("meta").text(" (key, value) VALUES (").param(key).text(", ").param(value).text(") ON CONFLICT (key) DO UPDATE SET value = excluded.value").done();
  await tx.exec(st.text, st.params);
}

/** The statements of one version of the layout. */
function statementsOf(version: number, port: SqlPort, naming: Naming): readonly string[] {
  const sql = sqlFor(port.dialect, naming);
  const n = (role: Parameters<typeof sql.table>[0]): string => sql.table(role);
  const idx = (on: string): string => sql.name(`${naming.prefix}_versions_${on}`);
  switch (version) {
    case 3:
      return [
        // the facts of this copy of the database: never in a dump
        `CREATE TABLE IF NOT EXISTS ${n("meta")} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
        // the version rows: immutable, the key is the id with the sum, a second insert of a key is ignored, no row id
        `CREATE TABLE IF NOT EXISTS ${n("versions")} (id TEXT NOT NULL, sum TEXT NOT NULL, replica TEXT NOT NULL, seq INTEGER NOT NULL, path TEXT NOT NULL, parent TEXT, merged TEXT NOT NULL, kind TEXT NOT NULL, blob TEXT, PRIMARY KEY (id, sum) ON CONFLICT IGNORE) WITHOUT ROWID`,
        // the blobs: named by the digest of their bytes
        `CREATE TABLE IF NOT EXISTS ${n("blobs")} (sha TEXT NOT NULL PRIMARY KEY ON CONFLICT IGNORE, bytes BLOB NOT NULL) WITHOUT ROWID`,
        `CREATE INDEX IF NOT EXISTS ${idx("path")} ON ${n("versions")} (path, id)`,
        `CREATE INDEX IF NOT EXISTS ${idx("parent")} ON ${n("versions")} (parent) WHERE parent IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS ${idx("replica")} ON ${n("versions")} (replica, seq)`,
        `CREATE INDEX IF NOT EXISTS ${idx("merged")} ON ${n("versions")} (id) WHERE merged <> '[]'`,
        // the local tables: whom this copy trusts, its epochs, its caches
        `CREATE TABLE IF NOT EXISTS ${n("trust")} (replica TEXT PRIMARY KEY)`,
        `CREATE TABLE IF NOT EXISTS ${n("epochs")} (n INTEGER PRIMARY KEY, horizon TEXT NOT NULL, roster TEXT NOT NULL, retained TEXT NOT NULL, bound TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS ${n("cache")} (kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (kind, key))`,
        // the heads: the rows no other row replaced
        `CREATE VIEW IF NOT EXISTS ${n("heads")} AS SELECT v.id AS id, v.sum AS sum, v.replica AS replica, v.seq AS seq, v.path AS path, v.parent AS parent, v.merged AS merged, v.kind AS kind, v.blob AS blob FROM ${n("versions")} v ` +
          `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} c WHERE c.parent = v.id) ` +
          `AND NOT EXISTS (SELECT 1 FROM ${n("versions")} c, json_each(c.merged) j WHERE c.merged <> '[]' AND j.value = v.id)`,
        // the files: the winner of each path (the head with the greatest id and then sum) where it is a put
        `CREATE VIEW IF NOT EXISTS ${n("names")} AS SELECT h.path AS path, h.id AS id, h.sum AS sum, h.blob AS blob, h.replica AS replica FROM ${n("heads")} h ` +
          `WHERE h.kind = 'put' AND NOT EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
        // the siblings: the heads that are not the winner
        `CREATE VIEW IF NOT EXISTS ${n("siblings")} AS SELECT h.id AS id, h.sum AS sum, h.replica AS replica, h.seq AS seq, h.path AS path, h.parent AS parent, h.merged AS merged, h.kind AS kind, h.blob AS blob FROM ${n("heads")} h ` +
          `WHERE EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
        // the vector: for each replica, the last number held with none missing before it
        `CREATE VIEW IF NOT EXISTS ${n("vector")} AS SELECT v.replica AS replica, MIN(v.seq) AS n FROM ${n("versions")} v ` +
          `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} w WHERE w.replica = v.replica AND w.seq = v.seq + 1) ` +
          `GROUP BY v.replica HAVING EXISTS (SELECT 1 FROM ${n("versions")} f WHERE f.replica = v.replica AND f.seq = 1)`,
        // a row an epoch has collected is dead: a raw import that brings it back (an old dump) writes nothing, unless the epoch retained it
        `CREATE TRIGGER IF NOT EXISTS ${sql.name(`${naming.prefix}_versions_dead`)} BEFORE INSERT ON ${n("versions")} ` +
          `WHEN EXISTS (SELECT 1 FROM ${n("epochs")} e WHERE e.n = (SELECT MAX(n) FROM ${n("epochs")}) ` +
          `AND NEW.seq <= COALESCE(json_extract(e.horizon, '$."' || NEW.replica || '"'), 0) ` +
          `AND NOT EXISTS (SELECT 1 FROM json_each(e.retained) j WHERE j.value = NEW.id || '|' || NEW.sum)) ` +
          `BEGIN SELECT RAISE(IGNORE); END`,
        // a raw import writes no row of a replica this copy does not trust where its trust mode is the allowlist: SQLite cannot hash, so the sums are checked by `verify`
        `CREATE TRIGGER IF NOT EXISTS ${sql.name(`${naming.prefix}_versions_trust`)} BEFORE INSERT ON ${n("versions")} ` +
          `WHEN (SELECT value FROM ${n("meta")} WHERE key = 'trust_mode') = 'allowlist' AND NOT EXISTS (SELECT 1 FROM ${n("trust")} WHERE replica = NEW.replica) ` +
          `BEGIN SELECT RAISE(ABORT, 'the replica of this row is not one this database takes rows from'); END`,
      ];
    default:
      return [];
  }
}

/** The statements that make the index of search in a dialect, or none where the dialect has no index. */
function searchStatements(port: SqlPort, naming: Naming): readonly string[] {
  const sql = sqlFor(port.dialect, naming);
  return [`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.table("search")} USING fts5(path UNINDEXED, text)`];
}

/** Whether the database has the table of search. */
export async function hasSearch(port: SqlPort, naming: Naming): Promise<boolean> {
  return tableExists(port, port, naming, "search");
}

/**
 * Brings the database to the latest version of the layout (or to `target`): each version in its own transaction, the version written with it. A database that is ahead of the library is refused, and so is one of an earlier
 * layout. The index of search is made after the migrations, where the engine has one, and the fact is written.
 */
export async function migrate(port: SqlPort, naming: Naming, options: MigrateOptions = {}): Promise<Result<Migrated, string>> {
  const bad = dialectProblem(port);
  if (bad !== undefined) return err(bad);
  const plan = options.plan ?? MIGRATION_PLAN;
  const first = Math.min(...plan.map((m) => m.version));
  const latest = Math.max(SCHEMA_VERSION, ...plan.map((m) => m.version));
  const target = options.target ?? latest;
  const from = await versionOf(port, port, naming);
  if (from > latest) return err(`the database is at version ${from} of the layout and this library knows version ${SCHEMA_VERSION}: it is left as it is`);
  if (from > 0 && from < first) return err(`the database holds version ${from} of an earlier layout, which is not migrated: the layout of a store that merges starts at version ${first}`);
  let version = from;
  for (const step of plan) {
    if (step.version <= from || step.version > target) continue;
    if (step.destructive && options.destructive !== true) return err(`migration ${step.version} (${step.name}) takes something away: it runs only where the caller says so`);
    const statements = statementsOf(step.version, port, naming);
    await port.transaction(async (tx) => {
      for (const s of statements) await tx.exec(s, []);
      if (step.version === first) {
        await setFact(tx, port, naming, "layout", LAYOUT_NAME);
        await setFact(tx, port, naming, "trust_mode", "allowlist");
      }
      await setFact(tx, port, naming, "schema_version", String(step.version));
    });
    version = step.version;
  }
  let search = false;
  if (version >= SCHEMA_VERSION && options.search !== "off") {
    try {
      for (const s of searchStatements(port, naming)) await port.exec(s, []);
      search = true;
    } catch (thrown) {
      if (options.search === "require") return err(`the index of search could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
  }
  if (search) await port.transaction((tx) => setFact(tx, port, naming, "search", "on"));
  return ok({ from, version, search: options.search === "off" ? false : search || (version >= SCHEMA_VERSION && (await hasSearch(port, naming))) });
}
