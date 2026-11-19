// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `dirs`, by the package name of commons (commons 0027-commons-libraries FR-004): where a program keeps its files on each system, by the conventions of the system and not by one of ours (commons
 * 0031-install-locations).
 *
 * @module
 */
import { dirs } from "@intellectual-frontiers/commons/ts/runtime";
/** `dirs.dirsOf`. */
export const dirsOf = dirs.dirsOf;
/** `dirs.homeOf`. */
export const homeOf = dirs.homeOf;
/** `dirs.Dirs`. */
export type Dirs = dirs.Dirs;
/** `dirs.Env`. */
export type Env = dirs.Env;
/** `dirs.Os`. */
export type Os = dirs.Os;
