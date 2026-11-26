// Spec: 0004-headless-cli FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024
/**
 * The pieces a report and a long run are drawn with (commons headless 0004-headless-cli FR-018 to FR-024): a section header, `key: value` rows, a table, a counts line, the
 * heartbeat line of a phase in progress and the dressing of a help text. Each is a pure function of its data and the look (the ui's capabilities), made of the ui's one table of icons, its one theme and its
 * widgets, and nothing else: it imports the terminal and Core alone and decides nothing of a domain, so that a program draws a host table, a status or a
 * list with the same look as the closing block.
 *
 * @example
 * ```ts
 * import { capabilitiesOf } from "@intellectual-frontiers/terminal/ui";
 * import { lookOf } from "./style.ts";
 * import { keyValues } from "./view.ts";
 * const look = lookOf(capabilitiesOf({}, { isTTY: false, columns: 80 }), false);
 * keyValues([["host", "synthetic-host-01"], ["state", "ready"]], look); // ["  host:  synthetic-host-01", "  state: ready"]
 * ```
 *
 * @module
 */
import { elapsedOf, lineMarkOf, renderTable, tint, type IconName, type TableColumn } from "@intellectual-frontiers/terminal/ui";
import { cutToWidth, displayWidth } from "@intellectual-frontiers/terminal/width";
import { dim, mark, paint, progressBar, spinnerFrame, textLines, type Look, type Tone } from "./style.ts";

/** The text with the spaces at the end of each line taken off (before a closing reset, where the line ends in one). */
function trimEnd(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/ +((?:\u001b\[[0-9;]*m)*)$/, "$1");
}

/** A text cut to the terminal's columns less one (so that a line never wraps), with `…` where it was cut; a text that fits is as it is. */
function cut(text: string, look: Look): string {
  return displayWidth(text) <= look.columns - 1 ? text : cutToWidth(text, Math.max(1, look.columns - 1), "…");
}

/** A section header: a blank line, the title in the accent colour and a rule of the width of the title (at most the terminal's), in `─` where there are emoji and `-` elsewhere. */
export function sectionHeader(title: string, look: Look): readonly string[] {
  const text = cut(textLines(title)[0] ?? "", look);
  const rule = (look.emoji ? "─" : "-").repeat(Math.max(3, Math.min(displayWidth(text), look.columns - 1)));
  return ["", paint("accent", text, look), dim(rule, look)];
}

/** `key: value` rows: the keys dimmed and padded by their width in columns so that the values line up, the values cut to the terminal's width. */
export function keyValues(rows: readonly (readonly [string, string])[], look: Look, indent = 2): readonly string[] {
  const width = Math.max(0, ...rows.map(([k]) => displayWidth(k) + 1));
  return rows.map(([k, v]) => {
    const key = `${k}:`;
    const pad = " ".repeat(Math.max(0, width - displayWidth(key)));
    return trimEnd(cut(`${" ".repeat(indent)}${dim(key, look)}${pad} ${textLines(v)[0] ?? ""}`, look));
  });
}

/** A cell that begins with the icon of a tone (`✅ ready`, `[ok] ready`): in a column of a table it is as wide as its text, so the column is as wide as its widest. */
export function toneCell(tone: Tone, text: string, look: Look): string {
  return `${mark(tone, look)} ${text}`;
}

/** A table of rows (a cell is text, and may hold a tone cell) drawn by the ui's table: a dimmed header, the rows, every line as wide in columns as any other and never wider than the terminal. Nothing to show is one dimmed line. */
export function tableLines(columns: readonly TableColumn[], rows: readonly Readonly<Record<string, string>>[], look: Look): readonly string[] {
  if (rows.length === 0) return [dim("  (none)", look)];
  return renderTable({ columns, rows }, { columns: Math.max(10, look.columns - 1), rows: rows.length + 1 }, look).map(trimEnd);
}

/** The words of the counts, in the order of their severity. */
const COUNT_WORDS: readonly { readonly tone: Tone; readonly one: string; readonly many: string }[] = [
  { tone: "fail", one: "failed", many: "failed" },
  { tone: "warn", one: "warning", many: "warnings" },
  { tone: "pending", one: "pending", many: "pending" },
  { tone: "action", one: "for you", many: "for you" },
];

