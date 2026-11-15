/**
 * Ignore files: `.gitignore`, `.git/info/exclude` and `.faignore`, read with Git's rules (patterns, negation, anchoring, patterns that match
 * only folders, the last match deciding and a deeper file after a shallower one), which a query applies by default (commons 0010-file-aide
 * FR-027, FR-028).
 *
 * @module
 */
import { type Glob, glob } from "./glob.ts";

/** The names of the files whose rules a walk reads in each folder. */
export const IGNORE_FILES = [".gitignore", ".faignore"] as const;

/** One rule of an ignore file. */
export type IgnoreRule = {
  /** The line as written. */
  readonly source: string;
  /** Whether it brings back what an earlier rule left out (`!`). */
  readonly negated: boolean;
  /** Whether it matches only folders (a trailing `/`). */
  readonly folderOnly: boolean;
  /** The pattern, relative to the folder of its file. */
  readonly glob: Glob;
};

/** The rules of one ignore file, and the folder they are relative to (`""` for the root, otherwise ending with `/`). */
export type IgnoreFile = { readonly base: string; readonly rules: readonly IgnoreRule[] };

/**
 * Reads the rules of an ignore file. A line that is not a valid pattern is left out, as Git leaves it out.
 *
 * @param text - the file's text
 * @param base - the folder it is in, `""` or ending with `/`
 */
export function parseIgnore(text: string, base: string): IgnoreFile {
  const rules: IgnoreRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/(?<!\\)\s+$/, "");
    if (line === "" || line.startsWith("#")) continue;
    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    } else if (line.startsWith("\\!") || line.startsWith("\\#")) line = line.slice(1);
    let folderOnly = false;
    if (line.endsWith("/")) {
      folderOnly = true;
      line = line.slice(0, -1);
    }
    if (line === "") continue;
    const anchored = line.includes("/");
    const pattern = anchored ? line.replace(/^\//, "") : `**/${line}`;
    const g = glob(pattern);
    if (g.kind === "ok") rules.push({ source: raw, negated, folderOnly, glob: g.value });
  }
  return { base, rules };
}

/**
 * Whether the rules of the ignore files leave a path out. Files are taken from the root down, and the last rule that matches decides.
 *
 * @param files - the ignore files that apply, in any order
 * @param path - the path from the root of the walk
 * @param folder - whether the path is a folder
 */
export function ignored(files: readonly IgnoreFile[], path: string, folder: boolean): boolean {
  let out = false;
  const ordered = [...files].sort((a, b) => a.base.length - b.base.length);
  for (const f of ordered) {
    if (!path.startsWith(f.base)) continue;
    const rel = path.slice(f.base.length);
    for (const r of f.rules) {
      if (r.folderOnly && !folder) continue;
      if (r.glob.matches(rel)) out = !r.negated;
    }
  }
  return out;
}
