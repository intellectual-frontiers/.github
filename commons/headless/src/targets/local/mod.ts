// Spec: 0005-reach-and-targets FR-004
/**
 * The local target (commons headless 0005-reach-and-targets FR-004): an `Executor` that runs the program here, through the system's `proc`. It adds nothing and
 * takes nothing away: the options and the output are `proc`'s own, so a command run here is the command run anywhere else, with only the executor changed.
 *
 * @example
 * ```ts
 * import { localExecutor } from "@intellectual-frontiers/headless/targets/local";
 * // const out = await localExecutor().exec(["git", "--version"]);
 * ```
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import type { Executor } from "@intellectual-frontiers/headless/logical";

/** The executor that runs a program on this machine. */
export function localExecutor(): Executor {
  return { exec: (argv, opts) => proc.output(argv, opts) };
}
