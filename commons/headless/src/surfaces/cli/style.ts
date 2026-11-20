// Spec: 0004-headless-cli FR-001, FR-002, FR-005
/**
 * How the command line looks (commons headless 0004-headless-cli FR-001, FR-002, FR-005): the marks, the colours and the widths. The marks are the
 * terminal's one palette and no other (an ASCII fallback where the terminal shows no emoji); colour is written only where the look allows it; a
 * text is cut to the columns of the terminal, never inside a character or an escape sequence. The spinner and the progress bar are pure
 * functions of a number, so that a test draws them without a terminal.
 *
 * @example
 * ```ts
 * import { line, progressBar } from "./style.ts";
 * const look = { tty: false, colour: false, emoji: false, columns: 80 };
 * line("ok", "built", look); // "[ok] built"
 * progressBar(5, 10, 10, look); // "[#####-----]"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { cutToWidth } from "@intellectual-frontiers/terminal/width";
import * as palette from "@intellectual-frontiers/terminal/palette";
import type { ProblemLevel } from "@intellectual-frontiers/headless/governance";

/** What the terminal written to can show, and whether it is one. */
export type Look = palette.Capabilities & { readonly tty: boolean };

/** What a line of output is about: a problem's level, or how something ended. */
export type Tone = ProblemLevel | "ok" | "skip" | "hint" | "cancelled";

/** The mark of the palette a tone is written with (the palette's marks are the only marks). */
export function markKindOf(tone: Tone): palette.MarkKind {
  switch (tone) {
    case "ok":
      return "done";
    case "fail":
      return "failed";
    case "warn":
      return "warning";
    case "pending":
      return "pending";
    case "action":
      return "action";
    case "skip":
      return "skipped";
    case "hint":
      return "hint";
    case "cancelled":
      return "cancelled";
    default:
      return absurd(tone);
  }
}

/** The tone's mark, painted. */
export function mark(tone: Tone, look: Look): string {
  const kind = markKindOf(tone);
  return palette.paint(palette.MARKS[kind].role, palette.mark(kind, look), look);
}

/** A line's beginning: the tone's mark, a space and the text. */
export function line(tone: Tone, text: string, look: Look): string {
  return palette.label(markKindOf(tone), text, look);
}

/** A text painted in a role. */
export function paint(role: palette.Role, text: string, look: Look): string {
  return palette.paint(role, text, look);
}

/** A text dimmed. */
export function dim(text: string, look: Look): string {
  return palette.paint("dim", text, look);
}

/** The frames of the spinner: braille where the terminal is a modern one (it shows emoji), else ASCII. */
export const SPINNER: { readonly emoji: readonly string[]; readonly ascii: readonly string[] } = {
  emoji: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  ascii: ["|", "/", "-", "\\"],
};

/** The frame of the spinner at a step; any integer is a step. */
export function spinnerFrame(step: number, look: Look): string {
  const frames = look.emoji ? SPINNER.emoji : SPINNER.ascii;
  const n = frames.length;
  return frames[((Math.trunc(step) % n) + n) % n] ?? "";
}

/** A progress bar of `width` cells for `n` of `total`: `[█████░░░░░]`, or `[#####-----]` where the terminal shows no emoji. */
export function progressBar(n: number, total: number, width: number, look: Look): string {
  const filled = total <= 0 ? 0 : Math.max(0, Math.min(width, Math.round((n / total) * width)));
  const [on, off] = look.emoji ? ["█", "░"] : ["#", "-"];
  return `[${(on ?? "#").repeat(filled)}${(off ?? "-").repeat(width - filled)}]`;
}

/** A duration for a person: `640ms`, `12s`, `1m12s`, `2h03m`. */
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

/** A line cut to the terminal's width (one column is left free so that the line never wraps), with `…` where it was cut. */
export function fit(text: string, look: Look): string {
  return cutToWidth(text, Math.max(1, look.columns - 1), "…");
}
