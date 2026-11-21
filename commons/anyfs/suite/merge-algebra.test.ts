/**
 * Tests of the pure algebra of a merge (commons anyfs 0007-anyfs-merge-governance FR-001 to FR-008, 0008-anyfs-merge-logical FR-001 to FR-015): ids that are UUIDs of version 7 made by a clock that never goes back,
 * rows that are their own checksums, the view of a path as the heads of its rows, the union of rows in any order, deltas with their trust, deferral and findings, and the check of rows put in by an import.
 *
 * @module
 */
import fc from "fast-check";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  compareTime,
  type Delta,
  makeVersionId,
  parseReplicaId,
  parseVersionId,
  type ReplicaId,
  replicaIdOfBytes,
  timeOfId,
  type Version,
} from "../src/governance/mod.ts";
import {
  applyDelta,
  deltaId,
  decodeDelta,
  DEFAULT_LIMITS,
  deltaSince,
  encodeDelta,
  headsOf,
  type MergeState,
  makeVersion,
  newState,
  nextTime,
  presentPaths,
  seeTime,
  stateText,
  toBase64,
  transact,
  vectorOf,
  verifyState,
  viewOf,
  viewText,
  withBlob,
  withVersion,
  defaultConfig,
} from "../src/merge/mod.ts";
import { defaultTrust, describeMergeRefusal, FINDING_KINDS, MERGE_REFUSAL_KINDS } from "../src/governance/mod.ts";

const rid = (n: number): ReplicaId => {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const enc = new TextEncoder();
const open = (replica: ReplicaId): MergeState => newState(replica, { ...defaultConfig(replica), trust: { kind: "open" } });

async function put(s: MergeState, path: string, text: string, wall: number): Promise<{ state: MergeState; delta: Delta }> {
  const sha = await sha256(enc.encode(text));
  const made = await transact(s, [{ kind: "put", path, blob: sha }], new Map([[sha, enc.encode(text)]]), wall);
  if (made.kind === "err" || made.value.delta === undefined) throw new Error("no row made");
  return { state: made.value.state, delta: made.value.delta };
}
async function remove(s: MergeState, path: string, wall: number): Promise<{ state: MergeState; delta: Delta | undefined }> {
  const made = await transact(s, [{ kind: "remove", path }], new Map(), wall);
  if (made.kind === "err") throw new Error(made.error);
  return { state: made.value.state, delta: made.value.delta };
}
async function take(s: MergeState, d: Delta, wall: number): Promise<MergeState> {
  return (await applyDelta(s, d, wall)).state;
}

proves(["0007-anyfs-merge-governance FR-001", "0007-anyfs-merge-governance FR-002"], "a replica id is 32 hexadecimal digits and a version id a UUID of version 7, each made only by its parser, and an id carries its time and sorts by it", () => {
  assertEquals(parseReplicaId("zz").kind, "err");
  assertEquals(parseReplicaId("0123456789abcdef0123456789abcdef").kind, "ok");
  assertEquals(parseVersionId("018f3a6e-7c00-7000-8123-456789abcdef").kind, "ok");
  for (const bad of ["", "018f3a6e-7c00-4000-8123-456789abcdef", "018f3a6e-7c00-7000-c123-456789abcdef", "018F3A6E-7C00-7000-8123-456789ABCDEF"]) assertEquals(parseVersionId(bad).kind, "err", bad);
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 40 }), fc.integer({ min: 0, max: 0xfff }), fc.integer({ min: 1, max: 200 }), (ms, counter, n) => {
      const id = makeVersionId({ ms, counter }, rid(n));
      const t = timeOfId(id);
      return parseVersionId(id).kind === "ok" && t.ms === ms && t.counter === counter;
    }),
  );
  fc.assert(
    fc.property(fc.tuple(fc.integer({ min: 0, max: 2 ** 40 }), fc.integer({ min: 0, max: 0xfff })), fc.tuple(fc.integer({ min: 0, max: 2 ** 40 }), fc.integer({ min: 0, max: 0xfff })), (a, b) => {
      const ia = makeVersionId({ ms: a[0], counter: a[1] }, rid(1));
      const ib = makeVersionId({ ms: b[0], counter: b[1] }, rid(1));
      return Math.sign(compareTime({ ms: a[0], counter: a[1] }, { ms: b[0], counter: b[1] })) === Math.sign(ia < ib ? -1 : ia > ib ? 1 : 0);
    }),
  );
  assert(makeVersionId({ ms: 5, counter: 5 }, rid(1)) !== makeVersionId({ ms: 5, counter: 5 }, rid(2)), "two replicas never make one id");
});