/** How many lines of each level there are, as one line (`2 failed, 1 warning`), each part in its colour; nothing where there are none. */
export function countsLine(counts: Readonly<Record<"fail" | "warn" | "pending" | "action", number>>, look: Look): string | undefined {
  const parts = COUNT_WORDS.filter((w) => counts[w.tone as "fail"] > 0).map((w) => {
    const n = counts[w.tone as "fail"];
    return paint(w.tone === "fail" ? "error" : w.tone === "warn" ? "warn" : w.tone === "pending" ? "dim" : "accent", `${n} ${n === 1 ? w.one : w.many}`, look);
  });
  return parts.length === 0 ? undefined : `   ${parts.join(", ")}`;
}

/** What a phase in progress is told. */
export type Heartbeat = {
  readonly name: string;
  /** What it is doing now: the line of a bar, a message. */
  readonly live?: string | undefined;
  readonly elapsedMs: number;
  readonly step: number;
};

/** The line of a phase in progress (FR-021): the spinner, the name, what it is doing now and, from one second, the time elapsed; cut to the terminal's width less one. */
export function heartbeatLine(h: Heartbeat, look: Look): string {
  const elapsed = h.elapsedMs >= 1000 ? `  ${dim(elapsedOf(h.elapsedMs), look)}` : "";
  return cut(`${paint("accent", spinnerFrame(h.step, look), look)} ${h.name}${h.live === undefined ? "" : `  ${h.live}`}${elapsed}`, look);
}

/** The bar and the count of a step, as the live text of a phase. */
export function stepLive(n: number, total: number, label: string, look: Look): string {
  return `${progressBar(n, total, 20, look)} ${n}/${total}${label === "" ? "" : `  ${label}`}`;
}

/** The section words of a help text, and the icon where there are emoji. */
const HELP_SECTIONS: Readonly<Record<string, IconName | undefined>> = { "Usage:": undefined, "Commands:": undefined, "Options:": undefined, "Arguments:": undefined, "Examples:": "info", "Effect:": "run" };

/**
 * A generated help text dressed by the look (FR-022): the title line and the section words in the accent colour, the names of commands and options in the accent colour, an icon before `Examples:`
 * and `Effect:` where there are emoji. Where the look has no colour and no emoji it is the text as it was, byte for byte; it never changes a column of what it dresses.
 */
export function styleHelp(text: string, look: Look): string {
  if (!look.colour && !look.emoji) return text;
  let section: string | undefined;
  return text
    .split("\n")
    .map((l, i) => {
      if (l === "") return l;
      const word = Object.keys(HELP_SECTIONS).find((w) => l === w || l.startsWith(`${w} `) || (w === "Usage:" && l.startsWith("Usage: ")));
      if (word !== undefined && !l.startsWith(" ")) {
        section = word;
        const icon = HELP_SECTIONS[word];
        const head = tint("accent", word, look);
        return `${icon !== undefined && look.emoji ? `${lineMarkOf(icon, look)} ` : ""}${head}${l.slice(word.length)}`;
      }
      if (!l.startsWith(" ")) {
        if (/^(Repeating it|For):/.test(l)) return l.replace(/^([^:]+:)/, (m) => tint("accent", m, look));
        if (i === 0) {
          const at = l.indexOf(": ");
          return at < 0 ? tint("accent", l, look) : `${tint("accent", l.slice(0, at), look)}${l.slice(at)}`;
        }
        return l;
      }
      if (section === "Commands:" || section === "Options:" || section === "Arguments:" || section === "Examples:") {
        const m = /^(\s+)(\S.*?)(\s{2,})(\S.*)$/.exec(l) ?? /^(\s+)(\S.*)()()$/.exec(l);
        if (m !== null) return `${m[1]}${tint("accent", m[2] ?? "", look)}${m[3] ?? ""}${m[4] ?? ""}`;
      }
      return l;
    })
    .join("\n");
}
