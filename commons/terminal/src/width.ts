// Spec: 0001-terminal FR-004
/**
 * Display width: how many columns of a terminal a text takes, and a text cut to a number of columns (commons 0006-signals FR-023). An
 * escape sequence takes none and is never split; a grapheme (what a person sees as one character, found with `Intl.Segmenter`) is never
 * split either; a wide character or an emoji takes two columns.
 *
 * The width of a grapheme is an approximation of what terminals do (as `wcwidth` and the `string-width` package approximate it):
 * - a control character, a combining mark, a format character (such as the zero-width joiner) or a variation selector alone: 0;
 * - an emoji: 2 when it is shown as an emoji, which is when its first code point has the `Emoji_Presentation` property (✅ ❌ 👉), when
 *   it carries the emoji variation selector U+FE0F (⏭️ ⏹️ ⚠️, keycaps such as 1️⃣), or when it is a zero-width-joiner sequence (one glyph
 *   of two columns, however many code points it joins); the text variation selector U+FE0E makes it 1;
 * - an East Asian Wide or Fullwidth character (CJK ideographs, kana, Hangul syllables, fullwidth forms): 2, by the ranges in `WIDE`,
 *   which follow Unicode's `EastAsianWidth.txt` in blocks rather than code point by code point (JavaScript has no property escape for it);
 * - anything else: 1. Ambiguous-width characters (Greek, box drawing) count 1, as a terminal in a Western locale shows them.
 *
 * @example
 * ```ts
 * import { cutToWidth, displayWidth } from "./width.ts";
 * displayWidth("✅ 测试"); // 7
 * cutToWidth("✅ 测试", 6); // "✅ 测"
 * cutToWidth("\u001b[31mfailed badly\u001b[0m", 7, "…"); // "\u001b[31mfailed…\u001b[0m"
 * ```
 *
 * @module
 */

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

/**
 * An escape sequence: a control sequence (CSI, even one cut off at the end of the text), a string sequence (OSC, DCS, SOS, PM, APC) up
 * to its terminator (BEL or ESC \) or the end, another escape (`ESC 7`, `ESC ( B`), or a lone ESC.
 */
const ESCAPE = new RegExp(`${ESC}(?:\\[[0-?]*[ -/]*[@-~]?|[\\]PX^_][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)?|[ -/]*[0-~]|)`, "g");

/** A piece of a text: an escape sequence, or a run of text between them. */
export type Token = { readonly kind: "escape"; readonly text: string } | { readonly kind: "text"; readonly text: string };

/** A text split into its escape sequences and the runs of text between them, in order; joined, the pieces are the text again. */
export function tokens(text: string): readonly Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(ESCAPE)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "escape", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The graphemes of a text with no escape sequence, in order (extended grapheme clusters, by `Intl.Segmenter`). */
export function graphemes(text: string): readonly string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** East Asian Wide and Fullwidth ranges (inclusive), by block; emoji are told apart by their own properties. */
const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], // Hangul Jamo, leading consonants
  [0x2329, 0x232a], // angle brackets
  [0x2e80, 0x303e], // CJK radicals, Kangxi radicals, ideographic description, CJK symbols and punctuation
  [0x3041, 0x33ff], // Hiragana, Katakana, Bopomofo, Hangul compatibility Jamo, Kanbun, CJK strokes, enclosed CJK, CJK compatibility
  [0x3400, 0x4dbf], // CJK extension A
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo extended A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms, small form variants
  [0xff00, 0xff60], // fullwidth forms
  [0xffe0, 0xffe6], // fullwidth signs
  [0x16fe0, 0x16fe4], // ideographic symbols
  [0x17000, 0x18cff], // Tangut, Khitan
  [0x1b000, 0x1b2ff], // kana supplement and extensions, Nushu
  [0x1f200, 0x1f2ff], // enclosed ideographic supplement
  [0x20000, 0x2fffd], // CJK extensions B to F, compatibility supplement
  [0x30000, 0x3fffd], // CJK extensions G and H
];

