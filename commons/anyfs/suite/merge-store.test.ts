/**
 * Tests of the store in memory that merges (commons anyfs 0009-anyfs-merge-physical FR-008 to FR-012): it passes the conformance suite of the store in memory and the suite of merging, and the suite of merging fails
 * for a replica that does not obey its laws.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { runConformance, runMergeConformance, type MergeFace, type MakeReplicas } from "../src/logical/conformance/mod.ts";
import { type ReplicaId, replicaIdOfBytes } from "../src/governance/mod.ts";
import { memoryMergeStore } from "../src/physical/memory-merge/mod.ts";
import { expectAbsent, expectAny, expectRev, parsePath, parsePrefix, ROOT } from "../src/governance/mod.ts";
import { asStore, effectOf, emptyNamespace, mount, readOnly, sub } from "../src/logical/mod.ts";
import { safeToRepeat } from "../src/logical/layers/mod.ts";
import { makeVersion as makeRow, versionKey as keyOfRow } from "../src/merge/mod.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";

const replicaOf = (n: number): ReplicaId => {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n + 1));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** Replicas in memory: they trust one another where asked. */
export const memoryReplicas: MakeReplicas = async (count, options) => {
  const ids = Array.from({ length: count }, (_, i) => replicaOf(i));
  let t = 1_700_000_000_000;
  const clock = (): number => (t += 1);
  return ids.map((id, i): MergeFace => {
    const r = memoryMergeStore({ name: `r${i}`, replica: id, clock, ...(options.trusting ? { trust: { kind: "open" as const } } : {}) });
    return { store: r.store, replica: id, siblings: (path) => r.siblings(path) };
  });
};

proves(["0009-anyfs-merge-physical FR-008"], "the store in memory that merges passes every case of the conformance suite of a store", async () => {
  const reports = await runConformance(async () => memoryMergeStore().store);
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  assert(reports.length >= 15, "the cases that a store of these capabilities is held to are run");
});

proves(["0009-anyfs-merge-physical FR-011"], "replicas in memory pass every case of the conformance suite of merging", async () => {
  const reports = await runMergeConformance(memoryReplicas);
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  assertEquals(reports.length, 12);
});

import { makeStore } from "../src/logical/mod.ts";
import { makeVersion, versionKey as keyOf } from "../src/merge/mod.ts";

type Mutant = "drops-tombstones" | "drops-blobs" | "regressing-vector" | "never-duplicate" | "trusts-everyone" | "accepts-tampered";

/** Replicas in memory with one deliberate fault each: a merge that does not obey its laws. */
function broken(fault: Mutant): MakeReplicas {
  return async (count, options) => {
    const faces = await memoryReplicas(count, fault === "trusts-everyone" ? { trusting: true } : options);
    return faces.map((f): MergeFace => {
      let calls = 0;
      const store = makeStore({
        id: `${f.store.id}#${fault}`,
        place: f.store.place,
        consistency: f.store.consistency,
        traits: f.store.traits,
        capabilities: ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history", "merge"] as const,
        handle: async (op) => {
          if (op.op !== "merge") return f.store.handle(op);
          if (op.action.kind === "since" && fault === "drops-tombstones") {
            const done = await f.store.handle(op);
            if (done.kind === "err" || done.value.op !== "merge" || done.value.value.kind !== "delta") return done;
            const delta = done.value.value.delta;
            return { kind: "ok", value: { op: "merge", value: { kind: "delta", delta: { ...delta, versions: delta.versions.filter((v) => v.kind !== "tombstone") } } } };
          }
          if (op.action.kind === "since" && fault === "drops-blobs") {
            const done = await f.store.handle(op);
            if (done.kind === "err" || done.value.op !== "merge" || done.value.value.kind !== "delta") return done;
            return { kind: "ok", value: { op: "merge", value: { kind: "delta", delta: { ...done.value.value.delta, blobs: [] } } } };
          }
          if (op.action.kind === "vector" && fault === "regressing-vector") {
            calls += 1;
            if (calls > 3) return { kind: "ok", value: { op: "merge", value: { kind: "vector", vector: {} } } };
          }
          if (op.action.kind === "apply" && fault === "never-duplicate") {
            const done = await f.store.handle(op);
            if (done.kind === "ok" && done.value.op === "merge" && done.value.value.kind === "outcome" && done.value.value.outcome.kind === "duplicate") {
              return { kind: "ok", value: { op: "merge", value: { kind: "outcome", outcome: { kind: "applied", versions: 0, blobs: 0, findings: [] } } } };
            }
            return done;
          }
          if (op.action.kind === "apply" && fault === "accepts-tampered") {
            const delta = op.action.delta;
            const repaired = await Promise.all(delta.versions.map(async (v) => {
              const again = await makeVersion({ id: v.id, replica: v.replica, seq: v.seq, path: v.path, parent: v.parent, merged: v.merged, kind: v.kind, blob: v.blob });
              return again.kind === "ok" ? again.value : v;
            }));
            return f.store.handle({ ...op, action: { kind: "apply", delta: { ...delta, versions: repaired } } });
          }
          return f.store.handle(op);
        },
      });
      return { store, replica: f.replica, ...(f.siblings === undefined ? {} : { siblings: f.siblings }) };
    });
  };
}

const EXPECTED_FAILURES: Readonly<Record<Mutant, readonly string[]>> = {
  "drops-tombstones": ["delete-recreate"],
  "drops-blobs": ["convergence"],
  "regressing-vector": ["vector-monotonic"],
  "never-duplicate": ["idempotent"],
  "trusts-everyone": ["trust"],
  "accepts-tampered": ["hostile"],
};

