/**
 * Tests of the transfers of the bridge (commons anyfs-bridge 0003-bridge-transfer FR-001 to FR-012): the inventory of an endpoint, the ladder of comparators, copy, sync with its allowance of deletes,
 * move, check, collisions, losses and renames, and the apply with its refusals, its guarded writes, its checks of what it wrote, its batch, its journal and its events.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { expectAny, parsePrefix, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { only } from "@intellectual-frontiers/anyfs/logical";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { allowDeletes, forbidDeletes, parseGlob, type Action, type Glob, type Plan } from "../src/governance/mod.ts";
import { apply, applyStream, compare, diff, digestOf, identity, inventory, keepOf, memoryDigestCache, memoryJournal, prepare, type ApplyEvent, type Dest } from "../src/logical/mod.ts";
import { at, decode, flaky, get, liar, names, opaque, p, put, timed, withTraits } from "./kit.ts";

const g = (t: string): Glob => {
  const r = parseGlob(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const planOf = async (...args: Parameters<typeof diff>): Promise<Plan> => {
  const r = await diff(...args);
  if (r.kind === "err") throw new Error(`no plan: ${JSON.stringify(r.error)}`);
  return r.value;
};
const kinds = (plan: Plan): readonly string[] => plan.actions.map((a) => `${a.kind}:${a.kind === "rename" ? a.to : a.kind === "remove-source" ? a.rel : a.target}`);
const doApply = async (...args: Parameters<typeof prepare>) => {
  const prepared = await prepare(...args);
  if (prepared.kind === "err") throw new Error(JSON.stringify(prepared.error));
  const r = await apply(prepared.value);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0003-bridge-transfer FR-001"], "an inventory pages through the store, keeps what the filter keeps, rewrites the names and lists them in the order of the target", async () => {
  const s = memoryStore();
  for (const n of ["b.txt", "a.tmp", "d/x.txt", "d/y.tmp", "c.txt"]) await put(s, n, n);
  const pre = parsePrefix("d");
  if (pre.kind === "err") throw new Error(pre.error);
  const all = await inventory(s, ROOT, { keep: keepOf({ exclude: [g("*.tmp")] }), rewrite: identity, pageSize: 2 });
  assertEquals(all.kind === "ok" && all.value.map((e) => String(e.rel)), ["b.txt", "c.txt", "d/x.txt"]);
  const under = await inventory(s, pre.value, { keep: () => true, rewrite: identity, pageSize: 1 });
  assertEquals(under.kind === "ok" && under.value.map((e) => String(e.rel)), ["x.txt", "y.tmp"]);
  const bad = await inventory(s, ROOT, { keep: () => true, rewrite: (rel) => (rel === "c.txt" ? err("not this one") : { kind: "ok", value: rel }), pageSize: 10 });
  assertEquals(bad.kind === "err" && bad.error.kind === "rewrite", true);
  const failing = flaky(s, () => true);
  assertEquals((await inventory(failing, ROOT, { keep: () => true, rewrite: identity, pageSize: 10 })).kind, "err");
});

proves(["0003-bridge-transfer FR-002"], "the ladder decides by the revisions where both are hashes, by the size and time where allowed, and by the bytes otherwise, and says what decided", async () => {
  const a = timed("a");
  const b = timed("b", Date.UTC(2026, 5, 1));
  await put(a, "x", "same");
  await put(b, "x", "same");
  await put(a, "y", "one");
  await put(b, "y", "two");
  const side = async (s: Dest, path: string) => {
    const r = await s.stat(p(path));
    if (r.kind === "err") throw new Error("stat");
    return { store: s, stat: r.value };
  };
  const eq = await compare(await side(a, "x"), await side(b, "x"), ["native-digest", "content-hash"]);
  assertEquals(eq.kind === "ok" && eq.value, { same: true, by: "native-digest" });
  const ne = await compare(await side(a, "y"), await side(b, "y"), ["native-digest", "content-hash"]);
  assertEquals(ne.kind === "ok" && ne.value, { same: false, by: "native-digest" });
  const sized = await compare(await side(a, "y"), await side(b, "x"), ["size-mtime"]);
  assertEquals(sized.kind === "ok" && sized.value, { same: false, by: "size" }, "the sizes differ: they cannot be the same");
  const weak = await compare(await side(a, "y"), await side(b, "y"), ["size-mtime"]);
  assertEquals(weak.kind === "ok" && weak.value.by, "undecided", "equal sizes and no common time: it does not say");
  const o = opaque(b);
  await put(o, "z", "same");
  await put(a, "z", "same");
  const cache = memoryDigestCache();
  const bytes = await compare(await side(a, "z"), await side(o, "z"), ["native-digest", "content-hash"], cache);
  assertEquals(bytes.kind === "ok" && bytes.value, { same: true, by: "content-hash" }, "revisions that are not hashes pass to the bytes");
  const d = await digestOf(await side(o, "z"), cache);
  assertEquals(d.kind, "ok");
  const none = await compare(await side(a, "y"), await side(o, "z"), []);
  assertEquals(none.kind === "ok" && none.value, { same: false, by: "undecided" }, "no comparator, so the files are copied again");
});

proves(["0003-bridge-transfer FR-003"], "a copy creates what is missing, updates what differs, counts what is equal, and plans no delete", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "new.txt", "n");
  await put(s, "same.txt", "s");
  await put(s, "diff.txt", "from source");
  await put(d, "same.txt", "s");
  await put(d, "diff.txt", "old");
  await put(d, "extra.txt", "x");
  const plan = await planOf({ kind: "copy" }, at(s), at(d));
  assertEquals(kinds(plan), ["create:new.txt", "update:diff.txt"].sort((x, y) => (x < y ? -1 : 1)).sort((x) => (x.startsWith("create") ? -1 : 1)));
  assertEquals(plan.unchanged, 1);
  assertEquals(plan.carries, ["bytes"]);
  assertEquals(plan.bytes, "n".length + "from source".length);
  const update = plan.actions.find((a): a is Extract<Action, { kind: "update" }> => a.kind === "update");
  assertEquals(update?.decided, "native-digest");
  assertEquals(plan.actions.find((a) => a.kind === "create")?.kind === "create" && plan.actions.find((a) => a.kind === "create") !== undefined, true);
  const report = await doApply({ kind: "copy" }, at(s), at(d));
  assertEquals([report.done, report.failed], [2, 0]);
  assertEquals([await get(d, "new.txt"), await get(d, "diff.txt"), await get(d, "extra.txt")], ["n", "from source", "x"]);
});

proves(["0003-bridge-transfer FR-004"], "a sync deletes only within its allowance, shows what it leaves, and is refused where it would delete more", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "a.txt", "a");
  for (const n of ["x.txt", "y.txt", "keep/z.txt"]) await put(d, n, n);
  const forbid = await planOf({ kind: "sync", deletes: forbidDeletes }, at(s), at(d));
  assertEquals(kinds(forbid), ["create:a.txt", "skip:keep/z.txt", "skip:x.txt", "skip:y.txt"]);
  assert(forbid.actions.filter((a) => a.kind === "skip").every((a) => a.kind === "skip" && a.reason === "delete-not-allowed"));
  const allowed = await planOf({ kind: "sync", deletes: allowDeletes(3) }, at(s), at(d), { rails: { protect: [g("keep/**")] } });
  assertEquals(kinds(allowed), ["create:a.txt", "delete:x.txt", "delete:y.txt", "skip:keep/z.txt"]);
  const over = await diff({ kind: "sync", deletes: allowDeletes(1) }, at(s), at(d));
  assertEquals(over.kind === "err" && over.error.kind === "delete-budget" && [over.error.wanted, over.error.max], [3, 1]);
  const report = await doApply({ kind: "sync", deletes: allowDeletes(5) }, at(s), at(d));
  assertEquals(report.failed, 0);
  assertEquals(await names(d), ["a.txt"]);
  assertEquals((await planOf({ kind: "sync", deletes: allowDeletes(5) }, at(s), at(d))).actions, []);
});

proves(["0003-bridge-transfer FR-005"], "a move copies, then removes the source only where the copy is at the destination, and needs a sure comparator and a source that can delete", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "a.txt", "a");
  await put(s, "b.txt", "b");
  await put(d, "b.txt", "b");
  const plan = await planOf({ kind: "move" }, at(s), at(d));
  assertEquals(kinds(plan), ["create:a.txt", "remove-source:a.txt", "remove-source:b.txt"]);
  const weak = await diff({ kind: "move" }, at(s), at(d), { comparators: ["size-mtime"] });
  assertEquals(weak.kind === "err" && weak.error.kind, "capability");
  const readOnly = only(s, ["read", "list", "stat"]);
  const noDelete = await diff({ kind: "move" } as never, at(readOnly) as never, at(d) as never);
  assertEquals(noDelete.kind === "err" && noDelete.error.kind, "capability");
  const report = await doApply({ kind: "move" }, at(s), at(d));
  assertEquals(report.failed, 0);
  assertEquals([await names(s), await names(d)], [[], ["a.txt", "b.txt"]]);
  // a copy that fails leaves its source where it is
  const s2 = memoryStore({ name: "s2" });
  await put(s2, "a.txt", "a");
  const broken = flaky(memoryStore({ name: "d2" }), (op) => op.op === "write");
  const failed = await doApply({ kind: "move" }, at(s2), at(broken));
  assertEquals([failed.failed, failed.skipped], [1, 1]);
  assertEquals(await names(s2), ["a.txt"]);
});

proves(["0003-bridge-transfer FR-006"], "a check lists the differences, protected files are left out of it, and it cannot be applied", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "a", "1");
  await put(s, "b", "2");
  await put(d, "b", "other");
  await put(d, "c", "3");
  await put(d, "p/q", "protected");
  const plan = await planOf({ kind: "check" }, at(s), at(only(d, ["read", "list", "stat"])), { rails: {} });
  assertEquals(kinds(plan), ["create:a", "update:b", "delete:c", "delete:p/q"]);
  const kept = await planOf({ kind: "check" }, at(s), at(d), { rails: { protect: [g("p/**")] } });
  assertEquals(kinds(kept), ["create:a", "update:b", "delete:c", "skip:p/q"]);
  const prepared = await prepare({ kind: "check" }, at(s), at(d));
  assertEquals(prepared.kind, "ok");
  if (prepared.kind === "ok") {
    const r = await apply(prepared.value);
    assertEquals(r.kind === "err" && r.error.kind, "not-applicable");
  }
});

proves(["0003-bridge-transfer FR-007", "0002-bridge-plans FR-004"], "two files that would become one are a conflict, a name the destination folds is a loss, and a file the destination cannot hold is left", async () => {
  const s = memoryStore({ name: "s" });
  await put(s, "A.txt", "upper");
  await put(s, "a.txt", "lower");
  await put(s, "big.bin", "0123456789");
  await put(s, "ok.txt", "ok");
  const folding = withTraits(memoryStore({ name: "d" }), { caseSensitive: false, maxObject: 5 });
  const plan = await planOf({ kind: "copy" }, at(s), at(folding));
  assertEquals(kinds(plan), ["create:ok.txt", "skip:big.bin", "conflict:A.txt", "conflict:a.txt"]);
  assertEquals(plan.actions.filter((a) => a.kind === "conflict").every((a) => a.kind === "conflict" && a.reason === "case-collision"), true);
  assertEquals(plan.losses.map((l) => l.kind), ["too-large"]);
  const strict = await diff({ kind: "copy" }, at(s), at(folding), { strict: true });
  assertEquals(strict.kind === "err" && strict.error.kind, "lossy");
  const same = await diff({ kind: "copy" }, at(s), at(memoryStore({ name: "e" })), { rewrite: () => ({ kind: "ok", value: p("one") }) });
  assertEquals(same.kind === "ok" && same.value.actions.every((a) => a.kind === "conflict" && a.reason === "target-collision"), true);
  const folded = memoryStore({ name: "f" });
  await put(folded, "OK.TXT", "old");
  const known = await planOf({ kind: "copy" }, at(memoryStore({ name: "g" })), at(folded));
  assertEquals(known.actions, []);
  const src2 = memoryStore({ name: "h" });
  await put(src2, "ok.txt", "new");
  const caseDest = withTraits(folded, { caseSensitive: false });
  const update = await planOf({ kind: "copy" }, at(src2), at(caseDest));
  assertEquals(update.losses.map((l) => l.kind), ["case-folded"]);
});

proves(["0003-bridge-transfer FR-007"], "a sync renames a file at the destination that has the content of a missing one, where the destination can rename", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "new-name.txt", "the same bytes");
  await put(d, "old-name.txt", "the same bytes");
  const plan = await planOf({ kind: "sync", deletes: allowDeletes(5) }, at(s), at(d));
  assertEquals(kinds(plan), ["rename:new-name.txt"]);
  const report = await doApply({ kind: "sync", deletes: allowDeletes(5) }, at(s), at(d));
  assertEquals(report.failed, 0);
  assertEquals(await names(d), ["new-name.txt"]);
  const without = await planOf({ kind: "sync", deletes: allowDeletes(5) }, at(s), at(memoryStore({ name: "e" })), { renames: false });
  assertEquals(kinds(without), ["create:new-name.txt"]);
});

proves(["0003-bridge-transfer FR-003", "0002-bridge-plans FR-003"], "the rails: include, exclude, never overwrite, the largest file, files and bytes, and an empty destination", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  for (const n of ["a.txt", "b.log", "c.txt", "sub/d.txt"]) await put(s, n, n);
  await put(d, "c.txt", "different");
  const base = { kind: "copy" } as const;
  assertEquals(kinds(await planOf(base, at(s), at(d), { rails: { include: [g("*.txt")], exclude: [g("sub")] } })), ["create:a.txt", "update:c.txt"]);
  assertEquals(kinds(await planOf(base, at(s), at(d), { rails: { neverOverwrite: true, exclude: [g("*.log")] } })), ["create:a.txt", "create:sub/d.txt", "skip:c.txt"]);
  assertEquals(kinds(await planOf(base, at(s), at(d), { rails: { maxObjectBytes: 5 } })).filter((k) => k.startsWith("skip")), ["skip:sub/d.txt"]);
  const files = await diff(base, at(s), at(d), { rails: { maxFiles: 2 } });
  assertEquals(files.kind === "err" && files.error.kind === "rails" && files.error.reason, "max-files");
  const bytes = await diff(base, at(s), at(d), { rails: { maxBytes: 3 } });
  assertEquals(bytes.kind === "err" && bytes.error.kind === "rails" && bytes.error.reason, "max-bytes");
  const notEmpty = await diff(base, at(s), at(d), { rails: { requireEmptyDestination: true } });
  assertEquals(notEmpty.kind === "err" && notEmpty.error.kind === "rails" && notEmpty.error.reason, "destination-not-empty");
  assertEquals((await diff(base, at(s), at(memoryStore({ name: "e" })), { rails: { requireEmptyDestination: true } })).kind, "ok");
});

proves(["0003-bridge-transfer FR-008"], "an apply is refused for a plan that is not the one approved, one the stores no longer make, or one with conflicts", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "a.txt", "one");
  const prepared = await prepare({ kind: "copy" }, at(s), at(d));
  if (prepared.kind === "err") throw new Error("plan");
  const wrong = await apply(prepared.value, { approved: "0".repeat(64) as never });
  assertEquals(wrong.kind === "err" && wrong.error.kind, "stale");
  const approved = await apply(prepared.value, { approved: prepared.value.plan.hash, recheck: true });
  assertEquals(approved.kind, "ok");
  const prepared2 = await prepare({ kind: "copy" }, at(s), at(memoryStore({ name: "d2" })));
  if (prepared2.kind === "err") throw new Error("plan");
  await put(s, "a.txt", "two");
  const stale = await apply(prepared2.value);
  assertEquals(stale.kind === "err" && stale.error.kind, "stale");
  const skipped = await apply(prepared2.value, { recheck: false });
  assertEquals(skipped.kind === "ok" && skipped.value.failed, 1, "without a recheck, the source that moved is found when it is read");
  assertEquals(skipped.kind === "ok" && skipped.value.outcomes[0]?.failure?.kind, "stale-source");
  const c = memoryStore({ name: "c" });
  await put(c, "A", "1");
  await put(c, "a", "2");
  const conflicted = await prepare({ kind: "copy" }, at(c), at(withTraits(memoryStore({ name: "ci" }), { caseSensitive: false })));
  if (conflicted.kind === "err") throw new Error("plan");
  const refused = await apply(conflicted.value);
  assertEquals(refused.kind === "err" && refused.error.kind, "conflicts");
  const partial = await apply(conflicted.value, { skipConflicts: true });
  assertEquals(partial.kind === "ok" && partial.value.skipped, 2);
});

proves(["0003-bridge-transfer FR-009"], "a write expects the revision the plan saw where the destination can tell, so a change made since is a conflict and not an overwrite; where it cannot, the report says so", async () => {
  const s = memoryStore({ name: "s" });
  const d = memoryStore({ name: "d" });
  await put(s, "a.txt", "from source");
  await put(d, "a.txt", "old");
  const prepared = await prepare({ kind: "copy" }, at(s), at(d));
  if (prepared.kind === "err") throw new Error("plan");
  await put(d, "a.txt", "changed by someone else");
  const r = await apply(prepared.value, { recheck: false });
  assertEquals(r.kind === "ok" && [r.value.failed, r.value.outcomes[0]?.failure?.kind === "problem" && r.value.outcomes[0].failure.problem.kind], [1, "conflict"]);
  assertEquals(await get(d, "a.txt"), "changed by someone else");
  const plain = only(memoryStore({ name: "p" }), ["read", "write", "list", "stat", "delete"]);
  await put(plain, "a.txt", "old");
  const done = await doApply({ kind: "copy" }, at(s), at(plain as unknown as Dest));
  assertEquals([done.done, done.unguarded], [1, 1]);
  const created = await doApply({ kind: "copy" }, at(s), at(memoryStore({ name: "n" })));
  assertEquals([created.done, created.unguarded], [1, 0], "a create expects that there is no object");
});

proves(["0003-bridge-transfer FR-010"], "what is written is checked: by the revision where it is the hash, by reading it back otherwise, and a store that keeps other bytes is found", async () => {
  const s = memoryStore({ name: "s" });
  await put(s, "a.txt", "text");
  const hashed = await doApply({ kind: "copy" }, at(s), at(memoryStore({ name: "h" })));
  assertEquals(hashed.outcomes[0]?.verified, "verified");
  const opaqueDest = opaque(memoryStore({ name: "o" }));
  const back = await doApply({ kind: "copy" }, at(s), at(opaqueDest));
  assertEquals(back.outcomes[0]?.verified, "verified");
  const prepared = await prepare({ kind: "copy" }, at(s), at(memoryStore({ name: "n" })));
  if (prepared.kind === "err") throw new Error("plan");
  const none = await apply(prepared.value, { verify: "none" });
  assertEquals(none.kind === "ok" && none.value.outcomes[0]?.verified, "unverifiable");
  const lying = await doApply({ kind: "copy" }, at(s), at(liar(memoryStore({ name: "l" }))));
  assertEquals([lying.failed, lying.outcomes[0]?.failure?.kind], [1, "mismatch"]);
  const lyingOpaque = await doApply({ kind: "copy" }, at(s), at(liar(opaque(memoryStore({ name: "lo" })))));
  assertEquals(lyingOpaque.outcomes[0]?.failure?.kind, "mismatch");
});

proves(["0003-bridge-transfer FR-011"], "with a destination that has a batch and the caller asking for it, the writes and deletes are one batch: all or none", async () => {
  const s = memoryStore({ name: "s" });
  for (const n of ["a", "b", "c"]) await put(s, `${n}.txt`, n);
  const d = memoryStore({ name: "d" });
  await put(d, "gone.txt", "x");
  const mode = { kind: "sync", deletes: allowDeletes(5) } as const;
  const prepared = await prepare(mode, at(s), at(d));
  if (prepared.kind === "err") throw new Error("plan");
  const r = await apply(prepared.value, { atomic: true });
  assertEquals(r.kind === "ok" && [r.value.done, r.value.failed], [4, 0]);
  assertEquals(await names(d), ["a.txt", "b.txt", "c.txt"]);
  // one change that cannot be made stops all of them
  const e = memoryStore({ name: "e" });
  await put(e, "a.txt", "old");
  const prepared2 = await prepare({ kind: "copy" }, at(s), at(e));
  if (prepared2.kind === "err") throw new Error("plan");
  await put(e, "a.txt", "changed");
  const failing = await apply(prepared2.value, { atomic: true, recheck: false });
  assertEquals(failing.kind === "ok" && failing.value.failed, 3, "one conflict makes the whole batch fail");
  assertEquals(await names(e), ["a.txt"], "nothing was written");
  void expectAny;
});

proves(["0003-bridge-transfer FR-012"], "a journal lets an apply that stopped go on, skipping what is done", async () => {
  const s = memoryStore({ name: "s" });
  for (const n of ["a", "b", "c", "d"]) await put(s, `${n}.txt`, n);
  const inner = memoryStore({ name: "d" });
  const prepared1 = await prepare({ kind: "copy" }, at(s), at(flaky(inner, (op, count) => op.op === "write" && count > 4)));
  if (prepared1.kind === "err") throw new Error("plan");
  const journal = memoryJournal();
  const first = await apply(prepared1.value, { journal, concurrency: 1, recheck: false });
  assertEquals(first.kind === "ok" && first.value.failed > 0, true);
  const doneFirst = journal.keys().length;
  assert(doneFirst > 0 && doneFirst < 4, "some are done and some are not");
  const prepared2 = await prepare({ kind: "copy" }, at(s), at(inner));
  if (prepared2.kind === "err") throw new Error("plan");
  const second = await apply({ ...prepared2.value, plan: prepared1.value.plan }, { journal, resume: true });
  assertEquals(second.kind === "ok" && [second.value.failed, second.value.skipped > 0], [0, true]);
  assertEquals((await names(inner)).length, 4);
});

proves(["0003-bridge-transfer FR-012"], "an apply tells what it does as events, with at most the allowed number of actions at once, and ends with its report", async () => {
  const s = memoryStore({ name: "s" });
  for (let i = 0; i < 8; i++) await put(s, `f${i}.txt`, `${i}`);
  let running = 0;
  let most = 0;
  const inner = memoryStore({ name: "d" });
  const slow = flaky(inner, () => false);
  const watched = { ...slow, handle: slow.handle } as Dest;
  const wrapped = new Proxy(watched, {
    get(target, key, receiver) {
      if (key === "handle")
        return async (op: Parameters<Dest["handle"]>[0]) => {
          if (op.op === "write") {
            running++;
            most = Math.max(most, running);
            await new Promise((resolve) => setTimeout(resolve, 5));
            const r = await target.handle(op);
            running--;
            return r;
          }
          return target.handle(op);
        };
      return Reflect.get(target, key, receiver);
    },
  });
  const prepared = await prepare({ kind: "copy" }, at(s), at(wrapped as Dest));
  if (prepared.kind === "err") throw new Error("plan");
  const started = await applyStream(prepared.value, { concurrency: 3 });
  if (started.kind === "err") throw new Error("start");
  const events: ApplyEvent[] = [];
  for await (const e of started.value) events.push(e);
  assertEquals(events[0]?.kind, "planned");
  assertEquals(events.at(-1)?.kind, "finished");
  assertEquals(events.filter((e) => e.kind === "started").length, 8);
  assertEquals(events.filter((e) => e.kind === "outcome").length, 8);
  void decode;
  void timed;
  assert(most <= 3, `at most 3 at once, saw ${most}`);
});