const isWide = (cp: number): boolean => WIDE.some(([lo, hi]) => cp >= lo && cp <= hi);
const isControl = (cp: number): boolean => cp < 0x20 || (cp >= 0x7f && cp < 0xa0);
const ZERO = /^[\p{Mn}\p{Me}\p{Cf}\u{fe00}-\u{fe0f}]+$/u;
const PRESENTATION = /^\p{Emoji_Presentation}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const EMOJI = /\p{Emoji}/u;

/** The columns one grapheme takes: 0, 1 or 2 (see the module's rules). */
export function graphemeWidth(grapheme: string): 0 | 1 | 2 {
  const cp = grapheme.codePointAt(0);
  if (cp === undefined || isControl(cp) || ZERO.test(grapheme)) return 0;
  if (grapheme.includes("\u{fe0e}")) return 1;
  if (PRESENTATION.test(grapheme)) return 2;
  if (grapheme.includes("\u{fe0f}") && EMOJI.test(grapheme)) return 2;
  if (grapheme.includes("\u{200d}") && PICTOGRAPHIC.test(grapheme)) return 2;
  return isWide(cp) ? 2 : 1;
}

/** The columns a text takes on a terminal: its graphemes' widths summed; escape sequences take none. */
export function displayWidth(text: string): number {
  let w = 0;
  for (const t of tokens(text)) if (t.kind === "text") for (const g of graphemes(t.text)) w += graphemeWidth(g);
  return w;
}

/** A text split in two at a number of columns. */
export type Split = {
  /** The longest beginning that takes at most the columns asked for, with every escape sequence before the cut. */
  readonly head: string;
  /** The rest: `head + tail` is the text. */
  readonly tail: string;
};

/**
 * A text split where it reaches `width` columns, between two graphemes or escape sequences, never inside one: a wide character that would
 * cross the edge goes to the tail. Escape sequences up to the first grapheme that does not fit stay in the head.
 */
export function splitAtWidth(text: string, width: number): Split {
  let used = 0;
  let at = 0;
  for (const t of tokens(text)) {
    if (t.kind === "escape") {
      at += t.text.length;
      continue;
    }
    for (const g of graphemes(t.text)) {
      const w = graphemeWidth(g);
      if (used + w > width) return { head: text.slice(0, at), tail: text.slice(at) };
      used += w;
      at += g.length;
    }
  }
  return { head: text, tail: "" };
}

const SGR = new RegExp(`^${ESC}\\[([0-9;:]*)m$`);

/** The parameters of an SGR sequence (`ESC [ ... m`), or undefined for another sequence. */
export function sgrParams(escape: string): readonly number[] | undefined {
  const m = SGR.exec(escape);
  if (m === null) return undefined;
  return (m[1] ?? "").split(/[;:]/).map((p) => (p === "" ? 0 : Number(p)));
}

/** Whether, after these escape sequences, a style set by SGR is still on: something other than a reset came after the last reset. */
function styleOpen(escapes: readonly string[]): boolean {
  let open = false;
  for (const e of escapes) {
    const params = sgrParams(e) ?? [];
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p === 0) open = false;
      else {
        open = true;
        // 38, 48 and 58 take a colour: 5;n or 2;r;g;b.
        if (p === 38 || p === 48 || p === 58) i += params[i + 1] === 5 ? 2 : params[i + 1] === 2 ? 4 : 0;
      }
    }
  }
  return open;
}

/** The SGR sequence that turns every style off. */
export const RESET = `${ESC}[0m`;

/**
 * A text cut to at most `width` columns. A text that fits is returned as it is. Otherwise it is cut between graphemes so that it and the
 * `ellipsis` (none by default; "…" is the usual one) fit; the escape sequences before the cut are kept, those after are dropped, and where a
 * colour or another style was still on at the cut, the result ends with a reset so that the style does not run on. An ellipsis wider than
 * `width` is left out.
 */
export function cutToWidth(text: string, width: number, ellipsis = ""): string {
  if (displayWidth(text) <= width) return text;
  const room = width - displayWidth(ellipsis);
  const mark = room >= 0 ? ellipsis : "";
  const { head } = splitAtWidth(text, room >= 0 ? room : width);
  const escapes = tokens(head).flatMap((t) => (t.kind === "escape" ? [t.text] : []));
  return head + mark + (styleOpen(escapes) ? RESET : "");
}
