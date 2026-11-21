// Spec: 0002-bridge-plans FR-006
/**
 * The patterns of a filter: a small glob with no regular expression in it, so that a pattern from a person can never take a long time to match. A pattern is `/`-separated segments. In a segment `*`
 * is any run of characters and `?` any one character; a segment that is `**` is any number of segments, none included. A pattern with no `/` matches wherever a segment of the path matches it, so that
 * `node_modules` or `*.tmp` leaves out a whole subtree; a pattern with a `/` is anchored at the root of the endpoint.
 *
 * @example
 * ```ts
 * import { globMatches, parseGlob } from "./glob.ts";
 * const g = parseGlob("*.tmp");
 * g.kind === "ok" && globMatches(g.value, "a/b/c.tmp"); // true
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Path } from "@intellectual-frontiers/anyfs/governance";

/** A pattern, made only by `parseGlob`: its segments and whether it is anchored. */
export type Glob = Brand<string, "anyfs-bridge glob">;

const MAX_GLOB = 512;

/** A glob from text, or why it is not one: not empty, at most 512 characters, no NUL, no backslash, no empty segment, and `**` only as a whole segment. */
export function parseGlob(text: string): Result<Glob, string> {
  if (text === "" || text.length > MAX_GLOB) return err(`a pattern is 1 to ${MAX_GLOB} characters`);
  if (text.includes("\0") || text.includes("\\")) return err(`${JSON.stringify(text)} holds a NUL or a backslash`);
  const segments = text.split("/");
  if (segments.some((s) => s === "")) return err(`${JSON.stringify(text)} has an empty segment`);
  if (segments.some((s) => s.includes("**") && s !== "**")) return err(`${JSON.stringify(text)} uses ** inside a segment: it is a segment of its own`);
  return ok(text as Glob);
}

/** Whether one segment of a path matches one segment of a pattern: `*` and `?` only, by two cursors and one backtrack point, so that it never takes more than the product of the lengths. */
function segmentMatches(pattern: string, name: string): boolean {
  let p = 0;
  let n = 0;
  let star = -1;
  let mark = 0;
  while (n < name.length) {
    const c = pattern[p];
    if (c === "*") {
      star = p++;
      mark = n;
    } else if (c === "?" || (c !== undefined && c === name[n])) {
      p++;
      n++;
    } else if (star >= 0) {
      p = star + 1;
      n = ++mark;
    } else return false;
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}

/** Whether the segments of a pattern, from `i`, match the segments of a path, from `j`: `**` takes any number of segments. */
function sequenceMatches(pattern: readonly string[], i: number, name: readonly string[], j: number): boolean {
  if (i === pattern.length) return j === name.length;
  if (pattern[i] === "**") {
    for (let k = j; k <= name.length; k++) if (sequenceMatches(pattern, i + 1, name, k)) return true;
    return false;
  }
  return j < name.length && segmentMatches(pattern[i] ?? "", name[j] ?? "") && sequenceMatches(pattern, i + 1, name, j + 1);
}

/** Whether a glob matches a path: anchored where it holds a `/`, and at any segment where it holds none. */
export function globMatches(glob: Glob, path: Path): boolean {
  const names = path.split("/");
  const pattern = glob.split("/");
  if (pattern.length === 1) return names.some((name) => segmentMatches(glob, name));
  return sequenceMatches(pattern, 0, names, 0);
}

/** Whether any of the globs matches the path. */
export function anyGlobMatches(globs: readonly Glob[], path: Path): boolean {
  return globs.some((g) => globMatches(g, path));
}
