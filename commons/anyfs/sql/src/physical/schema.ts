// Spec: 0004-sql-schema FR-001, FR-002, FR-004
/**
 * The tables and views of a store that merges, made by code: where the database has no layout they are made in one transaction with the facts of the copy written in it, and where it has one they are left as they are. The version rows
 * and the blobs are the mergeable tables (a key with `ON CONFLICT IGNORE` and no row id, so that replaying a dump of them is replaying a union); the facts of the copy, its trust, its epochs and its caches are local and
 * never in a dump; the heads, the files, the siblings and the version vector are views of the rows. The index of search is made where the engine has one (the words of a text in an FTS5 table for SQLite) and the library
 * says whether it did. The statements are written for SQLite, PostgreSQL and DuckDB; any other dialect is refused with a sentence.
 *
 * @example
 * ```ts
 * import { makeLayout } from "./schema.ts";
 * const done = await makeLayout(port, naming, { search: "auto" });
 * done.kind === "ok" && done.value.search; // true where the engine has an index of search
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { LAYOUT_NAME, type Naming, type SqlPort, type SqlRunner, tableOf } from "@intellectual-frontiers/anyfs-sql/governance";
import { sqlFor, textOf } from "./sql.ts";

/** What making the layout may be asked. */
export type LayoutOptions = {
  /** Whether to make the index of search: `auto` makes it where the engine has one, `require` fails where it cannot, `off` never makes it. */
  readonly search?: "auto" | "require" | "off";
};

/** What making the layout did: whether the database has the index of search. */
export type Made = { readonly search: boolean };

/** Why a dialect has no layout, or nothing where it has one: SQLite and its drivers, PostgreSQL and DuckDB each have theirs. */
export function dialectProblem(port: SqlPort): string | undefined {
  return port.dialect === "sqlite" || port.dialect === "postgres" || port.dialect === "duckdb" ? undefined : `the layout of a store that merges has none for the dialect ${String(port.dialect)}`;
}

async function tableExists(tx: SqlRunner, port: SqlPort, naming: Naming, role: "meta" | "search"): Promise<boolean> {
  const sql = sqlFor(port.dialect, naming);
  if (port.dialect === "sqlite") {
    const q = sql.query().text("SELECT name FROM ");
    if (naming.schema !== undefined) q.name(naming.schema).text(".");
    q.text("sqlite_master WHERE name = ").param(tableOf(naming, role));
    const st = q.done();
    return (await tx.query(st.text, st.params)).length > 0;
  }
  // PostgreSQL and DuckDB both keep the catalog in `information_schema`, a table of a schema being the one named or the current one
  const q = sql.query().text("SELECT table_name FROM information_schema.tables WHERE table_name = ").param(tableOf(naming, role)).text(" AND table_schema = ");
  if (naming.schema !== undefined) q.param(naming.schema);
  else q.text("current_schema()");
  const st = q.done();
  return (await tx.query(st.text, st.params)).length > 0;
}

/** Whether the database has the layout: the table of the facts of the copy holds the name of the layout. */
async function hasLayout(port: SqlPort, naming: Naming): Promise<boolean> {
  if (!(await tableExists(port, port, naming, "meta"))) return false;
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("SELECT value FROM ").table("meta").text(" WHERE key = ").param("layout").done();
  return (await port.query(st.text, st.params)).length > 0;
}

async function setFact(tx: SqlRunner, port: SqlPort, naming: Naming, key: string, value: string): Promise<void> {
  const sql = sqlFor(port.dialect, naming);
  const st = sql.query().text("INSERT INTO ").table("meta").text(" (key, value) VALUES (").param(key).text(", ").param(value).text(") ON CONFLICT (key) DO UPDATE SET value = excluded.value").done();
  await tx.exec(st.text, st.params);
}

/** The statements of the layout. */
function statementsOf(port: SqlPort, naming: Naming, schema: string): readonly string[] {
  if (port.dialect === "postgres") return postgresStatements(naming, schema);
  if (port.dialect === "duckdb") return duckdbStatements(naming);
  const sql = sqlFor(port.dialect, naming);
  const n = (role: Parameters<typeof sql.table>[0]): string => sql.table(role);
  const idx = (on: string): string => sql.name(`${naming.prefix}_versions_${on}`);
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
}

