/**
 * Tests of the store of a database that merges (commons anyfs-sql 0005-sql-store FR-001 to FR-008), on the real engine: reads, stats and lists in the order of the bytes with names that are hostile to patterns, writes decided
 * by their expectation with writers racing, revisions and history, batches that apply whole or not at all, renames, search, and the refusals of a large object, a tampered body and a busy database.
 *
 * @module
 */
import { comparePaths, expectAbsent, expectAny, expectRev, parsePrefix, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type SqlPort, openSqlStore, sqlFor } from "../src/mod.ts";
import { bytes, monotone, p, sqliteMemory, storeOn, text } from "./kit.ts";
import { revisionOf } from "./revision.ts";

const prefix = (t: string): ReturnType<typeof parsePrefix> extends { value: infer V } ? V : never => {
  const r = parsePrefix(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value as never;
};

proves(["0005-sql-store FR-001"], "a list is the order of the bytes of the paths, in pages with a cursor, below a prefix by a range: names with %, _, a quote and characters above the plane of the basic ones are ordinary names", async () => {
  const names = ["a", "a%", "a_b", "a^b", "a'b", 'a"b', "a b", "é", "漢", "𝒳", "a/%", "a/_", "a/z", "b", "a0", "a-"];
  const store = (await storeOn(await sqliteMemory())).store;
  for (const n of names) assert((await store.write(p(n), bytes(`body of ${n}`), expectAny)).kind === "ok", n);
  const all: string[] = [];
  let after: Parameters<typeof store.list>[1] = { limit: 4 };
  for (let guard = 0; guard < 20; guard++) {
    const page = await store.list(ROOT, after);
    assert(page.kind === "ok");
    all.push(...page.value.entries.map((s) => s.path));
    if (page.value.next === undefined) break;
    after = { limit: 4, after: page.value.next };
  }
  assertEquals(all, [...names].sort(comparePaths), "the order is the order of the bytes, in pages");
  const below = await store.list(prefix("a"), {});
  assert(below.kind === "ok");
  assertEquals(below.value.entries.map((s) => s.path), ["a/%", "a/_", "a/z"], "below a is what is below a/, and a% a_b a0 are not");
  const wild = await store.list(prefix("a%"), {});
  assert(wild.kind === "ok" && wild.value.entries.length === 0, "a percent sign in a prefix is a character");
  const read = await store.read(p("a'b"));
  assert(read.kind === "ok" && text(read.value.bytes) === "body of a'b");
  const stat = await store.stat(p("漢"));
  assert(stat.kind === "ok" && stat.value.size === bytes("body of 漢").length);
  assert((await store.read(p("nope"))).kind === "err");
});

proves(["0005-sql-store FR-001"], "a path made to break a statement is only a value: it is stored, read back, listed and deleted, and the tables are still there", async () => {
  const evil = `x'); DROP TABLE anyfs_versions; --`;
  const port = await sqliteMemory();
  const store = (await storeOn(port)).store;
  assert((await store.write(p(evil), bytes("evil"), expectAny)).kind === "ok");
  const read = await store.read(p(evil));
  assert(read.kind === "ok" && text(read.value.bytes) === "evil");
  const listed = await store.list(ROOT, {});
  assert(listed.kind === "ok" && listed.value.entries.map((s) => s.path).includes(p(evil)));
  assert((await store.delete(p(evil), expectAny)).kind === "ok");
  const rows = await port.query(sqlFor(port.dialect, { prefix: "anyfs" as never }).query().text("SELECT count(*) AS n FROM ").table("versions").done().text, []);
  assertEquals(Number(rows[0]?.["n"]), 2, "the put and the tombstone are rows, and the table is there");
});

proves(["0005-sql-store FR-002"], "a write is decided by its expectation: no file, a revision or any state; the same bytes again change nothing; and writers racing for one state do not both win", async () => {
  const store = (await storeOn(await sqliteMemory())).store;
  const a = p("race/a");
  const first = await store.write(a, bytes("one"), expectAbsent);
  assert(first.kind === "ok" && first.value.created);
  const again = await store.write(a, bytes("two"), expectAbsent);
  assert(again.kind === "err" && again.error.kind === "conflict", "absent where there is one");
  const same = await store.write(a, bytes("one"), expectAny);
  assert(same.kind === "ok" && !same.value.created && same.value.rev === first.value.rev);
  const wrong = await store.write(a, bytes("three"), expectRev(await revisionOf(bytes("nope"))));
  assert(wrong.kind === "err" && wrong.error.kind === "conflict" && wrong.error.found.kind === "rev", "a revision that is not there");
  const right = await store.write(a, bytes("three"), expectRev(first.value.rev));
  assert(right.kind === "ok" && !right.value.created && right.value.rev === (await revisionOf(bytes("three"))));
  const missingRev = await store.write(p("race/none"), bytes("x"), expectRev(first.value.rev));
  assert(missingRev.kind === "err" && missingRev.error.kind === "conflict" && missingRev.error.found.kind === "absent");
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => store.write(p("race/new"), bytes(`writer ${i}`), expectAbsent)));
  assertEquals(results.filter((r) => r.kind === "ok").length, 1, "one winner of an absent race");
  assert(results.filter((r) => r.kind === "err").every((r) => r.kind === "err" && r.error.kind === "conflict"));
  const base = await store.write(p("race/rev"), bytes("base"), expectAny);
  assert(base.kind === "ok");
  const revs = await Promise.all(Array.from({ length: 6 }, (_, i) => store.write(p("race/rev"), bytes(`next ${i}`), expectRev(base.value.rev))));
  assertEquals(revs.filter((r) => r.kind === "ok").length, 1, "one winner of a revision race");
  const winner = await store.read(p("race/rev"));
  assert(winner.kind === "ok" && /^next \d$/.test(text(winner.value.bytes)));
});

