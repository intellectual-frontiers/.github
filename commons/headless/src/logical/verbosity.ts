// Spec: 0003-headless-output FR-003
/**
 * How much of a run reaches a person (commons headless 0003-headless-output FR-003): the four modes (`calm`, the default, quiet on success and loud and
 * actionable on a problem; `verbose`, every item as it happens; `quiet`, the verdict alone; `json`, nothing for a person but one document), how
 * the flags choose among them, and which kind of line each mode shows. The surface only draws what this says to show.
 *
 * @example
 * ```ts
 * import { shows, verbosityOf } from "./verbosity.ts";
 * shows("calm", "item"); // false
 * shows("verbose", "item"); // true
 * verbosityOf({ json: false, quiet: false, verbose: true }); // ok("verbose")
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** How much of a run is shown. */
export type Verbosity = "calm" | "verbose" | "quiet" | "json";

/** Every verbosity. */
export const VERBOSITIES: readonly Verbosity[] = ["calm", "verbose", "quiet", "json"];

/** The flags that choose a verbosity. */
export type VerbosityFlags = { readonly json: boolean; readonly quiet: boolean; readonly verbose: boolean };

/**
 * The verbosity the flags choose: `json` over everything (a program that reads the output wants the document whatever else is set), `quiet`
 * and `verbose` together contradict each other and are refused, else `calm`.
 */
export function verbosityOf(flags: VerbosityFlags): Result<Verbosity, string> {
  if (flags.quiet && flags.verbose) return err("--quiet and --verbose ask for opposite things: give one of them");
  if (flags.json) return ok("json");
  if (flags.quiet) return ok("quiet");
  return ok(flags.verbose ? "verbose" : "calm");
}

/** The kinds of line a run can show. */
export type LineKind = "header" | "phase" | "item" | "change" | "problem" | "outcome" | "hint" | "verdict" | "next" | "live" | "log";

/** Every kind of line. */
export const LINE_KINDS: readonly LineKind[] = ["header", "phase", "item", "change", "problem", "outcome", "hint", "verdict", "next", "live", "log"];

/** Whether a mode shows a kind of line on the screen (the run's log records every kind whatever the mode). */
export function shows(mode: Verbosity, kind: LineKind): boolean {
  switch (mode) {
    case "json":
      return false;
    case "quiet":
      return kind === "verdict";
    case "verbose":
      return true;
    case "calm":
      return kind !== "item" && kind !== "log";
    default:
      return absurd(mode);
  }
}
