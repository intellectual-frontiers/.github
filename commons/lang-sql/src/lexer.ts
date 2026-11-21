/**
 * The lexer of SQL (commons lang-sql 0001-sql-lang): one pass over the character codes of a text, by the tables of a compiled lexical, that returns the tokens, the comments and the errors, so that every
 * character is in exactly one token, one comment or white space. It does not throw, does not judge where a word is a keyword, and names no dialect: what a dialect writes is its lexical.
 *
 * @remarks
 * The hot path reads each character once: white space, then a comment (the one table lookup that says whether a character may begin one), a word with its keyword found by a hash of its upper-cased
 * characters, a number, a quoted string or identifier, a parameter, punctuation, then an operator, the longest of the dialect's first. A token is four pushes onto arrays of small integers; its text is
 * cut from the source only when someone asks (`textAt`).
 *
 * @limits
 * A word is not split at a character outside ASCII, so a word such as `naïve` is one word that is never a keyword; a number has no suffix; `\r` alone ends a line for the place of a comment.
 *
 * @example
 * ```ts
 * const { tokens, comments, errors } = lex("select 1 -- one", ansi.compiled);
 * errors.length; // 0
 * ```
 *
 * Spec: 0001-sql-lang FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-018
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { CommentFlag, type Comments, StyleCode } from "./comment.ts";
import { Cls, type CommentRule, type CompiledLexical, type Escape, ParamStyleId, wordHash } from "./lexical.ts";
import type { Span } from "./span.ts";
import { Tok, type TokKind, type Tokens } from "./token.ts";

/** What the lexer found that the dialect cannot read. */
export type LexError =
  | { readonly kind: "unterminated-comment"; readonly span: Span }
  | { readonly kind: "unterminated-string"; readonly span: Span }
  | { readonly kind: "unterminated-identifier"; readonly span: Span }
  | { readonly kind: "unexpected-character"; readonly span: Span; readonly char: string };

/** One sentence for an error of the lexer. */
export function describeLexError(e: LexError): string {
  switch (e.kind) {
    case "unterminated-comment":
      return `the comment at ${e.span.start} is not closed`;
    case "unterminated-string":
      return `the string at ${e.span.start} is not closed`;
    case "unterminated-identifier":
      return `the quoted identifier at ${e.span.start} is not closed`;
    case "unexpected-character":
      return `the character ${JSON.stringify(e.char)} at ${e.span.start} is not part of the language`;
    default:
      return absurd(e);
  }
}

/** The result of lexing a text. */
export interface Lexed {
  readonly text: string;
  readonly tokens: Tokens;
  readonly comments: Comments;
  readonly errors: readonly LexError[];
}

const isUnicodeSpace = (c: number): boolean =>
  c === 0xa0 ||
  c === 0x1680 ||
  (c >= 0x2000 && c <= 0x200a) ||
  c === 0x2028 ||
  c === 0x2029 ||
  c === 0x202f ||
  c === 0x205f ||
  c === 0x3000 ||
  c === 0xfeff;

/** The id a string token carries for an Oracle `q'[...]'` string, which no string syntax of the dialect has. */
export const Q_STRING = 65535;
const CLOSERS: Readonly<Record<string, string>> = { "[": "]", "{": "}", "(": ")", "<": ">" };

/** The id of the keyword in `text[start, end)`, 0 where it is none. */
function keywordAt(lx: CompiledLexical, text: string, start: number, end: number): number {
  const len = end - start;
  if (len > lx.kwMax || len < lx.kwMin) return 0;
  let slot = wordHash(text, start, end) & lx.kwMask;
  for (;;) {
    const id = lx.kwTable[slot] ?? 0;
    if (id === 0) return 0;
    const word = lx.kwWords[id - 1] ?? "";
    if (word.length === len) {
      let k = 0;
      for (; k < len; k++) {
        let c = text.charCodeAt(start + k);
        if (c >= 97 && c <= 122) c -= 32;
        if (c !== word.charCodeAt(k)) break;
      }
      if (k === len) return id;
    }
    slot = (slot + 1) & lx.kwMask;
  }
}