proves(["0005-sql-store FR-003"], "a revision is sha256 and the digest of the bytes as every store makes it, a delete succeeds where the file is gone, history is the puts of the path newest first, and a deleted path has no history", async () => {
  const store = (await storeOn(await sqliteMemory(), { clock: monotone() })).store;
  const a = p("h/a.json");
  const w1 = await store.write(a, bytes("v1"), expectAny);
  const w2 = await store.write(a, bytes("v2"), expectAny);
  const w3 = await store.write(a, bytes("v3"), expectAny);
  assert(w1.kind === "ok" && w2.kind === "ok" && w3.kind === "ok");
  assertEquals(w1.value.rev, await revisionOf(bytes("v1")));
  const h = await store.history(a);
  assert(h.kind === "ok");
  assertEquals(h.value.versions.map((v) => v.rev), [w3.value.rev, w2.value.rev, w1.value.rev], "newest first");
  assertEquals(h.value.versions.map((v) => v.size), [2, 2, 2]);
  const limited = await store.history(a, 2);
  assert(limited.kind === "ok" && limited.value.versions.length === 2);
  const gone = await store.delete(a, expectAny);
  assert(gone.kind === "ok" && gone.value.existed);
  const again = await store.delete(a, expectAny);
  assert(again.kind === "ok" && !again.value.existed, "a delete where the file is gone succeeds");
  assert((await store.history(a)).kind === "err", "no history of a deleted path");
  const atRev = await store.write(a, bytes("w"), expectAny);
  assert(atRev.kind === "ok");
  const wrong = await store.delete(a, expectRev(w1.value.rev));
  assert(wrong.kind === "err" && wrong.error.kind === "conflict");
  const right = await store.delete(a, expectRev(atRev.value.rev));
  assert(right.kind === "ok" && right.value.existed);
  const absent = await store.delete(a, expectAbsent);
  assert(absent.kind === "ok" && !absent.value.existed);
});

proves(["0005-sql-store FR-004"], "a batch is one transaction: every change applies or none, an expectation that fails and an object too large each leave the database as it was", async () => {
  const store = (await storeOn(await sqliteMemory(), { maxObject: 100 })).store;
  assert((await store.write(p("b/exists"), bytes("here"), expectAny)).kind === "ok");
  const failing = await store.batch([
    { kind: "put", path: p("b/one"), bytes: bytes("1"), expect: expectAbsent },
    { kind: "put", path: p("b/two"), bytes: bytes("2"), expect: expectAbsent },
    { kind: "put", path: p("b/exists"), bytes: bytes("again"), expect: expectAbsent },
  ]);
  assert(failing.kind === "err" && failing.error.kind === "conflict");
  const listed = await store.list(prefix("b"), {});
  assert(listed.kind === "ok" && listed.value.entries.map((s) => s.path).join() === "b/exists", "the first two changes are not there");
  const tooBig = await store.batch([
    { kind: "put", path: p("b/ok"), bytes: bytes("ok"), expect: expectAny },
    { kind: "put", path: p("b/big"), bytes: new Uint8Array(101), expect: expectAny },
  ]);
  assert(tooBig.kind === "err" && tooBig.error.kind === "refused" && tooBig.error.reason === "too-large");
  assert((await store.stat(p("b/ok"))).kind === "err", "nothing of a refused batch");
  const good = await store.batch([
    { kind: "put", path: p("b/x"), bytes: bytes("x"), expect: expectAbsent },
    { kind: "delete", path: p("b/exists"), expect: expectAny },
    { kind: "put", path: p("b/y"), bytes: bytes("y"), expect: expectAny },
  ]);
  assert(good.kind === "ok" && good.value.results.length === 3);
  const after = await store.list(prefix("b"), {});
  assert(after.kind === "ok" && after.value.entries.map((s) => s.path).join() === "b/x,b/y");
  const both = await store.batch([
    { kind: "delete", path: p("b/x"), expect: expectAny },
    { kind: "put", path: p("b/x"), bytes: bytes("new x"), expect: expectAny },
  ]);
  assert(both.kind === "ok", both.kind === "err" ? JSON.stringify(both.error) : "");
  const x = await store.read(p("b/x"));
  assert(x.kind === "ok" && text(x.value.bytes) === "new x");
});

