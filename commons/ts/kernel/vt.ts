/**
 * A small terminal emulator for snapshot tests (commons 0006-signals FR-025): a screen a given number of columns wide, either growing as it
 * is written to (no height) or a given number of rows high and scrolling, that is fed what a program writes and shows what a person would
 * see after it: the text, each cell's style kept apart from it, and the cursor.
 *
 * What it understands, as xterm does:
 * - printable text by grapheme and display width (`width.ts`): a wide character or emoji takes two cells (the second a continuation), a
 *   combining mark or another zero-width grapheme joins the cell before; a character that does not fit in the last column wraps to the next
 *   line (autowrap with the wrap deferred until the next character, so a line exactly as wide as the screen does not add an empty one), and a
 *   wide character that would cross the right edge wraps whole, leaving the last cell empty;
 * - CR, LF (also VT and FF), BS and TAB (stops every eight columns); LF also returns the carriage by default (`newline: "crlf"`, as a
 *   terminal's line discipline turns a program's "\n" into CR LF), or only moves down (`newline: "lf"`);
 * - CSI cursor up, down, forward and back (A, B, C, D), next and previous line (E, F), column (G), row (d), position (H, f), save and
 *   restore (s, u, and ESC 7, ESC 8), erase in line (K 0, 1, 2) and in display (J 0, 1, 2, 3), and SGR (m: bold, dim, italic, underline,
 *   blink, inverse, hidden, strike, their resets, the 8, 16, 256 and 24-bit colours of text and background);
 * - cursor shown and hidden (CSI ? 25 h and l), kept in `cursor().visible`;
 * - every other control sequence, other private mode, OSC, DCS, APC, PM and SOS string, other escape and other control character: read
 *   and ignored. A sequence may be split across writes; bytes are decoded as UTF-8 across writes too.
 *
 * Erased cells take no style. A grapheme split across two writes is seen as two (the second joins the first cell, without changing its
 * width).
 *
 * @example
 * ```ts
 * import { createScreen } from "./vt.ts";
 * const s = createScreen({ width: 20 });
 * s.write("building\n\u001b[32m✅\u001b[0m done");
 * s.write("\u001b[1A\r\u001b[2Kbuilt");
 * s.text(); // "built\n✅ done"
 * s.cell(1, 0)?.style.fg; // { kind: "indexed", index: 2 }
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { graphemes, graphemeWidth } from "./width.ts";

/** A colour of text or background: the terminal's default, one of 256 indexed colours (0 to 15 the basic and bright ones), or 24-bit. */
export type Colour =
  | { readonly kind: "default" }
  | { readonly kind: "indexed"; readonly index: number }
  | { readonly kind: "rgb"; readonly r: number; readonly g: number; readonly b: number };

/** How a cell's text is drawn, as SGR left it. */
export type Style = {
  readonly bold: boolean;
  readonly dim: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly blink: boolean;
  readonly inverse: boolean;
  readonly hidden: boolean;
  readonly strike: boolean;
  readonly fg: Colour;
  readonly bg: Colour;
};

const DEFAULT: Colour = { kind: "default" };

/** The style of a cell nothing styled: every attribute off, default colours. */
export const PLAIN: Style = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  blink: false,
  inverse: false,
  hidden: false,
  strike: false,
  fg: DEFAULT,
  bg: DEFAULT,
};

const colourName = (c: Colour): string => {
  switch (c.kind) {
    case "default":
      return "default";
    case "indexed":
      return String(c.index);
    case "rgb":
      return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    default:
      return absurd(c);
  }
};

/** A style in words, for a snapshot: the attributes on, then `fg=` and `bg=` where not the default; "" for `PLAIN`. */
export function describeStyle(style: Style): string {
  const words: string[] = [];
  for (const a of ["bold", "dim", "italic", "underline", "blink", "inverse", "hidden", "strike"] as const) if (style[a]) words.push(a);
  if (style.fg.kind !== "default") words.push(`fg=${colourName(style.fg)}`);
  if (style.bg.kind !== "default") words.push(`bg=${colourName(style.bg)}`);
  return words.join(" ");
}

/** Whether two styles draw the same. */
export function sameStyle(a: Style, b: Style): boolean {
  return describeStyle(a) === describeStyle(b);
}

/** One cell of the screen: a grapheme and its style; a wide grapheme's second cell is a continuation, of width 0 and empty text. */
export type Cell = { readonly text: string; readonly width: 0 | 1 | 2; readonly style: Style };

/** A run of cells of one style on a line, their text joined. */
export type Run = { readonly text: string; readonly style: Style };

