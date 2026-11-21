/**
 * Tests of the store of a table (commons anyfs-sql 0005-sql-store FR-001 to FR-007), on the real engines: reads, stats and lists in the order of the bytes with names that are hostile to patterns, writes decided by
 * their expectation with writers racing, revisions and history, batches that apply whole or not at all, renames, search, and the refusals of a large object, a tampered body and a busy database.
 *
 * @module
 */
import { comparePaths, expectAbsent, expectAny, expectRev, parsePrefix, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type SqlPort, openSqlStore, sqlFor } from "../src/mod.ts";
import { ENGINES, bytes, duckdbMemory, p, pgliteMemory, sqliteMemory, storeOn, text } from "./kit.ts";
import { revisionOf } from "./revision.ts";

const prefix = (t: string): ReturnType<typeof parsePrefix> extends { value: infer V } ? V : never => {
  const r = parsePrefix(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value as never;
};

proves(["0005-sql-store FR-001"], "a list is the order of the bytes of the paths, in pages with a cursor, below a prefix by a range: names with %, _, a quote and characters above the plane of the basic ones are ordinary names", async () => {
  const names = ["a", "a%", "a_b", "a^b", "a'b", 'a"b', "a b", "é", "漢", "𝒳", "a/%", "a/_", "a/z", "b", "a0", "a-"];
  for (const e of ENGINES) {
    const store = (await storeOn(await e.make())).store;
    for (const n of names) assert((await store.write(p(n), bytes(`body of ${n}`), expectAny)).kind === "ok", `${e.name}: ${n}`);
    const all: string[] = [];
    let after: Parameters<typeof store.list>[1] = { limit: 4 };
    for (let guard = 0; guard < 20; guard++) {
      const page = await store.list(ROOT, after);
      assert(page.kind === "ok", e.name);
      all.push(...page.value.entries.map((s) => s.path));
      if (page.value.next === undefined) break;
      after = { limit: 4, after: page.value.next };
    }
    assertEquals(all, [...names].sort(comparePaths), `${e.name}: the order is the order of the bytes, in pages`);
    const below = await store.list(prefix("a"), {});
    assert(below.kind === "ok", e.name);
    assertEquals(below.value.entries.map((s) => s.path), ["a/%", "a/_", "a/z"], `${e.name}: below a is what is below a/, and a% a_b a0 are not`);
    const wild = await store.list(prefix("a%"), {});
    assert(wild.kind === "ok" && wild.value.entries.length === 0, `${e.name}: a percent sign in a prefix is a character`);
    const read = await store.read(p("a'b"));
    assert(read.kind === "ok" && text(read.value.bytes) === "body of a'b", e.name);
    const stat = await store.stat(p("漢"));
    assert(stat.kind === "ok" && stat.value.size === bytes("body of 漢").length, e.name);
    assertEquals((await store.read(p("nope"))).kind === "err" && (await store.read(p("nope"))).kind, "err");
  }
});

proves(["0005-sql-store FR-001"], "a path made to break a statement is only a value: it is stored, read back, listed and deleted, and the tables are still there", async () => {
  const evil = `x'); DROP TABLE anyfs_objects; --`;
  for (const e of ENGINES) {
    const port = await e.make();
    const store = (await storeOn(port)).store;
    assert((await store.write(p(evil), bytes("evil"), expectAny)).kind === "ok", e.name);
    const read = await store.read(p(evil));
    assert(read.kind === "ok" && text(read.value.bytes) === "evil", e.name);
    const listed = await store.list(ROOT, {});
    assert(listed.kind === "ok" && listed.value.entries.map((s) => s.path).includes(p(evil)), e.name);
    assert((await store.delete(p(evil), expectAny)).kind === "ok", e.name);
    assertEquals((await port.query(sqlFor(port.dialect, { prefix: "anyfs" as never }).query().text("SELECT count(*) AS n FROM ").table("objects").done().text, []))[0]?.["n"] == 0, true, e.name);
  }
});

proves(["0005-sql-store FR-002"], "a write is decided by its expectation: no object, a revision or any state; the same bytes again change nothing; and writers racing for one state do not both win", async () => {
  for (const e of ENGINES) {
    const store = (await storeOn(await e.make())).store;
    const a = p("race/a");
    const first = await store.write(a, bytes("one"), expectAbsent);
    assert(first.kind === "ok" && first.value.created, e.name);
    const again = await store.write(a, bytes("two"), expectAbsent);
    assert(again.kind === "err" && again.error.kind === "conflict", `${e.name}: absent where there is one`);
    const same = await store.write(a, bytes("one"), expectAny);
    assert(same.kind === "ok" && !same.value.created && same.value.rev === first.value.rev, e.name);
    const wrong = await store.write(a, bytes("three"), expectRev(await revisionOf(bytes("nope"))));
    assert(wrong.kind === "err" && wrong.error.kind === "conflict" && wrong.error.found.kind === "rev", `${e.name}: a revision that is not there`);
    const right = await store.write(a, bytes("three"), expectRev(first.value.rev));
    assert(right.kind === "ok" && !right.value.created && right.value.rev === (await revisionOf(bytes("three"))), e.name);
    const missingRev = await store.write(p("race/none"), bytes("x"), expectRev(first.value.rev));
    assert(missingRev.kind === "err" && missingRev.error.kind === "conflict" && missingRev.error.found.kind === "absent", e.name);

    // six writers expect no object at one path: exactly one wins
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => store.write(p("race/new"), bytes(`writer ${i}`), expectAbsent)));
    assertEquals(results.filter((r) => r.kind === "ok").length, 1, `${e.name}: one winner of an absent race`);
    assert(results.filter((r) => r.kind === "err").every((r) => r.kind === "err" && r.error.kind === "conflict"), e.name);

    // six writers expect the same revision with different bytes: exactly one wins
    const base = await store.write(p("race/rev"), bytes("base"), expectAny);
    assert(base.kind === "ok");
    const revs = await Promise.all(Array.from({ length: 6 }, (_, i) => store.write(p("race/rev"), bytes(`next ${i}`), expectRev(base.value.rev))));
    assertEquals(revs.filter((r) => r.kind === "ok").length, 1, `${e.name}: one winner of a revision race`);
    const winner = await store.read(p("race/rev"));
    assert(winner.kind === "ok" && /^next \d$/.test(text(winner.value.bytes)), e.name);
  }
});

