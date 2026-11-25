// Spec: 0002-headless-governance FR-009, FR-010
// Spec: 0008-exit-style-consent FR-001
/**
 * The exit statuses of a headless program, one table for every program (commons headless 0002-headless-governance FR-009). A run's own verdicts
 * are 0 to 4 (the statuses of a tool that reports: `Ok`, `Findings`, `Usage`, `Environment`, and `Pending`, which is kept apart from a
 * failure); a program that cannot start at all uses the range of `sysexits.h` (64 and up), which a launcher, a service manager and a shell
 * already know; a signal is 128 plus its number.
 *
 * @remarks
 * Sources reconciled here: the first program returned 0 to 3; erga's launcher gave its startup failures 4 to 11; a third returned 0 or 1 and never made
 * `pending` a status. The run's verdicts keep the numbers of the first program (a script that tests `$? -eq 1` for findings keeps working), the launcher's
 * failures move above 63 so that 4 is free for `Pending`, and nothing below 64 but 0 to 4 is used.
 *
 * @example
 * ```ts
 * import { exitCodeOf, exitOfRun } from "./exits.ts";
 * exitCodeOf("usage"); // 2
 * exitOfRun({ fail: 0, warn: 1, pending: 2, action: 0 }, { pending: "pending" }); // 4
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** What a run ended as, by name. */
export type ExitName =
  | "ok"
  | "findings"
  | "usage"
  | "environment"
  | "pending"
  | "startup-usage"
  | "startup-unavailable"
  | "startup-software"
  | "startup-osfile"
  | "startup-config"
  | "interrupted"
  | "terminated";

/** Every exit name, in the order of its status. */
export const EXIT_NAMES: readonly ExitName[] = [
  "ok",
  "findings",
  "usage",
  "environment",
  "pending",
  "startup-usage",
  "startup-unavailable",
  "startup-software",
  "startup-osfile",
  "startup-config",
  "interrupted",
  "terminated",
];

/** The status of a name. */
export function exitCodeOf(name: ExitName): number {
  switch (name) {
    case "ok":
      return 0;
    case "findings":
      return 1;
    case "usage":
      return 2;
    case "environment":
      return 3;
    case "pending":
      return 4;
    case "startup-usage":
      return 64;
    case "startup-unavailable":
      return 69;
    case "startup-software":
      return 70;
    case "startup-osfile":
      return 72;
    case "startup-config":
      return 78;
    case "interrupted":
      return 130;
    case "terminated":
      return 143;
    default:
      return absurd(name);
  }
}

/** The name of a status, or `undefined` for one the table does not hold. */
export function exitNameOf(code: number): ExitName | undefined {
  return EXIT_NAMES.find((n) => exitCodeOf(n) === code);
}

/** What a status means, in one line, for the help and for `explain`. */
export function exitMeaning(name: ExitName): string {
  switch (name) {
    case "ok":
      return "it did what it was asked, and nothing needs attention";
    case "findings":
      return "it ran, and found something wrong (a failed check, a drift, a failure)";
    case "usage":
      return "the command line was wrong, or the action was refused (a missing confirmation, a human-only option)";
    case "environment":
      return "something the run needs is missing or unreachable (a tool, a file, a network)";
    case "pending":
      return "nothing failed, but something is not set up yet and waits on time or on someone else";
    case "startup-usage":
      return "the program could not start: it was started wrongly (EX_USAGE)";
    case "startup-unavailable":
      return "the program could not start: a service it needs is not available (EX_UNAVAILABLE)";
    case "startup-software":
      return "the program could not start: an internal error (EX_SOFTWARE)";
    case "startup-osfile":
      return "the program could not start: a file it needs is missing or unreadable (EX_OSFILE)";
    case "startup-config":
      return "the program could not start: its configuration is wrong (EX_CONFIG)";
    case "interrupted":
      return "it was stopped by the person (SIGINT)";
    case "terminated":
      return "it was stopped by the system (SIGTERM)";
    default:
      return absurd(name);
  }
}

/** The status of the signal a run was stopped by (128 plus its number). */
export function exitOfSignal(signal: "SIGINT" | "SIGTERM"): number {
  return signal === "SIGINT" ? exitCodeOf("interrupted") : exitCodeOf("terminated");
}

/** How many problems of each level a run found. */
export type Counts = { readonly fail: number; readonly warn: number; readonly pending: number; readonly action: number };

/** What a run does with what is only pending: it is a success (`ok`, the default of an action), or its own status (`pending`, for a report that is asked to check). */
export type PendingPolicy = { readonly pending?: "ok" | "pending" };

/**
 * The status of a run from what it found: `findings` where anything failed; else `pending` where the policy says pending is its own status and
 * something is pending; else `ok`. A warning and a step for the person are not failures and never change the status.
 */
export function exitOfRun(counts: Counts, policy: PendingPolicy = {}): number {
  if (counts.fail > 0) return exitCodeOf("findings");
  if (counts.pending > 0 && policy.pending === "pending") return exitCodeOf("pending");
  return exitCodeOf("ok");
}

/** The verdicts of a run that a command can name for itself: the closed union of the exit names that are a run's own (not a launcher's, not a signal's). */
export type RunExit = "ok" | "findings" | "usage" | "environment" | "pending";

/** Every run exit, from the least severe to the most. */
export const RUN_EXITS: readonly RunExit[] = ["ok", "pending", "findings", "environment", "usage"];

/** The more severe of two named exits (`undefined` is no name): usage, then environment, findings, pending, ok. */
export function moreSevere(a: RunExit | undefined, b: RunExit | undefined): RunExit | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return RUN_EXITS.indexOf(a) >= RUN_EXITS.indexOf(b) ? a : b;
}

/**
 * The status of a run from what it found and the exit its command named (0008-exit-style-consent FR-001): no name, or `ok`, is the status of `exitOfRun`; `pending` is 4 unless
 * something failed; `findings`, `usage` and `environment` are their own statuses, however little was found. The same status is what the JSON envelope carries, so that the
 * code and the document agree.
 */
export function exitOfNamed(counts: Counts, named: RunExit | undefined, policy: PendingPolicy = {}): number {
  const derived = exitOfRun(counts, policy);
  switch (named) {
    case undefined:
    case "ok":
      return derived;
    case "pending":
      return derived === exitCodeOf("findings") ? derived : exitCodeOf("pending");
    case "findings":
    case "usage":
    case "environment":
      return exitCodeOf(named);
    default:
      return absurd(named);
  }
}