/** The statements that make the index of search in a dialect, or none where the dialect has no index: FTS5 for SQLite, a `tsvector` with a GIN index for PostgreSQL, nothing for DuckDB (it has no index that keeps itself current). */
function searchStatements(port: SqlPort, naming: Naming): readonly string[] {
  const sql = sqlFor(port.dialect, naming);
  switch (port.dialect) {
    case "sqlite":
      return [`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.table("search")} USING fts5(path UNINDEXED, text)`];
    case "postgres":
      return [
        `CREATE TABLE IF NOT EXISTS ${sql.table("search")} (path TEXT COLLATE "C" NOT NULL PRIMARY KEY, text TEXT NOT NULL, tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED)`,
        `CREATE INDEX IF NOT EXISTS ${sql.name(`${naming.prefix}_search_tsv`)} ON ${sql.table("search")} USING GIN (tsv)`,
      ];
    case "duckdb":
      return [];
    default:
      return absurd(port.dialect);
  }
}

/** Whether the database has the table of search. */
export async function hasSearch(port: SqlPort, naming: Naming): Promise<boolean> {
  return tableExists(port, port, naming, "search");
}

/**
 * Makes the layout where the database has none, in one transaction with the facts of the copy, and the index of search where the engine has one. A database that has the layout is left as it is.
 */
