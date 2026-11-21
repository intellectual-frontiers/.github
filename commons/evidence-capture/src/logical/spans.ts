// Spec: 0005-evidence-capture-views FR-001
/**
 * Spans of time as a person writes them (`30m`, `7d`, or ISO 8601) and as they are shown. Pure.
 *
 * @example
 * ```ts
 * import { durationText } from "./spans.ts";
 * durationText(3_600_000); // "1h"
 * ```
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import { parseDuration } from "@intellectual-frontiers/grc/governance";

/** A duration as `1h`, `30m`, `7d` or ISO 8601 (`PT1H`), in milliseconds. */
export function parseSpan(text: string): Result<number, string> {
  const m = /^(\d+)([smhd])$/.exec(text);
  if (m !== null) return ok(Number(m[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "s" | "m" | "h" | "d"]);
  return parseDuration(text);
}

/** A span of milliseconds as short text. */
export function durationText(ms: number): string {
  if (ms === 0) return "0s";
  const units: [string, number][] = [["d", 86_400_000], ["h", 3_600_000], ["m", 60_000], ["s", 1000]];
  for (const [u, n] of units) if (ms >= n && ms % n === 0) return `${ms / n}${u}`;
  return `${ms}ms`;
}