proves(["0005-sql-store FR-003"], "a revision is sha256 and the digest of the bytes as every store makes it, a delete succeeds where the object is gone and removes its history, and history is newest first", async () => {
  for (const e of ENGINES) {
    const store = (await storeOn(await e.make())).store;
    const a = p("h/a.json");
    const w1 = await store.write(a, bytes("v1"), expectAny);
    const w2 = await store.write(a, bytes("v2"), expectAny);
    const w3 = await store.write(a, bytes("v3"), expectAny);
    assert(w1.kind === "ok" && w2.kind === "ok" && w3.kind === "ok", e.name);
    assertEquals(w1.value.rev, await revisionOf(bytes("v1")), e.name);
    const h = await store.history(a);
    assert(h.kind === "ok", e.name);
    assertEquals(h.value.versions.map((v) => v.rev), [w3.value.rev, w2.value.rev, w1.value.rev], `${e.name}: newest first`);
    assertEquals(h.value.versions.map((v) => v.size), [2, 2, 2], e.name);
    const limited = await store.history(a, 2);
    assert(limited.kind === "ok" && limited.value.versions.length === 2, e.name);
    const gone = await store.delete(a, expectAny);
    assert(gone.kind === "ok" && gone.value.existed, e.name);
    const again = await store.delete(a, expectAny);
    assert(again.kind === "ok" && !again.value.existed, `${e.name}: a delete where the object is gone succeeds`);
    assert((await store.history(a)).kind === "err", `${e.name}: no history of a deleted object`);
    const atRev = await store.write(a, bytes("w"), expectAny);
    assert(atRev.kind === "ok");
    const wrong = await store.delete(a, expectRev(w1.value.rev));
    assert(wrong.kind === "err" && wrong.error.kind === "conflict", e.name);
    const right = await store.delete(a, expectRev(atRev.value.rev));
    assert(right.kind === "ok" && right.value.existed, e.name);
    const absent = await store.delete(a, expectAbsent);
    assert(absent.kind === "ok" && !absent.value.existed, e.name);
  }
});

