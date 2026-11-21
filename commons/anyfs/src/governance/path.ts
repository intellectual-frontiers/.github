// Spec: 0002-anyfs-governance FR-001, FR-002
/**
 * The keys of a store: a path and a prefix, each a branded text made only by its parser, and the reasons another file system could not hold a path. A path is a relative key of segments joined
 * by `/`, never an operating system's path: it has no `.` or `..`, no backslash, no control character, and it is in Unicode normalization form C, so that two spellings of one name are one path.
 * Paths are case sensitive; a store that cannot tell two paths apart by case says so in its traits, and `portabilityFindings` names what a path could not be in a case-folding or Windows file system.
 *
 * @example
 * ```ts
 * import { parsePath, parsePrefix, isUnder } from "./path.ts";
 * const p = parsePath("fleet/olympia/asset.json");
 * const prefix = parsePrefix("fleet");
 * p.kind === "ok" && prefix.kind === "ok" && isUnder(prefix.value, p.value); // true
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** A key of a store: one or more segments joined by `/`, in normalization form C. Made only by `parsePath`. */
export type Path = Brand<string, "anyfs path">;
/** The root or a path: what a list is asked below. Made only by `parsePrefix`. */
export type Prefix = Brand<string, "anyfs prefix">;

/** The longest segment of a path, in UTF-8 bytes. */
export const MAX_SEGMENT_BYTES = 255;
/** The longest path, in UTF-8 bytes. */
export const MAX_PATH_BYTES = 1024;

const encoder = new TextEncoder();
const bytes = (text: string): number => encoder.encode(text).length;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

/** A path from text, or the reason it is not one. The text is returned in normalization form C. */
export function parsePath(text: string): Result<Path, string> {
  if (!text.isWellFormed()) return err("a path holds a lone surrogate, which is not text");
  const t = text.normalize("NFC");
  if (t === "") return err("a path has at least one segment");
  if (t.includes("\\")) return err(`${JSON.stringify(text)} holds a backslash: a path is joined by "/" only`);
  if (CONTROL.test(t)) return err(`${JSON.stringify(text)} holds a control character`);
  for (const segment of t.split("/")) {
    if (segment === "") return err(`${JSON.stringify(text)} has an empty segment: no leading, trailing or doubled "/"`);
    if (segment === "." || segment === "..") return err(`${JSON.stringify(text)} has the segment ${JSON.stringify(segment)}: a path is below its store and never names the way up`);
    if (bytes(segment) > MAX_SEGMENT_BYTES) return err(`a segment of ${JSON.stringify(text.slice(0, 40))}… is more than ${MAX_SEGMENT_BYTES} bytes`);
  }
  if (bytes(t) > MAX_PATH_BYTES) return err(`${JSON.stringify(text.slice(0, 40))}… is more than ${MAX_PATH_BYTES} bytes`);
  return ok(t as Path);
}

/** The root of a store: the prefix of every path. */
export const ROOT: Prefix = "" as Prefix;

/** A prefix from text: the empty text is the root, and any other text is a path. */
export function parsePrefix(text: string): Result<Prefix, string> {
  if (text === "") return ok(ROOT);
  const p = parsePath(text);
  return p.kind === "ok" ? ok(p.value as string as Prefix) : p;
}

/** Whether a path is below a prefix: every path is below the root, and a prefix is not below itself. */
export function isUnder(prefix: Prefix, path: Path): boolean {
  return prefix === "" || path.startsWith(`${prefix}/`);
}

/** The path below a prefix, or nothing where the path is not below it. */
export function relativeTo(prefix: Prefix, path: Path): Path | undefined {
  if (prefix === "") return path;
  return path.startsWith(`${prefix}/`) ? (path.slice(prefix.length + 1) as Path) : undefined;
}

/** The prefix below a base: the root where they are the same, and nothing where the prefix is not below the base. */
export function relativePrefix(base: Prefix, prefix: Prefix): Prefix | undefined {
  if (base === "") return prefix;
  if (prefix === base) return ROOT;
  return prefix.startsWith(`${base}/`) ? (prefix.slice(base.length + 1) as Prefix) : undefined;
}

/** A path below a prefix: the prefix, a `/` and the path, or why it is too long. */
export function below(prefix: Prefix, path: Path): Result<Path, string> {
  if (prefix === "") return ok(path);
  const joined = `${prefix}/${path}`;
  return bytes(joined) > MAX_PATH_BYTES ? err(`${JSON.stringify(joined.slice(0, 40))}… is more than ${MAX_PATH_BYTES} bytes`) : ok(joined as Path);
}

/** The last segment of a path. */
export function nameOf(path: Path): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

/** The prefix that holds a path: the root for a path of one segment. */
export function parentOf(path: Path): Prefix {
  const i = path.lastIndexOf("/");
  return i < 0 ? ROOT : (path.slice(0, i) as Prefix);
}

/** The order of paths in a list: by their code points, which no locale changes and which is the order of their UTF-8 bytes. */
export function comparePaths(a: string, b: string): number {
  if (a === b) return 0;
  const n = Math.min(a.length, b.length);
  // UTF-16 puts the surrogates of the characters above U+FFFF before U+E000 to U+FFFF; moving them after gives the order of the code points
  const unit = (c: number): number => (c >= 0xe000 ? c - 0x800 : c >= 0xd800 ? c + 0x2000 : c);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return unit(x) < unit(y) ? -1 : 1;
  }
  return a.length < b.length ? -1 : 1;
}

const RESERVED_CHARACTERS = /[<>:"|?*]/u;
const DEVICES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

/** What another file system could not hold in a path: one sentence for each reason, none where the path is portable. */
export function portabilityFindings(path: Path): readonly string[] {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    const reserved = RESERVED_CHARACTERS.exec(segment);
    if (reserved !== null) out.push(`${JSON.stringify(segment)} holds ${JSON.stringify(reserved[0])}, which Windows reserves`);
    if (/[ .]$/u.test(segment)) out.push(`${JSON.stringify(segment)} ends in a space or a dot, which Windows drops`);
    if (DEVICES.test(segment)) out.push(`${JSON.stringify(segment)} is the name of a device on Windows`);
  }
  return out;
}
