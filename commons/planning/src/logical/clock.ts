// Spec: 0002-planning-core FR-003
/**
 * The ids of an item and of an event are made by the hybrid clock of AnyFS's merge, reused and not made again (0037-planning FR-007): `nextTime` and `seeTime` choose the time of the next id, and
 * `makeVersionId` writes it with the replica. The clock is a value that is taken and returned (FR-022): the wall time is an argument, never read here, and the last time of the replica is in the value, so
 * that every id a replica makes is after every id it has made or seen. An id whose time is further ahead of the wall time than the limit (five minutes, as AnyFS) is refused when it is taken.
 *
 * @example
 * ```ts
 * import { mintEventId, newClock } from "./clock.ts";
 * // const made = mintEventId(newClock(replica), Date.now()); made.kind === "ok" && made.value.id
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type IdTime, makeVersionId, type ReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { DEFAULT_MAX_DRIFT, nextTime, seeTime } from "@intellectual-frontiers/anyfs/merge";
import { type EventId, type IdProblem, idTime, type ItemId, parseEventId, parseItemId } from "@intellectual-frontiers/planning/governance";

/** The clock of one replica: who it is, the time of the last id it made or saw, and how far ahead of the wall time it takes an id. */
export type Clock = { readonly replica: ReplicaId; readonly last: IdTime | undefined; readonly maxDriftMs: number };

/** Why an id is not taken from another store. */
export type ClockProblem = { readonly kind: "future-id"; readonly id: string; readonly aheadByMs: number; readonly limitMs: number };

/** The clock of a replica that has made and seen no id. */
export function newClock(replica: ReplicaId, maxDriftMs: number = DEFAULT_MAX_DRIFT): Clock {
  return { replica, last: undefined, maxDriftMs };
}

/** The next time, and the text of the id made from it. */
function next(clock: Clock, wallMs: number): { readonly text: string; readonly clock: Clock } {
  const time = nextTime(clock.last, wallMs);
  return { text: makeVersionId(time, clock.replica), clock: { ...clock, last: time } };
}

/** A new event id, after every id the clock has made or seen, and the clock after it. */
export function mintEventId(clock: Clock, wallMs: number): Result<{ readonly id: EventId; readonly clock: Clock }, IdProblem> {
  const made = next(clock, wallMs);
  const id = parseEventId(made.text);
  return id.kind === "ok" ? ok({ id: id.value, clock: made.clock }) : id;
}

/** A new item id, after every id the clock has made or seen, and the clock after it. */
export function mintItemId(clock: Clock, wallMs: number): Result<{ readonly id: ItemId; readonly clock: Clock }, IdProblem> {
  const made = next(clock, wallMs);
  const id = parseItemId(made.text);
  return id.kind === "ok" ? ok({ id: id.value, clock: made.clock }) : id;
}

/** The clock after an id taken from another store, so that the next id made comes after it; an id too far ahead of the wall time is refused. */
export function seeId(clock: Clock, id: ItemId | EventId, wallMs: number): Result<Clock, ClockProblem> {
  const time = idTime(id);
  return time.ms > wallMs + clock.maxDriftMs
    ? err({ kind: "future-id", id, aheadByMs: time.ms - wallMs, limitMs: clock.maxDriftMs })
    : ok({ ...clock, last: seeTime(clock.last, time) });
}
