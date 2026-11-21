// Spec: 0003-anyfs-logical FR-002
/**
 * The store: one interface to a place, whose capabilities are in its type. `Store<C>` has the methods of the capabilities `C` and no other, and a function that needs a capability takes a `Store` that has it,
 * so that a store without it is a compile error and not a surprise at run time. A store is made by `makeStore` from one handler of operations: the store is a facade, so that every layer and every
 * attenuation is a function of operations and none can be bypassed.
 *
 * @remarks
 * The one cast of the library is in `makeStore`: it builds the object from the capabilities it is given and gives it the type those capabilities say. A test holds it: a store has a method exactly where its
 * capabilities name one. `watch` and `lock` are capabilities with no operation, so `makeStore` makes no store of them yet.
 *
 * @example
 * ```ts
 * import { makeStore } from "./store.ts";
 * // a store of `read` alone: store.write does not exist, and a function that needs `write` refuses it
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Capability,
  type Consistency,
  type Cursor,
  type Delta,
  type ExpectFor,
  type MergeOutcome,
  type VersionVector,
  type Path,
  type Place,
  type Prefix,
  type Problem,
  refused,
  type Traits,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import {
  type BatchWritten,
  type Change,
  type Deleted,
  type Done,
  type Handler,
  type Hits,
  type MergeAnswer,
  type ListOptions,
  type Listing,
  type Op,
  type Ranged,
  type Read,
  type Stat,
  type Versions,
  type Written,
  capabilitiesNeeded,
} from "./ops.ts";

/** The capabilities that have an operation: every one but `watch` and `lock`. */
export type OpCapability = Exclude<Capability, "watch" | "lock">;

/** The change of an object a watcher is told of. */
export type Changed = { readonly path: Path; readonly kind: "put" | "delete" };
/** A watch: stop it with `stop`. */
export type Subscription = { stop(): void };
/** A held object: give it back with `release`. */
export type Lock = { release(): Promise<void> };

/** The methods one capability adds, for a store of the capabilities `C`: where `C` has `cas`, a change may expect a revision. */
type Group<K extends Capability, C extends Capability> = K extends "read"
  ? { read(path: Path): Promise<Result<Read, Problem>> }
  : K extends "write"
    ? { write(path: Path, bytes: Uint8Array, expect: ExpectFor<C>): Promise<Result<Written, Problem>> }
    : K extends "list"
      ? { list(prefix: Prefix, options?: ListOptions): Promise<Result<Listing, Problem>> }
      : K extends "stat"
        ? { stat(path: Path): Promise<Result<Stat, Problem>> }
        : K extends "delete"
          ? { delete(path: Path, expect: ExpectFor<C>): Promise<Result<Deleted, Problem>> }
          : K extends "cas"
            ? { readonly cas: true }
            : K extends "batch"
              ? { batch(changes: readonly Change<ExpectFor<C>>[]): Promise<Result<BatchWritten, Problem>> }
              : K extends "rename"
                ? { rename(from: Path, to: Path, expect: ExpectFor<C>): Promise<Result<Written, Problem>> }
                : K extends "history"
                  ? { history(path: Path, limit?: number): Promise<Result<Versions, Problem>> }
                  : K extends "rangeRead"
                    ? { readRange(path: Path, start: number, length: number): Promise<Result<Ranged, Problem>> }
                    : K extends "append"
                      ? { append(path: Path, bytes: Uint8Array, expect: ExpectFor<C>): Promise<Result<Written, Problem>> }
                      : K extends "search"
                        ? { search(prefix: Prefix, text: string, limit?: number): Promise<Result<Hits, Problem>> }
                        : K extends "merge"
                          ? {
                              versionVector(): Promise<Result<VersionVector, Problem>>;
                              deltaSince(since: VersionVector): Promise<Result<Delta, Problem>>;
                              applyDelta(delta: Delta): Promise<Result<MergeOutcome, Problem>>;
                            }
                        : K extends "watch"
                          ? { watch(prefix: Prefix, listener: (change: Changed) => void): Promise<Result<Subscription, Problem>> }
                          : K extends "lock"
                            ? { lock(path: Path): Promise<Result<Lock, Problem>> }
                            : never;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/** What every store has, whatever its capabilities. */
