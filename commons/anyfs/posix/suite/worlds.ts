/**
 * The worlds the tests run the views in: a store in memory, a store of the five core capabilities alone (no compare-and-write, no rename, no batch), a store in a folder, each with a trace of the operations the
 * store was asked for, and the policies that keep no marker and that keep one.
 *
 * @module
 */
import { carriedCapabilities, makeStore, memoryStoreOf, type OpName, type Store } from "./stores.ts";
import { fs, path as osPath } from "@intellectual-frontiers/system";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { defaultPolicy, keepMarkers, type Policy } from "../src/governance/mod.ts";
import { posix } from "../src/physical/mod.ts";
import type { World } from "../src/logical/conformance/mod.ts";

/** The policy that keeps an empty directory as an object named `.keep`. */
export function keepPolicy(): Policy {
  const m = keepMarkers(".keep");
  if (m.kind === "err") throw new Error(m.error);
  return { ...defaultPolicy(), markers: m.value };
}

/** A store that records the operations it is asked for: the same capabilities, the same answers. */
export function traced<C extends Capability>(store: Store<C>): { readonly store: Store<C>; readonly trace: () => readonly OpName[]; readonly reset: () => void } {
  const seen: OpName[] = [];
  const wrapped = makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      seen.push(op.op);
      return store.handle(op);
    },
  }) as unknown as Store<C>;
  return { store: wrapped, trace: () => [...seen], reset: () => void seen.splice(0, seen.length) };
}

/** A world over a store in memory. */
export function memoryWorld(policy: Policy = defaultPolicy(), withTrace = false): World {
  const s = memoryStoreOf("world");
  if (!withTrace) return { posix: posix(s, { policy }) };
  const t = traced(s);
  return { posix: posix(t.store, { policy }), trace: t.trace, reset: t.reset };
}

/** A world over a store of the five core capabilities. */
export function coreWorld(policy: Policy = defaultPolicy(), withTrace = false): World {
  const s = memoryStoreOf("core", ["read", "write", "list", "stat", "delete"]);
  if (!withTrace) return { posix: posix(s, { policy }) };
  const t = traced(s);
  return { posix: posix(t.store, { policy }), trace: t.trace, reset: t.reset };
}

/** A folder for the worlds in a folder, and a function that removes it. */
export async function folderRoot(): Promise<{ readonly dir: string; readonly done: () => Promise<void> }> {
  const dir = await fs.realPath(await fs.makeTempDir({ prefix: "anyfs-posix-" }));
  return { dir, done: () => fs.remove(dir, { recursive: true }) };
}

/** A world over a store in a new folder below a root. */
export async function localWorld(root: string, n: number, policy: Policy = defaultPolicy()): Promise<World> {
  const dir = osPath.join(root, `w${n}`);
  await fs.mkdir(dir, { recursive: true });
  const s = await localStore(dir);
  if (s.kind === "err") throw new Error(s.error);
  return { posix: posix(s.value, { policy }) };
}
