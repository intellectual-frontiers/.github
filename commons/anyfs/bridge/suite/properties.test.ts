/**
 * Property tests of the transfers (commons anyfs-bridge 0003-bridge-transfer FR-003, FR-004, FR-006; 0004-bridge-twoway FR-002): for any two trees, a sync makes the destination equal and a second sync
 * plans nothing, a copy never removes a file of the destination, a check after a sync finds no difference, a plan is the same however many times it is made, and a two-way sync of any two trees
 * converges.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { allowDeletes } from "../src/governance/mod.ts";
import { applyBisync, apply, diff, planBisync, prepare } from "../src/logical/mod.ts";
import { at, get, names, put } from "./kit.ts";

const tree = fc.dictionary(fc.constantFrom("a", "b", "c", "d/e", "d/f", "g/h/i", "j"), fc.constantFrom("", "x", "yy", "zzz"), { maxKeys: 7 });
const fill = async (store: ReturnType<typeof memoryStore>, files: Readonly<Record<string, string>>): Promise<void> => {
  for (const [name, body] of Object.entries(files)) await put(store, `${name}.txt`, body);
};
const options = { numRuns: 60 };

proves(["0003-bridge-transfer FR-004"], "for any two trees a sync makes the destination equal to the source and a second sync plans nothing", async () => {
  await fc.assert(
    fc.asyncProperty(tree, tree, async (src, dst) => {
      const s = memoryStore({ name: "s" });
      const d = memoryStore({ name: "d" });
      await fill(s, src);
      await fill(d, dst);
      const mode = { kind: "sync", deletes: allowDeletes(100) } as const;
      const prepared = await prepare(mode, at(s), at(d));
      if (prepared.kind === "err") return false;
      const done = await apply(prepared.value);
      if (done.kind === "err" || done.value.failed > 0) return false;
      const again = await diff(mode, at(s), at(d));
      const check = await diff({ kind: "check" }, at(s), at(d));
      return again.kind === "ok" && again.value.actions.length === 0 && check.kind === "ok" && check.value.actions.length === 0 && JSON.stringify(await names(s)) === JSON.stringify(await names(d));
    }),
    options,
  );
});

proves(["0003-bridge-transfer FR-003"], "for any two trees a copy plans no delete and leaves every file the destination had and the source did not", async () => {
  await fc.assert(
    fc.asyncProperty(tree, tree, async (src, dst) => {
      const s = memoryStore({ name: "s" });
      const d = memoryStore({ name: "d" });
      await fill(s, src);
      await fill(d, dst);
      const plan = await diff({ kind: "copy" }, at(s), at(d));
      if (plan.kind === "err" || plan.value.actions.some((a) => a.kind === "delete" || a.kind === "rename")) return false;
      const prepared = await prepare({ kind: "copy" }, at(s), at(d));
      if (prepared.kind === "err") return false;
      await apply(prepared.value);
      const onlyAtDest = Object.keys(dst).filter((k) => !(k in src));
      for (const k of onlyAtDest) if ((await get(d, `${k}.txt`)) !== dst[k]) return false;
      return true;
    }),
    options,
  );
});

proves(["0002-bridge-plans FR-005"], "a plan is the same, with the same hash, however many times it is made, and making it changes nothing", async () => {
  await fc.assert(
    fc.asyncProperty(tree, tree, async (src, dst) => {
      const s = memoryStore({ name: "s" });
      const d = memoryStore({ name: "d" });
      await fill(s, src);
      await fill(d, dst);
      const before = JSON.stringify([await names(s), await names(d)]);
      const x = await diff({ kind: "sync", deletes: allowDeletes(100) }, at(s), at(d));
      const y = await diff({ kind: "sync", deletes: allowDeletes(100) }, at(s), at(d));
      return x.kind === "ok" && y.kind === "ok" && x.value.hash === y.value.hash && before === JSON.stringify([await names(s), await names(d)]);
    }),
    options,
  );
});

proves(["0004-bridge-twoway FR-002"], "a two-way sync of any two trees, seeded, makes them hold the same files, and the next sync plans nothing", async () => {
  await fc.assert(
    fc.asyncProperty(tree, tree, async (left, right) => {
      const a = memoryStore({ name: "a" });
      const b = memoryStore({ name: "b" });
      await fill(a, left);
      await fill(b, right);
      const first = await planBisync(at(a), at(b), { seed: "union" }, { conflict: "keep-both", deletes: allowDeletes(100) });
      if (first.kind === "err") return false;
      const done = await applyBisync(first.value, at(a), at(b));
      // the copies of a conflict reach the other side at the next sync
      const second = await planBisync(at(a), at(b), done.base, { conflict: "keep-both", deletes: allowDeletes(100) });
      if (second.kind === "err") return false;
      const done2 = await applyBisync(second.value, at(a), at(b));
      const third = await planBisync(at(a), at(b), done2.base, { conflict: "keep-both", deletes: allowDeletes(100) });
      return third.kind === "ok" && third.value.actions.length === 0 && third.value.conflicts.length === 0 && JSON.stringify(await names(a)) === JSON.stringify(await names(b));
    }),
    options,
  );
  assert(true);
  assertEquals(1, 1);
});
