// Spec: 0003-anyfs-cli-logical FR-010
/**
 * How a verb ends (commons anyfs-cli 0003-anyfs-cli-logical FR-010): a run that did what was asked, a run that found something (a name that is not there, two files that differ), a command line that does not fit, and a
 * computer that cannot do it are four endings with four exit names, and each problem has the code of the catalogue and the command that fixes it. Pure functions of their arguments.
 *
 * @example
 * ```ts
 * import { finding, usage } from "./outcomes.ts";
 * usage("ls takes a place").exit; // "usage"
 * finding("E-FILESYSTEM", "ENOENT /a: no such name").problems[0]?.code; // "E-FILESYSTEM"
 * ```
 *
 * @module
 */
import { problem, type Problem } from "@intellectual-frontiers/headless/governance";
import { outcomeOf, withExit, type Outcome } from "@intellectual-frontiers/headless/logical";
import { CATALOGUE, type ProblemCode } from "@intellectual-frontiers/anyfs-cli/governance";

/** A problem of a code, with the message of the run and the fix of the catalogue unless one is given. */
export function problemOf(code: ProblemCode, message: string, fix?: string): Problem {
  return problem("fail", message, { code, fix: fix ?? CATALOGUE[code].fix });
}

/** A run that found something, which is a result and not a failure of the program: exit `findings`. */
export function finding(code: ProblemCode, message: string, fix?: string): Outcome {
  return outcomeOf(null, { problems: [problemOf(code, message, fix)] });
}

/** A run whose command line does not fit what the verb takes: exit `usage`. */
export function usage(message: string, fix = "anyfs help"): Outcome {
  return withExit(outcomeOf(null, { problems: [problemOf("E-USAGE", message, fix)] }), "usage");
}

/** A run that cannot be made on this computer: exit `environment`. */
export function environment(code: ProblemCode, message: string, fix?: string): Outcome {
  return withExit(outcomeOf(null, { problems: [problemOf(code, message, fix)] }), "environment");
}
