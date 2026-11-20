// Spec: 0003-headless-output FR-004
/**
 * The closing block of a run as data (commons headless 0003-headless-output FR-004): which lines come, in which order, what the verdict says, and
 * the ONE `next:` command. The surface draws the lines it is given with its own marks and colours; it neither orders nor chooses.
 *
 * @remarks
 * Order: the problems (the first failure is the verdict, so it is not listed twice; then the other failures, then the warnings), what is the
 * person's to do, what is pending, the hints that are due, the steps the command spelled out; then the verdict, then the one next command. The
 * next command is the failure's own, else the first step for the person, else the one the command suggested; a failure whose fix holds no command
 * has none.
 *
 * @example
 * ```ts
 * import { closingOf } from "./closing.ts";
 * import { outcomeOf } from "./outcome.ts";
 * closingOf(outcomeOf(null), { fix: { commands: [], own: [] }, shownHints: [] }).verdict.text; // "Up to date"
 * ```
 *
 * @module
 */
import { countsOf, type Counts, type Problem, type ProblemLevel } from "@intellectual-frontiers/headless/governance";
import { fixSplitter, type FixCommands } from "./fix.ts";
import type { Hint, Outcome } from "./outcome.ts";

/** A problem as a line of the block: its text, its code, the instruction and the one command of its fix. */
export type ClosingProblem = {
  readonly kind: "problem";
  readonly level: ProblemLevel;
  readonly message: string;
  readonly code?: string;
  readonly say?: string;
  /** The command, labelled `fix` for a failure or a warning and `run` for what is pending or the person's. */
  readonly command?: { readonly label: "fix" | "run"; readonly command: string };
  readonly raw?: string;
  readonly logLine?: number;
};

/** A hint as a line of the block. */
export type ClosingHint = { readonly kind: "hint"; readonly message: string; readonly command?: string };

/** A step the command spelled out. */
export type ClosingStep = { readonly kind: "step"; readonly text: string };

/** One line of the block. */
export type ClosingLine = ClosingProblem | ClosingHint | ClosingStep;

/** The verdict: how the run ended, in one line. */
export type Verdict = {
  readonly level: "ok" | "fail" | "cancelled";
  readonly text: string;
  /** The code of the failure that is the verdict. */
  readonly code?: string;
};

/** The closing block. */
export type Closing = {
  readonly lines: readonly ClosingLine[];
  readonly verdict: Verdict;
  /** The instruction of the failure that is the verdict, shown before it. */
  readonly rootSay?: string;
  /** The one next command: only a command, never a sentence. */
  readonly next?: string;
  readonly counts: Counts;
  /** How many hints the block shows. */
  readonly hintsShown: number;
};

/** What the block depends on besides the outcome. */
export type ClosingOptions = {
  readonly fix: FixCommands;
  /** The title of a verdict where all is well, over the outcome's own. */
  readonly title?: string;
  /** The hints that are due (the cadence is the surface's: `hintsDue`). */
  readonly shownHints: readonly Hint[];
};

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

/** The closing block of an outcome. */
export function closingOf(o: Outcome, options: ClosingOptions): Closing {
  const split = fixSplitter(options.fix);
  const counts = countsOf(o.problems);
  const of = (level: ProblemLevel): readonly Problem[] => o.problems.filter((p) => p.level === level);
  const fails = of("fail");
  const warns = of("warn");
  const actions = of("action");
  const pending = of("pending");
  const root = fails[0];
  const line = (p: Problem): ClosingProblem => {
    const f = split(p.fix);
    return {
      kind: "problem",
      level: p.level,
      message: p.message,
      ...(p.code === undefined ? {} : { code: p.code }),
      ...(f.say === undefined ? {} : { say: f.say }),
      ...(f.cmd === undefined ? {} : { command: { label: p.level === "fail" || p.level === "warn" ? "fix" : "run", command: f.cmd } }),
      ...(p.raw === undefined ? {} : { raw: p.raw }),
      ...(p.logLine === undefined ? {} : { logLine: p.logLine }),
    };
  };
  const lines: ClosingLine[] = [];
  for (const p of [...fails.slice(1), ...warns, ...actions, ...pending]) lines.push(line(p));
  for (const h of options.shownHints) lines.push({ kind: "hint", message: h.message, ...(h.command === undefined ? {} : { command: h.command }) });
  let suggested: string | undefined;
  for (const entry of o.next) {
    const m = /^next:\s*(.+)$/.exec(entry);
    if (m?.[1] !== undefined) suggested ??= split(m[1]).cmd ?? m[1];
    else lines.push({ kind: "step", text: entry.replace(/^then:\s*/, "") });
  }
  const rootFix = split(root?.fix);
  let verdict: Verdict;
  if (root !== undefined) {
    verdict = { level: "fail", text: root.message, ...(root.code === undefined ? {} : { code: root.code }) };
  } else if (o.cancelled) {
    verdict = { level: "cancelled", text: "Stopped" };
  } else {
    const parts = [options.title ?? o.title ?? "Up to date"];
    if (warns.length > 0) parts.push(plural(warns.length, "warning"));
    if (actions.length > 0) parts.push(`${actions.length} for you`);
    if (pending.length > 0) parts.push(`${pending.length} waiting`);
    if (options.shownHints.length > 0) parts.push(`${options.shownHints.length} optional`);
    verdict = { level: "ok", text: parts.join(" · ") };
  }
  const next = rootFix.cmd ?? (root === undefined ? (split(actions[0]?.fix).cmd ?? suggested) : undefined);
  return {
    lines,
    verdict,
    ...(root !== undefined && rootFix.say !== undefined ? { rootSay: rootFix.say } : {}),
    ...(next === undefined ? {} : { next }),
    counts,
    hintsShown: options.shownHints.length,
  };
}
