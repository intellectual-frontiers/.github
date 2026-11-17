/**
 * The former name of `mizan-check.ts` (commons 0003-mizan FR-009): kept for one repin cycle, so that a harness that runs
 * `bun commons/tools/spec-kit-check.ts` keeps working until it runs `mizan-check.ts`. It adds nothing.
 *
 * @module
 */
import { main } from "./mizan-check.ts";

export * from "./mizan-check.ts";

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
