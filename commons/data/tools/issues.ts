// Spec: 0044-issues FR-002, FR-006
/**
 * The files of the issues of the library (commons data 0044-issues): every `issues/` folder that holds a `mod.ts`, the issue files in it, and whether the folder is kept as it must be: each file is
 * `NNNNN-slug.ts` with numbers from 1, and `mod.ts` names each of them. What an issue says is checked by governance (`checkIssueSet`); this finds the files and says where they do not fit.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** An `issues/` folder: where it is, and the files of its issues. */
export interface IssueFolder {
  /** The folder from the library, with `/`. */
  readonly dir: string;
  /** The scope the folder is for: its parent, or `data` for the library's own. */
  readonly scope: string;
  readonly files: readonly string[];
  readonly mod: string;
}

const SKIP = new Set(["node_modules", ".git", "spec-kit"]);
/** The folders whose children are units: a unit named `issues` there (the model, the extension) is a unit, not a folder of issues. */
const UNITS = new Set(["models", "extensions", "sql/extensions", "sql/dialects"]);

/** Every `issues/` folder with a `mod.ts` under a root. */
export function discover(root: string): readonly IssueFolder[] {
  const out: IssueFolder[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).toSorted()) {
      if (SKIP.has(name)) continue;
      const full = join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (name === "issues" && !UNITS.has(relative(root, dir).split("\\").join("/")) && existsSync(join(full, "mod.ts"))) {
        const rel = relative(root, full).split("\\").join("/");
        const parent = rel === "issues" ? "data" : rel.slice(0, -"/issues".length);
        out.push({
          dir: rel,
          scope: parent,
          files: readdirSync(full).filter((f) => f !== "mod.ts" && f.endsWith(".ts")).toSorted(),
          mod: readFileSync(join(full, "mod.ts"), "utf8"),
        });
      }
      walk(full);
    }
  };
  walk(root);
  return out;
}

/** What is wrong with the files of a folder: a name that is not `NNNNN-slug.ts`, a number that is not the next, a file `mod.ts` does not name, a name in `mod.ts` with no file. */
export function folderFindings(f: IssueFolder): readonly string[] {
  const out: string[] = [];
  f.files.forEach((name, i) => {
    const m = /^(\d{5})-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/.exec(name);
    if (m === null) out.push(`${f.dir}/${name}: a file of issues is named NNNNN-slug.ts`);
    else if (Number(m[1]) !== i + 1) out.push(`${f.dir}/${name}: the number is ${Number(m[1])}, and the ${i + 1}th file should be ${String(i + 1).padStart(5, "0")}`);
    if (!f.mod.includes(`"./${name}"`)) out.push(`${f.dir}/mod.ts: it does not list ${name}`);
  });
  for (const m of f.mod.matchAll(/from "\.\/([^"]+)"/g)) if (!f.files.includes(m[1] as string)) out.push(`${f.dir}/mod.ts: it lists ${m[1]}, which is not a file`);
  return out;
}