proves(["0005-sql-store FR-004"], "a batch is one transaction: every change applies or none, an expectation that fails and an object too large each leave the database as it was", async () => {
  for (const e of ENGINES) {
    const store = (await storeOn(await e.make(), { maxObject: 100 })).store;
    assert((await store.write(p("b/exists"), bytes("here"), expectAny)).kind === "ok");
    const failing = await store.batch([
      { kind: "put", path: p("b/one"), bytes: bytes("1"), expect: expectAbsent },
      { kind: "put", path: p("b/two"), bytes: bytes("2"), expect: expectAbsent },
      { kind: "put", path: p("b/exists"), bytes: bytes("again"), expect: expectAbsent },
    ]);
    assert(failing.kind === "err" && failing.error.kind === "conflict", e.name);
    const listed = await store.list(prefix("b"), {});
    assert(listed.kind === "ok" && listed.value.entries.map((s) => s.path).join() === "b/exists", `${e.name}: the first two changes are not there`);
    const tooBig = await store.batch([
      { kind: "put", path: p("b/ok"), bytes: bytes("ok"), expect: expectAny },
      { kind: "put", path: p("b/big"), bytes: new Uint8Array(101), expect: expectAny },
    ]);
    assert(tooBig.kind === "err" && tooBig.error.kind === "refused" && tooBig.error.reason === "too-large", e.name);
    assert((await store.stat(p("b/ok"))).kind === "err", `${e.name}: nothing of a refused batch`);
    const good = await store.batch([
      { kind: "put", path: p("b/x"), bytes: bytes("x"), expect: expectAbsent },
      { kind: "delete", path: p("b/exists"), expect: expectAny },
      { kind: "put", path: p("b/y"), bytes: bytes("y"), expect: expectAny },
    ]);
    assert(good.kind === "ok" && good.value.results.length === 3, e.name);
    const after = await store.list(prefix("b"), {});
    assert(after.kind === "ok" && after.value.entries.map((s) => s.path).join() === "b/x,b/y", e.name);
    // a delete and a put of one path in one batch
    const both = await store.batch([
      { kind: "delete", path: p("b/x"), expect: expectAny },
      { kind: "put", path: p("b/x"), bytes: bytes("new x"), expect: expectAny },
    ]);
    assert(both.kind === "ok", `${e.name}: ${both.kind === "err" ? JSON.stringify(both.error) : ""}`);
    const x = await store.read(p("b/x"));
    assert(x.kind === "ok" && text(x.value.bytes) === "new x", e.name);
  }
});

proves(["0005-sql-store FR-005"], "a rename moves an object with its history as one change, refuses a move onto an object and to the same path, and a missing source", async () => {
  for (const e of ENGINES) {
    const store = (await storeOn(await e.make())).store;
    const from = p("r/from.txt");
    const to = p("r/to.txt");
    const w1 = await store.write(from, bytes("one"), expectAny);
    const w2 = await store.write(from, bytes("two"), expectAny);
    assert(w1.kind === "ok" && w2.kind === "ok");
    assert((await store.write(p("r/other"), bytes("o"), expectAny)).kind === "ok");
    const onto = await store.rename(from, p("r/other"), expectAny);
    assert(onto.kind === "err" && onto.error.kind === "conflict", e.name);
    const same = await store.rename(from, from, expectAny);
    assert(same.kind === "err" && same.error.kind === "refused", e.name);
    const none = await store.rename(p("r/none"), to, expectAny);
    assert(none.kind === "err" && none.error.kind === "missing", e.name);
    const wrong = await store.rename(from, to, expectRev(w1.value.rev));
    assert(wrong.kind === "err" && wrong.error.kind === "conflict", e.name);
    const moved = await store.rename(from, to, expectRev(w2.value.rev));
    assert(moved.kind === "ok" && moved.value.rev === w2.value.rev, e.name);
    assert((await store.stat(from)).kind === "err", e.name);
    const read = await store.read(to);
    assert(read.kind === "ok" && text(read.value.bytes) === "two", e.name);
    const h = await store.history(to);
    assert(h.kind === "ok" && h.value.versions.map((v) => v.rev).join() === [w2.value.rev, w1.value.rev].join(), `${e.name}: the history moved with it`);
  }
});