/** The end of a string or quoted identifier whose contents begin at `from`, or -1 where it is not closed. */
function scanQuoted(text: string, from: number, close: string, escape: Escape): number {
  const n = text.length;
  const q = close.charCodeAt(0);
  const single = close.length === 1;
  const doubled = single && (escape === "double" || escape === "both");
  const slashed = escape === "backslash" || escape === "both";
  let k = from;
  while (k < n) {
    const d = text.charCodeAt(k);
    if (d === q && (single || text.startsWith(close, k))) {
      if (doubled && text.charCodeAt(k + 1) === q) {
        k += 2;
        continue;
      }
      return k + close.length;
    }
    if (d === 92 && slashed) {
      k += 2;
      continue;
    }
    k++;
  }
  return -1;
}

/** The end of a number that begins at `i`. */
function scanNumber(text: string, i: number, lx: CompiledLexical): number {
  let j = i;
  const first = text.charCodeAt(j);
  const digit = (d: number): boolean => d >= 48 && d <= 57;
  const run = (k: number): number => {
    for (;;) {
      const d = text.charCodeAt(k);
      if (digit(d) || (lx.underscores && d === 95 && digit(text.charCodeAt(k + 1)) && k > j)) k++;
      else return k;
    }
  };
  if (first === 48 && lx.radix) {
    const r = text.charCodeAt(j + 1) | 32;
    if (r === 120 || r === 98 || r === 111) {
      let k = j + 2;
      for (;;) {
        const d = text.charCodeAt(k);
        const lower = d | 32;
        const ok = r === 120 ? digit(d) || (lower >= 97 && lower <= 102) : r === 98 ? d === 48 || d === 49 : d >= 48 && d <= 55;
        if (ok || (lx.underscores && d === 95 && k > j + 2)) k++;
        else break;
      }
      if (k > j + 2) return k;
    }
  }
  if (first === 46) {
    j = run(j + 1);
  } else {
    j = run(j);
    if (text.charCodeAt(j) === 46) {
      const d = text.charCodeAt(j + 1);
      const word = (d >= 65 && d <= 90) || (d >= 97 && d <= 122) || d === 95 || d === 46;
      if (digit(d) || !word) j = run(j + 1);
    }
  }
  const e = text.charCodeAt(j) | 32;
  if (e === 101) {
    let k = j + 1;
    const sign = text.charCodeAt(k);
    if (sign === 43 || sign === 45) k++;
    if (digit(text.charCodeAt(k))) j = run(k);
  }
  if (lx.numberSuffixes.length > 0) {
    const c = text.charCodeAt(j) | 32;
    if (c >= 97 && c <= 122) {
      for (const sfx of lx.numberSuffixes) {
        const end = j + sfx.length;
        if (text.slice(j, end).toUpperCase() !== sfx) continue;
        const after = text.charCodeAt(end);
        if (!(after < 128 && ((lx.cls[after] ?? 0) & Cls.WordPart) !== 0)) return end;
      }
    }
  }
  return j;
}

/** Where a word that begins at `i` ends, and whether it holds a character outside ASCII. */
function scanWord(text: string, i: number, lx: CompiledLexical): number {
  const cls = lx.cls;
  let j = i + 1;
  for (;;) {
    const d = text.charCodeAt(j);
    if (d < 128) {
      if (((cls[d] ?? 0) & Cls.WordPart) === 0) return j;
    } else if (d !== d || isUnicodeSpace(d)) return j; // NaN: past the end of the text
    j++;
  }
}

/** Where the `$` that closes a dollar quote's tag is, for a tag that begins at `from` (just after the opening `$`): an empty tag, or a word with no `$` in it; -1 where it is not a tag. */
function scanTag(text: string, from: number, lx: CompiledLexical): number {
  const n = text.length;
  const cls = lx.cls;
  let j = from;
  if (j < n && text.charCodeAt(j) === 36) return j;
  const first = text.charCodeAt(j);
  if (!(first >= 128 || ((cls[first] ?? 0) & Cls.WordStart) !== 0)) return -1;
  for (j++; j < n; j++) {
    const d = text.charCodeAt(j);
    if (d === 36) return j;
    if (d < 128 ? ((cls[d] ?? 0) & Cls.WordPart) === 0 : isUnicodeSpace(d)) return -1;
  }
  return -1;
}

type MutableComments = {
  style: number[];
  marker: string[];
  start: number[];
  end: number[];
  innerStart: number[];
  innerEnd: number[];
  before: number[];
  flags: number[];
};