proves(["0005-sql-store FR-005"], "a rename is a put at the new path and a tombstone at the old in one transaction, refuses a move onto a file and to the same path and a missing source, and the file is the moved bytes", async () => {
  const store = (await storeOn(await sqliteMemory(), { clock: monotone() })).store;
  const from = p("r/from.txt");
  const to = p("r/to.txt");
  const w1 = await store.write(from, bytes("one"), expectAny);
  const w2 = await store.write(from, bytes("two"), expectAny);
  assert(w1.kind === "ok" && w2.kind === "ok");
  assert((await store.write(p("r/other"), bytes("o"), expectAny)).kind === "ok");
  const onto = await store.rename(from, p("r/other"), expectAny);
  assert(onto.kind === "err" && onto.error.kind === "conflict");
  const same = await store.rename(from, from, expectAny);
  assert(same.kind === "err" && same.error.kind === "refused");
  const none = await store.rename(p("r/none"), to, expectAny);
  assert(none.kind === "err" && none.error.kind === "missing");
  const wrong = await store.rename(from, to, expectRev(w1.value.rev));
  assert(wrong.kind === "err" && wrong.error.kind === "conflict");
  const moved = await store.rename(from, to, expectRev(w2.value.rev));
  assert(moved.kind === "ok" && moved.value.rev === w2.value.rev);
  assert((await store.stat(from)).kind === "err");
  const read = await store.read(to);
  assert(read.kind === "ok" && text(read.value.bytes) === "two");
});

proves(["0005-sql-store FR-006"], "search finds text files by their words below a prefix, follows a change, a rename and a delete, ignores bytes that are not text, and treats the words of the engine's syntax as words", async () => {
  const opened = await storeOn(await sqliteMemory());
  const s = opened.searchable;
  assert(s !== undefined);
  assertEquals(s.capabilities.has("search"), true);
  const base = opened.store;
  await base.write(p("docs/fleet.md"), bytes("The fleet of machines is listed in the register"), expectAny);
  await base.write(p("docs/notes.txt"), bytes("register your machine before the audit"), expectAny);
  await base.write(p("other/x.txt"), bytes("a register elsewhere"), expectAny);
  await base.write(p("docs/blob.bin"), new Uint8Array([0, 1, 2, 255, 254, 0, 114, 101, 103, 105, 115, 116, 101, 114]), expectAny);
  const all = await s.search(ROOT, "register");
  assert(all.kind === "ok");
  const paths = all.value.hits.map((h) => h.path);
  assert(paths.includes(p("docs/fleet.md")) && paths.includes(p("other/x.txt")) && !paths.includes(p("docs/blob.bin")), paths.join());
  const below = await s.search(prefix("docs"), "register");
  assert(below.kind === "ok" && below.value.hits.every((h) => h.path.startsWith("docs/")) && below.value.hits.length >= 1);
  const two = await s.search(ROOT, "fleet machines");
  assert(two.kind === "ok" && two.value.hits.map((h) => h.path).join() === "docs/fleet.md", "all the words");
  for (const hostile of ['"', 'register" OR "x', "NEAR(register", "register*", "a:b", "'; DROP TABLE x; --", "(", "*"]) assert((await s.search(ROOT, hostile)).kind === "ok", hostile);
  await base.write(p("docs/fleet.md"), bytes("nothing of that kind now"), expectAny);
  const afterChange = await s.search(ROOT, "fleet");
  assert(afterChange.kind === "ok" && afterChange.value.hits.length === 0, "the index follows a change");
  await base.rename(p("docs/notes.txt"), p("docs/moved.txt"), expectAny);
  const moved = await s.search(ROOT, "audit");
  assert(moved.kind === "ok" && moved.value.hits.map((h) => h.path).join() === "docs/moved.txt", "the index follows a rename");
  await base.delete(p("docs/moved.txt"), expectAny);
  const gone = await s.search(ROOT, "audit");
  assert(gone.kind === "ok" && gone.value.hits.length === 0, "the index follows a delete");
  const empty = await s.search(ROOT, "   ");
  assert(empty.kind === "ok" && empty.value.hits.length === 0);
  const off = await storeOn(await sqliteMemory(), { search: "off" });
  assertEquals(off.searchable, undefined);
  const refused = await off.store.handle({ op: "search", prefix: ROOT, text: "x" });
  assert(refused.kind === "err" && refused.error.kind === "refused");
});