proves(["0008-anyfs-merge-logical FR-003"], "the clock never makes an id that is not after the last, whatever the wall clock does, and an id taken from another replica puts the next one after it", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 1, maxLength: 60 }), (walls) => {
      let last: { ms: number; counter: number } | undefined;
      for (const w of walls) {
        const next = nextTime(last, w);
        if (last !== undefined && compareTime(next, last) <= 0) return false;
        last = next;
      }
      return true;
    }),
  );
  const taken = seeTime({ ms: 10, counter: 3 }, { ms: 50, counter: 1 });
  assertEquals(taken, { ms: 50, counter: 1 });
  assertEquals(nextTime(taken, 20), { ms: 50, counter: 2 });
  assertEquals(nextTime({ ms: 7, counter: 0xfff }, 7), { ms: 8, counter: 0 });
});

proves(["0007-anyfs-merge-governance FR-004", "0007-anyfs-merge-governance FR-007", "0007-anyfs-merge-governance FR-008"], "a row is its own checksum: its fields make it, a put names a blob and a tombstone none, and a changed field is found", async () => {
  const id = makeVersionId({ ms: 1, counter: 0 }, rid(1));
  const sha = await sha256(enc.encode("x"));
  const put_ = await makeVersion({ id, replica: rid(1), seq: 1, path: "a", parent: null, merged: [], kind: "put", blob: sha });
  assertEquals(put_.kind, "ok");
  assertEquals((await makeVersion({ id, replica: rid(1), seq: 1, path: "a", parent: null, merged: [], kind: "put", blob: null })).kind, "err");
  assertEquals((await makeVersion({ id, replica: rid(1), seq: 1, path: "a", parent: null, merged: [], kind: "tombstone", blob: sha })).kind, "err");
  assertEquals((await makeVersion({ id, replica: rid(1), seq: 0, path: "a", parent: null, merged: [], kind: "tombstone", blob: null })).kind, "err");
  const other = makeVersionId({ ms: 2, counter: 0 }, rid(1));
  assertEquals((await makeVersion({ id, replica: rid(1), seq: 1, path: "a", parent: other, merged: [other], kind: "tombstone", blob: null })).kind, "err");
  const s = open(rid(1));
  const { state } = await put(s, "p", "text", 1000);
  assertEquals(await verifyState(state, 1000), []);
  const row = [...state.versions.values()][0] as Version;
  const tampered = withVersion(newState(rid(1)), { ...row, path: "q" });
  assert((await verifyState(tampered, 1000)).some((f) => f.kind === "bad-sum"), "a changed path is found");
});

proves(["0008-anyfs-merge-logical FR-001", "0008-anyfs-merge-logical FR-002", "0008-anyfs-merge-logical FR-008"], "the view of a path is the heads of its rows: the greatest is the file, the others are siblings, and a winner that is a tombstone is no file", async () => {
  let a = open(rid(1));
  let b = open(rid(2));
  const first = await put(a, "p", "v1", 1000);
  a = first.state;
  b = await take(b, first.delta, 1000);
  const wa = await put(a, "p", "from-a", 1100);
  const wb = await put(b, "p", "from-b", 1200);
  a = await take(wa.state, wb.delta, 1300);
  b = await take(wb.state, wa.delta, 1300);
  assertEquals(viewText(a), viewText(b));
  const view = viewOf(a, "p");
  assert(view.present && view.winner !== undefined, "the path is there");
  assertEquals(view.siblings.length, 1);
  assertEquals(headsOf(a, "p").length, 2);
  assertEquals(view.winner.id > (view.siblings[0] as Version).id, true);
  // a later write replaces both heads
  const resolved = await put(a, "p", "resolved", 1400);
  assertEquals(headsOf(resolved.state, "p").length, 1);
  assertEquals((resolved.delta.versions[0] as Version).merged.length, 1);
  // a tombstone that wins is no file
  const gone = await remove(resolved.state, "p", 1500);
  assertEquals(viewOf(gone.state, "p").present, false);
  assertEquals([...presentPaths(gone.state)], []);
  const again = await put(gone.state, "p", "back", 1600);
  assertEquals(viewOf(again.state, "p").present, true);
  assertEquals((await remove(open(rid(3)), "never", 1)).delta, undefined);
});

