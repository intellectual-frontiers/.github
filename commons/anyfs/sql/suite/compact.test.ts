/**
 * Tests of the checkpoint and of the collection of rows (commons anyfs-sql 0009-sql-compaction FR-001 to FR-008): a file copied after the database is closed is the whole database; rows are collected only against a roster that has all
 * reported; a file that was deleted and collected stays gone when an old dump is replayed, by the real `sqlite3` and by the library; a row made after the horizon counts; an epoch is published and another replica that holds what it
 * covers takes it; a delta whose parent was collected is not waited for; a replica that will not return is retired and its rows are refused.
 *
 * @module
 */
import { expectAny, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { fs, proc } from "@intellectual-frontiers/system";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { adoptPublished, compactDatabase, publishEpoch } from "../src/physical/compact.ts";
import { dumpArgv, importDumps } from "../src/physical/dump.ts";
import type { SqlPort, SqlStore } from "../src/mod.ts";
import { bytes, monotone, osPath, p, replicaOf, sqliteFile, storeOn, text, withTemp } from "./kit.ts";

type Replica = { readonly file: string; readonly port: SqlPort; readonly store: SqlStore };

const open = async (dir: string, name: string, n: number, clock: () => number): Promise<Replica> => {
  const file = osPath.join(dir, `${name}.db`);
  const port = await sqliteFile(file);
  const store = await storeOn(port, { replica: replicaOf(n), clock, trust: { kind: "open" } });
  return { file, port, store };
};

const realDump = async (r: Replica): Promise<string> => {
  await r.store.checkpoint();
  return proc.must(dumpArgv(r.file, r.store.facts.naming) as string[]);
};

const put = async (r: Replica, path: string, body: string): Promise<void> => {
  const w = await r.store.store.write(p(path), bytes(body), expectAny);
  assert(w.kind === "ok", `put ${path}`);
};
const del = async (r: Replica, path: string): Promise<void> => {
  const w = await r.store.store.delete(p(path), expectAny);
  assert(w.kind === "ok", `delete ${path}`);
};

const take = async (from: Replica, to: Replica): Promise<void> => {
  const since = await to.store.store.versionVector();
  assert(since.kind === "ok");
  const delta = await from.store.store.deltaSince(since.value);
  assert(delta.kind === "ok");
  const r = await to.store.store.applyDelta(delta.value);
  assert(r.kind === "ok", "apply");
};
const exchange = async (a: Replica, b: Replica): Promise<void> => {
  await take(a, b);
  await take(b, a);
};

const files = async (r: Replica): Promise<string> => {
  const listing = await r.store.store.list(ROOT, { limit: 100000 });
  assert(listing.kind === "ok");
  const out: string[] = [];
  for (const e of listing.value.entries) {
    const x = await r.store.store.read(e.path);
    assert(x.kind === "ok");
    out.push(`${e.path}=${text(x.value.bytes)}`);
  }
  return out.join("\n");
};

const reportOf = async (r: Replica): Promise<Record<string, Record<string, number>>> => {
  const v = await r.store.store.versionVector();
  assert(v.kind === "ok");
  return { [r.store.replica]: { ...v.value } };
};

proves(["0009-sql-compaction FR-001"], "closing the port folds the log into the file: a file copied after it holds every file, and so does a copy taken after an explicit checkpoint", async () => {
  await withTemp(async (dir) => {
    const a = await open(dir, "a", 0, monotone());
    for (let i = 0; i < 20; i++) await put(a, `f${i}.txt`, `body ${i}`);
    assertEquals(await a.store.checkpoint(), "done");
    const early = osPath.join(dir, "early.db");
    await fs.copyFile(a.file, early);
    await put(a, "later.txt", "after");
    await a.port.close();
    const late = osPath.join(dir, "late.db");
    await fs.copyFile(a.file, late);
    const earlyStore = await storeOn(await sqliteFile(early), { replica: replicaOf(7), trust: { kind: "open" } });
    const lateStore = await storeOn(await sqliteFile(late), { replica: replicaOf(8), trust: { kind: "open" } });
    const count = async (s: SqlStore): Promise<number> => {
      const l = await s.store.list(ROOT, { limit: 1000 });
      assert(l.kind === "ok");
      return l.value.entries.length;
    };
    assertEquals(await count(earlyStore), 20, "a copy after a checkpoint is whole");
    assertEquals(await count(lateStore), 21, "a copy after close is whole");
    assertEquals((await lateStore.verify()).length, 0);
    const memory = await storeOn(await sqliteFile(":memory:"));
    assertEquals(await memory.checkpoint(), "done");
  });
});

proves(["0009-sql-compaction FR-002", "0009-sql-compaction FR-003"], "rows are collected only against a roster that has all reported, and a file deleted and collected stays gone when an old dump is replayed, by the real sqlite3 and by the library", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    await put(a, "keep.txt", "kept");
    await put(a, "gone.txt", "to be deleted");
    await exchange(a, b);
    const old = await realDump(a); // before the delete: holds the put of gone.txt
    await del(a, "gone.txt");
    await exchange(a, b);
    assertEquals(await files(a), "keep.txt=kept");
    const missing = await a.store.compact({ reports: { ...(await reportOf(a)) }, roster: [a.store.replica, b.store.replica, replicaOf(2)] });
    assert(missing.kind === "err" && missing.error.includes("has not reported"), "a roster that has not all reported is refused");
    const notMe = await a.store.compact({ reports: await reportOf(b), roster: [b.store.replica] });
    assert(notMe.kind === "err" && notMe.error.includes("not on the roster"));
    const done = await a.store.compact({ reports: await reportOf(b), roster: [a.store.replica, b.store.replica] });
    assert(done.kind === "ok");
    assertEquals(done.value.collected, 2, "the put and the delete of gone.txt are collected; the put of keep.txt is a head and stays");
    assertEquals(await files(a), "keep.txt=kept");
    assertEquals((await a.store.verify()).length, 0, "the rows that are left are all well formed, and a parent an epoch collected is not missing");
    // the old dump, replayed by the library and by the real sqlite3, brings back nothing
    const byLibrary = await importDumps(a.store, [old]);
    assert(byLibrary.kind === "ok");
    assertEquals(await files(a), "keep.txt=kept");
    const script = osPath.join(dir, "old.sql");
    await fs.writeTextFile(script, `.bail on\nBEGIN;\n${old}COMMIT;\n`);
    const cli = await proc.run(["sqlite3", a.file, `.read ${script}`]);
    assertEquals(cli.code, 0, cli.stderr);
    assertEquals(await files(a), "keep.txt=kept", "the real sqlite3 replays the old dump and the file stays gone");
    assertEquals((await a.store.verify()).length, 0);
    assertEquals((await a.store.epochs()).length, 1);
  });
});

