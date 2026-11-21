// Spec: 0002-planning-core FR-003
/**
 * The time of an event and the day a deferral ends, as branded text made only by a parser: an instant is `YYYY-MM-DDTHH:MM:SSZ` in UTC to the second (0037-planning FR-003) and a day is `YYYY-MM-DD`; each
 * is a real date, and each sorts as text in the order of time. Nothing here reads a clock: a time is a value the caller passes in (FR-022).
 *
 * @example
 * ```ts
 * import { parseInstant } from "./time.ts";
 * parseInstant("2026-11-21T10:00:00Z"); // { kind: "ok", value: "2026-11-21T10:00:00Z" }
 * parseInstant("2026-02-30T10:00:00Z"); // { kind: "err", error: ... }
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import { brand } from "./brand.ts";

/** A time in UTC to the second, `YYYY-MM-DDTHH:MM:SSZ`. Made only by `parseInstant` or `instantOfMs`. */
export type Instant = Brand<string, "plan instant">;
/** A calendar day, `YYYY-MM-DD`. Made only by `parseDay`. */
export type Day = Brand<string, "plan day">;

/** A text that is not an instant or a day. */
export type TimeProblem = { readonly kind: "bad-time"; readonly text: string; readonly expected: string };

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** An instant from text, or why it is not one: the form, and a date that exists. */
export function parseInstant(text: string): Result<Instant, TimeProblem> {
  const ms = INSTANT.test(text) ? Date.parse(text) : Number.NaN;
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 19) + "Z" !== text
    ? err({ kind: "bad-time", text: text.slice(0, 40), expected: "a real time in UTC to the second, YYYY-MM-DDTHH:MM:SSZ" })
    : ok(brand<string, "plan instant">(text));
}

/** The instant of a time in milliseconds since 1970, cut to the second. */
export function instantOfMs(ms: number): Result<Instant, TimeProblem> {
  return Number.isFinite(ms) && ms >= 0 && ms <= 8_640_000_000_000_000
    ? parseInstant(new Date(ms).toISOString().slice(0, 19) + "Z")
    : err({ kind: "bad-time", text: String(ms), expected: "a time in milliseconds that a date can hold" });
}

/** The milliseconds since 1970 of an instant. */
export function msOfInstant(instant: Instant): number {
  return Date.parse(instant);
}

/** A day from text, or why it is not one. */
export function parseDay(text: string): Result<Day, TimeProblem> {
  const ms = DAY.test(text) ? Date.parse(`${text}T00:00:00Z`) : Number.NaN;
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== text
    ? err({ kind: "bad-time", text: text.slice(0, 40), expected: "a real day, YYYY-MM-DD" })
    : ok(brand<string, "plan day">(text));
}
