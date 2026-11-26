/**
 * Tests of the queue over a store (commons anyfs 0011-anyfs-queue FR-001 to FR-009) on the store in memory and the store in a folder: order after a restart, a number never made twice by two writers, `ack` twice,
 * a cap by bytes and by age, the pure rule and fold, and a store refused for its consistency.
 *
 * @module
 */
import { withTempDir } from "@intellectual-frontiers/system/fs";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { localStore } from "../src/physical/local/mod.ts";
import { memoryStore } from "../src/physical/memory/mod.ts";
import { memoryMergeStore } from "../src/physical/memory-merge/mod.ts";
import { replicaIdOfBytes } from "../src/governance/mod.ts";
import { evictions, openQueue, parseSegmentName, type Queue, type QueuePolicy, type QueueStore, segmentName, statsOf } from "../src/queue/mod.ts";

const S = (n: string): string => `0011-anyfs-queue ${n}`;
const POLICY: QueuePolicy = { maxBytes: 1_000_000, maxAgeMs: 1_000_000, onFull: "drop-oldest" };
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

const open = (store: QueueStore, policy: QueuePolicy = POLICY, now: () => number = () => 1_700_000_000_000): Queue => {
  const q = openQueue(store, "queue", policy, now);
  if (q.kind === "err") throw new Error(q.error.message);
  return q.value;
};

async function onEachStore(run: (store: QueueStore, label: string) => Promise<void>): Promise<void> {
  await run(memoryStore(), "memory");
  await withTempDir(async (dir) => {
    const s = await localStore(dir, { create: true });
    if (s.kind === "err") throw new Error(s.error);
    await run(s.value, "folder");
  });
}

proves([S("FR-002"), S("FR-004")], "segments come back in the order made, after a restart, and ack twice succeeds", async () => {
  await onEachStore(async (store) => {
    const q = open(store);
    for (const t of ["one", "two", "three"]) assert((await q.enqueue(bytes(t), { signal: "metrics", at: 1_700_000_000_000, count: 1 })).kind === "ok");
    const restarted = open(store);
    const p = await restarted.peek(10);
    assert(p.kind === "ok");
    assertEquals(p.value.map((s) => text(s.bytes)), ["one", "two", "three"]);
    const first = p.value[0];
    assert(first !== undefined);
    assert((await restarted.ack(first.id)).kind === "ok");
    assert((await restarted.ack(first.id)).kind === "ok");
    const after = await restarted.peek(10);
    assert(after.kind === "ok" && after.value.length === 2);
    const next = await restarted.enqueue(bytes("four"), { signal: "logs", at: 1_700_000_000_000, count: 1 });
    assert(next.kind === "ok");
    const all = await restarted.peek(10);
    assert(all.kind === "ok");
    assertEquals(all.value.map((s) => text(s.bytes)), ["two", "three", "four"]);
  });
});

proves([S("FR-002")], "two writers never make one number twice: the second retries on the conflict", async () => {
  await onEachStore(async (store) => {
    const a = open(store);
    const b = open(store);
    const made = await Promise.all([1, 2, 3, 4].flatMap((n) => [a, b].map((q) => q.enqueue(bytes(String(n)), { signal: "metrics", at: 1_700_000_000_000, count: 1 }))));
    const names = made.flatMap((r) => (r.kind === "ok" ? [r.value] : []));
    assertEquals(new Set(names).size, names.length);
    assert(names.length >= 1);
  });
});

proves([S("FR-005")], "a cap by bytes drops the oldest and counts it; refuse-new refuses; a cap by age removes what is old", async () => {
  await onEachStore(async (store) => {
    let t = 1_700_000_000_000;
    const q = open(store, { maxBytes: 150, maxAgeMs: 1_000_000, onFull: "drop-oldest" }, () => t);
    for (const s of ["a".repeat(50), "b".repeat(50), "c".repeat(50)]) assert((await q.enqueue(bytes(s), { signal: "metrics", at: t, count: 1 })).kind === "ok");
    const d = await q.takeDropped();
    assert(d.kind === "ok" && d.value.metrics >= 1);
    const again = await q.takeDropped();
    assert(again.kind === "ok" && again.value.metrics === 0);
    t += 2_000_000;
    assert((await q.enqueue(bytes("fresh"), { signal: "logs", at: t, count: 1 })).kind === "ok");
    const s = await q.stats();
    assert(s.kind === "ok" && s.value.count === 1);
  });
  const refusing = open(memoryStore(), { maxBytes: 100, maxAgeMs: 1_000_000, onFull: "refuse-new" });
  assert((await refusing.enqueue(bytes("x".repeat(60)), { signal: "logs", at: 1_700_000_000_000, count: 1 })).kind === "ok");
  const r = await refusing.enqueue(bytes("y".repeat(60)), { signal: "logs", at: 1_700_000_000_000, count: 1 });
  assert(r.kind === "err" && r.error.kind === "full");
});

proves([S("FR-005"), S("FR-006")], "the rule and the fold are pure over a listing", () => {
  const listing = [
    { id: "a", bytes: 10, at: 0, signal: "logs" as const },
    { id: "b", bytes: 10, at: 900, signal: "metrics" as const },
  ];
  const e = evictions(listing, { maxBytes: 1_000, maxAgeMs: 500, onFull: "drop-oldest" }, 1_000, 5);
  assertEquals(e.remove, [{ id: "a", signal: "logs", reason: "age" }]);
  assertEquals(e.refuse, false);
  assertEquals(statsOf(listing, 1_000), { count: 2, bytes: 20, oldestAgeMs: 1_000 });
  assertEquals(statsOf([], 1_000), { count: 0, bytes: 0, oldestAgeMs: undefined });
  assertEquals(parseSegmentName(segmentName(7, 1_700_000_000_000, "logs")), { sequence: 7, at: 1_700_000_000_000, signal: "logs" });
  assertEquals(parseSegmentName("x.seg"), undefined);
});

proves([S("FR-003"), S("FR-007")], "a store that merges is refused", () => {
  const id = replicaIdOfBytes(new Uint8Array(16).fill(1));
  assert(id.kind === "ok");
  const merging = memoryMergeStore({ name: "m", replica: id.value, clock: () => 1 }).store;
  const q = openQueue(merging as unknown as QueueStore, "queue", POLICY, () => 1);
  assert(q.kind === "err" && q.error.kind === "store");
});