export type StoreBase = {
  /** What the store is called in a finding. */
  readonly id: string;
  /** Where it is. */
  readonly place: Place;
  readonly consistency: Consistency;
  readonly traits: Traits;
  /** The capabilities it has, as a set a program can read; the type says the same at compile time. */
  readonly capabilities: ReadonlySet<Capability>;
  /** Every operation goes through here, after the check that the store has what it needs. */
  readonly handle: Handler;
};

/**
 * A store with the capabilities `C`: it has their methods and no other. The optional marker is a function of `C` and never present at run time: it lets the compiler read `C` back from a store (so that
 * `readOnly(store)` of a store in memory is a store of the capabilities of memory) and keeps a store of more capabilities assignable to a store of fewer.
 */
export type Store<C extends Capability> = StoreBase & UnionToIntersection<{ [K in C]: Group<K, C> }[C]> & { readonly "@anyfs/capabilities"?: (capability: C) => void };

/** Any store, whatever its capabilities: what a function that only handles operations takes. */
export type AnyStore = StoreBase;

/** What a store is made from. */
export type StoreSpec<C extends OpCapability> = {
  readonly id: string;
  readonly place: Place;
  readonly consistency: Consistency;
  readonly traits: Traits;
  readonly capabilities: readonly C[];
  readonly handle: Handler;
};

const mismatch = (wanted: string, got: string): Problem => unavailable(`the backend answered ${got} to ${wanted}`, false);

const pick = <T>(r: Result<Done, Problem>, wanted: Op["op"], get: (d: Done) => T | undefined): Result<T, Problem> => {
  if (r.kind === "err") return r;
  const v = get(r.value);
  return v === undefined ? err(mismatch(wanted, r.value.op)) : ok(v);
};

type Call = (op: Op) => Promise<Result<Done, Problem>>;

const pickMerge = <T>(r: Result<Done, Problem>, wanted: string, get: (a: MergeAnswer) => T | undefined): Result<T, Problem> => {
  if (r.kind === "err") return r;
  const v = r.value.op === "merge" ? get(r.value.value) : undefined;
  return v === undefined ? err(mismatch(`merge ${wanted}`, r.value.op)) : ok(v);
};

const METHODS: { readonly [K in OpCapability]: (call: Call) => Readonly<Record<string, unknown>> } = {
  read: (call) => ({ read: async (path: Path) => pick(await call({ op: "read", path }), "read", (d) => (d.op === "read" ? d.value : undefined)) }),
  write: (call) => ({ write: async (path: Path, bytes: Uint8Array, expect: Parameters<Group<"write", "cas">["write"]>[2]) => pick(await call({ op: "write", path, bytes, expect }), "write", (d) => (d.op === "write" ? d.value : undefined)) }),
  list: (call) => ({
    list: async (prefix: Prefix, options: ListOptions = {}) =>
      pick(
        await call({ op: "list", prefix, ...(options.limit === undefined ? {} : { limit: options.limit }), ...(options.after === undefined ? {} : { after: options.after as Cursor }) }),
        "list",
        (d) => (d.op === "list" ? d.value : undefined),
      ),
  }),
  stat: (call) => ({ stat: async (path: Path) => pick(await call({ op: "stat", path }), "stat", (d) => (d.op === "stat" ? d.value : undefined)) }),
  delete: (call) => ({ delete: async (path: Path, expect: Parameters<Group<"delete", "cas">["delete"]>[1]) => pick(await call({ op: "delete", path, expect }), "delete", (d) => (d.op === "delete" ? d.value : undefined)) }),
  cas: () => ({ cas: true }),
  batch: (call) => ({ batch: async (changes: readonly Change[]) => pick(await call({ op: "batch", changes }), "batch", (d) => (d.op === "batch" ? d.value : undefined)) }),
  rename: (call) => ({ rename: async (from: Path, to: Path, expect: Parameters<Group<"rename", "cas">["rename"]>[2]) => pick(await call({ op: "rename", from, to, expect }), "rename", (d) => (d.op === "rename" ? d.value : undefined)) }),
  history: (call) => ({ history: async (path: Path, limit?: number) => pick(await call({ op: "history", path, ...(limit === undefined ? {} : { limit }) }), "history", (d) => (d.op === "history" ? d.value : undefined)) }),
  rangeRead: (call) => ({ readRange: async (path: Path, start: number, length: number) => pick(await call({ op: "rangeRead", path, start, length }), "rangeRead", (d) => (d.op === "rangeRead" ? d.value : undefined)) }),
  append: (call) => ({ append: async (path: Path, bytes: Uint8Array, expect: Parameters<Group<"append", "cas">["append"]>[2]) => pick(await call({ op: "append", path, bytes, expect }), "append", (d) => (d.op === "append" ? d.value : undefined)) }),
  merge: (call) => ({
    versionVector: async () => pickMerge(await call({ op: "merge", action: { kind: "vector" } }), "vector", (a) => (a.kind === "vector" ? a.vector : undefined)),
    deltaSince: async (since: VersionVector) => pickMerge(await call({ op: "merge", action: { kind: "since", since } }), "delta", (a) => (a.kind === "delta" ? a.delta : undefined)),
    applyDelta: async (delta: Delta) => pickMerge(await call({ op: "merge", action: { kind: "apply", delta } }), "outcome", (a) => (a.kind === "outcome" ? a.outcome : undefined)),
  }),
  search: (call) => ({ search: async (prefix: Prefix, text: string, limit?: number) => pick(await call({ op: "search", prefix, text, ...(limit === undefined ? {} : { limit }) }), "search", (d) => (d.op === "search" ? d.value : undefined)) }),
};

