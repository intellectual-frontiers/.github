// Spec: 0004-anyfs-middleware FR-005
/**
 * The rate-limited layer: at most a number of operations in an interval, by a token bucket that refills with the clock the caller gives. An operation over the limit waits through the sleep of the clock and is
 * then made; the limit never fails an operation.
 *
 * @example
 * ```ts
 * import { rateLimited } from "./rate-limited.ts";
 * // const store = rateLimited(inner, { operations: 10, intervalMs: 1000 }, clock)
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { type Carried, carriedCapabilities, makeStore, type Store } from "../store.ts";
import type { Clock } from "./ports.ts";

/** How many operations in how many milliseconds. */
export type RateLimit = { readonly operations: number; readonly intervalMs: number };

/** A store that makes at most the operations of the limit in each interval, and keeps the capabilities of its argument. */
export function rateLimited<C extends Capability>(store: Store<C>, limit: RateLimit, clock: Clock): Store<Carried<C>> {
  const capacity = Math.max(1, Math.floor(limit.operations));
  const perMs = capacity / Math.max(1, limit.intervalMs);
  let tokens = capacity;
  let last = clock.now();
  const take = async (): Promise<void> => {
    for (;;) {
      const now = clock.now();
      tokens = Math.min(capacity, tokens + (now - last) * perMs);
      last = now;
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await clock.sleep(Math.ceil((1 - tokens) / perMs));
    }
  };
  return makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      await take();
      return store.handle(op);
    },
  });
}
