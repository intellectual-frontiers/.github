/**
 * Small pure text helpers that more than one codebase wrote: line endings made LF, ANSI escapes removed, and a command line split into its
 * argument vector without a shell (commons 0005-typescript-runtime FR-009). Taken from Stolos's `fsx.ts` and `exec.ts` and the machine
 * setup's `ui.ts`.
 *
 * @example
 * ```ts
 * import { splitArgs } from "./text.ts";
 * splitArgs(`git commit -m "a message"`); // { kind: "ok", value: ["git", "commit", "-m", "a message"] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "./result.ts";

/** Text with Windows line endings (CRLF, as Git for Windows checks files out) made LF. */
export function lf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** A control sequence of a terminal (CSI): colour, cursor and erase. */
export const ANSI: RegExp = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;?]*[A-Za-z]`, "g");

/** Text without its terminal control sequences, as a log or a pipe should keep it. */
export function plain(text: string): string {
  return text.replace(ANSI, "");
}

/**
 * A command line split into its argument vector without a shell: words are separated by white space, and single or double quotes keep a
 * word together (no escapes, no variables, no globbing). An unterminated quote is an error.
 */
export function splitArgs(line: string): Result<readonly string[], string> {
  const out: string[] = [];
  let cur = "";
  let quote: string | undefined;
  let has = false;
  for (const ch of line) {
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur !== "" || has) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += ch;
    }
  }
  if (quote !== undefined) return err(`unterminated quote in: ${line}`);
  if (cur !== "" || has) out.push(cur);
  return ok(out);
}

/** An argument vector as one line a person can read and paste into a POSIX shell: words quoted only where they must be. */
export function quoteArgs(argv: readonly string[]): string {
  return argv.map((a) => (a !== "" && /^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'"'"'`)}'`)).join(" ");
}
