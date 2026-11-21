// Spec: 0003-anyfs-logical FR-001, FR-006
/**
 * What an operation does to the world, in the three classes a consent can be given for: it reads, it changes, or it destroys. `guarded` holds a store to one of them, so that a program given a store with
 * a class of consent cannot do more with it than the consent says, whatever the program does.
 *
 * @example
 * ```ts
 * import { effectOf } from "./effect.ts";
 * import { parsePath } from "@intellectual-frontiers/anyfs/governance";
 * const p = parsePath("a");
 * p.kind === "ok" && effectOf({ op: "read", path: p.value }); // "read"
 * ```
 *
 * @module
 */
import { absurd, err } from "@intellectual-frontiers/core";
import { type Capability, refused } from "@intellectual-frontiers/anyfs/governance";
import { type Op } from "./ops.ts";
import { type Carried, carriedCapabilities, makeStore, type Store } from "./store.ts";

/** What an operation does, from the least to the most: a closed list. */
export const EFFECTS = ["read", "mutate", "destructive"] as const;
/** One class of effect. */
export type Effect = (typeof EFFECTS)[number];

const rank = (effect: Effect): number => EFFECTS.indexOf(effect);

/** What an operation does: a read reads, a write, an append and a rename change, a delete destroys, and a batch destroys where one of its changes does. */
export function effectOf(op: Op): Effect {
  switch (op.op) {
    case "read":
    case "stat":
    case "list":
    case "history":
    case "rangeRead":
    case "search":
      return "read";
    case "write":
    case "append":
    case "rename":
      return "mutate";
    case "delete":
      return "destructive";
    case "batch":
      return op.changes.some((c) => c.kind === "delete") ? "destructive" : "mutate";
    default:
      return absurd(op);
  }
}

/** A store that refuses, as `consent`, every operation above the effect it is given. It has the capabilities of its argument. */
export function guarded<C extends Capability>(store: Store<C>, allowed: Effect): Store<Carried<C>> {
  return makeStore({
    id: `${store.id}#${allowed}`,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) =>
      rank(effectOf(op)) > rank(allowed) ? err(refused("consent", `the consent given is for operations that ${allowed === "read" ? "only read" : allowed === "mutate" ? "read or change" : "do anything"}, and ${op.op} is ${effectOf(op)}`)) : store.handle(op),
  });
}
