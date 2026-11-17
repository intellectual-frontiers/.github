/**
 * Paths that are valid on Linux, macOS and Windows alike (commons 0023-if-workspaces FR-009 to FR-012): `segment` refuses what one of them would not take, `repoPath` joins segments, a pair
 * of paths that are one after Unicode normalization and case folding are told apart from the ones that are not, and a path longer than Windows' limit is told as it is.
 *
 * @remarks
 * A segment is refused for: nothing in it, `.` and `..`; `<`, `>`, `:`, `"`, `/`, `\`, `|`, `?`, `*` and the control characters; a trailing dot or space; a Windows device name (`CON`, `PRN`, `AUX`,
 * `NUL`, `COM0` to `COM9`, `LPT0` to `LPT9`, with the superscript digits `¹ ² ³` in their place, and `CONIN$` and `CONOUT$`) in any case and with any extension (`aux.git` is `AUX`); more than 255 bytes in
 * UTF-8; and a name that is not in Unicode normalization form NFC (a name typed on macOS in NFD would be another name there). Case folding is the upper case then the lower case of the
 * NFC form, which makes `Straße` and `STRASSE` one name, as a case-insensitive file system does.
 *
 * @limits It reads no file system: whether a file system is case-insensitive is not asked, because the workspace refuses a collision on every one (0023-if-workspaces FR-011). Windows' own
 * rule of 260 counts the terminating character, so a path of 260 characters is the first too long (FR-012); the path of a file inside a repository is not known when its path is chosen (OQ-1).
 *
 * @module
 */
import { absurd } from "../kernel/absurd.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import type { PortableSegment, RepoPath } from "./types.ts";

/** Why a text is not a portable path segment. */
export type PortableError =
  | { readonly kind: "empty" }
  | { readonly kind: "dot"; readonly segment: string }
  | { readonly kind: "forbidden-character"; readonly segment: string; readonly character: string }
  | { readonly kind: "control-character"; readonly segment: string }
  | { readonly kind: "trailing-dot-or-space"; readonly segment: string }
  | { readonly kind: "device-name"; readonly segment: string; readonly device: string }
  | { readonly kind: "too-long"; readonly segment: string; readonly bytes: number }
  | { readonly kind: "not-nfc"; readonly segment: string };

/** A refusal as one sentence that names the text and what to do. */
export function describePortableError(e: PortableError): string {
  switch (e.kind) {
    case "empty":
      return "a path segment is empty";
    case "dot":
      return `the path segment ${JSON.stringify(e.segment)} would leave its folder`;
    case "forbidden-character":
      return `the path segment ${JSON.stringify(e.segment)} holds ${JSON.stringify(e.character)}, which Windows does not allow in a name`;
    case "control-character":
      return `the path segment ${JSON.stringify(e.segment)} holds a control character`;
    case "trailing-dot-or-space":
      return `the path segment ${JSON.stringify(e.segment)} ends in a dot or a space, which Windows drops`;
    case "device-name":
      return `the path segment ${JSON.stringify(e.segment)} is the Windows device name ${e.device}, with or without an extension, in any case`;
    case "too-long":
      return `the path segment is ${e.bytes} bytes in UTF-8, and a name may have 255`;
    case "not-nfc":
      return `the path segment ${JSON.stringify(e.segment)} is not in Unicode normalization form NFC, so it would be another name on macOS`;
    default:
      return absurd(e);
  }
}

/** The characters Windows does not allow in a name. */
const FORBIDDEN = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);

/** The reserved device names, on the part of a name before its first dot, without trailing spaces. */
const DEVICE = /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])$/i;

/** Whether a name, on the part before its first dot and without trailing spaces, is a reserved Windows device name in any case. */
export function isDeviceName(name: string): boolean {
  return DEVICE.test((name.split(".")[0] ?? "").replace(/ +$/, ""));
}

/** The longest name, in bytes of UTF-8. */
export const MAX_SEGMENT_BYTES = 255;

