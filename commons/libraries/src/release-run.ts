// Spec: 0001-libraries FR-008
/**
 * The root `release` command: it runs the release tool with the arguments it is given, and after a successful `apply` it makes the generated files again, so that what a version change alters (the installers, the register) is committed with it.
 *
 * @module
 */
import { spawnSync } from "node:child_process";

const run = (argv: readonly string[]): number => spawnSync(process.execPath, [...argv], { stdio: "inherit" }).status ?? 1;

const args = process.argv.slice(2);
const released = run(["commons/libraries/src/releasing.ts", ...args]);
process.exit(released !== 0 || args[0] !== "apply" ? released : run(["commons/repoctl/src/repoctl.ts", "sync"]));