export async function makeLayout(port: SqlPort, naming: Naming, options: LayoutOptions = {}): Promise<Result<Made, string>> {
  const bad = dialectProblem(port);
  if (bad !== undefined) return err(bad);
  if (!(await hasLayout(port, naming))) {
    // a trigger function of PostgreSQL runs with the search path of the session that fires it (a restore sets it empty), so it is given the schema of the tables: the one named or the current one
    const schema = naming.schema ?? (port.dialect === "postgres" ? textOf((await port.query("SELECT current_schema() AS schema", []))[0]?.["schema"] ?? null) : "main");
    const statements = statementsOf(port, naming, schema);
    await port.transaction(async (tx) => {
      for (const s of statements) await tx.exec(s, []);
      await setFact(tx, port, naming, "layout", LAYOUT_NAME);
      await setFact(tx, port, naming, "trust_mode", "allowlist");
    });
  }
  let search = false;
  if (options.search !== "off") {
    try {
      const made = searchStatements(port, naming);
      if (made.length === 0 && options.search === "require") return err(`the index of search could not be made: ${port.dialect} has no index that keeps itself current`);
      for (const s of made) await port.exec(s, []);
      search = made.length > 0;
    } catch (thrown) {
      if (options.search === "require") return err(`the index of search could not be made: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    }
  }
  if (search) await port.transaction((tx) => setFact(tx, port, naming, "search", "on"));
  return ok({ search: options.search === "off" ? false : search || (await hasSearch(port, naming)) });
}

/** The statements of the layout in PostgreSQL: the same tables with the types of the engine and the byte order of the `C` collation for every key and path (so that the order of a listing is the order of the bytes), the views, and the two triggers as functions. */
function postgresStatements(naming: Naming, schema: string): readonly string[] {
  const sql = sqlFor("postgres", naming);
  const n = (role: Parameters<typeof sql.table>[0]): string => sql.table(role);
  const idx = (on: string): string => sql.name(`${naming.prefix}_versions_${on}`);
  const key = 'TEXT COLLATE "C"';
  const qualify = (name: string): string => (naming.schema === undefined ? sql.name(name) : `${sql.name(naming.schema)}.${sql.name(name)}`);
  const dead = `${naming.prefix}_versions_dead`;
  const trust = `${naming.prefix}_versions_trust`;
  const wherever = "AND strpos(c.merged, '\"' || v.id || '\"') > 0";
  return [
    `CREATE TABLE IF NOT EXISTS ${n("meta")} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${n("versions")} (id ${key} NOT NULL, sum ${key} NOT NULL, replica ${key} NOT NULL, seq BIGINT NOT NULL, path ${key} NOT NULL, parent ${key}, merged TEXT NOT NULL, kind TEXT NOT NULL, blob ${key}, PRIMARY KEY (id, sum))`,
    `CREATE TABLE IF NOT EXISTS ${n("blobs")} (sha ${key} NOT NULL PRIMARY KEY, bytes BYTEA NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ${idx("path")} ON ${n("versions")} (path, id)`,
    `CREATE INDEX IF NOT EXISTS ${idx("parent")} ON ${n("versions")} (parent) WHERE parent IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS ${idx("replica")} ON ${n("versions")} (replica, seq)`,
    `CREATE INDEX IF NOT EXISTS ${idx("merged")} ON ${n("versions")} (id) WHERE merged <> '[]'`,
    `CREATE TABLE IF NOT EXISTS ${n("trust")} (replica TEXT PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS ${n("epochs")} (n BIGINT PRIMARY KEY, horizon TEXT NOT NULL, roster TEXT NOT NULL, retained TEXT NOT NULL, bound TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${n("cache")} (kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (kind, key))`,
    // the heads: the rows no other row replaced (a parent, or an id in the list of merged ids, which is the JSON text of a list of quoted ids)
    `CREATE OR REPLACE VIEW ${n("heads")} AS SELECT v.id AS id, v.sum AS sum, v.replica AS replica, v.seq AS seq, v.path AS path, v.parent AS parent, v.merged AS merged, v.kind AS kind, v.blob AS blob FROM ${n("versions")} v ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} c WHERE c.parent = v.id) ` +
      `AND NOT EXISTS (SELECT 1 FROM ${n("versions")} c WHERE c.merged <> '[]' ${wherever})`,
    `CREATE OR REPLACE VIEW ${n("names")} AS SELECT h.path AS path, h.id AS id, h.sum AS sum, h.blob AS blob, h.replica AS replica FROM ${n("heads")} h ` +
      `WHERE h.kind = 'put' AND NOT EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
    `CREATE OR REPLACE VIEW ${n("siblings")} AS SELECT h.id AS id, h.sum AS sum, h.replica AS replica, h.seq AS seq, h.path AS path, h.parent AS parent, h.merged AS merged, h.kind AS kind, h.blob AS blob FROM ${n("heads")} h ` +
      `WHERE EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
    `CREATE OR REPLACE VIEW ${n("vector")} AS SELECT v.replica AS replica, MIN(v.seq) AS n FROM ${n("versions")} v ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} w WHERE w.replica = v.replica AND w.seq = v.seq + 1) ` +
      `GROUP BY v.replica HAVING EXISTS (SELECT 1 FROM ${n("versions")} f WHERE f.replica = v.replica AND f.seq = 1)`,
    // a row an epoch has collected is dead: the trigger gives the row up (returns null) so that an old dump replayed writes nothing, unless the epoch retained it
    `CREATE OR REPLACE FUNCTION ${qualify(`${dead}_fn`)}() RETURNS trigger LANGUAGE plpgsql SET search_path = ${sql.name(schema)} AS $fn$ BEGIN ` +
      `IF EXISTS (SELECT 1 FROM ${n("epochs")} e WHERE e.n = (SELECT MAX(n) FROM ${n("epochs")}) ` +
      `AND NEW.seq <= COALESCE((e.horizon::jsonb ->> NEW.replica)::bigint, 0) ` +
      `AND NOT jsonb_exists(e.retained::jsonb, NEW.id || '|' || NEW.sum)) THEN RETURN NULL; END IF; RETURN NEW; END $fn$`,
    `DROP TRIGGER IF EXISTS ${sql.name(dead)} ON ${n("versions")}`,
    `CREATE TRIGGER ${sql.name(dead)} BEFORE INSERT ON ${n("versions")} FOR EACH ROW EXECUTE FUNCTION ${qualify(`${dead}_fn`)}()`,
    // a raw import writes no row of a replica this copy does not trust where its trust mode is the allowlist: the hashes are checked by `verify`
    `CREATE OR REPLACE FUNCTION ${qualify(`${trust}_fn`)}() RETURNS trigger LANGUAGE plpgsql SET search_path = ${sql.name(schema)} AS $fn$ BEGIN ` +
      `IF (SELECT value FROM ${n("meta")} WHERE key = 'trust_mode') = 'allowlist' AND NOT EXISTS (SELECT 1 FROM ${n("trust")} WHERE replica = NEW.replica) THEN ` +
      `RAISE EXCEPTION 'the replica of this row is not one this database takes rows from'; END IF; RETURN NEW; END $fn$`,
    `DROP TRIGGER IF EXISTS ${sql.name(trust)} ON ${n("versions")}`,
    `CREATE TRIGGER ${sql.name(trust)} BEFORE INSERT ON ${n("versions")} FOR EACH ROW EXECUTE FUNCTION ${qualify(`${trust}_fn`)}()`,
  ];
}

/**
 * The statements of the layout in DuckDB: the same tables with a primary key that the library's own inserts meet with `ON CONFLICT DO NOTHING` (DuckDB has no conflict rule in a table), the views, and no
 * trigger, since DuckDB has none: the allowlist and the epochs are held by the library's import and by `verify`, and a raw import into a DuckDB database that does not go through the library is held by neither.
 */
function duckdbStatements(naming: Naming): readonly string[] {
  const sql = sqlFor("duckdb", naming);
  const n = (role: Parameters<typeof sql.table>[0]): string => sql.table(role);
  const idx = (on: string): string => sql.name(`${naming.prefix}_versions_${on}`);
  return [
    `CREATE TABLE IF NOT EXISTS ${n("meta")} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${n("versions")} (id TEXT NOT NULL, sum TEXT NOT NULL, replica TEXT NOT NULL, seq BIGINT NOT NULL, path TEXT NOT NULL, parent TEXT, merged TEXT NOT NULL, kind TEXT NOT NULL, blob TEXT, PRIMARY KEY (id, sum))`,
    `CREATE TABLE IF NOT EXISTS ${n("blobs")} (sha TEXT NOT NULL PRIMARY KEY, bytes BLOB NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ${idx("path")} ON ${n("versions")} (path, id)`,
    `CREATE INDEX IF NOT EXISTS ${idx("parent")} ON ${n("versions")} (parent)`,
    `CREATE INDEX IF NOT EXISTS ${idx("replica")} ON ${n("versions")} (replica, seq)`,
    `CREATE TABLE IF NOT EXISTS ${n("trust")} (replica TEXT PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS ${n("epochs")} (n BIGINT PRIMARY KEY, horizon TEXT NOT NULL, roster TEXT NOT NULL, retained TEXT NOT NULL, bound TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${n("cache")} (kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (kind, key))`,
    `CREATE OR REPLACE VIEW ${n("heads")} AS SELECT v.id AS id, v.sum AS sum, v.replica AS replica, v.seq AS seq, v.path AS path, v.parent AS parent, v.merged AS merged, v.kind AS kind, v.blob AS blob FROM ${n("versions")} v ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} c WHERE c.parent = v.id) ` +
      `AND NOT EXISTS (SELECT 1 FROM ${n("versions")} c WHERE c.merged <> '[]' AND strpos(c.merged, '"' || v.id || '"') > 0)`,
    `CREATE OR REPLACE VIEW ${n("names")} AS SELECT h.path AS path, h.id AS id, h.sum AS sum, h.blob AS blob, h.replica AS replica FROM ${n("heads")} h ` +
      `WHERE h.kind = 'put' AND NOT EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
    `CREATE OR REPLACE VIEW ${n("siblings")} AS SELECT h.id AS id, h.sum AS sum, h.replica AS replica, h.seq AS seq, h.path AS path, h.parent AS parent, h.merged AS merged, h.kind AS kind, h.blob AS blob FROM ${n("heads")} h ` +
      `WHERE EXISTS (SELECT 1 FROM ${n("heads")} o WHERE o.path = h.path AND (o.id > h.id OR (o.id = h.id AND o.sum > h.sum)))`,
    `CREATE OR REPLACE VIEW ${n("vector")} AS SELECT v.replica AS replica, MIN(v.seq) AS n FROM ${n("versions")} v ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${n("versions")} w WHERE w.replica = v.replica AND w.seq = v.seq + 1) ` +
      `GROUP BY v.replica HAVING EXISTS (SELECT 1 FROM ${n("versions")} f WHERE f.replica = v.replica AND f.seq = 1)`,
  ];
}
