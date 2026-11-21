// Spec: 0004-anyfs-middleware FR-004
/**
 * The retrying layer: an operation that is safe to repeat is repeated when it ends `unavailable` where a retry may succeed, at most the attempts of its policy, with a wait that doubles up to a limit. A read,
 * a stat, a list, a history, a ranged read and a search are safe; so is a write or a delete that expects any state, which leaves the same object however often it runs. A conflict, a refusal and every other
 * operation are never repeated, because repeating them would change what they mean.
 *
 * @example
 * ```ts
 * import { retrying } from "./retrying.ts";
 * // const store = retrying(inner, { attempts: 3, baseMs: 100, maxMs: 2000 }, clock)
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { Op } from "../ops.ts";
import { type Carried, carriedCapabilities, makeStore, type Store } from "../store.ts";
import type { Clock } from "./ports.ts";

/** How often to try and how long to wait: the attempts including the first, the first wait and the longest. */
export type RetryPolicy = { readonly attempts: number; readonly baseMs: number; readonly maxMs: number };

/** Whether an operation may be repeated. */
export function safeToRepeat(op: Op): boolean {
  switch (op.op) {
    case "read":
    case "stat":
    case "list":
    case "history":
    case "rangeRead":
    case "search":
    // a delta applied twice is applied once, so a merge may be repeated
    case "merge":
      return true;
    case "write":
    case "delete":
      return op.expect.kind === "any";
    case "batch":
    case "rename":
    case "append":
      return false;
    default:
      return false;
  }
}

/** A store that repeats what is safe to repeat, and keeps the capabilities of its argument. */
export function retrying<C extends Capability>(store: Store<C>, policy: RetryPolicy, clock: Pick<Clock, "sleep">): Store<Carried<C>> {
  return makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      const attempts = Math.max(1, Math.floor(policy.attempts));
      let wait = policy.baseMs;
      for (let attempt = 1; ; attempt++) {
        const r = await store.handle(op);
        const again = r.kind === "err" && r.error.kind === "unavailable" && r.error.retryable && safeToRepeat(op) && attempt < attempts;
        if (!again) return r;
        await clock.sleep(wait);
        wait = Math.min(wait * 2, policy.maxMs);
      }
    },
  });
}
