/**
 * Tests of the two-way sync and the mirror (commons anyfs-bridge 0004-bridge-twoway FR-001 to FR-008): a base that records what the sides agreed on, a first sync that is said out loud, a change told
 * from a difference, the policies for a path both sides changed, a change that beats a delete, the states of a replica, a convergence that leaves what has diverged, and a promotion that says what is lost.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { allowDeletes, forbidDeletes } from "../src/governance/mod.ts";
import {
  applyBisync,
  type BiOptions,
  type BiPlan,
  converge,
  decodeBase,
  emptyBase,
  emptyLedger,
  encodeBase,
  type Base,
  type Ledger,
  planBisync,
  promote,
  replicaStatus,
  pathState,
} from "../src/logical/mod.ts";
import { at, flaky, get, names, p, put, timed } from "./kit.ts";

const opts = (extra: Partial<BiOptions> = {}): BiOptions => ({ conflict: "newer-wins", deletes: allowDeletes(10), ...extra });
const plan = async (a: ReturnType<typeof timed>, b: ReturnType<typeof timed>, base: Base | { seed: "union" }, o: BiOptions = opts()): Promise<BiPlan> => {
  const r = await planBisync(at(a), at(b), base, o);
  if (r.kind === "err") throw new Error(`no plan: ${JSON.stringify(r.error)}`);
  return r.value;
};
const run = async (a: ReturnType<typeof timed>, b: ReturnType<typeof timed>, base: Base | { seed: "union" }, o: BiOptions = opts()): Promise<{ plan: BiPlan; base: Base }> => {
  const pl = await plan(a, b, base, o);
  const done = await applyBisync(pl, at(a), at(b));
  return { plan: pl, base: done.base };
};
const summary = (pl: BiPlan): readonly string[] => pl.actions.map((x) => `${x.side}:${x.action.kind}:${x.rel}`);

proves(["0004-bridge-twoway FR-001"], "a sync has no default base: a seed agrees on what is equal, copies what is on one side and deletes nothing, and an empty base said out loud does the same", async () => {
  const a = timed("a");
  const b = timed("b");
  await put(a, "equal.txt", "same");
  await put(b, "equal.txt", "same");
  await put(a, "only-a.txt", "a");
  await put(b, "only-b.txt", "b");
  const empty = await plan(a, b, emptyBase);
  assertEquals(summary(empty), ["b:create:only-a.txt", "a:create:only-b.txt"]);
  const seeded = await plan(a, b, { seed: "union" });
  assertEquals(summary(seeded), ["b:create:only-a.txt", "a:create:only-b.txt"]);
  assertEquals(seeded.unchanged, 1);
  assertEquals(seeded.next.entries.size, 3);
  assertEquals(seeded.conflicts, []);
});

proves(["0004-bridge-twoway FR-001"], "a base is kept as pairs in the order of the paths, and a pair that is not a path and a digest is refused", async () => {
  const a = timed("a");
  const b = timed("b");
  await put(a, "z.txt", "z");
  await put(a, "a.txt", "a");
  const { base } = await run(a, b, { seed: "union" });
  const pairs = encodeBase(base);
  assertEquals(pairs.map(([path]) => path), ["a.txt", "z.txt"]);
  const back = decodeBase(pairs);
  assertEquals(back.kind === "ok" && back.value.entries.size, 2);
  assertEquals(decodeBase([["../x", "0".repeat(64)]]).kind, "err");
  assertEquals(decodeBase([["x", "nothex"]]).kind, "err");
});

proves(["0004-bridge-twoway FR-002"], "a change made on one side goes to the other, a change made on both to the same bytes is agreed, and a second sync plans nothing", async () => {
  const a = timed("a");
  const b = timed("b");
  await put(a, "1.txt", "one");
  await put(a, "2.txt", "two");
  await put(a, "3.txt", "three");
  let { base } = await run(a, b, { seed: "union" });
  await put(a, "1.txt", "one, changed at a");
  await put(b, "2.txt", "two, changed at b");
  await put(a, "3.txt", "both the same");
  await put(b, "3.txt", "both the same");
  const next = await run(a, b, base);
  assertEquals(summary(next.plan), ["b:update:1.txt", "a:update:2.txt"]);
  base = next.base;
  assertEquals([await get(b, "1.txt"), await get(a, "2.txt")], ["one, changed at a", "two, changed at b"]);
  assertEquals((await plan(a, b, base)).actions, [], "converged");
});

proves(["0004-bridge-twoway FR-003"], "a path both sides changed is settled by the policy: the newer wins, both are kept, or it fails", async () => {
  const setup = async () => {
    const a = timed("a", Date.UTC(2026, 0, 1));
    const b = timed("b", Date.UTC(2026, 6, 1));
    await put(a, "f.txt", "base");
    const { base } = await run(a, b, { seed: "union" });
    await put(a, "f.txt", "changed at a");
    await put(b, "f.txt", "changed at b, later");
    return { a, b, base };
  };
  {
    const { a, b, base } = await setup();
    const r = await run(a, b, base, opts({ conflict: "newer-wins" }));
    assertEquals(summary(r.plan), ["a:update:f.txt"]);
    assertEquals([await get(a, "f.txt"), await get(b, "f.txt")], ["changed at b, later", "changed at b, later"]);
  }
  {
    const { a, b, base } = await setup();
    const r = await run(a, b, base, opts({ conflict: "keep-both" }));
    const files = await names(b);
    assertEquals(files.filter((n) => n.startsWith("f.conflict-a-")).length, 1, "the loser's bytes are kept at the winner's side");
    assertEquals((await names(a)).filter((n) => n.startsWith("f.conflict-a-")).length, 0);
    assertEquals(r.plan.resolved.length, 1);
    assertEquals(await get(a, "f.txt"), "changed at b, later");
    const again = await run(a, b, r.base, opts({ conflict: "keep-both" }));
    assertEquals(again.plan.actions.length, 1, "the kept copy reaches the other side at the next sync");
    assertEquals((await names(a)).filter((n) => n.startsWith("f.conflict-a-")).length, 1);
  }
  {
    const { a, b, base } = await setup();
    const r = await plan(a, b, base, opts({ conflict: "fail" }));
    assertEquals(r.conflicts.map((c) => c.reason), ["both-changed"]);
    assertEquals(r.actions, []);
    assertEquals(r.next.entries.get(p("f.txt")), base.entries.get(p("f.txt")), "a conflict keeps what the base said");
  }
  {
    const a = timed("a");
    const b = timed("b");
    await put(a, "g.txt", "x");
    const { base } = await run(a, b, { seed: "union" });
    await put(a, "g.txt", "a");
    await put(b, "g.txt", "b");
    const r = await plan(a, b, base, opts({ conflict: "newer-wins" }));
    assertEquals(r.conflicts.length === 0 || r.conflicts[0]?.reason === "both-changed", true);
  }
});

proves(["0004-bridge-twoway FR-004"], "a delete reaches the other side within the allowance, is left where deletes are forbidden, and a change beats a delete", async () => {
  const a = timed("a");
  const b = timed("b");
  for (const n of ["keep", "drop", "edited"]) await put(a, `${n}.txt`, n);
  let { base } = await run(a, b, { seed: "union" });
  await a.delete(p("drop.txt"), { kind: "any" } as never);
  const forbidden = await plan(a, b, base, opts({ deletes: forbidDeletes }));
  assertEquals(summary(forbidden), ["b:skip:drop.txt"]);
  assertEquals(forbidden.next.entries.get(p("drop.txt")), base.entries.get(p("drop.txt")), "the delete is still to be made");
  const over = await planBisync(at(a), at(b), base, opts({ deletes: allowDeletes(0) }));
  assertEquals(over.kind === "err" && over.error.kind, "delete-budget");
  const made = await run(a, b, base);
  assertEquals(summary(made.plan), ["b:delete:drop.txt"]);
  base = made.base;
  assertEquals(await names(b), ["edited.txt", "keep.txt"]);
  await a.delete(p("edited.txt"), { kind: "any" } as never);
  await put(b, "edited.txt", "edited at b");
  const beats = await run(a, b, base);
  assertEquals(summary(beats.plan), ["a:create:edited.txt"]);
  assertEquals(beats.plan.resolved.length, 1);
  assertEquals(await get(a, "edited.txt"), "edited at b");
});

proves(["0004-bridge-twoway FR-004"], "a path whose change did not reach the other side goes back to what the base said, so that the next sync sees it again", async () => {
  const a = timed("a");
  const inner = timed("b");
  await put(a, "1.txt", "one");
  await put(a, "2.txt", "two");
  const { base } = await run(a, inner, { seed: "union" });
  await put(a, "1.txt", "one, changed");
  await put(a, "2.txt", "two, changed");
  const broken = flaky(inner, (op, count) => op.op === "write" && op.path === "1.txt" && count > 0);
  const pl = await planBisync(at(a), at(broken as never), base, opts());
  if (pl.kind === "err") throw new Error("plan");
  const done = await applyBisync(pl.value, at(a), at(broken as never));
  assertEquals(done.b.failed, 1);
  assertEquals(done.base.entries.get(p("1.txt")), base.entries.get(p("1.txt")));
  assert(done.base.entries.get(p("2.txt")) !== base.entries.get(p("2.txt")), "the other path moved on");
});

const replicaOf = async (setup: (p: ReturnType<typeof timed>, r: ReturnType<typeof timed>) => Promise<void>) => {
  const primary = timed("primary");
  const replica = timed("replica");
  await setup(primary, replica);
  return { primary, replica };
};

proves(["0004-bridge-twoway FR-005"], "a path is the same, behind, or diverged, by the bytes of the primary, of the replica and of the ledger", () => {
  assertEquals(pathState("x", "x", undefined), "same");
  assertEquals(pathState("new", undefined, undefined), "behind");
  assertEquals(pathState("new", "old", "old"), "behind");
  assertEquals(pathState(undefined, "old", "old"), "behind", "the primary deleted it");
  assertEquals(pathState("p", "r", "old"), "diverged");
  assertEquals(pathState("p", "foreign", undefined), "diverged", "a file nobody put there");
  assertEquals(pathState("p", undefined, "old"), "diverged", "the replica lost it on its own");
});

proves(["0004-bridge-twoway FR-005", "0004-bridge-twoway FR-006"], "a replica is behind until it is converged, and then in sync; a path changed at the replica is diverged, never overwritten and never merged", async () => {
  const { primary, replica } = await replicaOf(async (pr) => {
    await put(pr, "a.txt", "one");
    await put(pr, "b.txt", "two");
  });
  let ledger: Ledger = emptyLedger;
  const s1 = await replicaStatus(at(primary), at(replica), ledger);
  assertEquals(s1.kind === "ok" && s1.value, { kind: "behind", pending: 2 });
  const c1 = await converge(at(primary), at(replica), ledger, { deletes: allowDeletes(5) });
  if (c1.kind === "err") throw new Error(JSON.stringify(c1.error));
  assertEquals(c1.value.report.failed, 0);
  ledger = c1.value.ledger;
  const s2 = await replicaStatus(at(primary), at(replica), ledger);
  assertEquals(s2.kind === "ok" && s2.value, { kind: "in-sync" });
  await put(primary, "a.txt", "one, changed at the primary");
  await put(replica, "b.txt", "two, edited at the replica");
  await put(primary, "c.txt", "new at the primary");
  const s3 = await replicaStatus(at(primary), at(replica), ledger);
  assertEquals(s3.kind === "ok" && s3.value, { kind: "diverged", paths: [p("b.txt")], pending: 2 });
  const c2 = await converge(at(primary), at(replica), ledger, { deletes: allowDeletes(5) });
  if (c2.kind === "err") throw new Error("converge");
  assertEquals(c2.value.before.kind, "diverged");
  assertEquals([await get(replica, "a.txt"), await get(replica, "b.txt"), await get(replica, "c.txt")], ["one, changed at the primary", "two, edited at the replica", "new at the primary"]);
  assertEquals(c2.value.ledger.applied.get(p("b.txt")), ledger.applied.get(p("b.txt")), "a diverged path keeps the ledger's bytes");
  const s4 = await replicaStatus(at(primary), at(replica), c2.value.ledger);
  assertEquals(s4.kind === "ok" && s4.value, { kind: "diverged", paths: [p("b.txt")], pending: 0 });
});

proves(["0004-bridge-twoway FR-006"], "a delete at the primary reaches the replica within the allowance, and is left where deletes are forbidden", async () => {
  const { primary, replica } = await replicaOf(async (pr) => {
    await put(pr, "a.txt", "a");
    await put(pr, "b.txt", "b");
  });
  const first = await converge(at(primary), at(replica), emptyLedger, { deletes: allowDeletes(5) });
  if (first.kind === "err") throw new Error("converge");
  await primary.delete(p("b.txt"), { kind: "any" } as never);
  const left = await converge(at(primary), at(replica), first.value.ledger, { deletes: forbidDeletes });
  if (left.kind === "err") throw new Error("converge");
  assertEquals(await names(replica), ["a.txt", "b.txt"]);
  const over = await converge(at(primary), at(replica), first.value.ledger, { deletes: allowDeletes(0) });
  assertEquals(over.kind === "err" && over.error.kind, "delete-budget");
  const made = await converge(at(primary), at(replica), first.value.ledger, { deletes: allowDeletes(1) });
  if (made.kind === "err") throw new Error("converge");
  assertEquals(await names(replica), ["a.txt"]);
  assertEquals(made.value.ledger.applied.has(p("b.txt")), false);
});

proves(["0004-bridge-twoway FR-007"], "a replica becomes the primary only as an explicit act: not while it is behind unless the loss is accepted, not while it has diverged unless that is accepted", async () => {
  const { primary, replica } = await replicaOf(async (pr) => {
    await put(pr, "a.txt", "a");
  });
  const c = await converge(at(primary), at(replica), emptyLedger, { deletes: allowDeletes(5) });
  if (c.kind === "err") throw new Error("converge");
  const ok = await promote(at(primary), at(replica), c.value.ledger);
  assertEquals(ok.kind === "ok" && [ok.value.lost, ok.value.primary.store === replica, ok.value.replica.store === primary], [0, true, true]);
  await put(primary, "b.txt", "written at the old primary");
  const behind = await promote(at(primary), at(replica), c.value.ledger);
  assertEquals(behind.kind === "err" && behind.error.kind === "behind" && behind.error.pending, 1);
  const accepted = await promote(at(primary), at(replica), c.value.ledger, { acceptLoss: 1 });
  assertEquals(accepted.kind === "ok" && accepted.value.lost, 1);
  await put(replica, "a.txt", "edited at the replica");
  const diverged = await promote(at(primary), at(replica), c.value.ledger, { acceptLoss: 5 });
  assertEquals(diverged.kind === "err" && diverged.error.kind, "diverged");
  const knowing = await promote(at(primary), at(replica), c.value.ledger, { acceptLoss: 5, acceptDivergence: true });
  assertEquals(knowing.kind === "ok" && knowing.value.lost, 2);
});

proves(["0004-bridge-twoway FR-008"], "after a promotion the old primary is a replica of the new one, and what it holds that the new one does not is diverged until a person decides", async () => {
  const { primary, replica } = await replicaOf(async (pr) => {
    await put(pr, "a.txt", "a");
  });
  const c = await converge(at(primary), at(replica), emptyLedger, { deletes: allowDeletes(5) });
  if (c.kind === "err") throw new Error("converge");
  await put(primary, "late.txt", "written before the failover");
  const promoted = await promote(at(primary), at(replica), c.value.ledger, { acceptLoss: 1 });
  if (promoted.kind === "err") throw new Error("promote");
  const state = await replicaStatus(promoted.value.primary, promoted.value.replica, promoted.value.ledger);
  assertEquals(state.kind === "ok" && state.value, { kind: "diverged", paths: [p("late.txt")], pending: 0 });
  assertEquals(promoted.value.ledger.applied.get(p("a.txt")) !== undefined, true);
});