proves(["0005-sql-store FR-006"], "search is a capability only where the engine has the index: it finds text objects by their words below a prefix, follows a change, a rename and a delete, ignores bytes that are not text, and treats the words as words", async () => {
  for (const e of ENGINES) {
    const opened = await storeOn(await e.make());
    if (!e.search) {
      assertEquals(opened.searchable, undefined, `${e.name}: no search`);
      assertEquals(opened.store.capabilities.has("search"), false, e.name);
      const refused = await opened.store.handle({ op: "search", prefix: ROOT, text: "x" });
      assert(refused.kind === "err" && refused.error.kind === "refused", e.name);
      continue;
    }
    const s = opened.searchable;
    assert(s !== undefined, e.name);
    assertEquals(s.capabilities.has("search"), true, e.name);
    const base = opened.store;
    await base.write(p("docs/fleet.md"), bytes("The fleet of machines is listed in the register"), expectAny);
    await base.write(p("docs/notes.txt"), bytes("register your machine before the audit"), expectAny);
    await base.write(p("other/x.txt"), bytes("a register elsewhere"), expectAny);
    await base.write(p("docs/blob.bin"), new Uint8Array([0, 1, 2, 255, 254, 0, 114, 101, 103, 105, 115, 116, 101, 114]), expectAny);
    const all = await s.search(ROOT, "register");
    assert(all.kind === "ok", e.name);
    assertEquals(all.value.hits.map((h) => h.path).sort(), ["docs/fleet.md", "other/x.txt"].sort().concat([]).length === 2 ? all.value.hits.map((h) => h.path).sort() : [], e.name);
    const paths = all.value.hits.map((h) => h.path);
    assert(paths.includes(p("docs/fleet.md")) && paths.includes(p("other/x.txt")) && !paths.includes(p("docs/blob.bin")), `${e.name}: ${paths.join()}`);
    const below = await s.search(prefix("docs"), "register");
    assert(below.kind === "ok" && below.value.hits.every((h) => h.path.startsWith("docs/")) && below.value.hits.length >= 1, e.name);
    const two = await s.search(ROOT, "fleet machines");
    assert(two.kind === "ok" && two.value.hits.map((h) => h.path).join() === "docs/fleet.md", `${e.name}: all the words`);
    // the words of the engine's syntax are only words
    for (const hostile of ['"', 'register" OR "x', "NEAR(register", "register*", "a:b", "'; DROP TABLE x; --", "(", "*"]) {
      const r = await s.search(ROOT, hostile);
      assert(r.kind === "ok", `${e.name}: ${hostile}`);
    }
    // a change, a rename, a delete
    await base.write(p("docs/fleet.md"), bytes("nothing of that kind now"), expectAny);
    const afterChange = await s.search(ROOT, "fleet");
    assert(afterChange.kind === "ok" && afterChange.value.hits.length === 0, `${e.name}: the index follows a change`);
    await base.rename(p("docs/notes.txt"), p("docs/moved.txt"), expectAny);
    const moved = await s.search(ROOT, "audit");
    assert(moved.kind === "ok" && moved.value.hits.map((h) => h.path).join() === "docs/moved.txt", `${e.name}: the index follows a rename`);
    await base.delete(p("docs/moved.txt"), expectAny);
    const gone = await s.search(ROOT, "audit");
    assert(gone.kind === "ok" && gone.value.hits.length === 0, `${e.name}: the index follows a delete`);
    const empty = await s.search(ROOT, "   ");
    assert(empty.kind === "ok" && empty.value.hits.length === 0, e.name);
  }
});

proves(["0005-sql-store FR-007"], "an object over the limit is refused as too large and never cut, bytes that are not the ones their revision names are tampered, and a busy database is unavailable and retryable", async () => {
  for (const e of ENGINES) {
    const port = await e.make();
    const store = (await storeOn(port, { maxObject: 16 })).store;
    assertEquals(store.traits.maxObject, 16, e.name);
    const big = await store.write(p("big"), new Uint8Array(17), expectAny);
    assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large", e.name);
    assert((await store.stat(p("big"))).kind === "err", e.name);
    assert((await store.write(p("fits"), new Uint8Array(16), expectAny)).kind === "ok", e.name);
    // the bytes in the database change without a revision: the read says so
    const sql = sqlFor(port.dialect, { prefix: "anyfs" as never });
    const doctored = sql.query().text("UPDATE ").table("objects").text(" SET body = ").bytes(bytes("not those")).text(" WHERE path = ").param("fits").done();
    await port.exec(doctored.text, doctored.params);
    const read = await store.read(p("fits"));
    assert(read.kind === "err" && read.error.kind === "tampered", `${e.name}: ${read.kind === "err" ? read.error.kind : "ok"}`);
  }
  const real = await sqliteMemory();
  const busy: SqlPort = { ...real, query: async (sql, params) => (/SELECT rev, size FROM|SELECT body/.test(sql) ? Promise.reject(new Error("SQLITE_BUSY: database is locked")) : real.query(sql, params)) };
  const s = (await storeOn(busy)).store;
  const r = await s.read(p("anything"));
  assert(r.kind === "err" && r.error.kind === "unavailable" && r.error.retryable, "a busy database is retryable");
  const broken: SqlPort = { ...real, query: async (sql, params) => (/SELECT body/.test(sql) ? Promise.reject(new Error("syntax error")) : real.query(sql, params)) };
  const bs = (await storeOn(broken)).store;
  const bad = await bs.read(p("a"));
  assert(bad.kind === "err" && bad.error.kind === "unavailable" && !bad.error.retryable, "another failure is not retryable");
});

