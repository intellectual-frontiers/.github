// Spec: 0003-headless-output FR-010
/**
 * A run inside another run (commons headless 0003-headless-output FR-010): a command that runs another command of the same program as one of its
 * steps. The child does not draw a closing block of its own; it writes what it found as a summary (to the file its parent names in the
 * environment) and the parent merges it, so that every problem appears once, in the parent's block. The names of the variables come from the
 * program's prefix, and the summary is read back by a decoder, never trusted.
 *
 * @example
 * ```ts
 * import { nestedNames, summaryOf, parseSummary, encodeSummary } from "./nested.ts";
 * import { outcomeOf } from "./outcome.ts";
 * nestedNames("tool").nested; // "TOOL_NESTED"
 * parseSummary(encodeSummary(summaryOf(outcomeOf(null)))); // ok({ fails: 0, ... })
 * ```
 *
 * @module
 */
import { array, err, integer, json, literal, mapErr, object, ok, type Decoded, string, type Result, formatDecodeError } from "@intellectual-frontiers/core";
import { countsOf, type Problem } from "@intellectual-frontiers/headless/governance";
import { mergeOutcomes, outcomeOf, type Outcome } from "./outcome.ts";

/** The names of the environment variables a program uses to nest its runs. */
export type NestedNames = {
  /** Set in a child's environment: this run is a step of another. */
  readonly nested: string;
  /** Names the file the child writes its summary to. */
  readonly summary: string;
};

/** The variable names of a program, from its prefix (`tool` or `TOOL`: `TOOL_NESTED` and `TOOL_SUMMARY`). */
export function nestedNames(prefix: string): NestedNames {
  const p = prefix.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return { nested: `${p}_NESTED`, summary: `${p}_SUMMARY` };
}

/** What a child run found, as its parent wants it: the counts, every problem in order, and the lines the run wanted seen. */
export type RunSummary = {
  readonly fails: number;
  readonly warns: number;
  readonly pending: number;
  readonly actions: number;
  readonly problems: readonly Problem[];
  readonly outcomes: readonly string[];
};

/** The summary of an outcome. */
export function summaryOf(o: Outcome): RunSummary {
  const c = countsOf(o.problems);
  return { fails: c.fail, warns: c.warn, pending: c.pending, actions: c.action, problems: o.problems, outcomes: o.outcomes };
}

const problemDecoder = object(
  { level: literal("fail", "warn", "pending", "action"), message: string },
  { phase: string, fix: string, code: string, raw: string, logLine: integer },
);

const summaryDecoder = object({
  fails: integer,
  warns: integer,
  pending: integer,
  actions: integer,
  problems: array(problemDecoder),
  outcomes: array(string),
});

/** The summary as the text a child writes. */
export function encodeSummary(s: RunSummary): string {
  return JSON.stringify(s);
}

/** A summary read from the text a child wrote, or why it is not one. */
export function parseSummary(text: string): Result<RunSummary, string> {
  const r = mapErr(json(text, summaryDecoder), formatDecodeError);
  if (r.kind === "err") return err(r.error);
  const v: Decoded<typeof summaryDecoder> = r.value;
  return ok({
    fails: v.fails,
    warns: v.warns,
    pending: v.pending,
    actions: v.actions,
    problems: v.problems.map((p): Problem => ({ ...p })),
    outcomes: v.outcomes,
  });
}

/** The parent's outcome with what its child found added after its own: the child's problems and lines, once. */
export function mergeSummary<D>(parent: Outcome<D>, child: RunSummary): Outcome<D> {
  return mergeOutcomes(parent, outcomeOf(null, { problems: child.problems, outcomes: child.outcomes }));
}

/** Whether an environment says this run is a step of another. */
export function isNested(names: NestedNames, env: (name: string) => string | undefined): boolean {
  const v = env(names.nested);
  return v !== undefined && v !== "";
}

/** The variables to give a child run: that it is nested, and where to write its summary. */
export function childEnv(names: NestedNames, summaryFile: string): Readonly<Record<string, string>> {
  return { [names.nested]: "1", [names.summary]: summaryFile };
}
