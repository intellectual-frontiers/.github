// Spec: 0001-quality-evidence FR-021
/**
 * Days as the quality system keeps them (commons 0001-quality-evidence FR-021, FR-030): a UTC day as `YYYY-MM-DD`, the instant at the end of a day, and
 * the day of an instant. Pure: the day today is always an argument.
 *
 * @module
 */
import { type Decoder, refine, string, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { type Instant, instantOf } from "./primitives.ts";

/** A UTC day, `YYYY-MM-DD`, that exists on the calendar. */
export type Day = Brand<string, "Day">;

/** Whether a text is a day on the calendar. */
export function isDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** A decoder of a day. */
export const dayDecoder: Decoder<Day> = refine(string, "Day", isDay);

/** A day as such, or why it is not one. */
export function dayOfText(text: string): Result<Day, string> {
  return isDay(text) ? ok(text as Day) : err(`${JSON.stringify(text)} is not a day (YYYY-MM-DD)`); // checked just now: the brand's constructor
}

/** The instant of noon UTC on a day: the time a day-grained piece of evidence is held to its cadence from. */
export function noonOf(day: string): Instant | undefined {
  return instantOf(`${day}T12:00:00.000Z`);
}
