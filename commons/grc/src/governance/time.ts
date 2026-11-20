// Spec: 0002-grc-governance FR-009
/**
 * Durations and instants: ISO 8601 durations (`P1D`, `PT1H`, `P1Y`) as exact lengths, and the sum of an instant and a duration. A year is 365 days and a month 30, so that a cadence is the
 * same on every runtime and in every month. Pure: nothing here reads the clock.
 *
 * @example
 * ```ts
 * import { parseDuration } from "./time.ts";
 * parseDuration("P1W"); // { kind: "ok", value: 604800000 }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

const DAY = 86_400_000;
const PATTERN = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** The length in milliseconds of an ISO 8601 duration, or why the text is not one. */
export function parseDuration(text: string): Result<number, string> {
  const m = PATTERN.exec(text);
  if (m === null || text === "P" || text.endsWith("T")) return err(`${text} is not an ISO 8601 duration (such as P1D, PT1H or P1Y)`);
  const n = (i: number): number => Number(m[i] ?? 0);
  return ok(n(1) * 365 * DAY + n(2) * 30 * DAY + n(3) * 7 * DAY + n(4) * DAY + n(5) * 3_600_000 + n(6) * 60_000 + n(7) * 1000);
}

/** An instant as milliseconds since the epoch, or `undefined` where the text is not an ISO 8601 instant with a zone. */
export function instantMs(text: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return undefined;
  const t = Date.parse(text);
  return Number.isNaN(t) ? undefined : t;
}

/** The instant a duration after `instant`, as an ISO 8601 instant in UTC. */
export function addDuration(instant: string, duration: string): Result<string, string> {
  const t = instantMs(instant);
  if (t === undefined) return err(`${instant} is not an ISO 8601 instant`);
  const d = parseDuration(duration);
  if (d.kind === "err") return d;
  return ok(new Date(t + d.value).toISOString());
}