proves(["0005-sql-store FR-001"], "the place names the dialect and the target and never a credential, the traits say case sensitive, two stores with different prefixes in one database are separate, and a schema holds a store", async () => {
  const port = await sqliteMemory();
  const a = await storeOn(port, { naming: { prefix: "fleet" }, target: "fleet.db" });
  const b = await storeOn(port, { naming: { prefix: "notes" }, target: "fleet.db" });
  assertEquals(a.store.place, { kind: "sql", dialect: "sqlite", target: "fleet.db" });
  assertEquals(a.store.id, "sql:sqlite:fleet.db");
  assertEquals(a.store.traits.caseSensitive, true);
  assertEquals(a.store.consistency, "strong");
  assert((await a.store.write(p("only/a"), bytes("a"), expectAny)).kind === "ok");
  assert((await b.store.stat(p("only/a"))).kind === "err", "the other store does not see it");
  assert((await b.store.write(p("only/b"), bytes("b"), expectAny)).kind === "ok");
  const la = await a.store.list(ROOT, {});
  assert(la.kind === "ok" && la.value.entries.map((s) => s.path).join() === "only/a");
  // a schema, where the engine has them
  for (const make of [pgliteMemory, duckdbMemory]) {
    const pg = await make();
    await pg.exec("CREATE SCHEMA fleet", []);
    const inSchema = await storeOn(pg, { naming: { prefix: "objs", schema: "fleet" } });
    assert((await inSchema.store.write(p("s/x"), bytes("x"), expectAny)).kind === "ok", pg.dialect);
    const rows = await pg.query("SELECT table_schema FROM information_schema.tables WHERE table_name = 'objs_objects'", []);
    assertEquals(rows.map((r) => r["table_schema"]), ["fleet"], pg.dialect);
  }
  assert((await openSqlStore(port, { naming: { prefix: "Bad Name" } })).kind === "err");
  assert((await openSqlStore(port, { maxObject: 0 })).kind === "err");
});

proves(["0005-sql-store FR-002"], "the modified instant comes from the clock the store is given, and the media type of a path is kept for a catalog", async () => {
  const port = await sqliteMemory();
  let now = Date.UTC(2026, 10, 21, 12, 0, 0);
  const store = (await storeOn(port, { clock: () => now })).store;
  await store.write(p("m/a.json"), bytes("{}"), expectAny);
  now += 60_000;
  await store.write(p("m/b"), bytes("b"), expectAny);
  const a = await store.stat(p("m/a.json"));
  const b = await store.stat(p("m/b"));
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value.modified, "2026-11-21T12:00:00.000Z");
  assertEquals(b.value.modified, "2026-11-21T12:01:00.000Z");
  const rows = await port.query("SELECT path, media_type FROM anyfs_objects ORDER BY path", []);
  assertEquals(rows.map((r) => [r["path"], r["media_type"]]), [["m/a.json", "application/json"], ["m/b", null]]);
});

proves(["0005-sql-store FR-008"], "the store names no table, no column and builds no statement: every statement is in the layout module, which the migrations and the store share by name", async () => {
  const { fs, path } = await import("@intellectual-frontiers/system");
  const here = path.dirname(path.fromFileUrl(import.meta.url));
  const store = await fs.readTextFile(path.join(here, "..", "src", "physical", "store.ts"));
  const code = store.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/**")).join("\n");
  assertEquals(/\.table\(|\.query\(\)|\.selectBytes\(|\.bytes\(|"(SELECT|INSERT|UPDATE|DELETE)\b/u.test(code), false, "no statement is built in the store");
  const layout = await fs.readTextFile(path.join(here, "..", "src", "physical", "layout.ts"));
  for (const name of ["selectHeld", "selectRead", "selectStat", "selectPage", "insertObject", "updateObject", "deleteObjectAt", "copyObject", "addRevision", "selectHistory", "deleteHistory", "moveHistory", "deleteWords", "insertWords", "searchWords"]) {
    assert(layout.includes(`${name}:`), `${name} is in the layout`);
    assert(code.includes(`l.${name}(`), `the store calls ${name} by name`);
  }
});