proves(["0007-anyfs-merge-governance FR-003", "0008-anyfs-merge-logical FR-004"], "a replica's version vector is the number of the last of each replica's rows it holds with none missing before it", async () => {
  let a = open(rid(1));
  const w1 = await put(a, "x", "1", 1000);
  a = w1.state;
  const w2 = await put(a, "x", "2", 1001);
  a = w2.state;
  const w3 = await put(a, "x", "3", 1002);
  a = w3.state;
  assertEquals(vectorOf(a), { [rid(1)]: 3 });
  // a replica that holds rows 1 and 3 but not 2 has the prefix 1
  const [r1, , r3] = [...a.versions.values()].sort((p, q) => p.seq - q.seq) as Version[];
  let b = open(rid(2));
  b = withVersion(withVersion(b, r1 as Version), r3 as Version);
  assertEquals(vectorOf(b), { [rid(1)]: 1 });
  // and so asks for everything after row 1, which brings the missing row again
  const d = deltaSince(a, vectorOf(b));
  assertEquals(d.versions.map((v) => v.seq), [2, 3]);
  assertEquals(deltaSince(a, vectorOf(a)).versions, []);
});

proves(["0008-anyfs-merge-logical FR-005", "0008-anyfs-merge-logical FR-006"], "the rows of any number of replicas, put together in any order and any number of times, give the same state and the same files", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 4 }),
      fc.array(fc.tuple(fc.nat(3), fc.constantFrom("a", "b", "c", "d/e"), fc.constantFrom("x", "y", "z", "w", "-"), fc.integer({ min: 0, max: 400 }), fc.nat(3), fc.nat(3)), { minLength: 1, maxLength: 24 }),
      fc.array(fc.nat(1000), { minLength: 3, maxLength: 6 }),
      async (n, steps, seeds) => {
        const replicas = Array.from({ length: n }, (_, i) => open(rid(i + 1)));
        for (const [who, path, content, skew, from, to] of steps) {
          const i = who % n;
          const wall = 10_000 + skew;
          const cur = replicas[i] as MergeState;
          if (content === "-") replicas[i] = (await remove(cur, path, wall)).state;
          else replicas[i] = (await put(cur, path, content, wall)).state;
          if (from % n !== to % n) {
            const src = replicas[from % n] as MergeState;
            const dst = replicas[to % n] as MergeState;
            replicas[to % n] = await take(dst, deltaSince(src, vectorOf(dst)), 20_000);
          }
        }
        // every row and blob from everywhere, in a shuffled order, with duplicates, into a replica that holds nothing
        const all = replicas.flatMap((r) => [...r.versions.values()]);
        const blobs = new Map(replicas.flatMap((r) => [...r.blobs.entries()]));
        const order = [...all, ...all.slice(0, 3)].sort((a, b) => ((seeds.reduce((acc, s) => acc + s, 0) + a.seq * 7 + b.seq) % 3) - 1);
        let union = open(rid(9));
        for (const [sha, bytes] of blobs) union = withBlob(union, sha, bytes);
        for (const v of order) union = withVersion(union, v);
        let full = open(rid(8));
        for (const [sha, bytes] of blobs) full = withBlob(full, sha, bytes);
        for (const v of all) full = withVersion(full, v);
        if (stateText(union) !== stateText(full) || viewText(union) !== viewText(full)) return false;
        // and every pair of replicas, exchanged until nothing is new, holds that same state
        let settled = replicas;
        for (let round = 0; round < n; round++) {
          settled = await Promise.all(
            settled.map(async (r, i) => {
              let cur = r;
              for (let j = 0; j < settled.length; j++) if (j !== i) cur = await take(cur, deltaSince(settled[j] as MergeState, vectorOf(cur)), 30_000);
              return cur;
            }),
          );
        }
        return settled.every((r) => stateText(r) === stateText(full) && viewText(r) === viewText(full));
      },
    ),
    { numRuns: 40 },
  );
});

proves(["0008-anyfs-merge-logical FR-007"], "a tombstone and a new write of one path made at the same time converge, and concurrent writes that replaced one version keep a deterministic winner", async () => {
  let a = open(rid(1));
  let b = open(rid(2));
  const base = await put(a, "p", "base", 1000);
  a = base.state;
  b = await take(b, base.delta, 1000);
  const del = await remove(a, "p", 1100);
  const re = await put(b, "p", "again", 1100);
  a = await take(del.state, re.delta, 1200);
  b = await take(re.state, del.delta as Delta, 1200);
  assertEquals(viewText(a), viewText(b));
  const c1 = await put(a, "q", "from-a", 1300);
  const c2 = await put(b, "q", "from-b", 1300);
  a = await take(c1.state, c2.delta, 1400);
  b = await take(c2.state, c1.delta, 1400);
  assertEquals(viewOf(a, "q").winner?.id, viewOf(b, "q").winner?.id);
});

