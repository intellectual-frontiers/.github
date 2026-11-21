/**
 * The stores of the tests: the store in memory, narrowed to a set of its capabilities, and what a test needs of the library to build a store of its own.
 *
 * @module
 */
import { memoryStore, MEMORY_CAPABILITIES } from "@intellectual-frontiers/anyfs/memory";
import { only, type OpCapability, type Store } from "@intellectual-frontiers/anyfs/logical";

export { carriedCapabilities, makeStore, type OpName, type Store, type Handler, type Op } from "@intellectual-frontiers/anyfs/logical";
export { memoryStore, MEMORY_CAPABILITIES };

/** The store in memory, with all its capabilities or only those named. */
export function memoryStoreOf(name: string): Store<(typeof MEMORY_CAPABILITIES)[number]>;
export function memoryStoreOf<K extends (typeof MEMORY_CAPABILITIES)[number] & OpCapability>(name: string, capabilities: readonly K[]): Store<K>;
export function memoryStoreOf(name: string, capabilities?: readonly (typeof MEMORY_CAPABILITIES)[number][]): Store<(typeof MEMORY_CAPABILITIES)[number]> {
  const s = memoryStore({ name });
  return capabilities === undefined ? s : (only(s, capabilities) as unknown as Store<(typeof MEMORY_CAPABILITIES)[number]>);
}

import type { Result } from "@intellectual-frontiers/core";
import type { Capability, Problem } from "@intellectual-frontiers/anyfs/governance";
import { carriedCapabilities as carried, makeStore as make, type Done, type Handler, type Op } from "@intellectual-frontiers/anyfs/logical";

/** A store whose answers a test may change: the same capabilities, and a hook that sees each operation and the handler of the store beneath. */
export function intercept<C extends Capability>(store: Store<C>, hook: (op: Op, next: Handler) => Promise<Result<Done, Problem>>): Store<C> {
  const wrapped = make({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carried(store),
    handle: (op) => hook(op, store.handle),
  });
  return wrapped as unknown as Store<C>;
}
