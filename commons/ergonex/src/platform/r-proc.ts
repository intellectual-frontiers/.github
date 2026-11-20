// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `proc`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
/** `proc.build`. */
export const build = proc.build;
/** `proc.cwd`. */
export const cwd = proc.cwd;
/** `proc.env`. */
export const env = proc.env;
/** `proc.execPath`. */
export const execPath = proc.execPath;
/** `proc.output`. */
export const output = proc.output;
/** `proc.run`. */
export const run = proc.run;
/** `proc.runtimeName`. */
export const runtimeName = proc.runtimeName;
/** `proc.runtimeVersion`. */
export const runtimeVersion = proc.runtimeVersion;
/** `proc.which`. */
export const which = proc.which;
