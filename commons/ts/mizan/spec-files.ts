/**
 * Reading a folder of specifications for the Mizan rules (commons 0003-mizan FR-019): the text of each `specs/NNNN-slug/spec.md` and of its `plan.md` where there is one, and the
 * comment lines a baseline file begins with.
 *
 * @module
 */
import { existsSync, readDirSync, readTextFileSync } from "../runtime/fs.ts";
import type { SpecText } from "./rules.ts";

/** The specifications of a folder (`root/specs/NNNN-slug/spec.md`, and `plan.md` where there is one), in the order of their names. */
export function readSpecTexts(root: string): readonly SpecText[] {
  const specs = `${root.replace(/[\\/]$/, "")}/specs`;
  if (!existsSync(specs)) return [];
  const out: SpecText[] = [];
  for (const e of readDirSync(specs).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!e.isDirectory || !existsSync(`${specs}/${e.name}/spec.md`)) continue;
    const plan = existsSync(`${specs}/${e.name}/plan.md`) ? readTextFileSync(`${specs}/${e.name}/plan.md`) : undefined;
    out.push({
      slug: e.name,
      spec: readTextFileSync(`${specs}/${e.name}/spec.md`).replaceAll("\r\n", "\n"),
      ...(plan === undefined ? {} : { plan: plan.replaceAll("\r\n", "\n") }),
    });
  }
  return out;
}

/** The comment lines a baseline file begins with. */
export const BASELINE_COMMENTS = [
  "The findings of the rules Mizan adds (commons 0003-mizan FR-015) that existed when each rule was first held.",
  "A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "Never add a line to make a check pass.",
] as const;
