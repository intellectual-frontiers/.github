// Spec: 0003-headless-output FR-005
/**
 * A fix text split into the one command in it and the words around it (commons headless 0003-headless-output FR-005): a `fix:`, `run:` or `next:`
 * line holds only the command, so that a person can copy it whole; any instruction goes on a line of its own.
 *
 * @remarks
 * Which words begin a command is the program's: it gives its own name and the tools its fixes call (`git`, `sudo`).
 *
 * @example
 * ```ts
 * import { fixSplitter } from "./fix.ts";
 * const split = fixSplitter({ commands: ["mytool", "git"], own: ["mytool"] });
 * split("mytool sync (pull first)"); // { cmd: "mytool sync", say: "Pull first" }
 * split("Plug it in"); // { say: "Plug it in" }
 * ```
 *
 * @module
 */

/** The words a fix is read for: the programs a whole fix may be a command of, and the program's own, which may stand inside a sentence. */
export type FixCommands = {
  /** Programs a whole fix may begin with (`mytool`, `git`, `sudo`). */
  readonly commands: readonly string[];
  /** The program's own commands, found inside a sentence ("then run mytool sync"). */
  readonly own: readonly string[];
};

/** The instruction and the command of a fix: each may be absent. */
export type SplitFix = { readonly say?: string; readonly cmd?: string };

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternation = (words: readonly string[]): string => [...words].sort((a, b) => b.length - a.length).map(escape).join("|");

/** A function that splits a fix, for the commands given. */
export function fixSplitter(commands: FixCommands): (fix: string | undefined) => SplitFix {
  const any = commands.commands.length === 0 ? undefined : new RegExp(String.raw`^((?:${alternation(commands.commands)})\b[^;(]*?)(?:\s+\((.*)\))?\s*$`, "s");
  const own =
    commands.own.length === 0
      ? undefined
      : new RegExp(String.raw`(?:^|[:;,]\s*|\bthen\s+)((?:${alternation(commands.own)})\s+[A-Za-z][^;(,]*?)\s*(?:\(|;|,|\.\s|$)`);
  return (fix) => {
    if (fix === undefined || fix === "") return {};
    const text = fix.trim();
    const head = any?.exec(text);
    if (head?.[1] !== undefined && !/,\s|\bthen\b/.test(head[1])) {
      const say = head[2]?.trim();
      return { cmd: head[1].trim(), ...(say === undefined || say === "" ? {} : { say: say.slice(0, 1).toUpperCase() + say.slice(1) }) };
    }
    const inner = own?.exec(text);
    if (inner?.[1] !== undefined) {
      const cmd = inner[1].trim();
      const say = text
        .replace(cmd, "")
        .replace(/^\s*[:;,]\s*/, "")
        .replace(/\s*(,\s*)?(then|:)\s*$/i, "")
        .replace(/^then\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const said = say === "" ? "" : say.slice(0, 1).toUpperCase() + say.slice(1);
      return { cmd, ...(said !== "" && said !== ":" ? { say: said } : {}) };
    }
    return { say: text };
  };
}
