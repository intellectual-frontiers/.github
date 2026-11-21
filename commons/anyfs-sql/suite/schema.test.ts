/**
 * Tests of the schema and its migrations (commons anyfs-sql 0004-sql-schema FR-001 to FR-003): the layout is brought to the latest version in order with the version written in each transaction, a second run changes
 * nothing, a database at version 1 keeps its objects and history on the way to version 2, a database ahead of the library and a destructive step are refused, and the index of search is made only where the engine has one.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny } from "@intellectual-frontiers/anyfs/governance";
import { MIGRATION_PLAN, SCHEMA_VERSION, parseNaming } from "../src/governance/mod.ts";
import { hasSearch, layoutVersion, migrate, openSqlStore, sqlFor } from "../src/physical/mod.ts";
import { ENGINES, bytes, duckdbMemory, p, pgliteMemory, sqliteMemory, storeOn, text } from "./kit.ts";

const naming = (() => {
  const n = parseNaming();
  if (n.kind === "err") throw new Error(n.error);
  return n.value;
})();

proves(["0004-sql-schema FR-001"], "migrate brings an empty database to the latest version with the facts of the layout, and a second run changes nothing, on every engine", async () => {
  for (const e of ENGINES) {
    const port = await e.make();
    assertEquals(await layoutVersion(port, naming), 0, e.name);
    const first = await migrate(port, naming);
    assert(first.kind === "ok", e.name);
    assertEquals([first.value.from, first.value.version, first.value.search], [0, SCHEMA_VERSION, e.search], e.name);
    const sql = sqlFor(port.dialect, naming);
    const facts = await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, []);
    const byKey = Object.fromEntries(facts.map((r) => [String(r["key"]), String(r["value"])]));
    assertEquals(byKey["layout"], "anyfs-sql", e.name);
    assertEquals(byKey["schema_version"], String(SCHEMA_VERSION), e.name);
    const again = await migrate(port, naming);
    assert(again.kind === "ok" && again.value.from === SCHEMA_VERSION && again.value.version === SCHEMA_VERSION, e.name);
    assertEquals(await layoutVersion(port, naming), SCHEMA_VERSION, e.name);
    await port.close();
  }
});

proves(["0004-sql-schema FR-001"], "a database at version 1 keeps its objects and their history on the way to version 2, and its objects are read through the store afterwards", async () => {
  for (const e of ENGINES) {
    const port = await e.make();
    const first = await migrate(port, naming, { target: 1, search: "off" });
    assert(first.kind === "ok" && first.value.version === 1, e.name);
    const sql = sqlFor(port.dialect, naming);
    // an object as version 1 held it: a row, and one revision in its history
    const { revisionOf } = await import("./revision.ts");
    const body = bytes("made at version one");
    const rev = await revisionOf(body);
    const insert = sql
      .query()
      .text("INSERT INTO ")
      .table("objects")
      .text(" (path, rev, size, media_type, modified, body) VALUES (")
      .param("old/a.txt")
      .text(", ")
      .param(rev)
      .text(", ")
      .param(body.length)
      .text(", ")
      .param("text/plain")
      .text(", ")
      .param("2026-01-01T00:00:00.000Z")
      .text(", ")
      .bytes(body)
      .text(")")
      .done();
    await port.exec(insert.text, insert.params);
    const hist = sql.query().text("INSERT INTO ").table("revisions").text(" (path, seq, rev, size, modified) VALUES (").param("old/a.txt").text(", 1, ").param(rev).text(", ").param(body.length).text(", ").param("2026-01-01T00:00:00.000Z").text(")").done();
    await port.exec(hist.text, hist.params);
    assertEquals(await layoutVersion(port, naming), 1, e.name);
    const store = await storeOn(port);
    assertEquals(store.facts.version, 2, e.name);
    const read = await store.store.read(p("old/a.txt"));
    assert(read.kind === "ok" && text(read.value.bytes) === "made at version one" && read.value.rev === rev, e.name);
    const history = await store.store.history(p("old/a.txt"));
    assert(history.kind === "ok" && history.value.versions.length === 1 && history.value.versions[0]?.rev === rev, e.name);
    // and a change after the migration adds to that history
    const w = await store.store.write(p("old/a.txt"), bytes("changed"), expectAny);
    assert(w.kind === "ok", e.name);
    const after = await store.store.history(p("old/a.txt"));
    assert(after.kind === "ok" && after.value.versions.length === 2, e.name);
    await port.close();
  }
});

proves(["0004-sql-schema FR-002"], "a database ahead of the library is refused and left as it is, and a store asked only to check refuses one that is not at the version the library writes", async () => {
  const port = await sqliteMemory();
  assert((await migrate(port, naming)).kind === "ok");
  const sql = sqlFor("sqlite", naming);
  const bump = sql.query().text("UPDATE ").table("meta").text(" SET value = ").param("99").text(" WHERE key = ").param("schema_version").done();
  await port.exec(bump.text, bump.params);
  const metaOf = async (): Promise<readonly string[]> => (await port.query(sql.query().text("SELECT key, value FROM ").table("meta").text(" ORDER BY key").done().text, [])).map((r) => `${String(r["key"])}=${String(r["value"])}`);
  const before = await metaOf();
  const refused = await openSqlStore(port);
  assert(refused.kind === "err" && /version 99/.test(refused.error), "a database ahead is refused");
  assertEquals(await layoutVersion(port, naming), 99);
  // the database is as it was: nothing was written to it
  assertEquals(await metaOf(), before);
  assert(before.includes("schema_version=99"));

  const old = await sqliteMemory();
  assert((await migrate(old, naming, { target: 1 })).kind === "ok");
  const checked = await openSqlStore(old, { layout: "check" });
  assert(checked.kind === "err" && /only to check/.test(checked.error));
  assertEquals(await layoutVersion(old, naming), 1, "a check changes nothing");
  const current = await sqliteMemory();
  assert((await migrate(current, naming)).kind === "ok");
  assert((await openSqlStore(current, { layout: "check" })).kind === "ok");
});

proves(["0004-sql-schema FR-002"], "a migration that takes something away runs only where the caller says so", async () => {
  const port = await sqliteMemory();
  assert((await migrate(port, naming)).kind === "ok");
  const plan = [...MIGRATION_PLAN, { version: 3, name: "drops a thing", destructive: true }];
  const refused = await migrate(port, naming, { plan });
  assert(refused.kind === "err" && /takes something away/.test(refused.error));
  assertEquals(await layoutVersion(port, naming), 2, "the destructive step did not run");
  const allowed = await migrate(port, naming, { plan, destructive: true });
  assert(allowed.kind === "ok" && allowed.value.version === 3);
  assertEquals(await layoutVersion(port, naming), 3);
});

proves(["0004-sql-schema FR-003"], "the index of search is made where the engine has one (SQLite, PostgreSQL), said to exist, refused with a reason where `require` cannot have it (DuckDB), and not made where `off`", async () => {
  for (const [name, make, has] of [["sqlite", sqliteMemory, true], ["postgres", pgliteMemory, true], ["duckdb", duckdbMemory, false]] as const) {
    const on = await make();
    const auto = await migrate(on, naming, { search: "auto" });
    assert(auto.kind === "ok" && auto.value.search === has, name);
    assertEquals(await hasSearch(on, naming), has, name);
    const off = await make();
    const none = await migrate(off, naming, { search: "off" });
    assert(none.kind === "ok" && none.value.search === false, name);
    assertEquals(await hasSearch(off, naming), false, name);
    const req = await make();
    const required = await migrate(req, naming, { search: "require" });
    if (has) assert(required.kind === "ok" && required.value.search, name);
    else assert(required.kind === "err" && /no index of search/.test(required.error), name);
  }
});
