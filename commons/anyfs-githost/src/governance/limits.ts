// Spec: 0002-anyfs-githost-store FR-002
/**
 * What a Git store will hold: the largest object (a refusal that names the limit, never a truncation), and the names Git treats specially or that two computers read differently: the `.git` component in
 * every spelling a file system gives it, and paths that differ only by case. Pure: the checks are functions of text.
 *
 * @example
 * ```ts
 * import { gitPathProblems, caseCollisions } from "./limits.ts";
 * import { parsePath } from "@intellectual-frontiers/anyfs/governance";
 * const p = parsePath("a/.GIT/config");
 * p.kind === "ok" && gitPathProblems(p.value).length; // 1
 * ```
 *
 * @module
 */
import type { Path } from "@intellectual-frontiers/anyfs/governance";

/** The largest object a Git store holds unless told another limit: 25 MiB. Larger files belong in a store made for them; large file storage is not part of this library. */
export const DEFAULT_MAX_OBJECT_BYTES = 25 * 1024 * 1024;

// the names a file system reads as `.git`: any case, trailing dots and spaces (NTFS), and the short name of it
const GIT_NAME = /^(?:\.git|git~1)[. ]*$/iu;

/** What makes a path unfit for a Git repository: one sentence for each reason, none where the path is fit. */
export function gitPathProblems(path: Path): readonly string[] {
  const out: string[] = [];
  for (const segment of path.split("/")) {
    if (GIT_NAME.test(segment)) out.push(`${JSON.stringify(segment)} is read as the folder of Git itself by some file systems`);
  }
  return out;
}

/** The groups of paths that differ only by case: a computer that does not tell case apart holds one of each group. */
export function caseCollisions(paths: Iterable<Path>): readonly (readonly Path[])[] {
  const groups = new Map<string, Path[]>();
  for (const p of paths) {
    const key = p.toLowerCase();
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [p]);
    else if (!group.includes(p)) group.push(p);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.toSorted());
}