proves(["0008-anyfs-merge-logical FR-010", "0008-anyfs-merge-logical FR-011"], "a delta is read only as the format says, has one identity whatever the order of its rows, and is the same text when it is read and written", async () => {
  let a = open(rid(1));
  a = (await put(a, "one", "1", 1000)).state;
  a = (await put(a, "two", "2", 1001)).state;
  const d = deltaSince(a, {});
  const text = encodeDelta(d);
  const back = decodeDelta(text, DEFAULT_LIMITS);
  assertEquals(back.kind, "ok");
  assertEquals(encodeDelta(back.kind === "ok" ? back.value : d), text);
  const reversed: Delta = { ...d, versions: [...d.versions].reverse() };
  assertEquals(await deltaId(reversed), await deltaId(d));
  for (const bad of ["", "{", "[]", '{"format":2}', JSON.stringify({ ...d, format: 9 }), JSON.stringify({ ...d, versions: "no" }), JSON.stringify({ ...d, blobs: [{ sha: "x", bytes: 1 }] })]) assertEquals(decodeDelta(bad, DEFAULT_LIMITS).kind, "err", bad);
  assertEquals(decodeDelta("x".repeat(100), { ...DEFAULT_LIMITS, maxDeltaChars: 10 }).kind, "err");
});

proves(["0007-anyfs-merge-governance FR-005", "0008-anyfs-merge-logical FR-012"], "a replica takes changes only from whom its trust names: itself alone by default, any with `open`, and deltas with a signature a verifier accepts with `signed`", async () => {
  const a = open(rid(1));
  const w = await put(a, "t", "x", 1000);
  const alone = newState(rid(2));
  const refused = await applyDelta(alone, w.delta, 1000);
  assertEquals(refused.outcome.kind, "refused");
  assertEquals(refused.state.versions.size, 0);
  const listed = newState(rid(2), { ...defaultConfig(rid(2)), trust: { kind: "allowlist", replicas: new Set([rid(1), rid(2)]) } });
  assertEquals((await applyDelta(listed, w.delta, 1000)).outcome.kind, "applied");
  const signedOk = newState(rid(2), { ...defaultConfig(rid(2)), trust: { kind: "signed", verify: (_id, sig) => sig === "good" } });
  assertEquals((await applyDelta(signedOk, w.delta, 1000)).outcome.kind, "refused");
  assertEquals((await applyDelta(signedOk, { ...w.delta, signature: "bad" }, 1000)).outcome.kind, "refused");
  assertEquals((await applyDelta(signedOk, { ...w.delta, signature: "good" }, 1000)).outcome.kind, "applied");
  // the signature is not part of the identity
  assertEquals(await deltaId({ ...w.delta, signature: "good" }), await deltaId(w.delta));
});

proves(["0008-anyfs-merge-logical FR-013"], "a delta whose rows replace rows that are not held, or whose puts name blobs that are not held, waits and is applied when they arrive, in any order", async () => {
  let a = open(rid(1));
  const w1 = await put(a, "d", "one", 1000);
  a = w1.state;
  const seen = vectorOf(a);
  const w2 = await put(a, "d", "two", 1001);
  const d2 = deltaSince(w2.state, seen);
  const b = open(rid(2));
  const early = await applyDelta(b, d2, 1002);
  assertEquals(early.outcome.kind, "deferred");
  assertEquals(early.state.pending.length, 1);
  assertEquals(early.state.versions.size, 0);
  const twice = await applyDelta(early.state, d2, 1002);
  assertEquals(twice.state.pending.length, 1, "the same delta is held once");
  const done = await applyDelta(twice.state, w1.delta, 1003);
  assertEquals(done.outcome.kind, "applied");
  assertEquals(done.state.pending.length, 0);
  assertEquals(viewOf(done.state, "d").winner?.blob, await sha256(enc.encode("two")));
  const noBlob: Delta = { ...w1.delta, blobs: [] };
  const lacking = await applyDelta(open(rid(3)), noBlob, 1000);
  assertEquals(lacking.outcome.kind, "deferred");
  assertStringIncludes(lacking.outcome.kind === "deferred" ? lacking.outcome.missing.join(" ") : "", "blob");
});