/** A text as a path segment valid on every operating system, or why not. */
export function segment(text: string): Result<PortableSegment, PortableError> {
  if (text === "") return err({ kind: "empty" });
  if (text === "." || text === "..") return err({ kind: "dot", segment: text });
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return err({ kind: "control-character", segment: text });
    if (FORBIDDEN.has(ch)) return err({ kind: "forbidden-character", segment: text, character: ch });
  }
  if (text.endsWith(".") || text.endsWith(" ")) return err({ kind: "trailing-dot-or-space", segment: text });
  const stem = (text.split(".")[0] ?? "").replace(/ +$/, "");
  if (isDeviceName(text)) return err({ kind: "device-name", segment: text, device: stem.toUpperCase() });
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_SEGMENT_BYTES) return err({ kind: "too-long", segment: text.slice(0, 40), bytes });
  if (text !== text.normalize("NFC")) return err({ kind: "not-nfc", segment: text });
  return ok(text as PortableSegment);
}

/** Segments as a path of the workspace, each made by `segment`, with `/` between them; the first refusal otherwise. At least one segment. */
export function repoPath(segments: readonly string[]): Result<RepoPath, PortableError> {
  if (segments.length === 0) return err({ kind: "empty" });
  const made: PortableSegment[] = [];
  for (const s of segments) {
    const r = segment(s);
    if (r.kind === "err") return r;
    made.push(r.value);
  }
  return ok(made.join("/") as RepoPath);
}

/** The segments of a path of the workspace. */
export function segmentsOf(path: RepoPath): readonly PortableSegment[] {
  return path.split("/") as PortableSegment[]; // a RepoPath is made only of segments joined by `/`
}

/** A path with one more segment below it. */
export function child(path: RepoPath, name: PortableSegment): RepoPath {
  return `${path}/${name}` as RepoPath; // both are made of portable segments
}

/** A path as the operating system writes it below a root: the root, then the segments with the platform's separator. */
export function nativePath(root: string, path: RepoPath, separator: "/" | "\\"): string {
  const base = root.replace(/[\\/]+$/, "");
  return [base, ...segmentsOf(path)].join(separator);
}

/** The key under which two names are one on a file system that folds case and normalizes Unicode: NFC, upper case, lower case, NFC. */
export function foldKey(path: string): string {
  return path.normalize("NFC").toUpperCase().toLowerCase().normalize("NFC");
}

/** Two or more paths that are one after folding, with the name each was given. */
export type Collision = { readonly key: string; readonly members: readonly { readonly id: string; readonly path: string }[] };

/**
 * The paths that collide: every group of two or more items whose paths are equal after NFC and case folding (an item listed twice collides with itself), each member named, in the order
 * of the first. `id` says what the path is for (a repository's remote, a worktree, a generated file).
 */
export function collisions(items: readonly { readonly id: string; readonly path: string }[]): readonly Collision[] {
  const groups = new Map<string, { id: string; path: string }[]>();
  for (const item of items) {
    const key = foldKey(item.path);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [{ ...item }]);
    else group.push({ ...item });
  }
  return [...groups.entries()].filter(([, members]) => members.length > 1).map(([key, members]) => ({ key, members }));
}

/** The most characters a path may have on Windows while long paths are off: 259, as the limit of 260 counts the terminating character. */
export const WINDOWS_PATH_LIMIT = 259;

/** A path that is too long for Windows, as `ifws:Error` says it. */
export type PathTooLong = { readonly kind: "path-too-long"; readonly path: string; readonly length: number; readonly limit: number };

/**
 * Whether a path, written as Windows writes it (`C:\Users\a\workspaces\github.com\o\r`), may be used: where long paths are not enabled, more than 259 characters are refused with the path named;
 * where they are, no length is refused.
 */
export function checkPathLength(windowsPath: string, longPathsEnabled: boolean): Result<string, PathTooLong> {
  if (longPathsEnabled || windowsPath.length <= WINDOWS_PATH_LIMIT) return ok(windowsPath);
  return err({ kind: "path-too-long", path: windowsPath, length: windowsPath.length, limit: WINDOWS_PATH_LIMIT });
}
