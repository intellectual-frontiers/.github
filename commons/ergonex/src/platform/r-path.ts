// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `path`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/commons/ts/runtime";
/** `path.basename`. */
export const basename = path.basename;
/** `path.delimiter`. */
export const delimiter = path.delimiter;
/** `path.dirname`. */
export const dirname = path.dirname;
/** `path.fromFileUrl`. */
export const fromFileUrl = path.fromFileUrl;
/** `path.isAbsolute`. */
export const isAbsolute = path.isAbsolute;
/** `path.join`. */
export const join = path.join;
/** `path.relative`. */
export const relative = path.relative;
/** `path.posix`. */
export const posix = path.posix;
/** `path.win32`. */
export const win32 = path.win32;
/** `path.resolve`. */
export const resolve = path.resolve;
/** `path.sep`. */
export const sep = path.sep;
/** `path.toFileUrl`. */
export const toFileUrl = path.toFileUrl;
/** `path.toPosix`. */
export const toPosix = path.toPosix;
