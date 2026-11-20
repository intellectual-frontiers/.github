// Spec: 0003-repoctl-sync FR-001
/**
 * Globs of paths, as the tables of the generators write them (commons repoctl 0003-repoctl-sync FR-001): `*` is the characters of one segment and `**` any number of segments. A path matches a glob, and two globs overlap where some
 * path could match both, which is what makes one generator come after another: it reads what the other writes.
 *
 * @example
 * ```ts
 * import { matches, overlap } from "./glob.ts";
 * matches("commons/*\/LICENSE", "commons/core/LICENSE"); // true
 * overlap("commons/**\/suite/**", "commons/core/suite/a.test.ts"); // true
 * ```
 *
 * @module
 */

const segments = (glob: string): readonly string[] => glob.split("/").filter((s) => s !== "");

const regexOf = (segment: string): RegExp => new RegExp(`^${segment.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);

/** Whether one segment pattern matches one name. */
const segmentMatches = (pattern: string, name: string): boolean => regexOf(pattern).test(name);

function matchFrom(pattern: readonly string[], path: readonly string[]): boolean {
  const [head, ...rest] = pattern;
  if (head === undefined) return path.length === 0;
  if (head === "**") return matchFrom(rest, path) || (path.length > 0 && matchFrom(pattern, path.slice(1)));
  const [first, ...others] = path;
  return first !== undefined && segmentMatches(head, first) && matchFrom(rest, others);
}

/** Whether a path (from the repository's root, with `/`) matches a glob. */
export function matches(glob: string, path: string): boolean {
  return matchFrom(segments(glob), segments(path));
}

/** Whether two segment patterns could match one name: equal, one matching the other read as a name, or (both with `*`) compatible beginnings and endings. */
function segmentOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a.includes("*")) return segmentMatches(b, a);
  if (!b.includes("*")) return segmentMatches(a, b);
  const head = (s: string): string => s.slice(0, s.indexOf("*"));
  const tail = (s: string): string => s.slice(s.lastIndexOf("*") + 1);
  const compatible = (x: string, y: string, from: "start" | "end"): boolean => (from === "start" ? x.startsWith(y) || y.startsWith(x) : x.endsWith(y) || y.endsWith(x));
  return compatible(head(a), head(b), "start") && compatible(tail(a), tail(b), "end");
}

function overlapFrom(a: readonly string[], b: readonly string[]): boolean {
  const [x, ...xs] = a;
  const [y, ...ys] = b;
  if (x === undefined && y === undefined) return true;
  if (x === "**") return overlapFrom(xs, b) || (y !== undefined && overlapFrom(a, ys));
  if (y === "**") return overlapFrom(a, ys) || (x !== undefined && overlapFrom(xs, b));
  if (x === undefined || y === undefined) return false;
  return segmentOverlap(x, y) && overlapFrom(xs, ys);
}

/** Whether some path could match both globs. */
export function overlap(a: string, b: string): boolean {
  return overlapFrom(segments(a), segments(b));
}
