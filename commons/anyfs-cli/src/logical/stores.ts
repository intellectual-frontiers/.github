// Spec: 0003-anyfs-cli-logical FR-004
/**
 * The capabilities a verb needs of a store, asked at run time (commons anyfs-cli 0003-anyfs-cli-logical FR-004): an opener gives a store whose capabilities are known only when it is open, so each verb asks for the
 * capabilities it uses and ends with a sentence that names what is missing where the store has none of them. The casts are here and only here, each after the check of the set of capabilities that the type promises.
 *
 * @example
 * ```ts
 * import { viewable } from "./stores.ts";
 * // const store = viewable(opened); store === undefined ? "cannot be listed" : "ok";
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore, Store } from "@intellectual-frontiers/anyfs/logical";

const has = (store: AnyStore, ...needed: readonly Capability[]): boolean => needed.every((c) => store.capabilities.has(c));

/** The store as something that can be read: `read`, `list` and `stat`. */
export function viewable(store: AnyStore): Store<"read" | "list" | "stat"> | undefined {
  return has(store, "read", "list", "stat") ? (store as Store<"read" | "list" | "stat">) : undefined;
}

/** The store as the source of a transfer. */
export function sourceOf(store: AnyStore): Store<"read" | "list" | "stat"> | undefined {
  return viewable(store);
}

/** The store as the source of a move: it can also delete. */
export function movableOf(store: AnyStore): Store<"read" | "list" | "stat" | "delete"> | undefined {
  return has(store, "read", "list", "stat", "delete") ? (store as Store<"read" | "list" | "stat" | "delete">) : undefined;
}

/** The store as the destination of a transfer: it can be read, written, listed, and have objects deleted. */
export function destOf(store: AnyStore): Store<"read" | "write" | "list" | "stat" | "delete"> | undefined {
  return has(store, "read", "write", "list", "stat", "delete") ? (store as Store<"read" | "write" | "list" | "stat" | "delete">) : undefined;
}

/** The names of the capabilities of a store that a person would want to see, in a fixed order. */
export function capabilityNames(store: AnyStore): readonly Capability[] {
  const order: readonly Capability[] = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history", "rangeRead", "append", "search", "watch", "lock"];
  return order.filter((c) => store.capabilities.has(c));
}

/** The capabilities of `needed` that a store lacks. */
export function missing(store: AnyStore, needed: readonly Capability[]): readonly Capability[] {
  return needed.filter((c) => !store.capabilities.has(c));
}
