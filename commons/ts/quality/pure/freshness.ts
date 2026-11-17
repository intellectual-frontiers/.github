/**
 * The freshness of a proof (commons 0021-ifqs FR-025): `Fresh`, `Due` or `Stale` (`ifqs:FreshnessState`), judged by time, as 0007-grc FR-011
 * judges evidence against a cadence (`kernel/assess.ts`), and by change, being stale where a file in the requirement's trace chain (its text,
 * term, code or test, 0020-ifccm FR-014) changed after the revision of the run, or where the run's revision is not at or after the last change
 * of the chain. A stale proof does not count at its grade and opens a nonconformance (FR-007).
 *
 * @remarks
 * Pure: the day today and what changed are arguments. `host/gather.ts` finds what changed with real `git`; this file only judges. The
 * cadences are the quality system's own defaults (FR-044): a run stays fresh for 30 days, a probe for 7, a statement for 90 and a review for a
 * year; a harness passes its own.
 *
 * @example
 * ```ts
 * import { DEFAULT_CADENCES, freshnessOf } from "./freshness.ts";
 * // freshnessOf({ kind: "run", at }, ["commons/ts/quality/pure/ladder.ts"], now, DEFAULT_CADENCES).state === "Stale"
 * ```
 *
 * @module
 */
import { type Duration, duration, type Instant } from "../../kernel/grc.ts";
import { freshness } from "../../kernel/assess.ts";

/** The state of a proof's freshness, in the words of the ontology (`ifqs:Fresh`, `ifqs:Due`, `ifqs:Stale`). */
export type FreshnessState = "Fresh" | "Due" | "Stale";

/** What kind of evidence is judged: each has its own cadence. */
export type EvidenceKind = "run" | "statement" | "review" | "probe";

/** The cadence each kind of evidence is held to (FR-044). */
export type Cadences = { readonly [K in EvidenceKind]: Duration };

/** The default cadences (FR-044): the run's 30 days, the probe's 7, the statement's 90 and the review's year. */
export const DEFAULT_CADENCES: Cadences = {
  run: duration("P30D"),
  probe: duration("P7D"),
  statement: duration("P90D"),
  review: duration("P1Y"),
};

/** How a proof was judged: its state, by which means, and what says so. */
export type FreshnessVerdict = {
  readonly state: FreshnessState;
  /** `change` where something in the chain changed after the evidence, else `time`. */
  readonly by: "time" | "change";
  readonly why: string;
  /** When it falls due, where the cadence is a time. */
  readonly dueAt?: Instant;
};

/**
 * The freshness of one piece of evidence at `now` (FR-025). `changes` names what in the requirement's chain changed after the evidence's
 * revision (files, or the requirement's text): where any did, the proof is `Stale` by change whatever its age; otherwise it is `Fresh`, `Due`
 * (in the last tenth of its cadence) or `Stale` by time.
 */
export function freshnessOf(
  evidence: { readonly kind: EvidenceKind; readonly at: Instant },
  changes: readonly string[],
  now: Instant,
  cadences: Cadences = DEFAULT_CADENCES,
): FreshnessVerdict {
  if (changes.length > 0) {
    const shown = changes.slice(0, 3).join(", ") + (changes.length > 3 ? ` and ${changes.length - 3} more` : "");
    return { state: "Stale", by: "change", why: `${shown} changed after the run` };
  }
  const f = freshness(cadences[evidence.kind], [evidence.at], now);
  const state: FreshnessState = f.status === "fresh" ? "Fresh" : f.status === "due" ? "Due" : "Stale";
  const why =
    state === "Stale"
      ? `older than its cadence ${f.cadence}`
      : state === "Due"
        ? `falls due ${f.dueAt ?? "later"}, a cadence of ${f.cadence}`
        : `within its cadence ${f.cadence}`;
  return { state, by: "time", why, ...(f.dueAt === null ? {} : { dueAt: f.dueAt }) };
}

/** Whether a proof counts at its grade: `Fresh` and `Due` do, `Stale` does not (FR-025). */
export function counts(state: FreshnessState): boolean {
  return state !== "Stale";
}
