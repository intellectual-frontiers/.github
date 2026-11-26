/**
 * Tests of the schema (commons anyfs-sql 0004-sql-schema FR-001, FR-002 and FR-004): the layout is made in one transaction with the facts of the copy and a second run changes nothing, the mergeable tables have
 * the key and the conflict rule a replay relies on, and the index of search is made only where asked.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { LAYOUT_NAME, parseNaming } from "../src/governance/mod.ts";
import { hasSearch, makeLayout, openSqlStore, sqlFor } from "../src/physical/mod.ts";
import { duckdbMemory, pgliteMemory, sqliteMemory } from "./kit.ts";

const naming = (() => {
  const n = parseNaming();
  if (n.kind === "err") throw new Error(n.error);
  return n.value;
})();

proves(["0004-sql-schema FR-001"], "makeLayout brings an empty database to the layout of a store that merges with the facts of the copy, and a second run changes nothing", async () => {
  const port = await sqliteMemory();
  const first = await makeLayout(port, naming);
  assert(first.kind === "ok");
  assertEquals(first.value.search, true);
  const sql = sqlFor("sqlite", naming);
  const facts = await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, []);
  const byKey = Object.fromEntries(facts.map((r) => [String(r["key"]), String(r["value"])]));
  assertEquals(byKey["layout"], LAYOUT_NAME);
  assertEquals(byKey["trust_mode"], "allowlist");
  const again = await makeLayout(port, naming);
  assert(again.kind === "ok" && again.value.search);
  const after = await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, []);
  assertEquals(after, facts, "a second run changes nothing");
  await port.close();
});

proves(["0004-sql-schema FR-002"], "the version rows and the blobs have no row id and a key whose conflict rule ignores a second row, and the other tables and views are the ones the layout names", async () => {
  const port = await sqliteMemory();
  assert((await makeLayout(port, naming)).kind === "ok");
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

proves(["0004-sql-schema FR-004"], "the index of search is made where asked (SQLite, PostgreSQL) and not where it is off, and DuckDB has none and says so where it is required", async () => {
  const on = await sqliteMemory();
  const auto = await makeLayout(on, naming, { search: "auto" });
  assert(auto.kind === "ok" && auto.value.search);
  assertEquals(await hasSearch(on, naming), true);
  const off = await sqliteMemory();
  const none = await makeLayout(off, naming, { search: "off" });
  assert(none.kind === "ok" && !none.value.search);
  assertEquals(await hasSearch(off, naming), false);
  const pg = await pgliteMemory();
  const made = await makeLayout(pg, naming, { search: "auto" });
  assert(made.kind === "ok" && made.value.search && (await hasSearch(pg, naming)));
  const duck = await duckdbMemory();
  const none2 = await makeLayout(duck, naming, { search: "auto" });
  assert(none2.kind === "ok" && !none2.value.search);
  const required = await makeLayout(await duckdbMemory(), naming, { search: "require" });
  assert(required.kind === "err" && /no index that keeps itself current/.test(required.error));
  for (const make of [pgliteMemory, duckdbMemory]) {
    const opened = await openSqlStore(await make());
    assert(opened.kind === "ok");
  }
});