proves(["0009-anyfs-merge-physical FR-012"], "the merge suite fails, with a sentence, for each replica with a deliberate fault: a delta that drops deletes or blobs, a vector that goes back, a delta that is never a duplicate, a trust that takes anyone and a row that is repaired on the way in", async () => {
  for (const fault of Object.keys(EXPECTED_FAILURES) as Mutant[]) {
    const reports = await runMergeConformance(broken(fault));
    const failed = reports.filter((r) => r.failure !== undefined);
    for (const id of EXPECTED_FAILURES[fault]) {
      const hit = failed.find((r) => r.id === id);
      assert(hit !== undefined, `${fault}: the case ${id} should fail, and ${failed.map((r) => r.id).join(", ") || "none"} did`);
      assert((hit.failure ?? "").length > 20, `${fault}: the failure of ${id} should be a sentence`);
    }
  }
  void keyOf;
});

const pth = (t: string) => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0007-anyfs-merge-governance FR-009", "0008-anyfs-merge-logical FR-009"], "a store that merges has `merge`, declares eventual-merge, counts a delta taken as an operation that destroys, is not made through a view of a prefix or across mounts, may be retried and is read-only without it", async () => {
  const r = memoryMergeStore({ name: "m" });
  assertEquals(r.store.consistency, "eventual-merge");
  assert(r.store.capabilities.has("merge"));
  assertEquals(effectOf({ op: "merge", action: { kind: "vector" } }), "read");
  assertEquals(effectOf({ op: "merge", action: { kind: "since", since: {} } }), "read");
  assertEquals(effectOf({ op: "merge", action: { kind: "apply", delta: { format: 1, origin: r.replica, versions: [], blobs: [] } } }), "destructive");
  assert(safeToRepeat({ op: "merge", action: { kind: "vector" } }));
  assert(!readOnly(r.store).capabilities.has("merge"));
  const prefix = parsePrefix("a");
  if (prefix.kind === "err") throw new Error(prefix.error);
  assert(!sub(r.store, prefix.value).capabilities.has("merge"));
  const ns = mount(emptyNamespace, ROOT, r.store);
  assert(ns.kind === "ok");
  assertEquals(asStore(ns.value, "ns", ["merge"]).kind, "err");
});

proves(["0009-anyfs-merge-physical FR-009"], "a write replaces the heads of its path, a write of the same bytes makes no row, a delete is a tombstone, a batch is whole or nothing, a rename leaves nothing to overwrite, and siblings can be read", async () => {
  const r = memoryMergeStore({ name: "w", trust: { kind: "open" } });
  const s = r.store;
  const enc2 = new TextEncoder();
  assertEquals((await s.write(pth("p"), enc2.encode("one"), expectAbsent)).kind, "ok");
  const rows = (): number => r.state().versions.size;
  const before = rows();
  assertEquals((await s.write(pth("p"), enc2.encode("one"), expectAny)).kind, "ok");
  assertEquals(rows(), before, "the same bytes make no row");
  const rev = await sha256(enc2.encode("one"));
  const wrongRev = expectRev(`sha256:${"0".repeat(64)}` as never);
  assertEquals((await s.write(pth("p"), enc2.encode("two"), wrongRev)).kind, "err");
  assertEquals((await s.write(pth("p"), enc2.encode("two"), expectRev(`sha256:${rev}` as never))).kind, "ok");
  assertEquals((await s.rename(pth("p"), pth("q"), expectAny)).kind, "ok");
  assertEquals((await s.read(pth("p"))).kind, "err");
  assertEquals((await s.write(pth("z"), enc2.encode("z"), expectAny)).kind, "ok");
  assertEquals((await s.rename(pth("q"), pth("z"), expectAny)).kind, "err");
  const batch = await s.batch([
    { kind: "put", path: pth("a1"), bytes: enc2.encode("1"), expect: expectAny },
    { kind: "put", path: pth("z"), bytes: enc2.encode("2"), expect: expectAbsent },
  ]);
  assertEquals(batch.kind, "err");
  assertEquals((await s.read(pth("a1"))).kind, "err", "a batch that fails changes nothing");
  assertEquals((await s.delete(pth("z"), expectAny)).kind, "ok");
  assertEquals([...r.state().byPath.get("z") ?? []].some((v) => v.kind === "tombstone"), true);
  const other = memoryMergeStore({ name: "o", replica: undefined as never, trust: { kind: "open" } });
  void other;
  assertEquals(r.siblings(pth("q")), []);
});

proves(["0009-anyfs-merge-physical FR-010"], "rows put in with no check, as a SQL import puts them, are found by verify: a row that is not its sum, a replica not trusted and a blob that is not its digest", async () => {
  const a = memoryMergeStore({ name: "a", trust: { kind: "open" } });
  await a.store.write(pth("f"), new TextEncoder().encode("hello"), expectAny);
  const rows = [...a.state().versions.values()];
  const blobs = new Map(a.state().blobs);
  const strict = memoryMergeStore({ name: "strict" });
  const row = rows[0];
  if (row === undefined) throw new Error("no row");
  const forged = await makeRow({ id: row.id, replica: row.replica, seq: row.seq, path: row.path, parent: null, merged: [], kind: "put", blob: await sha256(new TextEncoder().encode("forged")) });
  if (forged.kind === "err") throw new Error(forged.error);
  strict.importRows([{ ...row, path: "tampered" }, forged.value], new Map([[row.blob as string, new TextEncoder().encode("not hello")]]));
  void blobs;
  const kinds = (await strict.verify()).map((f) => f.kind);
  for (const k of ["bad-sum", "untrusted-replica", "bad-blob", "duplicate-id"]) assert(kinds.includes(k as never), `${k} in ${kinds.join(",")}`);
  assert(keyOfRow(row).length > 0);
});
