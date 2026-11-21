// Spec: 0002-anyfs-posix-governance FR-004
/**
 * The paths a program of POSIX gives, and how they become the keys of a store. A POSIX path is text: absolute from the root of the store, or relative to a working directory the program holds as a value
 * (there is none in the process). `.` and `..` are resolved by the text alone, and `..` at the root stays at the root, as a file system does. A backslash, a control character and a NUL are refused at
 * this boundary, never passed on. The key of a store is made from the resolved path by the parser of the store, so that nothing here can name what a store would refuse.
 *
 * @example
 * ```ts
 * import { resolvePosix, ROOT_PATH } from "./posix-path.ts";
 * const r = resolvePosix(ROOT_PATH, "a//b/./c/../d");
 * r.kind === "ok" && r.value; // "/a/b/d"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Path, parsePath, type Prefix, ROOT } from "@intellectual-frontiers/anyfs/governance";

/** An absolute path in the view of a store: `/`, or `/` and segments joined by `/`. Made only by `resolvePosix` and `parseAbsolute`. */
export type PosixPath = Brand<string, "anyfs posix path">;

/** The root. */
export const ROOT_PATH = "/" as PosixPath;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

/** The reason a text is not a path of POSIX, or nothing where it is one. */
function refusal(text: string): string | undefined {
  if (text === "") return "an empty text is not a path";
  if (!text.isWellFormed()) return "a path holds a lone surrogate, which is not text";
  if (text.includes("\\")) return `${JSON.stringify(text)} holds a backslash: a path is joined by "/" only`;
  if (CONTROL.test(text)) return `${JSON.stringify(text)} holds a control character`;
  return undefined;
}

/** The segments of a text that resolve below the segments of a base: `.` and empty segments are dropped and `..` takes one away, never below the root. */
function segmentsOf(base: readonly string[], text: string): readonly string[] {
  const out = [...base];
  for (const s of text.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return out;
}

const fromSegments = (segments: readonly string[]): PosixPath => (segments.length === 0 ? ROOT_PATH : (`/${segments.join("/")}` as PosixPath));
const segmentsOfPath = (p: PosixPath): readonly string[] => (p === ROOT_PATH ? [] : p.slice(1).split("/"));

/** A path from text, resolved against a working directory: absolute where it begins with `/`, otherwise below the working directory. */
export function resolvePosix(cwd: PosixPath, text: string): Result<PosixPath, string> {
  const why = refusal(text);
  if (why !== undefined) return err(why);
  const normal = text.normalize("NFC");
  return ok(fromSegments(segmentsOf(normal.startsWith("/") ? [] : segmentsOfPath(cwd), normal)));
}

/** An absolute path from text: the text begins with `/`. */
export function parseAbsolute(text: string): Result<PosixPath, string> {
  if (!text.startsWith("/")) return err(`${JSON.stringify(text)} is not absolute: it begins with "/"`);
  return resolvePosix(ROOT_PATH, text);
}

/** The key of a store for a path: nothing for the root, and the reason where the store would not take the path. */
export function storePathOf(path: PosixPath): Result<Path | undefined, string> {
  if (path === ROOT_PATH) return ok(undefined);
  return parsePath(path.slice(1));
}

/** The prefix of a store for a path: the root for the root. */
export function prefixOf(path: PosixPath): Result<Prefix, string> {
  if (path === ROOT_PATH) return ok(ROOT);
  const p = parsePath(path.slice(1));
  return p.kind === "ok" ? ok(p.value as string as Prefix) : p;
}

/** The path of a key of a store. */
export function posixOf(path: Path): PosixPath {
  return `/${path}` as PosixPath;
}

/** The directory that holds a path: the root holds itself. */
export function parentPosix(path: PosixPath): PosixPath {
  return fromSegments(segmentsOfPath(path).slice(0, -1));
}

/** The last name of a path: nothing for the root. */
export function baseName(path: PosixPath): string | undefined {
  return segmentsOfPath(path).at(-1);
}

/** The path of a name in a directory. */
export function joinPosix(dir: PosixPath, name: string): PosixPath {
  return fromSegments([...segmentsOfPath(dir), name]);
}

/** Whether a path is below a directory: the root holds every other path, and a path is not below itself. */
export function isBelow(dir: PosixPath, path: PosixPath): boolean {
  return dir === ROOT_PATH ? path !== ROOT_PATH : path.startsWith(`${dir}/`);
}

/** Every directory above a path, from the root's child down to its parent: none for the root and for a path of one name. */
export function ancestorsOf(path: PosixPath): readonly PosixPath[] {
  const segments = segmentsOfPath(path);
  const out: PosixPath[] = [];
  for (let i = 1; i < segments.length; i++) out.push(fromSegments(segments.slice(0, i)));
  return out;
}