/** Reads a comment at `i` where a rule has one, records it, and returns where it ends, or -1 where none of the rules reads one there. */
function scanComment(
  text: string,
  i: number,
  rules: readonly CommentRule[],
  into: MutableComments,
  errors: LexError[],
  before: number,
  ownLine: boolean,
): number {
  const n = text.length;
  for (const r of rules) {
    if (!text.startsWith(r.open, i)) continue;
    let style: number = StyleCode.Line;
    let end: number;
    let innerStart = i + r.open.length;
    let innerEnd: number;
    let closed = true;
    if (r.kind === "line") {
      if (r.spaceAfter) {
        const d = text.charCodeAt(innerStart);
        if (d > 32 && d !== 127) continue;
      }
      end = innerStart;
      for (; end < n; end++) {
        const d = text.charCodeAt(end);
        if (d === 10 || d === 13) break;
      }
      innerEnd = end;
    } else {
      style = StyleCode.Block;
      const marker = text.charCodeAt(innerStart);
      if (r.hints && marker === 43) style = StyleCode.Hint;
      else if (r.conditional && marker === 33) style = StyleCode.Conditional;
      let j = innerStart;
      let at = -1;
      if (!r.nested) {
        at = text.indexOf(r.close, j);
        j = at < 0 ? n : at + r.close.length;
      } else {
        let depth = 1;
        while (j < n) {
          if (text.startsWith(r.close, j)) {
            depth--;
            if (depth === 0) {
              at = j;
              j += r.close.length;
              break;
            }
            j += r.close.length;
          } else if (text.startsWith(r.open, j)) {
            depth++;
            j += r.open.length;
          } else j++;
        }
        if (at < 0) j = n;
      }
      closed = at >= 0;
      end = j;
      innerEnd = closed ? at : n;
      if (innerEnd < innerStart) innerStart = innerEnd;
      if (!closed) errors.push({ kind: "unterminated-comment", span: { start: i, end } });
    }
    let newlines = 0;
    let k = end;
    for (;;) {
      const d = text.charCodeAt(k);
      if (d === 10) {
        newlines++;
        k++;
      } else if (d === 13) {
        newlines++;
        k += text.charCodeAt(k + 1) === 10 ? 2 : 1;
      } else if (d < 128 ? d === 32 || d === 9 || d === 11 || d === 12 : isUnicodeSpace(d)) k++;
      else break;
    }
    const flags: number =
      (ownLine ? CommentFlag.OwnLine : 0) |
      (newlines >= 2 || k >= n ? CommentFlag.BlankAfter : 0) |
      (closed ? 0 : CommentFlag.Unterminated);
    into.style.push(style);
    into.marker.push(r.open);
    into.start.push(i);
    into.end.push(end);
    into.innerStart.push(innerStart);
    into.innerEnd.push(innerEnd);
    into.before.push(before);
    into.flags.push(flags);
    return end;
  }
  return -1;
}

/**
 * Lexes a text.
 *
 * @param text - SQL, in any dialect
 * @param lx - how that dialect is written, compiled
 * @param from - where to begin, 0 by default; the tokens, comments and errors have offsets of the whole text
 * @param to - where to end, the end of the text by default
 * @returns its tokens (the last is the end of the text), its comments and what it holds that the dialect cannot read
 */
export function lex(text: string, lx: CompiledLexical, from = 0, to = text.length): Lexed {
  if (from === 0 && to >= text.length) return lexWhole(text, lx);
  // a range of a text: lexed alone and moved to its place, so that every offset is an offset of the whole text
  const l = lexWhole(text.slice(from, to), lx);
  const shift = (xs: readonly number[]): number[] => xs.map((x) => x + from);
  const span = (s: Span): Span => ({ start: s.start + from, end: s.end + from });
  const errors = l.errors.map((e): LexError =>
    e.kind === "unexpected-character" ? { ...e, span: span(e.span) } : { ...e, span: span(e.span) },
  );
  const c = l.comments;
  return {
    text,
    tokens: { kind: l.tokens.kind, start: shift(l.tokens.start), end: shift(l.tokens.end), id: l.tokens.id },
    comments: {
      style: c.style,
      marker: c.marker,
      start: shift(c.start),
      end: shift(c.end),
      innerStart: shift(c.innerStart),
      innerEnd: shift(c.innerEnd),
      before: c.before,
      flags: c.flags,
    },
    errors,
  };
}

