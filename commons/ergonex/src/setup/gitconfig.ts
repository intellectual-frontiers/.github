// Spec: 0003-host FR-016
/**
 * The global Git include of `ergonex setup --git-include` (commons 0003-host FR-016, 0001-ergonex FR-020): one marked block in the user's global Git configuration holding one `[include]` of a
 * file generated in the workspace. These functions only turn text into text: the block that is added (and replaced, never doubled), the text with the block removed, and the exact change to show
 * before anything is written.
 *
 * @remarks
 * The host layer (`host/apply.ts`) shows the change, asks, and writes only after a yes (and refuses where there is no terminal and no `--yes`); Ergonex never reads or writes that file otherwise. The
 * marked lines are Git comments, so Git ignores them and a person can find them.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The line that opens the block. */
export const INCLUDE_BEGIN = "# >>> ergonex git-include >>>";

/** The line that closes the block. */
export const INCLUDE_END = "# <<< ergonex git-include <<<";

/** The block for an included file (an absolute path), or why the path cannot be written in a Git configuration safely. */
export function includeBlock(file: string): Result<string, string> {
  if (/["\r\n\0]/.test(file)) return err("the path holds a quote or a line break, which a Git configuration value cannot hold here");
  if (file === "") return err("the path is empty");
  return ok(`${INCLUDE_BEGIN}\n[include]\n\tpath = "${file.replaceAll("\\", "/")}"\n${INCLUDE_END}\n`);
}

/** Where the block is in a text: the index of its first line and of the line after its last, or undefined where there is none. Two blocks, or an open one, are told by `blockProblem`. */
function span(lines: readonly string[]): { readonly from: number; readonly to: number } | undefined {
  const from = lines.indexOf(INCLUDE_BEGIN);
  if (from < 0) return undefined;
  const end = lines.indexOf(INCLUDE_END, from + 1);
  return end < 0 ? undefined : { from, to: end + 1 };
}

/** What is wrong with the marks in a text, or undefined: an opening with no closing, a closing with no opening, or more than one block. */
export function blockProblem(text: string): string | undefined {
  const lines = text.split("\n");
  const begins = lines.filter((l) => l === INCLUDE_BEGIN).length;
  const ends = lines.filter((l) => l === INCLUDE_END).length;
  if (begins !== ends) return "the marks of the ergonex block do not pair (one is missing)";
  if (begins > 1) return "the ergonex block is there more than once";
  return undefined;
}

/** The text with the block added at the end, or replaced where it is already there (so that running twice leaves one block). */
export function withInclude(text: string, block: string): Result<string, string> {
  const problem = blockProblem(text);
  if (problem !== undefined) return err(problem);
  const lines = text.split("\n");
  const at = span(lines);
  if (at === undefined) {
    const base = text === "" || text.endsWith("\n") ? text : `${text}\n`;
    return ok(`${base}${block}`);
  }
  const before = lines.slice(0, at.from).join("\n");
  const after = lines.slice(at.to).join("\n");
  return ok(`${before === "" ? "" : `${before}\n`}${block}${after}`);
}

/** The text with exactly the block removed and nothing else (the text around it is not touched); unchanged where there is none. */
export function withoutInclude(text: string): Result<string, string> {
  const problem = blockProblem(text);
  if (problem !== undefined) return err(problem);
  const lines = text.split("\n");
  const at = span(lines);
  if (at === undefined) return ok(text);
  return ok([...lines.slice(0, at.from), ...lines.slice(at.to)].join("\n"));
}

/** The exact change as a diff of the block: the lines that go with `-` and the lines that come with `+`, under the name of the file; empty where nothing changes. */
export function changeShown(name: string, before: string, after: string): string {
  if (before === after) return "";
  const a = before.split("\n");
  const b = after.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const gone = a.slice(head, a.length - tail).map((l) => `-${l}`);
  const came = b.slice(head, b.length - tail).map((l) => `+${l}`);
  return [`--- ${name}`, `+++ ${name}`, `@@ line ${head + 1} @@`, ...gone, ...came].join("\n") + "\n";
}
