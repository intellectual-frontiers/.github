/**
 * Names: a path as a typed value relative to its root, normalized and unable to leave it, and the limits of the stores a path must fit
 * (commons 0010-file-aide FR-012, FR-013).
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "../../../kernel/mod.ts";

/** A path relative to its root: names joined by `/`, none empty, `.` or `..`, in Unicode's normalization form C. */
export type RelPath = Brand<string, "RelPath">;

/** Why text is not a path relative to a root. */
export type PathError = { readonly kind: "invalid-path"; readonly path: string; readonly why: string };

const CONTROL = /[\u0000-\u001f\u007f]/u;

function brandPath(text: string): RelPath {
  // the one place a string becomes a path: everything that reaches here has been checked by `relPath`
  return text as RelPath;
}

/**
 * Checks and normalizes text as a path relative to a root (FR-012): its text is put in normalization form C, and a path that is empty,
 * begins or ends with `/`, has an empty, `.` or `..` name, or holds a backslash or a control character is refused.
 *
 * @param text - the path as given
 */
export function relPath(text: string): Result<RelPath, PathError> {
  const why = problemOf(text);
  if (why !== undefined) return err({ kind: "invalid-path", path: text, why });
  return ok(brandPath(text.normalize("NFC")));
}

function problemOf(text: string): string | undefined {
  if (text === "") return "it is empty";
  if (text.startsWith("/")) return "it begins at the root of the computer, not of the store";
  if (text.endsWith("/")) return "it ends with /";
  if (text.includes("\\")) return "it holds a backslash";
  if (CONTROL.test(text)) return "it holds a control character";
  for (const name of text.split("/")) {
    if (name === "") return "it has an empty name";
    if (name === "." || name === "..") return `it has the name ${name}, which would leave its place`;
  }
  return undefined;
}

/** Joins names into a path relative to a root, or says why they are not one. */
export function joinPath(...names: readonly string[]): Result<RelPath, PathError> {
  return relPath(names.filter((n) => n !== "").join("/"));
}

/** What a store allows of a path (FR-013). */
export type NameLimits = {
  /** The store's name, in a finding. */
  readonly name: string;
  /** The most bytes of UTF-8 a whole key may have. */
  readonly maxPathBytes?: number;
  /** The most bytes of UTF-8 one name may have. */
  readonly maxNameBytes?: number;
  /** Whether Windows' reserved names and characters are refused. */
  readonly windows: boolean;
  /** Whether two names that differ only in case are the same file. */
  readonly foldsCase: boolean;
};

/** S3: a key of at most 1,024 bytes of UTF-8, in which case matters. */
export const S3_LIMITS: NameLimits = { name: "s3", maxPathBytes: 1024, windows: false, foldsCase: false };
/** Linux: a name of at most 255 bytes and a path of at most 4,096. */
export const LINUX_LIMITS: NameLimits = { name: "linux", maxPathBytes: 4096, maxNameBytes: 255, windows: false, foldsCase: false };
/** macOS: as Linux, and its usual file system folds case. */
export const MACOS_LIMITS: NameLimits = { name: "macos", maxPathBytes: 1024, maxNameBytes: 255, windows: false, foldsCase: true };
/** Windows: reserved names and characters, and case folded. */
export const WINDOWS_LIMITS: NameLimits = { name: "windows", maxPathBytes: 32767, maxNameBytes: 255, windows: true, foldsCase: true };

/** A path that a store would refuse, or two that it would take for one. */
export type NameFinding =
  | { readonly kind: "too-long"; readonly store: string; readonly path: string; readonly bytes: number; readonly most: number }
  | {
      readonly kind: "name-too-long";
      readonly store: string;
      readonly path: string;
      readonly name: string;
      readonly bytes: number;
      readonly most: number;
    }
  | { readonly kind: "reserved"; readonly store: string; readonly path: string; readonly name: string; readonly why: string }
  | { readonly kind: "case-collision"; readonly store: string; readonly paths: readonly [string, string] };

const RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;
const WINDOWS_CHARS = /[<>:"|?*]/u;
const bytesOf = (text: string): number => new TextEncoder().encode(text).length;

function windowsProblem(name: string): string | undefined {
  if (RESERVED.test(name)) return "a name Windows reserves for a device";
  if (WINDOWS_CHARS.test(name)) return "a character Windows refuses in a name";
  if (name.endsWith(".") || name.endsWith(" ")) return "a name Windows ends without its last dot or space";
  return undefined;
}

/**
 * The paths that break a store's limits, and the pairs a store that folds case would take for one file (FR-013).
 *
 * @param paths - the paths, each checked by `relPath`
 * @param limits - the limits of every store the paths are used with
 */
export function checkNames(paths: Iterable<RelPath>, limits: readonly NameLimits[]): readonly NameFinding[] {
  const found: NameFinding[] = [];
  const all = [...paths];
  for (const l of limits) {
    const folded = new Map<string, string>();
    for (const p of all) {
      const bytes = bytesOf(p);
      if (l.maxPathBytes !== undefined && bytes > l.maxPathBytes)
        found.push({ kind: "too-long", store: l.name, path: p, bytes, most: l.maxPathBytes });
      for (const name of p.split("/")) {
        const nb = bytesOf(name);
        if (l.maxNameBytes !== undefined && nb > l.maxNameBytes)
          found.push({ kind: "name-too-long", store: l.name, path: p, name, bytes: nb, most: l.maxNameBytes });
        const why = l.windows ? windowsProblem(name) : undefined;
        if (why !== undefined) found.push({ kind: "reserved", store: l.name, path: p, name, why });
      }
      if (l.foldsCase) {
        const key = p.toLowerCase();
        const before = folded.get(key);
        if (before !== undefined && before !== p) found.push({ kind: "case-collision", store: l.name, paths: [before, p] });
        else folded.set(key, p);
      }
    }
  }
  return found;
}
