/**
 * Report an `AGENTS.md` that is past its budget (commons 0011-documentation FR-043): at most 8 KiB and 80 lines, so that it fits the limits of the agents that read it.
 *
 *     bun commons/tools/agents-md-check.ts [FILE...]      print `file: ...` for each file past a budget, exit 1 if there is one (a finding, which the build reports and never turns into a red run)
 *
 * With no argument it reads the `AGENTS.md` of the repository it is in. A file that does not exist is not a finding. `findings(name, text)` gives the findings of one text and reads nothing.
 *
 * @module
 */
import process from "node:process";
import { isKind, pathOfUrl, readText, splitLines, writeAll } from "./core.ts";

/** The budget of an `AGENTS.md`: the bytes and the lines. */
export const BUDGET = { bytes: 8 * 1024, lines: 80 } as const;

/** The findings of the text of a file named `name`: one sentence for each budget it is past. */
export function findings(name: string, text: string): string[] {
  const bytes = new TextEncoder().encode(text).length;
  const lines = splitLines(text).length;
  const found: string[] = [];
  if (bytes > BUDGET.bytes) found.push(`${name}: ${bytes} bytes, past its budget of ${BUDGET.bytes}: state each rule in one or two sentences and point to the requirement, guide or generated page that states it in full`);
  if (lines > BUDGET.lines) found.push(`${name}: ${lines} lines, past its budget of ${BUDGET.lines}: state each rule in one or two sentences and point to where it is stated in full`);
  return found;
}

export function main(argv: readonly string[]): number {
  const root = pathOfUrl(new URL("../../", import.meta.url));
  const files = argv.length > 0 ? argv : [`${root}AGENTS.md`];
  const found = files.filter((f) => isKind(f, "file")).flatMap((f) => findings(f.replace(/^.*[\\/]/, ""), readText(f)));
  writeAll("stderr", found.map((f) => `${f}\n`).join(""));
  return found.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