proves(["0009-sql-compaction FR-004"], "a row made after the horizon counts, the vector starts from the horizon, and a replica that has not collected still exchanges with one that has", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    await put(a, "x.txt", "one");
    await put(a, "x.txt", "two");
    await put(b, "y.txt", "why");
    await exchange(a, b);
    const before = await reportOf(a);
    const done = await a.store.compact({ reports: await reportOf(b), roster: [a.store.replica, b.store.replica] });
    assert(done.kind === "ok");
    const va = await a.store.store.versionVector();
    assert(va.kind === "ok");
    assertEquals(va.value[a.store.replica], before[a.store.replica]?.[a.store.replica], "the vector of the replica is what it was: the horizon counts as held");
    await put(a, "x.txt", "three"); // a child of a head the epoch kept
    await put(a, "new.txt", "fresh");
    await exchange(a, b);
    assertEquals(await files(a), await files(b));
    assertEquals(await files(a), ["new.txt=fresh", "x.txt=three", "y.txt=why"].join("\n"));
    assertEquals((await a.store.verify()).length, 0);
    assertEquals((await b.store.verify()).length, 0);
  });
});

proves(["0009-sql-compaction FR-005"], "a delta whose parent an epoch collected is not waited for", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    await put(a, "d.txt", "one");
    await del(a, "d.txt");
    await exchange(a, b);
    const done = await a.store.compact({ reports: await reportOf(b), roster: [a.store.replica, b.store.replica] });
    assert(done.kind === "ok");
    await put(b, "d.txt", "again"); // b has not collected: its row replaces the delete a collected
    await take(b, a);
    assertEquals(await a.store.pending(), 0, "nothing waits for the collected parent");
    assertEquals(await files(a), "d.txt=again");
    assertEquals((await a.store.verify()).length, 0);
  });
});

