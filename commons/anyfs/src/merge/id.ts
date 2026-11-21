// Spec: 0008-anyfs-merge-logical FR-003
/**
 * The hybrid clock that makes version ids. A replica makes each id from the later of its wall time and the last id it made or took, with the 12-bit counter of the UUID (`rand_a`) to order the ids of one millisecond, seeded at random in each new millisecond, so that every
 * id it makes is after every id it has seen and ids of one replica never go backwards, even where its wall clock does. An id from the far future is refused when a delta is taken, because one would put every later write
 * of the store behind it.
 *
 * @example
 * ```ts
 * import { nextTime } from "./id.ts";
 * nextTime(undefined, 1000); // { ms: 1000, counter: 0 }
 * ```
 *
 * @module
 */
import { compareTime, type IdTime, MAX_COUNTER_SEED, MAX_ID_COUNTER } from "@intellectual-frontiers/anyfs/governance";

/** How far ahead of its own wall clock a replica takes an id: five minutes, in milliseconds. */
export const DEFAULT_MAX_DRIFT = 300_000;

/**
 * The time of an id made now: after the last time and after the wall time. In the millisecond of the last id the counter is one more than the last; in a new millisecond it starts at `seed` (0 to `MAX_COUNTER_SEED`,
 * random where a replica makes ids: RFC 9562 section 6.2, method 1), whose top bit left clear guards against a rollover; where the counter is full the clock goes to the next millisecond and does not wait.
 */
export function nextTime(last: IdTime | undefined, wall: number, seed: number = 0): IdTime {
  const start = Math.min(Math.max(Math.trunc(seed), 0), MAX_COUNTER_SEED);
  const base = Math.max(wall, last?.ms ?? 0);
  const counter = last !== undefined && last.ms === base ? last.counter + 1 : start;
  return counter > MAX_ID_COUNTER ? { ms: base + 1, counter: start } : { ms: base, counter };
}

/** The last time after a time is taken from another replica: the later of the two, so that the next id made is after it. */
export function seeTime(last: IdTime | undefined, remote: IdTime): IdTime {
  return last === undefined || compareTime(remote, last) > 0 ? remote : last;
}
