/**
 * Which files are a work's (commons 0026-works-versioning FR-009): a work is a folder that holds a `release.ts`; its files are every file Git tracks under the folder except those of a work nested
 * in it, its own `release.ts` and `CITATION.cff`, and the paths its record names in `exclude`. Every judgement of a version is scoped to those files and to no others (path-scoped).
 *
 * @remarks
 * Pure: it works on lists of paths (as `git ls-files` or `git ls-tree` gives them, with `/`), so the same code scopes a tree at the head and at the base. A path is a work's by its place alone, so
 * a file that was deleted is still told as the work's it was. A work of a repository of one work keeps its record at the root, and its folder is `""`.
 *
 * @limits
 * It does not read a record: `exclude` is an argument.
 *
 * @example
 * ```ts
 * import { scopeOf, workFolders } from "./works.ts";
 * const folders = workFolders(["a/release.ts", "a/x.ts", "a/b/release.ts", "a/b/y.ts"]); // ["a", "a/b"]
 * scopeOf("a", folders, [])("a/b/y.ts"); // false: it is a nested work's
 * ```
 *
 * @module
 */
import { CITATION_FILE, RECORD_FILE } from "./record.ts";

/** The folder a path is in: everything before its last `/`, `""` for a file at the root. */
export function folderOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** The path of the record of the work in a folder. */
export function recordPathOf(folder: string): string {
  return folder === "" ? RECORD_FILE : `${folder}/${RECORD_FILE}`;
}

/** The folders that hold a `release.ts` among tracked paths, in order. */
export function workFolders(paths: readonly string[]): readonly string[] {
  return paths
    .filter((p) => p === RECORD_FILE || p.endsWith(`/${RECORD_FILE}`))
    .map(folderOf)
    .sort();
}

/** Whether `path` is `under` or inside it (`""` holds everything). */
export function isUnder(path: string, under: string): boolean {
  return under === "" || path === under || path.startsWith(`${under}/`);
}

/**
 * Whether a path is a file of the work in `folder` (FR-009): under the folder, not under another work's folder nested in it, not its `release.ts` or `CITATION.cff`, and not under a path of
 * `exclude` (paths of the folder).
 */
export function scopeOf(folder: string, folders: readonly string[], exclude: readonly string[]): (path: string) => boolean {
  const nested = folders.filter((f) => f !== folder && f !== "" && isUnder(f, folder));
  const own = new Set([recordPathOf(folder), folder === "" ? CITATION_FILE : `${folder}/${CITATION_FILE}`]);
  const excluded = exclude.map((e) => (folder === "" ? e : `${folder}/${e}`));
  return (path) =>
    isUnder(path, folder) && !own.has(path) && !nested.some((n) => isUnder(path, n)) && !excluded.some((e) => isUnder(path, e));
}

/** The paths of a work among tracked paths. */
export function filesOf(
  paths: readonly string[],
  folder: string,
  folders: readonly string[],
  exclude: readonly string[],
): readonly string[] {
  const inScope = scopeOf(folder, folders, exclude);
  return paths.filter(inScope);
}