proves(["0005-sql-store FR-007"], "an object over the limit is refused as too large and never cut, bytes that are not the ones their revision names are tampered, and a busy database is unavailable and retryable", async () => {
  const port = await sqliteMemory();
  const store = (await storeOn(port, { maxObject: 16 })).store;
  assertEquals(store.traits.maxObject, 16);
  const big = await store.write(p("big"), new Uint8Array(17), expectAny);
  assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large");
  assert((await store.stat(p("big"))).kind === "err");
  assert((await store.write(p("fits"), new Uint8Array(16), expectAny)).kind === "ok");
  // the bytes in the database change without the row that names them: the read says so
  await port.exec("UPDATE anyfs_blobs SET bytes = x'6e6f74207468657365'", []);
  const read = await store.read(p("fits"));
  assert(read.kind === "err" && read.error.kind === "tampered", read.kind === "err" ? read.error.kind : "ok");
  const real = await sqliteMemory();
  const busy: SqlPort = { ...real, query: async (sql, params) => (/FROM anyfs_names/.test(sql) ? Promise.reject(new Error("SQLITE_BUSY: database is locked")) : real.query(sql, params)) };
  const s = (await storeOn(busy)).store;
  const r = await s.read(p("anything"));
  assert(r.kind === "err" && r.error.kind === "unavailable" && r.error.retryable, "a busy database is retryable");
  const broken: SqlPort = { ...real, query: async (sql, params) => (/FROM anyfs_names/.test(sql) ? Promise.reject(new Error("syntax error")) : real.query(sql, params)) };
  const bs = (await storeOn(broken)).store;
  const bad = await bs.read(p("a"));
  assert(bad.kind === "err" && bad.error.kind === "unavailable" && !bad.error.retryable, "another failure is not retryable");
});

proves(["0005-sql-store FR-001"], "the place names the dialect and the target and never a credential, the traits say case sensitive, the consistency is eventual-merge, and two stores with different prefixes in one database are separate", async () => {
  const port = await sqliteMemory();
  const a = await storeOn(port, { naming: { prefix: "fleet" }, target: "fleet.db" });
  const b = await storeOn(port, { naming: { prefix: "notes" }, target: "fleet.db" });
  assertEquals(a.store.place, { kind: "sql", dialect: "sqlite", target: "fleet.db" });
  assertEquals(a.store.id, "sql:sqlite:fleet.db");
  assertEquals(a.store.traits.caseSensitive, true);
  assertEquals(a.store.consistency, "eventual-merge");
  assert((await a.store.write(p("only/a"), bytes("a"), expectAny)).kind === "ok");
  assert((await b.store.stat(p("only/a"))).kind === "err", "the other store does not see it");
  assert((await b.store.write(p("only/b"), bytes("b"), expectAny)).kind === "ok");
  const la = await a.store.list(ROOT, {});
  assert(la.kind === "ok" && la.value.entries.map((s) => s.path).join() === "only/a");
  assert((await openSqlStore(port, { naming: { prefix: "Bad Name" } })).kind === "err");
  assert((await openSqlStore(port, { maxObject: 0 })).kind === "err");
});

proves(["0005-sql-store FR-002"], "the modified instant of a file is the time of its id, which comes from the clock the store is given", async () => {
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
});

proves(["0005-sql-store FR-008"], "the store names no table, no column and builds no statement: every statement is in the layout module, which the layout, the merge and the dump share by name", async () => {
  const { fs, path } = await import("@intellectual-frontiers/system");
  const here = path.dirname(path.fromFileUrl(import.meta.url));
  const body = async (file: string): Promise<string> =>
    (await fs.readTextFile(path.join(here, "..", "src", "physical", file)))
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/**"))
      .join("\n");
  const statements = /\.table\(|\.query\(\)|\.selectBytes\(|\.bytes\(|"(SELECT |INSERT INTO|UPDATE |DELETE FROM)/u;
  for (const file of ["store.ts", "merge.ts", "dump.ts"]) assertEquals(statements.test(await body(file)), false, `no statement is built in ${file}`);
  const layout = await fs.readTextFile(path.join(here, "..", "src", "physical", "layout.ts"));
  const store = await body("store.ts");
  const merge = await body("merge.ts");
  const dump = await body("dump.ts");
  for (const name of ["selectRowsOfPath", "selectLastId", "insertVersion", "insertBlob", "selectCurrent", "selectCurrentStat", "selectPage", "selectHistory", "selectBlob", "selectFact", "upsertFact", "insertTrust", "deleteWords", "insertWords", "searchWords"]) {
    assert(layout.includes(`${name}:`), `${name} is in the layout`);
    assert(store.includes(`l.${name}(`) || merge.includes(`c.l.${name}(`) || dump.includes(`l.${name}(`), `${name} is called by name`);
  }
});
