// Spec: 0003-telemetry-reach FR-024
/**
 * Retention as a typed policy and a pure sweep (0003-telemetry-reach FR-024): each kind of record has its own period, a record past its period is removed or reduced to its summary, and the sweep says what it did so that it can be recorded.
 * The sweep never touches the chain of evidence: that is not given to it.
 *
 * @example
 * ```ts
 * import { DEFAULT_RETENTION, expired } from "./retention.ts";
 * expired(DEFAULT_RETENTION, "raw", 0, 31 * 86_400_000); // true
 * ```
 *
 * @module
 */

/** The kinds of record a policy has a period for: raw signals, and the summaries of health (presence and level changes). */
export type RetentionKind = "raw" | "summary";

/** The period, in days, that each kind is kept. */
export type RetentionPolicy = Readonly<Record<RetentionKind, number>>;

/** Thirty days for raw signals and thirteen months (395 days) for the summaries of health. */
export const DEFAULT_RETENTION: RetentionPolicy = { raw: 30, summary: 395 };

const DAY = 86_400_000;

/** What is wrong with a policy, as sentences (none where it is well formed). */
export function retentionProblems(p: RetentionPolicy): readonly string[] {
  const out: string[] = [];
  for (const kind of ["raw", "summary"] as const) if (!Number.isInteger(p[kind]) || p[kind] <= 0) out.push(`the period of ${kind} is a positive whole number of days`);
  if (p.summary < p.raw) out.push("a summary is kept at least as long as the raw signals it sums");
  return out;
}

/** Whether a record of `kind` made at `at` (milliseconds) is past its period at `now`. */
export function expired(policy: RetentionPolicy, kind: RetentionKind, at: number, now: number): boolean {
  return now - at > policy[kind] * DAY;
}

/** What one sweep did: when, by which policy, and how many records of each kind it removed or reduced. It is the record of the sweep. */
export type SweepRecord = { readonly at: number; readonly policy: RetentionPolicy; readonly removed: Readonly<Record<RetentionKind, number>>; readonly reduced: number };
