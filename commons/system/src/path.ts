// Spec: 0001-system FR-003
/**
 * Paths, on `node:path` (commons 0001-system FR-003): the platform's own rules, and `posix` and `win32` for the other's, with
 * `file:` URLs both ways.
 *
 * @example
 * ```ts
 * import { basename, join } from "./path.ts";
 * basename(join("a", "b", "c.txt")); // "c.txt"
 * ```
 *
 * @module
 */
import * as nodePath from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Path segments joined and normalized. */
export const join: (...paths: string[]) => string = nodePath.join;
/** The folder a path is in. */
export const dirname: (path: string) => string = nodePath.dirname;
/** The last segment of a path, without `suffix` where it ends with it. */
export const basename: (path: string, suffix?: string) => string = nodePath.basename;
/** The extension of the last segment, with its dot (`.ts`), or `""`. */
export const extname: (path: string) => string = nodePath.extname;
/** The path from one to the other. */
export const relative: (from: string, to: string) => string = nodePath.relative;
/** An absolute path, the segments taken from the right until one is absolute, against the working folder. */
export const resolve: (...paths: string[]) => string = nodePath.resolve;
/** A path with `.` and `..` and repeated separators resolved. */
export const normalize: (path: string) => string = nodePath.normalize;
/** Whether a path is absolute. */
export const isAbsolute: (path: string) => boolean = nodePath.isAbsolute;
/** A path's root, folder, base, name and extension. */
export const parse: (path: string) => nodePath.ParsedPath = nodePath.parse;
/** A path made from its parts. */
export const format: (parts: nodePath.FormatInputPathObject) => string = nodePath.format;
/** This platform's separator between segments: `/`, or `\` on Windows. */
export const sep: string = nodePath.sep;
/** This platform's separator between paths in `PATH`: `:`, or `;` on Windows. */
export const delimiter: string = nodePath.delimiter;
/** The POSIX rules, on any platform. */
export const posix: typeof nodePath.posix = nodePath.posix;
/** The Windows rules, on any platform. */
export const win32: typeof nodePath.posix = nodePath.win32;

/** A `file:` URL as a path. */
export function fromFileUrl(url: string | URL): string {
  return fileURLToPath(url);
}

/** A path as a `file:` URL. */
export function toFileUrl(path: string): URL {
  return pathToFileURL(path);
}

/** A path with `/` between its segments whatever the platform, as archives and URLs write them. */
export function toPosix(path: string): string {
  return path.split(nodePath.sep).join("/");
}
