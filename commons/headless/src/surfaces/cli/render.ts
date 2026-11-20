// Spec: 0004-headless-cli FR-001, FR-003
/**
 * The closing block drawn for a terminal (commons headless 0004-headless-cli FR-001, FR-003): the lines the logical layer chose, in the order it chose
 * them, each with its palette mark and colour; the verdict; the one `next:` line. In `quiet` mode only the verdict is drawn. Nothing is decided here:
 * which lines come, in which order, is `closingOf`'s.
 *
 * @example
 * ```ts
 * import { renderClosing } from "./render.ts";
 * import { closingOf, outcomeOf } from "@intellectual-frontiers/headless/logical";
 * const look = { tty: false, colour: false, emoji: false, columns: 80 };
 * renderClosing(closingOf(outcomeOf(null), { fix: { commands: [], own: [] }, shownHints: [] }), { look, verbosity: "calm" }); // "\n[ok] Up to date\n"
 * ```
 *
 * @module
 */
import type { Closing, ClosingLine, Verbosity } from "@intellectual-frontiers/headless/logical";
import { dim, line, paint, type Look } from "./style.ts";

/** What the drawing depends on. */
export type RenderOptions = {
  readonly look: Look;
  readonly verbosity: Verbosity;
  /** Where the run's log is, shown in verbose mode. */
  readonly logPath?: string;
};

function drawLine(l: ClosingLine, look: Look, verbose: boolean, logPath: string | undefined): readonly string[] {
  switch (l.kind) {
    case "problem": {
      const text = l.level === "fail" ? paint("failure", l.message, look) : l.level === "warn" ? paint("warning", l.message, look) : l.message;
      const out = [line(l.level, `${text}${l.code === undefined ? "" : dim(` [${l.code}]`, look)}`, look)];
      if (l.say !== undefined) out.push(`   ${l.say}`);
      if (l.command !== undefined) out.push(`   ${dim(`${l.command.label}: ${l.command.command}`, look)}`);
      if (verbose && l.raw !== undefined) out.push(`   ${dim(`raw: ${l.raw}`, look)}`);
      if (verbose && logPath !== undefined && l.logLine !== undefined) out.push(`   ${dim(`log: ${logPath}:${l.logLine}`, look)}`);
      return out;
    }
    case "hint":
      return [line("hint", l.message, look), ...(l.command === undefined ? [] : [`   ${dim(`run: ${l.command}`, look)}`])];
    case "step":
      return [`   ${dim(l.text, look)}`];
  }
}

/** The verdict line. */
export function drawVerdict(c: Closing, look: Look): string {
  const v = c.verdict;
  switch (v.level) {
    case "ok":
      return line("ok", paint("success", v.text, look), look);
    case "fail":
      return line("fail", `${paint("failure", v.text, look)}${v.code === undefined ? "" : dim(` [${v.code}]`, look)}`, look);
    case "cancelled":
      return line("cancelled", dim(v.text, look), look);
  }
}

/** The text a closing block is written as: a blank line, the lines, the verdict, the one next command; or the verdict alone in quiet mode. Ends in a newline. */
export function renderClosing(c: Closing, o: RenderOptions): string {
  const verdict = drawVerdict(c, o.look);
  if (o.verbosity === "quiet") return `${verdict}\n`;
  const verbose = o.verbosity === "verbose";
  const lines: string[] = [""];
  for (const l of c.lines) lines.push(...drawLine(l, o.look, verbose, o.logPath));
  if (c.rootSay !== undefined) lines.push(`   ${c.rootSay}`);
  if (verbose && o.logPath !== undefined) lines.push(dim(`   log: ${o.logPath}`, o.look));
  lines.push(verdict);
  if (c.next !== undefined) lines.push(`next: ${c.next}`);
  return `${lines.join("\n")}\n`;
}
