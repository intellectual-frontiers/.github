/**
 * Tests of the merge mode (commons anyfs-bridge 0008-bridge-merge-mode FR-001 to FR-005): the plan of a merge between two stores that merge changes nothing and has a hash; applying needs the hash and is refused where the
 * stores have moved; each store takes its delta whole and a second merge has nothing to take; the rails refuse a plan that is too large; a store that trusts only itself is told so and the other direction is still taken.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { applyMerge, describeMergeProblem, planMerge, type Mergeable } from "../src/exchange/mod.ts";
import { memoryMergeStore } from "@intellectual-frontiers/anyfs/memory-merge";
import { memoryCursor } from "../src/exchange/mod.ts";
import { members, type Member, newId, write } from "./exchange.ts";

const store = (m: Member): Mergeable => m.r.store as Mergeable;

proves(["0008-bridge-merge-mode FR-001"], "the plan of a merge holds the vectors, what each takes and a hash, and changes nothing", async () => {
  const [a, b] = members(2) as [Member, Member];
  await write(a, "x.txt", "one");
  await write(b, "y.txt", "two");
  const before = [a.r.stateText(), b.r.stateText()];
  const prepared = await planMerge(store(a), store(b));
  assert(prepared.kind === "ok");
  assertEquals([prepared.value.plan.toA.versions, prepared.value.plan.toB.versions], [1, 1]);
  assertEquals(prepared.value.plan.hash.length, 64);
  assertEquals([a.r.stateText(), b.r.stateText()], before);
  const again = await planMerge(store(a), store(b));
  assert(again.kind === "ok" && again.value.plan.hash === prepared.value.plan.hash, "the same stores make the same plan");
});

proves(["0008-bridge-merge-mode FR-002", "0008-bridge-merge-mode FR-003"], "applying needs the hash of the plan and is refused where the stores moved; each store takes its delta and a second merge has nothing to take", async () => {
  const [a, b] = members(2) as [Member, Member];
  await write(a, "x.txt", "one");
  await write(b, "y.txt", "two");
  const prepared = await planMerge(store(a), store(b));
  assert(prepared.kind === "ok");
  const unapproved = await applyMerge(store(a), store(b), prepared.value, { approved: undefined });
  assert(unapproved.kind === "err" && unapproved.error.kind === "unapproved");
  assert(unapproved.kind === "err" && describeMergeProblem(unapproved.error).includes("needs the hash"));
  await write(a, "z.txt", "three");
  const stale = await applyMerge(store(a), store(b), prepared.value, { approved: prepared.value.plan.hash });
  assert(stale.kind === "err" && stale.error.kind === "stale");
  assertEquals(b.r.viewText().includes("x.txt"), false, "a stale plan changes nothing");
  const fresh = await planMerge(store(a), store(b));
  assert(fresh.kind === "ok");
  const done = await applyMerge(store(a), store(b), fresh.value, { approved: fresh.value.plan.hash });
  assert(done.kind === "ok" && done.value.vectorsEqual);
  assertEquals(a.r.viewText(), b.r.viewText());
  const second = await planMerge(store(a), store(b));
  assert(second.kind === "ok" && second.value.plan.toA.versions === 0 && second.value.plan.toB.versions === 0);
});

proves(["0008-bridge-merge-mode FR-004"], "the rails refuse a plan that is too large, naming the store and the amount", async () => {
  const [a, b] = members(2) as [Member, Member];
  for (let i = 0; i < 4; i++) await write(a, `f${i}.txt`, "x".repeat(100));
  const rows = await planMerge(store(a), store(b), { maxVersions: 3 });
  assert(rows.kind === "err" && rows.error.kind === "rails" && rows.error.which === "b");
  const bytes = await planMerge(store(a), store(b), { maxBytes: 100 });
  assert(bytes.kind === "err" && bytes.error.kind === "rails");
  const fine = await planMerge(store(a), store(b), { maxVersions: 4, maxBytes: 400 });
  assert(fine.kind === "ok");
});

proves(["0008-bridge-merge-mode FR-005"], "a store that trusts only itself says so, and the other direction is still taken", async () => {
  const ia = newId();
  const ib = newId();
  const a: Member = { r: memoryMergeStore({ name: "a", replica: ia, trust: { kind: "allowlist", replicas: new Set([ia, ib]) } }), self: ia, cursor: memoryCursor() };
  const b: Member = { r: memoryMergeStore({ name: "b", replica: ib, trust: { kind: "allowlist", replicas: new Set([ib]) } }), self: ib, cursor: memoryCursor() };
  await write(a, "x.txt", "one");
  await write(b, "y.txt", "two");
  const prepared = await planMerge(store(a), store(b));
  assert(prepared.kind === "ok");
  const done = await applyMerge(store(a), store(b), prepared.value, { approved: prepared.value.plan.hash });
  assert(done.kind === "ok");
  assertEquals(done.value.toB?.kind, "refused", "b does not trust a");
  assertEquals(done.value.toA?.kind, "applied", "a trusts b, so that direction is taken");
  assertEquals(done.value.vectorsEqual, false);
});
