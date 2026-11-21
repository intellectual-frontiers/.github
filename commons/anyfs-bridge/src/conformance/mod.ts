// Spec: 0005-bridge-conformance FR-001
/**
 * The conformance of a bridge: the laws every pair of stores must keep under the transfers of this library, run against stores made by a function the caller gives. A backend's tests call
 * `runBridgeConformance`, and a failed law says which and how. The laws are the ones a person relies on: a plan changes nothing, a sync is idempotent, a copy never deletes, a check after a sync finds no
 * difference, and a plan that is out of date is refused.
 *
 * @example
 * ```ts
 * import { runBridgeConformance } from "./mod.ts";
 * // const report = await runBridgeConformance(async () => ({ source: memoryStore(), dest: memoryStore() }));
 * ```
 *
 * @module
 */
import { ConformanceFailure } from "@intellectual-frontiers/anyfs/conformance";
import { expectAbsent, expectAny, type Path, parsePath, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { allowDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { apply, type Dest, diff, prepare } from "@intellectual-frontiers/anyfs-bridge/logical";

/** Two stores, empty, made for one law. */
export type Pair = { readonly source: Dest; readonly dest: Dest };
/** What a caller gives: a function that makes a new pair. */
export type MakePair = () => Promise<Pair>;
/** One law, with the capabilities it needs of the destination. */
export type BridgeCase = { readonly id: string; readonly title: string; readonly run: (make: MakePair) => Promise<void> };
/** What one law did. */
export type BridgeCaseReport = { readonly id: string; readonly title: string; readonly failure?: string };

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new ConformanceFailure(r.error);
  return r.value;
};
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const ends = (pair: Pair) => ({ source: { store: pair.source, prefix: ROOT }, dest: { store: pair.dest, prefix: ROOT } });

async function put(store: Dest, path: string, text: string): Promise<void> {
  const r = await store.write(p(path), bytes(text), expectAny as never);
  if (r.kind === "err") throw new ConformanceFailure(`could not make ${path}: ${r.error.kind}`);
}
const need = <T, E>(r: { kind: "ok"; value: T } | { kind: "err"; error: E }, what: string): T => {
  if (r.kind === "err") throw new ConformanceFailure(`${what} did not end well: ${JSON.stringify(r.error)}`);
  return r.value;
};
const listing = async (store: Dest): Promise<readonly string[]> => need(await store.list(ROOT), "a list").entries.map((e) => e.path);

/** Every law of the suite. */
export const BRIDGE_CASES: readonly BridgeCase[] = [
  {
    id: "plan-changes-nothing",
    title: "making a plan changes neither store",
    async run(make) {
      const pair = await make();
      await put(pair.source, "a.txt", "one");
      await put(pair.dest, "z.txt", "extra");
      const before = [await listing(pair.source), await listing(pair.dest)];
      need(await diff({ kind: "sync", deletes: allowDeletes(10) }, ends(pair).source, ends(pair).dest), "a plan");
      const after = [await listing(pair.source), await listing(pair.dest)];
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new ConformanceFailure("a plan changed a store");
    },
  },
  {
    id: "plan-is-deterministic",
    title: "two plans of the same stores have the same hash",
    async run(make) {
      const pair = await make();
      for (const n of ["b", "a", "c/d", "c/a"]) await put(pair.source, `${n}.txt`, n);
      const x = need(await diff({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      const y = need(await diff({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      if (x.hash !== y.hash) throw new ConformanceFailure("the same stores gave two hashes");
    },
  },
  {
    id: "copy-makes-the-destination-hold-the-source",
    title: "a copy makes what the source has, and a check then finds no difference",
    async run(make) {
      const pair = await make();
      for (const n of ["a", "b/c", "b/d/e"]) await put(pair.source, `${n}.txt`, `text of ${n}`);
      const prepared = need(await prepare({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      const report = need(await apply(prepared), "an apply");
      if (report.failed > 0) throw new ConformanceFailure(`${report.failed} actions failed`);
      const check = need(await diff({ kind: "check" }, ends(pair).source, ends(pair).dest), "a check");
      if (check.actions.length > 0) throw new ConformanceFailure(`a check after a copy found ${check.actions.length} differences`);
    },
  },
  {
    id: "copy-never-deletes",
    title: "a copy never plans or makes a delete",
    async run(make) {
      const pair = await make();
      await put(pair.source, "a.txt", "one");
      await put(pair.dest, "only-at-dest.txt", "keep");
      const plan = need(await diff({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      if (plan.actions.some((a) => a.kind === "delete" || a.kind === "rename")) throw new ConformanceFailure("a copy planned a delete");
      need(await apply(need(await prepare({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan")), "an apply");
      if (!(await listing(pair.dest)).includes(p("only-at-dest.txt"))) throw new ConformanceFailure("a copy removed a file of the destination");
    },
  },
  {
    id: "sync-is-idempotent",
    title: "a sync, made twice, plans nothing the second time",
    async run(make) {
      const pair = await make();
      await put(pair.source, "a.txt", "one");
      await put(pair.source, "d/b.txt", "two");
      await put(pair.dest, "a.txt", "different");
      await put(pair.dest, "gone.txt", "extra");
      const mode = { kind: "sync", deletes: allowDeletes(10) } as const;
      need(await apply(need(await prepare(mode, ends(pair).source, ends(pair).dest), "a plan")), "an apply");
      const again = need(await diff(mode, ends(pair).source, ends(pair).dest), "a plan");
      if (again.actions.length > 0) throw new ConformanceFailure(`a second sync planned ${again.actions.length} actions`);
    },
  },
  {
    id: "delete-budget",
    title: "a sync that would delete more than its allowance is refused",
    async run(make) {
      const pair = await make();
      for (const n of ["x", "y", "z"]) await put(pair.dest, `${n}.txt`, n);
      const r = await diff({ kind: "sync", deletes: allowDeletes(2) }, ends(pair).source, ends(pair).dest);
      if (r.kind !== "err" || r.error.kind !== "delete-budget") throw new ConformanceFailure("a plan over the allowance was not refused");
    },
  },
  {
    id: "stale-plan",
    title: "a plan whose source changed after it was made is refused",
    async run(make) {
      const pair = await make();
      await put(pair.source, "a.txt", "one");
      const prepared = need(await prepare({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      await put(pair.source, "a.txt", "two");
      const r = await apply(prepared);
      if (r.kind !== "err" || r.error.kind !== "stale") throw new ConformanceFailure("a stale plan was applied");
    },
  },
  {
    id: "no-overwrite-of-a-concurrent-change",
    title: "an update does not replace a file that changed after the plan, where the destination can tell",
    async run(make) {
      const pair = await make();
      await put(pair.source, "a.txt", "from the source");
      await put(pair.dest, "a.txt", "old");
      if (!pair.dest.capabilities.has("cas")) return;
      const prepared = need(await prepare({ kind: "copy" }, ends(pair).source, ends(pair).dest), "a plan");
      await put(pair.dest, "a.txt", "changed by someone else");
      const r = await apply(prepared, { recheck: false });
      const report = need(r, "an apply");
      if (report.failed !== 1) throw new ConformanceFailure("an update replaced a file that had changed");
      const now = need(await pair.dest.read(p("a.txt")), "a read");
      if (new TextDecoder().decode(now.bytes) !== "changed by someone else") throw new ConformanceFailure("the other writer's change was lost");
      void expectAbsent;
    },
  },
];

/** Runs every law against pairs made by `make`, and reports each. */
export async function runBridgeConformance(make: MakePair): Promise<readonly BridgeCaseReport[]> {
  const reports: BridgeCaseReport[] = [];
  for (const c of BRIDGE_CASES) {
    try {
      await c.run(make);
      reports.push({ id: c.id, title: c.title });
    } catch (thrown) {
      const failure = thrown instanceof ConformanceFailure ? thrown.message : thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
      reports.push({ id: c.id, title: c.title, failure });
    }
  }
  return reports;
}
