/**
 * Tests of the schema and its migration (commons anyfs-sql 0004-sql-schema FR-001 to FR-004): the layout is made in one transaction with the version written in it and a second run changes nothing, the mergeable tables have
 * the key and the conflict rule a replay relies on, a database ahead of the library or of an earlier layout is refused and left as it is, a destructive step runs only where the caller says so, the index of search is made only
 * where asked, and PostgreSQL and DuckDB are refused with a sentence.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { LAYOUT_NAME, MIGRATION_PLAN, SCHEMA_VERSION, parseNaming } from "../src/governance/mod.ts";
import { hasSearch, layoutVersion, migrate, openSqlStore, sqlFor } from "../src/physical/mod.ts";
import { duckdbMemory, pgliteMemory, sqliteMemory } from "./kit.ts";

const naming = (() => {
  const n = parseNaming();
  if (n.kind === "err") throw new Error(n.error);
  return n.value;
})();

proves(["0004-sql-schema FR-001"], "migrate brings an empty database to the layout of a store that merges with the facts of the copy, and a second run changes nothing", async () => {
  const port = await sqliteMemory();
  assertEquals(await layoutVersion(port, naming), 0);
  const first = await migrate(port, naming);
  assert(first.kind === "ok");
  assertEquals([first.value.from, first.value.version, first.value.search], [0, SCHEMA_VERSION, true]);
  const sql = sqlFor("sqlite", naming);
  const facts = await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, []);
  const byKey = Object.fromEntries(facts.map((r) => [String(r["key"]), String(r["value"])]));
  assertEquals(byKey["layout"], LAYOUT_NAME);
  assertEquals(byKey["schema_version"], String(SCHEMA_VERSION));
  assertEquals(byKey["trust_mode"], "allowlist");
  const again = await migrate(port, naming);
  assert(again.kind === "ok" && again.value.from === SCHEMA_VERSION && again.value.version === SCHEMA_VERSION);
  await port.close();
});

proves(["0004-sql-schema FR-002"], "the version rows and the blobs have no row id and a key whose conflict rule ignores a second row, and the other tables and views are the ones the layout names", async () => {
  const port = await sqliteMemory();
  assert((await migrate(port, naming)).kind === "ok");
  const defs = await port.query("SELECT name, type, sql FROM sqlite_master ORDER BY name", []);
  const by = new Map(defs.map((r) => [String(r["name"]), { type: String(r["type"]), sql: String(r["sql"] ?? "") }]));
  const versions = by.get("anyfs_versions");
  assert(versions !== undefined && versions.type === "table");
  assert(/PRIMARY KEY \(id, sum\) ON CONFLICT IGNORE\) WITHOUT ROWID/u.test(versions.sql), versions.sql);
  const blobs = by.get("anyfs_blobs");
  assert(blobs !== undefined && /PRIMARY KEY ON CONFLICT IGNORE, bytes BLOB NOT NULL\) WITHOUT ROWID/u.test(blobs.sql), blobs?.sql);
  for (const view of ["anyfs_heads", "anyfs_names", "anyfs_siblings", "anyfs_vector"]) assertEquals(by.get(view)?.type, "view", view);
  for (const table of ["anyfs_meta", "anyfs_trust", "anyfs_epochs", "anyfs_cache"]) assertEquals(by.get(table)?.type, "table", table);
  assert(by.has("anyfs_versions_trust"), "the trigger that refuses a replica the database does not trust");
  for (const t of ["anyfs_versions", "anyfs_blobs"]) assert(!/UNIQUE|AUTOINCREMENT|REFERENCES|FOREIGN/iu.test(by.get(t)?.sql ?? ""), `${t} has no unique column, no auto-increment and no foreign key`);
  await port.close();
});

proves(["0004-sql-schema FR-003"], "a database ahead of the library, and one of an earlier layout, are refused and left as they are, and a store asked only to check refuses one that is not at the version the library writes", async () => {
  const port = await sqliteMemory();
  assert((await migrate(port, naming)).kind === "ok");
  const sql = sqlFor("sqlite", naming);
  const bump = sql.query().text("UPDATE ").table("meta").text(" SET value = ").param("99").text(" WHERE key = ").param("schema_version").done();
  await port.exec(bump.text, bump.params);
  const metaOf = async (): Promise<readonly string[]> => (await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, [])).map((r) => `${String(r["key"])}=${String(r["value"])}`);
  const before = await metaOf();
  const refused = await openSqlStore(port);
  assert(refused.kind === "err" && /version 99/.test(refused.error), "a database ahead is refused");
  assertEquals(await metaOf(), before);

  // a database of an earlier layout: a meta table at version 2
  const earlier = await sqliteMemory();
  await earlier.exec("CREATE TABLE anyfs_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)", []);
  await earlier.exec("INSERT INTO anyfs_meta VALUES ('schema_version', '2'), ('layout', 'anyfs-sql')", []);
  const old = await openSqlStore(earlier);
  assert(old.kind === "err" && /earlier layout, which is not migrated/.test(old.error), old.kind === "err" ? old.error : "opened");
  assertEquals(await layoutVersion(earlier, naming), 2, "an earlier layout is left as it is");

  const fresh = await sqliteMemory();
  const checked = await openSqlStore(fresh, { layout: "check" });
  assert(checked.kind === "err" && /only to check/.test(checked.error));
  assertEquals(await layoutVersion(fresh, naming), 0, "a check changes nothing");
  const current = await sqliteMemory();
  assert((await migrate(current, naming)).kind === "ok");
  assert((await openSqlStore(current, { layout: "check" })).kind === "ok");
});

proves(["0004-sql-schema FR-003"], "a migration that takes something away runs only where the caller says so", async () => {
  const port = await sqliteMemory();
  assert((await migrate(port, naming)).kind === "ok");
  const plan = [...MIGRATION_PLAN, { version: SCHEMA_VERSION + 1, name: "drops a thing", destructive: true }];
  const refused = await migrate(port, naming, { plan });
  assert(refused.kind === "err" && /takes something away/.test(refused.error));
  assertEquals(await layoutVersion(port, naming), SCHEMA_VERSION, "the destructive step did not run");
  const allowed = await migrate(port, naming, { plan, destructive: true });
  assert(allowed.kind === "ok" && allowed.value.version === SCHEMA_VERSION + 1);
});

proves(["0004-sql-schema FR-004"], "the index of search is made where asked (SQLite, PostgreSQL) and not where it is off, and DuckDB has none and says so where it is required", async () => {
  const on = await sqliteMemory();
  const auto = await migrate(on, naming, { search: "auto" });
  assert(auto.kind === "ok" && auto.value.search);
  assertEquals(await hasSearch(on, naming), true);
  const off = await sqliteMemory();
  const none = await migrate(off, naming, { search: "off" });
  assert(none.kind === "ok" && !none.value.search);
  assertEquals(await hasSearch(off, naming), false);
  const pg = await pgliteMemory();
  const made = await migrate(pg, naming, { search: "auto" });
  assert(made.kind === "ok" && made.value.search && (await hasSearch(pg, naming)));
  const duck = await duckdbMemory();
  const none2 = await migrate(duck, naming, { search: "auto" });
  assert(none2.kind === "ok" && !none2.value.search);
  const required = await migrate(await duckdbMemory(), naming, { search: "require" });
  assert(required.kind === "err" && /no index that keeps itself current/.test(required.error));
  for (const make of [pgliteMemory, duckdbMemory]) {
    const opened = await openSqlStore(await make());
    assert(opened.kind === "ok");
  }
});