function lexWhole(text: string, lx: CompiledLexical): Lexed {
  const n = text.length;
  const kind: TokKind[] = [];
  const start: number[] = [];
  const end: number[] = [];
  const id: number[] = [];
  const into: MutableComments = { style: [], marker: [], start: [], end: [], innerStart: [], innerEnd: [], before: [], flags: [] };
  const errors: LexError[] = [];
  const cls = lx.cls;
  let i = 0;
  let lineStart = true;

  while (i < n) {
    const c = text.charCodeAt(i);
    const f = c < 128 ? (cls[c] ?? 0) : 0;

    if ((f & Cls.Space) !== 0 || (c >= 128 && isUnicodeSpace(c))) {
      let j = i;
      for (;;) {
        const d = text.charCodeAt(j);
        if (d === 10 || d === 13) {
          lineStart = true;
          j++;
        } else if (d < 128 ? ((cls[d] ?? 0) & Cls.Space) !== 0 : isUnicodeSpace(d)) j++;
        else break;
      }
      i = j;
      continue;
    }

    if ((f & Cls.CommentStart) !== 0) {
      const at = scanComment(text, i, lx.commentsByFirst[c] ?? [], into, errors, kind.length, lineStart);
      if (at >= 0) {
        i = at;
        lineStart = false;
        continue;
      }
    }

    let k: TokKind = Tok.Error;
    let e = i + 1;
    let tid = 0;

    if ((f & Cls.WordStart) !== 0 || c >= 128) {
      const j = scanWord(text, i, lx);
      e = j;
      k = Tok.Word;
      const q = text.charCodeAt(j);
      let done = false;
      if (lx.qQuoting && j - i === 1 && (text.charCodeAt(i) | 32) === 113 && q === 39) {
        const d = text.charAt(j + 1);
        if (d !== "" && d.charCodeAt(0) > 32 && d !== "'") {
          const close = `${CLOSERS[d] ?? d}'`;
          const at = text.indexOf(close, j + 2);
          e = at < 0 ? n : at + close.length;
          if (at < 0) errors.push({ kind: "unterminated-string", span: { start: i, end: n } });
          k = Tok.String;
          tid = Q_STRING;
          done = true;
        }
      }
      if (!done && j - i <= 2 && q < 128 && ((cls[q] ?? 0) & Cls.QuoteStart) !== 0 && lx.prefixes.size > 0) {
        const up = text.slice(i, j).toUpperCase();
        if (lx.prefixes.has(up)) {
          for (const r of lx.stringsByFirst[q] ?? []) {
            if (!text.startsWith(r.open, j)) continue;
            const stop = scanQuoted(text, j + r.open.length, r.close, lx.prefixes.get(up) ?? r.escape);
            e = stop < 0 ? n : stop;
            if (stop < 0) errors.push({ kind: "unterminated-string", span: { start: i, end: n } });
            k = Tok.String;
            tid = r.id;
            done = true;
            break;
          }
        }
      } else if (lx.hasUnicodePrefix && q === 38 && j - i === 1 && (text.charCodeAt(i) | 32) === 117 && lx.prefixes.has("U&")) {
        const o = text.charCodeAt(j + 1);
        if (o < 128 && ((cls[o] ?? 0) & Cls.QuoteStart) !== 0) {
          for (const r of lx.stringsByFirst[o] ?? []) {
            if (!text.startsWith(r.open, j + 1)) continue;
            const stop = scanQuoted(text, j + 1 + r.open.length, r.close, lx.prefixes.get("U&") ?? r.escape);
            e = stop < 0 ? n : stop;
            if (stop < 0) errors.push({ kind: "unterminated-string", span: { start: i, end: n } });
            k = Tok.String;
            tid = r.id;
            done = true;
            break;
          }
        }
      }
      if (!done) {
        let ascii = true;
        for (let m = i; m < j; m++) {
          if (text.charCodeAt(m) >= 128) {
            ascii = false;
            break;
          }
        }
        tid = ascii ? keywordAt(lx, text, i, j) : 0;
      }
    } else if ((f & Cls.Digit) !== 0) {
      k = Tok.Number;
      e = scanNumber(text, i, lx);
    } else {
      let handled = false;
      if ((f & Cls.QuoteStart) !== 0) {
        for (const r of lx.stringsByFirst[c] ?? []) {
          if (!text.startsWith(r.open, i)) continue;
          const stop = scanQuoted(text, i + r.open.length, r.close, r.escape);
          e = stop < 0 ? n : stop;
          if (stop < 0) errors.push({ kind: "unterminated-string", span: { start: i, end: n } });
          k = Tok.String;
          tid = r.id;
          handled = true;
          break;
        }
        if (!handled) {
          for (const r of lx.identsByFirst[c] ?? []) {
            if (!text.startsWith(r.open, i)) continue;
            const stop = scanQuoted(text, i + r.open.length, r.close, "double");
            e = stop < 0 ? n : stop;
            if (stop < 0) errors.push({ kind: "unterminated-identifier", span: { start: i, end: n } });
            k = Tok.QuotedIdent;
            tid = r.id;
            handled = true;
            break;
          }
        }
      }
      if (!handled) {
        switch (c) {
          case 40:
            k = Tok.LParen;
            break;
          case 41:
            k = Tok.RParen;
            break;
          case 91:
            k = Tok.LBracket;
            break;
          case 93:
            k = Tok.RBracket;
            break;
          case 123:
            k = Tok.LBrace;
            break;
          case 125:
            k = Tok.RBrace;
            break;
          case 44:
            k = Tok.Comma;
            break;
          case 59:
            k = Tok.Semicolon;
            break;
          case 46: {
            const d = text.charCodeAt(i + 1);
            if (d >= 48 && d <= 57) {
              k = Tok.Number;
              e = scanNumber(text, i, lx);
            } else k = Tok.Dot;
            break;
          }
          case 36: {
            let done = false;
            if (lx.dollarQuotes) {
              const j = scanTag(text, i + 1, lx);
              if (j >= 0) {
                const tag = text.slice(i, j + 1);
                const close = text.indexOf(tag, j + 1);
                e = close < 0 ? n : close + tag.length;
                if (close < 0) errors.push({ kind: "unterminated-string", span: { start: i, end: n } });
                k = Tok.String;
                tid = 0;
                done = true;
              }
            }
            if (!done) {
              const d = text.charCodeAt(i + 1);
              if (d >= 48 && d <= 57 && (lx.paramBits & (1 << ParamStyleId.DollarNumber)) !== 0) {
                let j = i + 1;
                while (text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
                k = Tok.Param;
                e = j;
                tid = ParamStyleId.DollarNumber;
              } else if (((cls[d] ?? 0) & Cls.WordStart) !== 0 && (lx.paramBits & (1 << ParamStyleId.DollarName)) !== 0) {
                k = Tok.Param;
                e = scanWord(text, i + 1, lx);
                tid = ParamStyleId.DollarName;
              }
            }
            break;
          }
          default: {
            let op = false;
            if (c === 63 && (lx.paramBits & (1 << ParamStyleId.Question)) !== 0) {
              let j = i + 1;
              while (text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
              k = Tok.Param;
              e = j;
              tid = ParamStyleId.Question;
            } else if (
              c === 58 &&
              (lx.paramBits & (1 << ParamStyleId.ColonName)) !== 0 &&
              ((cls[text.charCodeAt(i + 1)] ?? 0) & Cls.WordStart) !== 0
            ) {
              k = Tok.Param;
              e = scanWord(text, i + 1, lx);
              tid = ParamStyleId.ColonName;
            } else if (c === 64 && (lx.paramBits & (1 << ParamStyleId.AtName)) !== 0) {
              const at = text.charCodeAt(i + 1) === 64 ? i + 2 : i + 1;
              if (((cls[text.charCodeAt(at)] ?? 0) & Cls.WordStart) !== 0) {
                k = Tok.Param;
                e = scanWord(text, at, lx);
                tid = ParamStyleId.AtName;
              } else op = true;
            } else op = true;
            if (op && (f & Cls.OpChar) !== 0) {
              k = Tok.Op;
              for (const r of lx.opsByFirst[c] ?? []) {
                if (text.startsWith(r.text, i)) {
                  e = i + r.text.length;
                  tid = r.id;
                  break;
                }
              }
              if (tid === 0) tid = lx.singleOp[c] ?? 0;
            }
          }
        }
      }
    }

    if (k === Tok.Error) errors.push({ kind: "unexpected-character", span: { start: i, end: e }, char: text.slice(i, e) });
    kind.push(k);
    start.push(i);
    end.push(e);
    id.push(tid);
    lineStart = false;
    i = e;
  }
  kind.push(Tok.Eof);
  start.push(n);
  end.push(n);
  id.push(0);
  return { text, tokens: { kind, start, end, id }, comments: into, errors };
}