/** Whether a capability has an operation. */
export const hasOperation = (c: Capability): c is OpCapability => c !== "watch" && c !== "lock";

/** The capabilities of a store that have an operation. */
export const opCapabilitiesOf = (store: AnyStore): readonly OpCapability[] => [...store.capabilities].filter(hasOperation);

/** The capabilities of a store of `C` that are carried and are not in `dropped`, typed as the type says: the same fact as the set of the store, with some taken away. */
export function capabilitiesWithout<C extends Capability, D extends Capability>(store: Store<C>, dropped: readonly D[]): readonly Exclude<C, D | "watch" | "lock">[] {
  return opCapabilitiesOf(store).filter((c) => !(dropped as readonly Capability[]).includes(c)) as unknown as readonly Exclude<C, D | "watch" | "lock">[];
}

/** What a layer or an attenuation keeps of a store of `C`: every capability but `watch` and `lock`, which have no operation to carry. */
export type Carried<C extends Capability> = Exclude<C, "watch" | "lock">;

/** The capabilities of a store of `C` that are carried, typed as the type says. The type of a store is its set, so the cast is the same fact. */
export function carriedCapabilities<C extends Capability>(store: Store<C>): readonly Carried<C>[] {
  return opCapabilitiesOf(store) as readonly Carried<C>[];
}

/** The store of its capabilities, made from a handler: it has exactly their methods, checks before each operation that it has what the operation needs, and never throws. */
export function makeStore<C extends OpCapability>(spec: StoreSpec<C>): Store<C> {
  const has = new Set<Capability>(spec.capabilities);
  const handle: Handler = async (op) => {
    for (const need of capabilitiesNeeded(op)) {
      if (!has.has(need)) {
        return err(need === "cas" ? refused("unsupported-expectation", `${spec.id} does not take an expectation of a revision: it has no compare-and-write`) : refused("capability-absent", `${spec.id} does not have ${need}`));
      }
    }
    try {
      return await spec.handle(op);
    } catch (thrown) {
      return err(unavailable(`${spec.id} failed: ${thrown instanceof Error ? thrown.message : String(thrown)}`, false));
    }
  };
  const base: StoreBase = { id: spec.id, place: spec.place, consistency: spec.consistency, traits: spec.traits, capabilities: has, handle };
  const methods = spec.capabilities.map((c) => METHODS[c](handle));
  // the one cast of the library: the capabilities decide the type, and the test of the store type holds that a store has a method exactly where its capabilities name one
  return Object.assign({}, base, ...methods) as Store<C>;
}

/** Narrows a store to more capabilities where its set has them: the compiler then lets the caller use their methods. */
export function supports<C extends Capability, D extends Capability>(store: Store<C>, ...needed: readonly D[]): store is Store<C> & Store<D> {
  return needed.every((c) => store.capabilities.has(c));
}
