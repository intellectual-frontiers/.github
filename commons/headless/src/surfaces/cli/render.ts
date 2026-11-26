// Spec: 0004-headless-cli FR-001, FR-003, FR-018, FR-024
/**
 * The closing block drawn for a terminal (commons headless 0004-headless-cli FR-001, FR-003): the lines the logical layer chose, in the order it chose
 * them, each with its icon of the ui's table and its colour of the ui's theme; the verdict; the one `next:` line. In `quiet` mode only the verdict is drawn. Nothing is decided here:
 * which lines come, in which order, is `closingOf`'s.
 *
 * @example
 * ```ts
 * import { capabilitiesOf } from "@intellectual-frontiers/terminal/ui";
 * import { renderClosing } from "./render.ts";
 * import { lookOf } from "./style.ts";
 * import { closingOf, outcomeOf } from "@intellectual-frontiers/headless/logical";
 * const look = lookOf(capabilitiesOf({}, { isTTY: false }), false);
 * renderClosing(closingOf(outcomeOf(null), { fix: { commands: [], own: [] }, shownHints: [] }), { look, verbosity: "calm" }); // "\n[ok] Up to date\n"
 * ```
 *
 * @module
 */
import type { Closing, ClosingLine, Verbosity } from "@intellectual-frontiers/headless/logical";
import { lineMarkOf } from "@intellectual-frontiers/terminal/ui";
import { dim, line, paint, textLines, type Look } from "./style.ts";
import { countsLine } from "./view.ts";

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
      const [first = "", ...more] = textLines(l.message);
      const tone = (t: string): string => (l.level === "fail" ? paint("error", t, look) : l.level === "warn" ? paint("warn", t, look) : t);
      const out = [line(l.level, `${tone(first)}${l.code === undefined ? "" : dim(` [${l.code}]`, look)}`, look), ...more.map((m) => `   ${tone(m)}`)];
      if (l.say !== undefined) out.push(...textLines(l.say).map((s) => `   ${s}`));
      if (l.command !== undefined) out.push(`   ${dim(`${l.command.label}: ${textLines(l.command.command).join(" ")}`, look)}`);
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
      return line("fail", `${paint("error", v.text, look)}${v.code === undefined ? "" : dim(` [${v.code}]`, look)}`, look);
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
  if (c.rootSay !== undefined) lines.push(...textLines(c.rootSay).map((t) => `   ${t}`));
  if (verbose && o.logPath !== undefined) lines.push(dim(`   log: ${o.logPath}`, o.look));
  const tally = { fail: 0, warn: 0, pending: 0, action: 0 };
  if (c.verdict.level === "fail") tally.fail += 1;
  for (const l of c.lines) if (l.kind === "problem") tally[l.level] += 1;
  const counts = c.verdict.level === "fail" && tally.fail + tally.warn + tally.pending + tally.action >= 2 ? countsLine(tally, o.look) : undefined;
  if (counts !== undefined) lines.push(counts);
  lines.push(verdict);
  if (c.next !== undefined) lines.push(`${o.look.emoji ? `${lineMarkOf("hint", o.look)} ` : ""}${paint("accent", "next:", o.look)} ${textLines(c.next).join(" ")}`);
  return `${lines.join("\n")}\n`;
}
