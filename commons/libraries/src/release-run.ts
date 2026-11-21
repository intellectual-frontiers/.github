// Spec: 0001-libraries FR-008
/**
 * The root `release` command: it runs the release tool with the arguments it is given. `apply` makes every generated file itself (it refreshes the lockfiles and runs `repoctl sync` before the tests that pack, 0001-libraries FR-014), so that what
 * a version change alters (the installers, the register) is committed with it and nothing is left for a second command.
 *
 * @module
 */
import { spawnSync } from "node:child_process";

process.exit(spawnSync(process.execPath, ["commons/libraries/src/releasing.ts", ...process.argv.slice(2)], { stdio: "inherit" }).status ?? 1);
