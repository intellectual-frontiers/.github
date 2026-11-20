// Spec: 0001-system FR-020
/**
 * System, the host of Intellectual Frontiers Commons as one typed library (its specification 0001-system): typed errors (as `errors`, with `mapError`, `RuntimeError` and `toError`), files (as `fs`), paths (as `path`),
 * the folders a program keeps its files in (as `dirs`), one run at a time (as `lock`), file watching (as `watch`), programs found by the prefix of their name (as `discover`), the process and the programs it runs
 * (as `proc`), Git read by running it (as `git`), a program built into one binary (as `compile`), the operating system's scheduled jobs installed (as `jobs`) and planned (as `jobPlan`), and the terminal's
 * streams (as `tty` and `stdio`). It names `node:` builtins and no vendor's global, depends on core, formats and crypto, and runs the same on Bun and on Node 26.
 *
 * @example
 * ```ts
 * import { fs, path } from "@intellectual-frontiers/system";
 * const text = await fs.readTextFile(path.join("a", "b.txt"));
 * ```
 *
 * @module
 */
export * as compile from "./compile.ts";
export * as dirs from "./dirs.ts";
export * as discover from "./discover.ts";
export { errors, mapError, RuntimeError, toError } from "./errors.ts";
export * as fs from "./fs.ts";
export * as git from "./git.ts";
export * as jobPlan from "./job-plan.ts";
export * as jobs from "./schedule.ts";
export * as lock from "./lock.ts";
export * as path from "./path.ts";
export * as proc from "./proc.ts";
export * as stdio from "./stdio.ts";
export * as tty from "./tty.ts";
export * as watch from "./watch.ts";
