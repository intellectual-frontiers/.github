// Spec: 0001-quality-evidence FR-050
/**
 * Retention of the evidence on the `quality` branch (commons 0001-quality-evidence FR-050): the harness's record states a retention period in days
 * (`retentionDays` of the declaration), and evidence is kept on the branch for it and is archived by a Git tag, never deleted. This file judges
 * whether the retention period of the oldest evidence has passed and names the tag that may then be made; it deletes nothing and has no way to.
 *
 * @remarks
 * Pure: the period, the day of the oldest evidence and the day today are arguments (no clock). The period is the harness's to state and never
 * shorter than the longest retention that applies to its evidence; the harness chooses it, and the check here only refuses what is not a whole
 * number of days of at least one.
 *
 * @example
 * ```ts
 * import { judgeRetention } from "./retention.ts";
 * judgeRetention({ oldestDay: "2026-01-01", retentionDays: 365, today: "2027-01-01" }); // { kind: "due", dueOn: "2027-01-01" }
 * ```
 *
 * @module
 */
import { err, ok, type Result, absurd } from "@intellectual-frontiers/core";
import { isDay } from "./time.ts";

/** The day `days` after `day` (`YYYY-MM-DD`), or none where `day` is not a day. */
export function addDays(day: string, days: number): string | undefined {
  if (!isDay(day) || !Number.isInteger(days)) return undefined;
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** What the retention period of the oldest evidence comes to on a day. */
export type RetentionJudgement =
  /** The branch holds no evidence file: nothing to archive. */
  | { readonly kind: "no-evidence" }
  /** The harness states no retention period: evidence is kept and nothing is archived until it does. */
  | { readonly kind: "no-period" }
  /** The oldest evidence is still inside its period. */
  | { readonly kind: "kept"; readonly oldestDay: string; readonly dueOn: string; readonly daysLeft: number }
  /** The period of the oldest evidence has passed: the branch may be archived by a tag. */
  | { readonly kind: "due"; readonly oldestDay: string; readonly dueOn: string };

/** The inputs of `judgeRetention`. */
export type RetentionInput = {
  /** The UTC day of the oldest evidence file of the branch, `YYYY-MM-DD`; none where there is none. */
  readonly oldestDay: string | undefined;
  /** The period the harness states, in days; none where it states none. */
  readonly retentionDays: number | undefined;
  /** The day today, an argument. */
  readonly today: string;
};

/** Whether the period of the oldest evidence has passed on `today` (FR-050): it has on the day the period ends and after it. */
export function judgeRetention(input: RetentionInput): Result<RetentionJudgement, string> {
  if (!isDay(input.today)) return err(`${JSON.stringify(input.today)} is not a day (YYYY-MM-DD)`);
  if (input.oldestDay === undefined) return ok({ kind: "no-evidence" });
  if (input.retentionDays === undefined) return ok({ kind: "no-period" });
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1)
    return err(`the retention period is a whole number of days of at least one, not ${input.retentionDays}`);
  const dueOn = addDays(input.oldestDay, input.retentionDays);
  if (dueOn === undefined) return err(`${JSON.stringify(input.oldestDay)} is not a day (YYYY-MM-DD)`);
  if (dueOn <= input.today) return ok({ kind: "due", oldestDay: input.oldestDay, dueOn });
  const left = Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${input.today}T00:00:00Z`)) / 86_400_000);
  return ok({ kind: "kept", oldestDay: input.oldestDay, dueOn, daysLeft: left });
}

/** A judgement as a sentence. */
export function showRetention(j: RetentionJudgement): string {
  switch (j.kind) {
    case "no-evidence":
      return "the quality branch holds no evidence: nothing to archive";
    case "no-period":
      return "the harness states no retention period (retentionDays of its record): evidence is kept and nothing is archived";
    case "kept":
      return `the oldest evidence (${j.oldestDay}) is kept until ${j.dueOn}, ${j.daysLeft} day${j.daysLeft === 1 ? "" : "s"} more`;
    case "due":
      return `the retention period of the oldest evidence (${j.oldestDay}) ended on ${j.dueOn}`;
    default:
      return absurd(j);
  }
}

/**
 * Whether a text may name an archive tag: Git's own rules for a reference name that matter here (no space, control character, `~ ^ : ? * [ \`, no
 * `..`, `@{`, leading or trailing slash or dot, `.lock` ending).
 */
export function tagNameProblem(name: string): string | undefined {
  if (name === "") return "the tag name is empty";
  // eslint-disable-next-line no-control-regex -- control characters are exactly what a reference name refuses
  if (/[\s\x00-\x1f\x7f~^:?*[\\]/.test(name)) return `${JSON.stringify(name)} holds a character a Git tag name cannot`;
  if (name.includes("..") || name.includes("@{") || name.includes("//")) return `${JSON.stringify(name)} is not a Git tag name`;
  if (name.startsWith("/") || name.endsWith("/") || name.startsWith(".") || name.endsWith(".") || name.endsWith(".lock") || name === "@")
    return `${JSON.stringify(name)} is not a Git tag name`;
  if (name.startsWith("-")) return `${JSON.stringify(name)} starts with a dash`;
  return undefined;
}
