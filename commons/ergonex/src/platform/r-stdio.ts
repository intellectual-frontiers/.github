// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `stdio`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { stdio } from "@intellectual-frontiers/commons/ts/runtime";
/** `stdio.stderr`. */
export const stderr = stdio.stderr;
/** `stdio.stdin`. */
export const stdin = stdio.stdin;
/** `stdio.stdout`. */
export const stdout = stdio.stdout;