proves(["0009-sql-compaction FR-006"], "an epoch is published once, another replica that holds what it covers takes it and ends with the same files, and one that is not caught up waits", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    const c = await open(dir, "c", 2, clock);
    await put(a, "one.txt", "1");
    await put(a, "two.txt", "2");
    await del(a, "two.txt");
    await exchange(a, b);
    await take(a, c);
    await take(b, c);
    const done = await a.store.compact({ reports: { ...(await reportOf(b)), ...(await reportOf(c)) }, roster: [a.store.replica, b.store.replica, c.store.replica] });
    assert(done.kind === "ok");
    const medium = memoryStore({ name: "medium" });
    const first = await publishEpoch(medium, done.value.proposal);
    const second = await publishEpoch(medium, done.value.proposal);
    assert(first.kind === "ok" && second.kind === "ok" && first.value === second.value, "an epoch is one file wherever it is published");
    const taken = await adoptPublished(medium, b.port, b.store.ctx);
    assert(taken.kind === "ok" && taken.value.adopted.length === 1);
    assertEquals(await files(b), await files(a));
    const again = await adoptPublished(medium, b.port, b.store.ctx);
    assert(again.kind === "ok" && again.value.adopted.length === 0, "adopting twice does nothing");
    // a replica that does not hold what the epoch covers waits
    const late = await open(dir, "late", 3, clock);
    const waits = await adoptPublished(medium, late.port, late.store.ctx);
    assert(waits.kind === "ok" && waits.value.waiting.length === 1 && waits.value.adopted.length === 0);
    // an epoch from a replica that is not trusted is refused
    const closed = await storeOn(await sqliteFile(":memory:"), { replica: replicaOf(9) });
    const refused = await closed.adopt(done.value.proposal);
    assert(refused.kind === "err");
  });
});

proves(["0009-sql-compaction FR-007"], "a replica that will not return is retired: it is no longer trusted, its rows are refused, and who retired it, when and why is written down", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    await put(b, "from-b.txt", "b");
    const retired = await a.store.retire(b.store.replica, "the laptop was lost", "2026-11-21T00:00:00Z");
    assert(retired.kind === "ok" && retired.value.by === a.store.replica);
    const notSelf = await a.store.retire(a.store.replica, "no", "2026-11-21T00:00:00Z");
    assert(notSelf.kind === "err");
    const noReason = await a.store.retire(b.store.replica, " ", "2026-11-21T00:00:00Z");
    assert(noReason.kind === "err");
    assertEquals((await a.store.retired()).map((r) => r.reason), ["the laptop was lost"]);
    const closed = await storeOn(a.port, { replica: replicaOf(0), trust: { kind: "allowlist", replicas: new Set([replicaOf(0)]) } });
    const delta = await b.store.store.deltaSince({});
    assert(delta.kind === "ok");
    const r = await closed.store.applyDelta(delta.value);
    assert(r.kind === "ok" && r.value.kind === "refused", "the rows of a retired replica are refused");
  });
});

proves(["0009-sql-compaction FR-008"], "a compacted database is dumped and replayed into a new one and gives the same files, and a second collection with a newer horizon collects the rows the first kept", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 0, clock);
    const b = await open(dir, "b", 1, clock);
    await put(a, "x.txt", "one");
    await exchange(a, b);
    const first = await a.store.compact({ reports: await reportOf(b), roster: [a.store.replica, b.store.replica] });
    assert(first.kind === "ok");
    await put(a, "x.txt", "two");
    await put(a, "x.txt", "three");
    await exchange(a, b);
    const second = await a.store.compact({ reports: await reportOf(b), roster: [a.store.replica, b.store.replica] });
    assert(second.kind === "ok" && second.value.collected >= 1);
    assertEquals(await files(a), "x.txt=three");
    const target = await open(dir, "target", 99, clock);
    const done = await importDumps(target.store, [await realDump(a)]);
    assert(done.kind === "ok");
    assertEquals(await files(target), "x.txt=three");
    // the epoch is what says that a parent that is not held was collected: a database made from the dump of a collected one takes it
    assertEquals((await target.store.verify()).length, 1, "a parent that is not held, and no epoch to say it was collected");
    const adopted = await target.store.adopt(second.value.proposal);
    assert(adopted.kind === "ok", adopted.kind === "err" ? adopted.error : "");
    assertEquals((await target.store.verify()).length, 0);
    assertEquals((await a.store.epochs()).length, 2);
    void compactDatabase;
  });
});
