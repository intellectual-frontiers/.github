/**
 * Tests of the merge of the SQL stores (commons anyfs-sql 0007-sql-merge FR-001 to FR-005): replicas on SQLite pass every case of the merge suite of AnyFS, a database copied as a file takes a new identity, a replica that
 * is not trusted is refused with a sentence, the heads that do not win are kept as siblings, and a database is its rows alone.
 *
 * @module
 */
import { runMergeConformance, type MakeReplicas, type MergeFace } from "@intellectual-frontiers/anyfs/conformance";
import { expectAny } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs } from "@intellectual-frontiers/system";
import { bytes, monotone, osPath, p, replicaOf, sqliteFile, sqliteMemory, storeOn, text, withTemp } from "./kit.ts";

const replicas: MakeReplicas = async (count, options) => {
  const clock = monotone();
  const faces: MergeFace[] = [];
  for (let i = 0; i < count; i++) {
    const s = await storeOn(await sqliteMemory(), { replica: replicaOf(i), clock, ...(options.trusting ? { trust: { kind: "open" as const } } : {}) });
    faces.push({ store: s.store as unknown as MergeFace["store"], replica: s.replica });
  }
  return faces;
};

proves(["0007-sql-merge FR-001"], "replicas on SQLite pass every case of the merge suite of AnyFS", async () => {
  const reports = await runMergeConformance(replicas);
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  assertEquals(reports.length, 12);
});

proves(["0007-sql-merge FR-002"], "a database copied as a file takes a new identity and keeps the old one as trusted, and the original keeps its own", async () => {
  await withTemp(async (dir) => {
    const a = osPath.join(dir, "a.db");
    const first = await sqliteFile(a);
    const one = await storeOn(first, { replica: replicaOf(1), fingerprint: "file-a" });
    assert((await one.store.write(p("x.txt"), bytes("one"), expectAny)).kind === "ok");
    await first.query("PRAGMA wal_checkpoint(TRUNCATE)", []);
    await first.close();
    const again = await sqliteFile(a);
    const same = await storeOn(again, { fingerprint: "file-a" });
    assertEquals([same.replica, same.forkedFrom], [replicaOf(1), undefined]);
    await again.close();
    await fs.copyFile(a, osPath.join(dir, "b.db"));
    const copied = await sqliteFile(osPath.join(dir, "b.db"));
    const fork = await storeOn(copied, { fingerprint: "file-b" });
    assert(fork.replica !== replicaOf(1) && fork.forkedFrom === replicaOf(1), "the copy is a new replica");
    const read = await fork.store.read(p("x.txt"));
    assert(read.kind === "ok" && text(read.value.bytes) === "one");
    await copied.close();
  });
});

type Face = MergeFace["store"];
const pull = async (from: Face, to: Face): Promise<unknown> => {
  const since = await to.versionVector();
  assert(since.kind === "ok");
  const delta = await from.deltaSince(since.value);
  assert(delta.kind === "ok");
  const done = await to.applyDelta(delta.value);
  return done.kind === "ok" ? done.value : { problem: done.error };
};

proves(["0007-sql-merge FR-003"], "a replica that is not trusted is refused with a sentence, and one named in the allowlist is taken", async () => {
  const clock = monotone();
  const a = await storeOn(await sqliteMemory(), { replica: replicaOf(1), clock });
  const b = await storeOn(await sqliteMemory(), { replica: replicaOf(2), clock });
  const c = await storeOn(await sqliteMemory(), { replica: replicaOf(3), clock, trust: { kind: "allowlist", replicas: new Set([replicaOf(1)]) } });
  assert((await a.store.write(p("a.txt"), bytes("from a"), expectAny)).kind === "ok");
  assert((await b.store.write(p("b.txt"), bytes("from b"), expectAny)).kind === "ok");
  const store = (s: typeof a): Face => s.store as unknown as Face;
  const takeA = JSON.stringify(await pull(store(a), store(c)));
  assert(!/refus|untrusted/i.test(takeA), `a is named: ${takeA}`);
  const takeB = JSON.stringify(await pull(store(b), store(c)));
  assert(/refus|untrusted|trust/i.test(takeB), `b is refused with a sentence: ${takeB}`);
  assert((await c.store.read(p("a.txt"))).kind === "ok");
  assert((await c.store.read(p("b.txt"))).kind === "err", "nothing of b is taken");
  assertEquals((await c.verify()).map((f) => f.kind), []);
});

proves(["0007-sql-merge FR-004"], "two writes to one path on two replicas leave one winner on both and the other version kept as a sibling", async () => {
  const clock = monotone();
  const x = await storeOn(await sqliteMemory(), { replica: replicaOf(1), clock, trust: { kind: "open" } });
  const y = await storeOn(await sqliteMemory(), { replica: replicaOf(2), clock, trust: { kind: "open" } });
  assert((await x.store.write(p("f.txt"), bytes("from x"), expectAny)).kind === "ok");
  assert((await y.store.write(p("f.txt"), bytes("from y"), expectAny)).kind === "ok");
  await pull(x.store as unknown as Face, y.store as unknown as Face);
  await pull(y.store as unknown as Face, x.store as unknown as Face);
  const rx = await x.store.read(p("f.txt"));
  const ry = await y.store.read(p("f.txt"));
  assert(rx.kind === "ok" && ry.kind === "ok" && text(rx.value.bytes) === text(ry.value.bytes), "the same winner on both");
  assertEquals(text((rx as { value: { bytes: Uint8Array } }).value.bytes), "from y", "the later id wins");
  assertEquals((await x.siblings(p("f.txt"))).length, 1);
  assertEquals((await y.siblings(p("f.txt"))).length, 1);
  assertEquals((await x.verify()).length + (await y.verify()).length, 0);
});