proves(["0008-anyfs-merge-logical FR-014"], "an id from the far future, a blob that is not its digest, a row that is not its sum and too many rows are refused; a held id with another sum is kept and found", async () => {
  const a = open(rid(1));
  const w = await put(a, "k", "v", 1000);
  const b = open(rid(2));
  const ahead = await put(open(rid(1)), "k", "v", 5_000_000_000_000);
  const future = await applyDelta(b, ahead.delta, 1000);
  assertEquals(future.outcome.kind === "refused" ? future.outcome.refusal.kind : future.outcome.kind, "future-id");
  const tinyLimits = newState(rid(2), { ...defaultConfig(rid(2)), trust: { kind: "open" }, limits: { ...DEFAULT_LIMITS, maxVersions: 0 } });
  assertEquals((await applyDelta(tinyLimits, w.delta, 1000)).outcome.kind, "refused");
  const blob = w.delta.blobs[0];
  assert(blob !== undefined);
  const wrong = await applyDelta(open(rid(2)), { ...w.delta, blobs: [{ sha: blob.sha, bytes: toBase64(enc.encode("other")) }] }, 1000);
  assertEquals(wrong.outcome.kind === "refused" ? wrong.outcome.refusal.kind : "", "bad-blob");
  const row = w.delta.versions[0] as Version;
  const forged = await makeVersion({ id: row.id, replica: row.replica, seq: row.seq, path: row.path, parent: null, merged: [], kind: "put", blob: await sha256(enc.encode("forged")) });
  assert(forged.kind === "ok");
  const first = await applyDelta(open(rid(2)), w.delta, 1000);
  const second = await applyDelta(first.state, { format: 1, origin: rid(1), versions: [forged.value], blobs: [{ sha: forged.value.blob as string, bytes: toBase64(enc.encode("forged")) }] }, 1000);
  assertEquals(second.outcome.kind, "applied");
  assertEquals(second.state.versions.size, 2);
  assert(second.outcome.kind === "applied" && second.outcome.findings.some((f) => f.kind === "duplicate-id"), "the forged id is a finding");
});

proves(["0008-anyfs-merge-logical FR-015"], "the check of a replica's rows finds what a raw import let in: a row that is not its sum, a replica that is not trusted, an id from the future, a missing parent, a missing blob and bytes that are not their digest", async () => {
  const a = open(rid(1));
  const w1 = await put(a, "k", "one", 1000);
  const w2 = await put(w1.state, "k", "two", 1001);
  assertEquals(await verifyState(w2.state, 1001), []);
  const rows = [...w2.state.versions.values()].sort((p, q) => p.seq - q.seq);
  const [r1, r2] = rows as [Version, Version];
  const strict = newState(rid(5));
  let imported = withVersion(strict, r2);
  imported = withBlob(imported, r2.blob as string, enc.encode("not the bytes"));
  const kinds = (await verifyState(imported, 1001)).map((f) => f.kind);
  for (const k of ["untrusted-replica", "dangling-parent", "bad-blob"]) assert(kinds.includes(k as never), `${k} in ${kinds.join(",")}`);
  assert((await verifyState(withVersion(open(rid(5)), r1), 1)).some((f) => f.kind === "future-id" || f.kind === "missing-blob"));
});

proves(["0007-anyfs-merge-governance FR-005"], "the reasons, outcomes and findings of a merge are closed lists, each with a sentence", () => {
  assertEquals([...MERGE_REFUSAL_KINDS], ["trust", "future-id", "malformed", "too-large", "bad-sum", "bad-blob", "forged"]);
  assertEquals([...FINDING_KINDS], ["duplicate-id", "duplicate-seq", "bad-sum", "bad-blob", "future-id", "untrusted-replica", "dangling-parent", "missing-blob", "bad-id"]);
  assertStringIncludes(describeMergeRefusal({ kind: "trust", message: "x" }), "trust");
  assertEquals(defaultTrust(rid(1)), { kind: "allowlist", replicas: new Set([rid(1)]) });
});

proves(["0007-anyfs-merge-governance FR-006"], "the limits are values: a path, a blob, the rows of a delta and the text of a delta over them are refused with the limit in the sentence", async () => {
  const s = newState(rid(1), { ...defaultConfig(rid(1)), limits: { ...DEFAULT_LIMITS, maxPathChars: 4, maxBlobBytes: 3 } });
  const tooLong = await transact(s, [{ kind: "put", path: "abcde", blob: "0".repeat(64) }], new Map(), 1);
  assert(tooLong.kind === "err" && tooLong.error.includes("4"), "a path over the limit");
  const sha = await sha256(enc.encode("abcd"));
  const big = await transact(s, [{ kind: "put", path: "p", blob: sha }], new Map([[sha, enc.encode("abcd")]]), 1);
  assert(big.kind === "err" && big.error.includes("3"), "a blob over the limit");
  assertEquals(DEFAULT_LIMITS.maxVersions, 100_000);
});
