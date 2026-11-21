// Spec: 0003-evidence-grading FR-001, FR-002, FR-003, FR-004
/**
 * The grade of evidence (0003-evidence-grading FR-001 to FR-004): how much a piece of evidence is worth from how it was obtained and how old it is, with no percentage. A record read from the system by a tool, or a signed record from a system, is `strong`; a person's attestation is `moderate`;
 * a screenshot is `weak`. Age takes a step off: evidence older than the age its origin allows is one grade lower, and older than twice that is `weak`; evidence that has expired is `expired`. An objective is graded by the best of its live, passing evidence, and says which it is, so that a control resting only
 * on screenshots is shown as the weak thing it is.
 *
 * @example
 * ```ts
 * import { GRADES } from "./grade.ts";
 * GRADES; // ["strong", "moderate", "weak", "expired", "none"]
 * ```
 *
 * @module
 */
import type { Evidence, Objective, Origin } from "@intellectual-frontiers/assessment/governance";
import { latest } from "./determine.ts";

/** The grades, best first. */
export const GRADES = ["strong", "moderate", "weak", "expired", "none"] as const;
/** A grade. */
export type Grade = (typeof GRADES)[number];

/** The origin of a record: what it says, or what its maker implies. */
export const originOf = (e: Evidence): Origin => e.origin ?? (e.by.kind === "tool" ? "machine" : "attestation");

/** The days a piece of evidence of each origin keeps its grade before age takes a step off. */
export const FRESH_DAYS: Readonly<Record<Origin, number>> = { machine: 7, "signed-record": 90, attestation: 365, screenshot: 90 };

const BASE: Readonly<Record<Origin, Grade>> = { machine: "strong", "signed-record": "strong", attestation: "moderate", screenshot: "weak" };
const STEP: Readonly<Record<Grade, Grade>> = { strong: "moderate", moderate: "weak", weak: "weak", expired: "expired", none: "none" };

const DAY = 86_400_000;
const days = (from: string, to: string): number => Math.floor((Date.parse(to) - Date.parse(from)) / DAY);

/** The grade of one record at an instant. */
export function gradeOf(e: Evidence, now: string): Grade {
  if (e.validUntil !== undefined && e.validUntil <= now) return "expired";
  const age = days(e.at, now);
  const fresh = FRESH_DAYS[originOf(e)];
  const base = BASE[originOf(e)];
  if (age > 2 * fresh) return "weak";
  return age > fresh ? STEP[base] : base;
}

/** The grade of an objective, with the record it rests on. */
export type ObjectiveGrade = { readonly objective: string; readonly grade: Grade; readonly basis?: string; readonly origin?: Origin; readonly ageDays?: number };

/** The grade of each objective from the latest of its records: the best live passing record counts; with only expired ones it is `expired`; with none it is `none`. */
export function gradeObjectives(objectives: readonly Objective[], evidence: readonly Evidence[], now: string): readonly ObjectiveGrade[] {
  return objectives.map((o) => {
    const own = latest(evidence.filter((e) => e.objective === o.id));
    const passing = own.filter((e) => e.result !== "fail");
    if (passing.length === 0) return { objective: o.id, grade: "none" as const };
    const scored = passing.map((e) => ({ e, g: gradeOf(e, now) })).sort((a, b) => GRADES.indexOf(a.g) - GRADES.indexOf(b.g) || (a.e.id < b.e.id ? -1 : 1));
    const best = scored[0] as { e: Evidence; g: Grade };
    return { objective: o.id, grade: best.g, basis: best.e.id, origin: originOf(best.e), ageDays: days(best.e.at, now) };
  });
}

/** The grades of the objectives of one requirement, counted: nothing is averaged. */
export function countGrades(grades: readonly ObjectiveGrade[]): Readonly<Record<Grade, number>> {
  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const g of grades) counts[g.grade]++;
  return counts;
}
