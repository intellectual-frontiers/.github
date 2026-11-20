// Spec: 0003-headless-output FR-002
/**
 * The typed outcome of a command (commons headless 0003-headless-output FR-002): what a verb returns instead of printing. A report's data and its
 * text, the problems the run found, the lines it wants seen, the optional features it noticed are off (hints), the steps it spells out for the
 * person, and the findings a SARIF reader would list. No surface is named here: the command line draws it, a tool server returns it as JSON.
 *
 * @example
 * ```ts
 * import { outcomeOf, withProblem } from "./outcome.ts";
 * import { problem } from "@intellectual-frontiers/headless/governance";
 * const o = withProblem(outcomeOf({ files: 3 }), problem("warn", "one file is large"));
 * o.problems.length; // 1
 * ```
 *
 * @module
 */
import { type Problem } from "@intellectual-frontiers/headless/governance";

/** An optional feature that is merely off: a hint, not a problem. */
export type Hint = {
  /** Its stable id: it is shown at most once in a while. */
  readonly id: string;
  /** What is off, and what it would give. */
  readonly message: string;
  /** The command that turns it on, where there is one. */
  readonly command?: string;
};

/** How serious a finding is, in the words SARIF uses. */
export type FindingLevel = "error" | "warning" | "note";

/** One finding of a check, for a reader of SARIF. */
export type Finding = {
  readonly ruleId: string;
  readonly level: FindingLevel;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
};

/** What a command returns. */
export type Outcome<D = unknown> = {
  /** The report's data: what `--json` carries under `data`. */
  readonly data: D;
  /** The report's text, for a person; what the command writes to its output. */
  readonly text: string | undefined;
  /** Every problem found, in the order found. */
  readonly problems: readonly Problem[];
  /** Lines the run wants the person to see ("Sent: every server applies it within 15 minutes"). */
  readonly outcomes: readonly string[];
  /** Optional features that are off. */
  readonly hints: readonly Hint[];
  /** Steps the command spells out: `next: <command>` is a candidate for the closing next line, any other line is shown as a step (`then: ...`). */
  readonly next: readonly string[];
  /** Findings, for SARIF. */
  readonly findings: readonly Finding[];
  /** The verdict's title when all is well ("Up to date"). */
  readonly title: string | undefined;
  /** Whether the run was stopped by the person before it ended. */
  readonly cancelled: boolean;
};

/** What `outcomeOf` takes besides the data. */
export type OutcomeFields = {
  readonly text?: string;
  readonly problems?: readonly Problem[];
  readonly outcomes?: readonly string[];
  readonly hints?: readonly Hint[];
  readonly next?: readonly string[];
  readonly findings?: readonly Finding[];
  readonly title?: string;
  readonly cancelled?: boolean;
};

/** An outcome with the data and the fields given; the rest is empty. */
export function outcomeOf<D>(data: D, fields: OutcomeFields = {}): Outcome<D> {
  return {
    data,
    text: fields.text,
    problems: fields.problems ?? [],
    outcomes: fields.outcomes ?? [],
    hints: fields.hints ?? [],
    next: fields.next ?? [],
    findings: fields.findings ?? [],
    title: fields.title,
    cancelled: fields.cancelled ?? false,
  };
}

/** The outcome of a run that found nothing and has nothing to say. */
export const NOTHING: Outcome<null> = outcomeOf(null);

/** The outcome with one more problem at the end. */
export function withProblem<D>(o: Outcome<D>, p: Problem): Outcome<D> {
  return { ...o, problems: [...o.problems, p] };
}

/**
 * Two outcomes as one: the data and text of the first (the second is what was found beside it), and everything else of the first and then the
 * second, in order. It is associative, and `NOTHING` is its identity for everything but the data.
 */
export function mergeOutcomes<D>(first: Outcome<D>, second: Outcome<unknown>): Outcome<D> {
  return {
    data: first.data,
    text: first.text,
    problems: [...first.problems, ...second.problems],
    outcomes: [...first.outcomes, ...second.outcomes],
    hints: [...first.hints, ...second.hints.filter((h) => !first.hints.some((x) => x.id === h.id))],
    next: [...first.next, ...second.next],
    findings: [...first.findings, ...second.findings],
    title: first.title ?? second.title,
    cancelled: first.cancelled || second.cancelled,
  };
}

/** The findings a SARIF reader sees for a run that has none of its own: each failure an error, each warning a warning, with the problem's code as the rule. */
export function findingsOfProblems(problems: readonly Problem[]): readonly Finding[] {
  return problems.flatMap((p): readonly Finding[] =>
    p.level === "fail" || p.level === "warn"
      ? [{ ruleId: p.code ?? (p.level === "fail" ? "failed" : "warning"), level: p.level === "fail" ? "error" : "warning", message: p.message }]
      : [],
  );
}