/** Where the cursor is (row and column from 0) and whether it is shown. */
export type Cursor = { readonly row: number; readonly col: number; readonly visible: boolean };

/** The size of a screen and how it reads a line feed. */
export type ScreenOptions = {
  /** Columns; at least 1. */
  readonly width: number;
  /** Rows: the screen scrolls when a line feed is written on the last; without it, the screen grows. */
  readonly height?: number;
  /** "crlf" (the default): a line feed also returns the carriage, as a terminal's line discipline does; "lf": it only moves down. */
  readonly newline?: "crlf" | "lf";
};

/** A screen being written to. */
export type Screen = {
  /** Its width in columns. */
  readonly width: number;
  /** Its height in rows, or undefined where it grows. */
  readonly height: number | undefined;
  /** Feeds it what a program writes: text, or bytes decoded as UTF-8 (a character may be split across writes). */
  write(data: string | Uint8Array): void;
  /** Its lines as text: trailing spaces of each line and trailing empty lines left out. */
  lines(): readonly string[];
  /** Its lines joined by "\n". */
  text(): string;
  /** Its lines as runs of one style, trailing unstyled spaces and trailing empty lines left out. */
  styled(): readonly (readonly Run[])[];
  /** The cell at a row and column; undefined outside the screen. */
  cell(row: number, col: number): Cell | undefined;
  /** The cursor. */
  cursor(): Cursor;
};

const BLANK: Cell = { text: " ", width: 1, style: PLAIN };
const CONTINUATION = (style: Style): Cell => ({ text: "", width: 0, style });

type ParserState = "ground" | "escape" | "csi" | "string" | "string-escape";

