// Spec: 0004-anyfs-middleware FR-001
/**
 * A layer: a function of a store to a store, written over the handler of operations. A layer says in its type which capabilities it keeps; `pipe` applies layers in the order given and the type of the result is
 * the type the last layer gives. A layer keeps every capability that has an operation: `watch` and `lock` have none to carry, and a layer that wants them says so by making them itself.
 *
 * @remarks
 * `pipe` has one cast, in its implementation: its overloads are the typed surface, and each step is a layer from the store the step before gave.
 *
 * @example
 * ```ts
 * import { pipe } from "./layer.ts";
 * // const guarded = pipe(store, (s) => readOnly(s), (s) => traced(s, tracer))
 * ```
 *
 * @module
 */
import { type Capability } from "@intellectual-frontiers/anyfs/governance";
import type { Done, Op } from "../ops.ts";
import type { Store } from "../store.ts";
import type { Result } from "@intellectual-frontiers/core";
import type { Problem } from "@intellectual-frontiers/anyfs/governance";

/** A function of a store to a store. */
export type Layer<In extends Capability, Out extends Capability> = (store: Store<In>) => Store<Out>;

/** What a layer wraps: the handler of the store it is given. */
export type Next = (op: Op) => Promise<Result<Done, Problem>>;

/** A store through one layer. */
export function pipe<A extends Capability, B extends Capability>(store: Store<A>, l1: Layer<A, B>): Store<B>;
/** A store through two layers, in the order given. */
export function pipe<A extends Capability, B extends Capability, C extends Capability>(store: Store<A>, l1: Layer<A, B>, l2: Layer<B, C>): Store<C>;
/** A store through three layers, in the order given. */
export function pipe<A extends Capability, B extends Capability, C extends Capability, D extends Capability>(store: Store<A>, l1: Layer<A, B>, l2: Layer<B, C>, l3: Layer<C, D>): Store<D>;
/** A store through four layers, in the order given. */
export function pipe<A extends Capability, B extends Capability, C extends Capability, D extends Capability, E extends Capability>(
  store: Store<A>,
  l1: Layer<A, B>,
  l2: Layer<B, C>,
  l3: Layer<C, D>,
  l4: Layer<D, E>,
): Store<E>;
/** A store through the layers given, in the order given. */
export function pipe(store: Store<Capability>, ...layers: readonly ((s: never) => Store<Capability>)[]): Store<Capability> {
  let current: Store<Capability> = store;
  for (const layer of layers) current = layer(current as never);
  return current;
}
