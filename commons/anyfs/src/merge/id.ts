// Spec: 0008-anyfs-merge-logical FR-003
/**
 * The hybrid clock that makes version ids. A replica makes each id from the later of its wall time and the last id it made or took, with the 12-bit counter of the UUID to order the ids of one millisecond, so that every
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
import { compareTime, type IdTime, MAX_ID_COUNTER } from "@intellectual-frontiers/anyfs/governance";

/** How far ahead of its own wall clock a replica takes an id: five minutes, in milliseconds. */
export const DEFAULT_MAX_DRIFT = 300_000;

/** The time of an id made now: after the last time and after the wall time. */
export function nextTime(last: IdTime | undefined, wall: number): IdTime {
  const base = Math.max(wall, last?.ms ?? 0);
  const counter = last !== undefined && last.ms === base ? last.counter + 1 : 0;
  return counter > MAX_ID_COUNTER ? { ms: base + 1, counter: 0 } : { ms: base, counter };
}

/** The last time after a time is taken from another replica: the later of the two, so that the next id made is after it. */
export function seeTime(last: IdTime | undefined, remote: IdTime): IdTime {
  return last === undefined || compareTime(remote, last) > 0 ? remote : last;
}