/** A new, empty screen with the cursor at the top left, shown. */
export function createScreen(options: ScreenOptions): Screen {
  const width = Math.max(1, Math.floor(options.width));
  const height = options.height === undefined ? undefined : Math.max(1, Math.floor(options.height));
  const crlf = (options.newline ?? "crlf") === "crlf";
  const rows: Cell[][] = [];
  const decoder = new TextDecoder();

  let row = 0;
  let col = 0;
  let pending = false;
  let visible = true;
  let style = PLAIN;
  let saved = { row: 0, col: 0, style: PLAIN };
  let state: ParserState = "ground";
  let seq = "";
  let text = "";

  const blankRow = (): Cell[] => Array.from({ length: width }, () => BLANK);
  const line = (r: number): Cell[] => {
    while (rows.length <= r) rows.push(blankRow());
    return rows[r] ?? blankRow();
  };
  const maxRow = (): number => (height === undefined ? Number.MAX_SAFE_INTEGER : height - 1);
  const clampCol = (c: number): number => Math.min(width - 1, Math.max(0, c));
  const clampRow = (r: number): number => Math.min(maxRow(), Math.max(0, r));

  const linefeed = (): void => {
    if (height !== undefined && row === height - 1) {
      line(height - 1);
      rows.shift();
      rows.push(blankRow());
    } else {
      row++;
    }
  };

  /** Blanks columns `from` to `to` (inclusive) of a row, with the halves of wide characters cut by the edges. */
  const blank = (r: number, from: number, to: number): void => {
    const l = line(r);
    let a = Math.max(0, from);
    let b = Math.min(width - 1, to);
    if (a > b) return;
    if (l[a]?.width === 0 && a > 0) a--;
    if (l[b]?.width === 2 && b < width - 1) b++;
    for (let c = a; c <= b; c++) l[c] = BLANK;
  };

  const put = (g: string, w: 1 | 2): void => {
    const l = line(row);
    blank(row, col, col + w - 1);
    l[col] = { text: g, width: w, style };
    if (w === 2 && col + 1 < width) l[col + 1] = CONTINUATION(style);
  };

  const print = (chunk: string): void => {
    for (const g of graphemes(chunk)) {
      const w = graphemeWidth(g);
      if (w === 0) {
        const cp = g.codePointAt(0) ?? 0;
        if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
        let c = pending ? col : col - 1;
        const l = line(row);
        if (l[c]?.width === 0) c--;
        const cell = l[c];
        if (c >= 0 && cell !== undefined) l[c] = { ...cell, text: cell.text + g };
        continue;
      }
      if (pending) {
        col = 0;
        linefeed();
        pending = false;
      }
      if (col + w > width && col > 0) {
        col = 0;
        linefeed();
      }
      put(g, w > width ? 1 : w);
      col += Math.min(w, width);
      if (col >= width) {
        col = width - 1;
        pending = true;
      }
    }
  };

  const flush = (): void => {
    if (text !== "") print(text);
    text = "";
  };

  const sgr = (params: readonly number[]): void => {
    const ps = params.length === 0 ? [0] : params;
    const extended = (i: number): { readonly colour: Colour; readonly used: number } => {
      if (ps[i + 1] === 5) return { colour: { kind: "indexed", index: (ps[i + 2] ?? 0) & 0xff }, used: 2 };
      if (ps[i + 1] === 2) {
        const at = (k: number): number => (ps[i + k] ?? 0) & 0xff;
        return { colour: { kind: "rgb", r: at(2), g: at(3), b: at(4) }, used: 4 };
      }
      return { colour: DEFAULT, used: 0 };
    };
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i] ?? 0;
      if (p === 0) style = PLAIN;
      else if (p === 1) style = { ...style, bold: true };
      else if (p === 2) style = { ...style, dim: true };
      else if (p === 3) style = { ...style, italic: true };
      else if (p === 4) style = { ...style, underline: true };
      else if (p === 5 || p === 6) style = { ...style, blink: true };
      else if (p === 7) style = { ...style, inverse: true };
      else if (p === 8) style = { ...style, hidden: true };
      else if (p === 9) style = { ...style, strike: true };
      else if (p === 21 || p === 24) style = { ...style, underline: false };
      else if (p === 22) style = { ...style, bold: false, dim: false };
      else if (p === 23) style = { ...style, italic: false };
      else if (p === 25) style = { ...style, blink: false };
      else if (p === 27) style = { ...style, inverse: false };
      else if (p === 28) style = { ...style, hidden: false };
      else if (p === 29) style = { ...style, strike: false };
      else if (p >= 30 && p <= 37) style = { ...style, fg: { kind: "indexed", index: p - 30 } };
      else if (p === 39) style = { ...style, fg: DEFAULT };
      else if (p >= 40 && p <= 47) style = { ...style, bg: { kind: "indexed", index: p - 40 } };
      else if (p === 49) style = { ...style, bg: DEFAULT };
      else if (p >= 90 && p <= 97) style = { ...style, fg: { kind: "indexed", index: p - 90 + 8 } };
      else if (p >= 100 && p <= 107) style = { ...style, bg: { kind: "indexed", index: p - 100 + 8 } };
      else if (p === 38 || p === 48) {
        const { colour, used } = extended(i);
        style = p === 38 ? { ...style, fg: colour } : { ...style, bg: colour };
        i += used;
      } else if (p === 58) i += extended(i).used;
    }
  };

  const csi = (body: string, final: string): void => {
    const priv = /^[<=>?]/.test(body);
    const raw = (priv ? body.slice(1) : body).replace(/[ -/]+$/, "");
    const params = raw === "" ? [] : raw.split(/[;:]/).map((p) => (p === "" ? 0 : Number.parseInt(p, 10) || 0));
    if (priv) {
      if (body.startsWith("?") && params.includes(25) && (final === "h" || final === "l")) visible = final === "h";
      return;
    }
    if (/[ -/]$/.test(body)) return; // a sequence with intermediates is none of these
    const n = Math.max(1, params[0] ?? 1);
    switch (final) {
      case "A":
        row = clampRow(row - n);
        break;
      case "B":
        row = clampRow(row + n);
        break;
      case "C":
        col = clampCol(col + n);
        break;
      case "D":
        col = clampCol(col - n);
        break;
      case "E":
        row = clampRow(row + n);
        col = 0;
        break;
      case "F":
        row = clampRow(row - n);
        col = 0;
        break;
      case "G":
      case "`":
        col = clampCol(n - 1);
        break;
      case "d":
        row = clampRow(n - 1);
        break;
      case "H":
      case "f":
        row = clampRow(n - 1);
        col = clampCol(Math.max(1, params[1] ?? 1) - 1);
        break;
      case "K": {
        const mode = params[0] ?? 0;
        if (mode === 0) blank(row, col, width - 1);
        else if (mode === 1) blank(row, 0, col);
        else if (mode === 2) blank(row, 0, width - 1);
        break;
      }
      case "J": {
        const mode = params[0] ?? 0;
        if (mode === 0) {
          blank(row, col, width - 1);
          if (height === undefined) rows.length = Math.min(rows.length, row + 1);
          else for (let r = row + 1; r < height; r++) blank(r, 0, width - 1);
        } else if (mode === 1) {
          for (let r = 0; r < row; r++) blank(r, 0, width - 1);
          blank(row, 0, col);
        } else if (mode === 2 || mode === 3) {
          if (height === undefined) rows.length = 0;
          else for (let r = 0; r < height; r++) blank(r, 0, width - 1);
        }
        break;
      }
      case "m":
        sgr(params);
        return; // SGR leaves a deferred wrap as it is
      case "s":
        saved = { row, col, style };
        break;
      case "u":
        ({ row, col, style } = saved);
        break;
      default:
        return; // unknown: ignored, and the cursor untouched
    }
    pending = false;
  };

  const control = (code: number): void => {
    switch (code) {
      case 0x0d:
        col = 0;
        pending = false;
        return;
      case 0x0a:
      case 0x0b:
      case 0x0c:
        linefeed();
        if (crlf) col = 0;
        pending = false;
        return;
      case 0x08:
        col = Math.max(0, col - 1);
        pending = false;
        return;
      case 0x09:
        col = Math.min(width - 1, (Math.floor(col / 8) + 1) * 8);
        pending = false;
        return;
      default:
        return; // BEL and the other controls show nothing
    }
  };

  const feed = (data: string): void => {
    for (let i = 0; i < data.length; i++) {
      const ch = data.charAt(i);
      const code = data.charCodeAt(i);
      switch (state) {
        case "ground":
          if (code === 0x1b) {
            flush();
            state = "escape";
          } else if (code < 0x20 || code === 0x7f) {
            flush();
            control(code);
          } else text += ch;
          break;
        case "escape":
          if (code === 0x5b) {
            state = "csi";
            seq = "";
          } else if (ch === "]" || ch === "P" || ch === "X" || ch === "^" || ch === "_") state = "string";
          else if (code >= 0x20 && code <= 0x2f) seq += ch;
          else if (code >= 0x30 && code <= 0x7e) {
            if (seq === "" && ch === "7") saved = { row, col, style };
            else if (seq === "" && ch === "8") ({ row, col, style } = saved);
            seq = "";
            state = "ground";
          } else if (code !== 0x1b) {
            seq = "";
            state = "ground";
            i--;
          }
          break;
        case "csi":
          if (code >= 0x20 && code <= 0x3f) seq += ch;
          else if (code >= 0x40 && code <= 0x7e) {
            csi(seq, ch);
            seq = "";
            state = "ground";
          } else if (code === 0x1b) {
            seq = "";
            state = "escape";
          } else {
            seq = "";
            state = "ground";
            if (code !== 0x18 && code !== 0x1a) i--;
          }
          break;
        case "string":
          if (code === 0x07) state = "ground";
          else if (code === 0x1b) state = "string-escape";
          break;
        case "string-escape":
          seq = "";
          state = code === 0x5c ? "ground" : "escape";
          if (code !== 0x5c) i--;
          break;
        default:
          absurd(state);
      }
    }
    flush();
  };

  const visibleCells = (l: readonly Cell[]): readonly Cell[] => l.filter((c) => c.width !== 0);
  const dropTrailingEmpty = <T>(ls: readonly T[], empty: (l: T) => boolean): readonly T[] => {
    let end = ls.length;
    for (let last = ls[end - 1]; last !== undefined && empty(last); last = ls[end - 1]) end--;
    return ls.slice(0, end);
  };
  const lines = (): readonly string[] =>
    dropTrailingEmpty(
      rows.map((l) =>
        visibleCells(l)
          .map((c) => c.text)
          .join("")
          .replace(/ +$/, ""),
      ),
      (l) => l === "",
    );

  return {
    width,
    height,
    write(data: string | Uint8Array): void {
      feed(typeof data === "string" ? data : decoder.decode(data, { stream: true }));
    },
    lines,
    text(): string {
      return lines().join("\n");
    },
    styled(): readonly (readonly Run[])[] {
      const out = rows.map((l) => {
        const cells = visibleCells(l);
        let end = cells.length;
        while (end > 0 && cells[end - 1]?.text === " " && sameStyle(cells[end - 1]?.style ?? PLAIN, PLAIN)) end--;
        const runs: Run[] = [];
        for (const c of cells.slice(0, end)) {
          const last = runs[runs.length - 1];
          if (last !== undefined && sameStyle(last.style, c.style)) runs[runs.length - 1] = { text: last.text + c.text, style: last.style };
          else runs.push({ text: c.text, style: c.style });
        }
        return runs;
      });
      return dropTrailingEmpty(out, (l) => l.length === 0);
    },
    cell(r: number, c: number): Cell | undefined {
      if (r < 0 || c < 0 || c >= width || (height !== undefined && r >= height)) return undefined;
      return rows[r]?.[c] ?? BLANK;
    },
    cursor(): Cursor {
      return { row, col, visible };
    },
  };
}
