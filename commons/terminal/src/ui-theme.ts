// Spec: 0002-ui FR-025
/**
 * The icons and the theme of the ui (commons terminal 0002-ui FR-025): one table of icons, each an emoji (always two columns wide, by the
 * `width` of this library, so columns never misalign) and an ASCII equivalent (always three columns); and a restrained theme of six
 * names (accent, success, warn, error, dim, selection) that is rendered at the colour depth of the terminal (16, 256 or truecolor) and not
 * at all where there is no colour. The caps decide: no flag.
 *
 * @module
 */
import type { ColourDepth, UiCaps } from "./ui-caps.ts";

/** What a widget needs of the capabilities to dress itself; the full `UiCaps` is one. */
export type Dress = Pick<UiCaps, "colour"> & { readonly emoji?: boolean | undefined; readonly colourDepth?: ColourDepth | undefined };

/** The names of the icons. */
export type IconName = "done" | "current" | "skipped" | "failed" | "pending" | "working" | "person" | "run" | "question" | "host" | "warn" | "info";

/** One icon: the emoji (two columns), and the ASCII equivalent (three columns). */
export type Icon = { readonly emoji: string; readonly ascii: string };

/** The one table of icons. An emoji that a terminal may draw one column wide carries U+FE0F, which `width` counts as two. */
export const ICONS: Readonly<Record<IconName, Icon>> = {
  done: { emoji: "✅", ascii: "[x]" },
  current: { emoji: "▶️", ascii: "[>]" },
  skipped: { emoji: "⏭️", ascii: "[-]" },
  failed: { emoji: "❌", ascii: "[!]" },
  pending: { emoji: "⬜", ascii: "[ ]" },
  working: { emoji: "⏳", ascii: "[~]" },
  person: { emoji: "\u{1f464}", ascii: "[@]" },
  run: { emoji: "⚙️", ascii: "[*]" },
  question: { emoji: "❓", ascii: "[?]" },
  host: { emoji: "\u{1f5a5}️", ascii: "[#]" },
  warn: { emoji: "⚠️", ascii: "[w]" },
  info: { emoji: "\u{1f4a1}", ascii: "[i]" },
};

/** The icon as a text: the emoji where `caps.emoji`, else the ASCII equivalent. */
export function iconOf(name: IconName, caps: Pick<Dress, "emoji">): string {
  return caps.emoji === true ? ICONS[name].emoji : ICONS[name].ascii;
}

/** The icon in a cell of exactly three columns, so that a column of them aligns whatever the mode: the emoji and a space, or the ASCII. */
export function iconCell(name: IconName, caps: Pick<Dress, "emoji">): string {
  return caps.emoji === true ? `${ICONS[name].emoji} ` : ICONS[name].ascii;
}

/** The names of the theme. */
export type ThemeName = "accent" | "success" | "warn" | "error" | "dim" | "selection";

const SGR: Readonly<Record<ThemeName, Readonly<Record<Exclude<ColourDepth, "none">, string>>>> = {
  accent: { "16": "36;1", "256": "1;38;5;81", truecolor: "1;38;2;102;204;238" },
  success: { "16": "32", "256": "38;5;78", truecolor: "38;2;102;204;136" },
  warn: { "16": "33", "256": "38;5;214", truecolor: "38;2;238;170;68" },
  error: { "16": "31;1", "256": "38;5;203", truecolor: "38;2;238;102;102" },
  dim: { "16": "2", "256": "38;5;244", truecolor: "38;2;136;136;136" },
  selection: { "16": "44;97", "256": "48;5;24;38;5;255", truecolor: "48;2;32;64;112;38;2;255;255;255" },
};

const ESC = String.fromCharCode(0x1b);

/** A text in a theme name's colour at the terminal's colour depth, with a reset after; the text as it is where there is no colour. */
export function tint(name: ThemeName, text: string, caps: Dress): string {
  if (!caps.colour || text === "") return text;
  const depth = caps.colourDepth === undefined || caps.colourDepth === "none" ? "16" : caps.colourDepth;
  return `${ESC}[${SGR[name][depth]}m${text}${ESC}[0m`;
}
