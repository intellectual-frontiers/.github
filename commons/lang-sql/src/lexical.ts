/**
 * How a dialect is written (commons lang-sql 0001-sql-lang FR-015): a {@link Lexical} is data (its comments, quoted identifiers, strings and their prefixes, parameters, operators, keywords and numbers), and
 * {@link compileLexical} turns it, once, into the tables the lexer reads: a class for each ASCII character, the rules that can begin at each character, the longest operators first, and a hash table of
 * the keywords. A lexical that cannot be compiled is an error value that names the field.
 *
 * @remarks
 * Every opener, marker and operator must begin with an ASCII character, so that the lexer chooses the rules at a character by one table lookup; a word may hold any character above ASCII.
 *
 * @limits
 * A number has no suffix (`10L` is a number and a word); a keyword is a word of ASCII letters, digits and `_`.
 *
 * @example
 * ```ts
 * const r = compileLexical({ ...ANSI_LEXICAL, comments: [{ kind: "line", marker: "#" }] });
 * r.kind === "ok"; // true
 * ```
 *
 * Spec: 0001-sql-lang FR-007, FR-008, FR-009, FR-010, FR-011, FR-015
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** A kind of comment: a line comment runs from its marker to the end of the line, a block comment from `open` to `close`. */
export type CommentSyntax =
  | {
      readonly kind: "line";
      readonly marker: string;
      /** Whether the marker is a comment only when white space, a control character or the end of the text follows it (MySQL's `--`). */
      readonly spaceAfter?: boolean;
    }
  | {
      readonly kind: "block";
      readonly open: string;
      readonly close: string;
      /** Whether a comment inside the comment must be closed too (PostgreSQL), or the first `close` ends it (SQLite). */
      readonly nested: boolean;
      /** Whether a comment that begins `open` then `+` is an optimizer hint. */
      readonly hints?: boolean;
      /** Whether a comment that begins `open` then `!` is a conditional comment (MySQL). */
      readonly conditional?: boolean;
    };

/** How a quote is written inside a string: by writing it twice, by a backslash before it, either, or not at all. */
export type Escape = "double" | "backslash" | "both" | "none";

/** A string: what opens it, what closes it, and how a quote is written inside. */
export interface StringSyntax {
  readonly open: string;
  readonly close: string;
  readonly escape: Escape;
}

/** A quoted identifier: what opens it and what closes it; the close is written twice inside. */
export interface IdentSyntax {
  readonly open: string;
  readonly close: string;
}

/** A letter or letters before a string's opening quote, such as `E`, and the escape it gives the string, where it changes it. */
export interface StringPrefix {
  readonly prefix: string;
  readonly escape?: Escape;
}

/** The styles of a parameter. */
export type ParamStyle = "question" | "dollar-number" | "dollar-name" | "colon-name" | "at-name";

/** The id a parameter token carries for its style. */
export const ParamStyleId = { Question: 1, DollarNumber: 2, DollarName: 3, ColonName: 4, AtName: 5 } as const;

/** What a dialect's text is made of. */
export interface Lexical {
  readonly comments: readonly CommentSyntax[];
  readonly identifiers: readonly IdentSyntax[];
  readonly strings: readonly StringSyntax[];
  readonly prefixes: readonly StringPrefix[];
  /** Whether `$$ ... $$` and `$tag$ ... $tag$` are strings. */
  readonly dollarQuotes: boolean;
  readonly params: readonly ParamStyle[];
  /** The operators of two or more characters; each of one character is read as an operator too. */
  readonly operators: readonly string[];
  /** The words the dialect knows; the lexer tells a parser which words these are and never judges where they are keywords. */
  readonly keywords: readonly string[];
  /** ASCII characters, besides letters, digits and `_`, that a word may hold after its first character (`$` in PostgreSQL). */
  readonly wordChars: string;
  readonly numbers: { readonly radix: boolean; readonly underscores: boolean };
  /** Upper-case letters after a number that belong to it (`L`, `BD` in Hive: `1L`, `1.5BD`). */
  readonly numberSuffixes: readonly string[];
  /** ASCII characters, besides letters and `_`, that may begin a word (`#` for T-SQL's `#temp`). */
  readonly wordStartChars: string;
  /** Whether `q'[...]'` is a string whose delimiter is the character after the quote (Oracle). */
  readonly qQuoting: boolean;
}

/** What is wrong with a lexical, one sentence each (see {@link describeLexicalError}). */
export type LexicalError =
  | { readonly kind: "empty"; readonly field: string }
  | { readonly kind: "not-ascii"; readonly field: string; readonly value: string }
  | { readonly kind: "duplicate"; readonly field: string; readonly value: string }
  | { readonly kind: "invalid"; readonly field: string; readonly value: string };

/** One sentence for a lexical's error. */
export function describeLexicalError(e: LexicalError): string {
  switch (e.kind) {
    case "empty":
      return `${e.field} has an empty value`;
    case "not-ascii":
      return `${e.field} "${e.value}" does not begin with an ASCII character`;
    case "duplicate":
      return `${e.field} "${e.value}" is given twice`;
    case "invalid":
      return `${e.field} "${e.value}" is not valid there`;
    default:
      return absurd(e);
  }
}

/** The kinds of line, block and rule, compiled. */
export interface CommentRule {
  readonly kind: "line" | "block";
  readonly open: string;
  readonly close: string;
  readonly nested: boolean;
  readonly spaceAfter: boolean;
  readonly hints: boolean;
  readonly conditional: boolean;
}

/** A compiled string rule; its `id` is its index plus one. */
export interface StringRule extends StringSyntax {
  readonly id: number;
}

/** A compiled quoted-identifier rule; its `id` is its index. */
export interface IdentRule extends IdentSyntax {
  readonly id: number;
}

/** A compiled operator of two or more characters. */
export interface OperatorRule {
  readonly text: string;
  readonly id: number;
}

/** The flags of the class of an ASCII character. */
export const Cls = { Space: 1, Digit: 2, WordStart: 4, WordPart: 8, OpChar: 16, CommentStart: 32, QuoteStart: 64 } as const;

/** The characters an operator is made of. */
export const OPERATOR_CHARS = "+-*/%=<>!~^&|:@#?";

/** A lexical made into the tables the lexer reads. */
export interface CompiledLexical {
  readonly lexical: Lexical;
  /** The class flags of each ASCII character (0 to 127). */
  readonly cls: Uint8Array;
  readonly commentsByFirst: readonly (readonly CommentRule[])[];
  readonly stringsByFirst: readonly (readonly StringRule[])[];
  readonly identsByFirst: readonly (readonly IdentRule[])[];
  /** The prefixes (upper case) with the escape each gives, `undefined` where it gives none. */
  readonly prefixes: ReadonlyMap<string, Escape | undefined>;
  readonly hasUnicodePrefix: boolean;
  /** The operators of two or more characters that begin at each ASCII character, the longest first. */
  readonly opsByFirst: readonly (readonly OperatorRule[])[];
  /** The id of the one-character operator at each ASCII character, 0 where it is none. */
  readonly singleOp: Uint16Array;
  /** Every operator's text; the id of the operator at index `i` is `i + 1`. */
  readonly operators: readonly string[];
  /** The bit of each style in `ParamStyleId` that the dialect has: `1 << id`. */
  readonly paramBits: number;
  readonly dollarQuotes: boolean;
  /** The keyword hash table: the keyword's id (its index plus one), 0 where a slot is empty. */
  readonly kwTable: Int32Array;
  readonly kwMask: number;
  readonly kwWords: readonly string[];
  readonly kwMin: number;
  readonly kwMax: number;
  readonly radix: boolean;
  readonly underscores: boolean;
  readonly numberSuffixes: readonly string[];
  readonly qQuoting: boolean;
}

const STYLE_ID: Readonly<Record<ParamStyle, number>> = {
  question: ParamStyleId.Question,
  "dollar-number": ParamStyleId.DollarNumber,
  "dollar-name": ParamStyleId.DollarName,
  "colon-name": ParamStyleId.ColonName,
  "at-name": ParamStyleId.AtName,
};

/**
 * The hash of the characters of `text` from `start` to `end`, folded to upper case, with the length: the lexer and the table of keywords use this one function, so that they agree.
 *
 * @param text - the text
 * @param start - where the word begins
 * @param end - where it ends
 * @returns a 32-bit integer
 */
export function wordHash(text: string, start: number, end: number): number {
  let h = end - start;
  for (let k = start; k < end; k++) {
    let c = text.charCodeAt(k);
    if (c >= 97 && c <= 122) c -= 32;
    h = (Math.imul(h, 31) + c) | 0;
  }
  return h;
}

const isAscii = (s: string): boolean => s.length > 0 && s.charCodeAt(0) < 128;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*$/;
const byLengthDesc = <T extends { readonly open?: string; readonly text?: string }>(a: T, b: T): number =>
  (b.open ?? b.text ?? "").length - (a.open ?? a.text ?? "").length;

/**
 * Compiles a lexical.
 *
 * @param lexical - how a dialect is written
 * @returns the tables the lexer reads, or what is wrong with the lexical
 */
export function compileLexical(lexical: Lexical): Result<CompiledLexical, LexicalError> {
  const cls = new Uint8Array(128);
  for (const c of [9, 10, 11, 12, 13, 32]) cls[c] = Cls.Space;
  for (let c = 48; c <= 57; c++) cls[c] = Cls.Digit | Cls.WordPart;
  for (let c = 65; c <= 90; c++) cls[c] = Cls.WordStart | Cls.WordPart;
  for (let c = 97; c <= 122; c++) cls[c] = Cls.WordStart | Cls.WordPart;
  cls[95] = Cls.WordStart | Cls.WordPart;
  for (const ch of OPERATOR_CHARS) cls[ch.charCodeAt(0)] = (cls[ch.charCodeAt(0)] ?? 0) | Cls.OpChar;
  for (const ch of lexical.wordStartChars) {
    const c = ch.charCodeAt(0);
    if (c >= 128 || (cls[c] ?? 0) & (Cls.WordStart | Cls.Space | Cls.Digit))
      return err({ kind: "invalid", field: "wordStartChars", value: ch });
    cls[c] = (cls[c] ?? 0) | Cls.WordStart | Cls.WordPart;
  }
  for (const ch of lexical.wordChars) {
    const c = ch.charCodeAt(0);
    if (c >= 128 || (cls[c] ?? 0) & (Cls.WordPart | Cls.Space)) return err({ kind: "invalid", field: "wordChars", value: ch });
    cls[c] = (cls[c] ?? 0) | Cls.WordPart;
  }

  const empty = (): CommentRule[][] => Array.from({ length: 128 }, () => []);
  const commentsByFirst = empty();
  const seenComment = new Set<string>();
  for (const s of lexical.comments) {
    const open = s.kind === "line" ? s.marker : s.open;
    if (open.length === 0) return err({ kind: "empty", field: "comments" });
    if (!isAscii(open)) return err({ kind: "not-ascii", field: "comments", value: open });
    if (seenComment.has(open)) return err({ kind: "duplicate", field: "comments", value: open });
    seenComment.add(open);
    if (s.kind === "block" && s.close.length === 0) return err({ kind: "empty", field: "comments" });
    const rule: CommentRule =
      s.kind === "line"
        ? { kind: "line", open, close: "", nested: false, spaceAfter: s.spaceAfter === true, hints: false, conditional: false }
        : {
            kind: "block",
            open,
            close: s.close,
            nested: s.nested,
            spaceAfter: false,
            hints: s.hints === true,
            conditional: s.conditional === true,
          };
    commentsByFirst[open.charCodeAt(0)]?.push(rule);
  }
  for (const [c, rules] of commentsByFirst.entries()) {
    rules.sort((a, b) => b.open.length - a.open.length);
    if (rules.length > 0) cls[c] = (cls[c] ?? 0) | Cls.CommentStart;
  }

  const stringsByFirst: StringRule[][] = Array.from({ length: 128 }, () => []);
  const identsByFirst: IdentRule[][] = Array.from({ length: 128 }, () => []);
  const openers = new Set<string>();
  for (const [i, s] of lexical.strings.entries()) {
    if (s.open.length === 0 || s.close.length === 0) return err({ kind: "empty", field: "strings" });
    if (!isAscii(s.open)) return err({ kind: "not-ascii", field: "strings", value: s.open });
    if (openers.has(s.open)) return err({ kind: "duplicate", field: "strings", value: s.open });
    openers.add(s.open);
    stringsByFirst[s.open.charCodeAt(0)]?.push({ ...s, id: i + 1 });
  }
  for (const [i, s] of lexical.identifiers.entries()) {
    if (s.open.length === 0 || s.close.length === 0) return err({ kind: "empty", field: "identifiers" });
    if (!isAscii(s.open)) return err({ kind: "not-ascii", field: "identifiers", value: s.open });
    if (openers.has(s.open)) return err({ kind: "duplicate", field: "identifiers", value: s.open });
    openers.add(s.open);
    identsByFirst[s.open.charCodeAt(0)]?.push({ ...s, id: i });
  }
  for (const [c, rules] of stringsByFirst.entries()) {
    rules.sort(byLengthDesc);
    if (rules.length > 0) cls[c] = (cls[c] ?? 0) | Cls.QuoteStart;
  }
  for (const [c, rules] of identsByFirst.entries()) {
    rules.sort(byLengthDesc);
    if (rules.length > 0) cls[c] = (cls[c] ?? 0) | Cls.QuoteStart;
  }

  const prefixes = new Map<string, Escape | undefined>();
  for (const p of lexical.prefixes) {
    if (p.prefix.length === 0) return err({ kind: "empty", field: "prefixes" });
    if (!/^[A-Za-z]+(&)?$/.test(p.prefix)) return err({ kind: "invalid", field: "prefixes", value: p.prefix });
    prefixes.set(p.prefix.toUpperCase(), p.escape);
  }

  const operators: string[] = [];
  const opId = new Map<string, number>();
  const singleOp = new Uint16Array(128);
  const add = (text: string): number => {
    const known = opId.get(text);
    if (known !== undefined) return known;
    operators.push(text);
    opId.set(text, operators.length);
    return operators.length;
  };
  for (const ch of OPERATOR_CHARS) singleOp[ch.charCodeAt(0)] = add(ch);
  const opsByFirst: OperatorRule[][] = Array.from({ length: 128 }, () => []);
  for (const text of lexical.operators) {
    if (text.length < 2) return err({ kind: "invalid", field: "operators", value: text });
    for (const ch of text) if (!OPERATOR_CHARS.includes(ch)) return err({ kind: "invalid", field: "operators", value: text });
    if (opsByFirst[text.charCodeAt(0)]?.some((o) => o.text === text) === true) continue;
    opsByFirst[text.charCodeAt(0)]?.push({ text, id: add(text) });
  }
  for (const rules of opsByFirst) rules.sort(byLengthDesc);

  for (const sfx of lexical.numberSuffixes)
    if (!/^[A-Za-z]+$/.test(sfx)) return err({ kind: "invalid", field: "numberSuffixes", value: sfx });

  let paramBits = 0;
  for (const p of lexical.params) paramBits |= 1 << STYLE_ID[p];

  const kwWords: string[] = [];
  const seen = new Set<string>();
  for (const w of lexical.keywords) {
    if (w.length === 0) return err({ kind: "empty", field: "keywords" });
    if (!WORD.test(w)) return err({ kind: "invalid", field: "keywords", value: w });
    const up = w.toUpperCase();
    if (seen.has(up)) continue;
    seen.add(up);
    kwWords.push(up);
  }
  let size = 16;
  while (size < kwWords.length * 4) size <<= 1;
  const kwTable = new Int32Array(size);
  const kwMask = size - 1;
  let kwMin = Number.MAX_SAFE_INTEGER;
  let kwMax = 0;
  for (const [i, w] of kwWords.entries()) {
    let slot = wordHash(w, 0, w.length) & kwMask;
    while ((kwTable[slot] ?? 0) !== 0) slot = (slot + 1) & kwMask;
    kwTable[slot] = i + 1;
    if (w.length < kwMin) kwMin = w.length;
    if (w.length > kwMax) kwMax = w.length;
  }

  return ok({
    lexical,
    cls,
    commentsByFirst,
    stringsByFirst,
    identsByFirst,
    prefixes,
    hasUnicodePrefix: [...prefixes.keys()].some((k) => k.endsWith("&")),
    opsByFirst,
    singleOp,
    operators,
    paramBits,
    dollarQuotes: lexical.dollarQuotes,
    kwTable,
    kwMask,
    kwWords,
    kwMin,
    kwMax,
    radix: lexical.numbers.radix,
    underscores: lexical.numbers.underscores,
    numberSuffixes: [...new Set(lexical.numberSuffixes.map((x) => x.toUpperCase()))].sort((a, b) => b.length - a.length),
    qQuoting: lexical.qQuoting,
  });
}

/** The id of a keyword in a compiled lexical, or `undefined` where the dialect does not list it; the id is what a word token carries. */
export function keywordId(lx: CompiledLexical, word: string): number | undefined {
  const up = word.toUpperCase();
  const i = lx.kwWords.indexOf(up);
  return i < 0 ? undefined : i + 1;
}

/** The id of an operator in a compiled lexical, or `undefined` where it is not one; the id is what an operator token carries. */
export function operatorId(lx: CompiledLexical, text: string): number | undefined {
  const i = lx.operators.indexOf(text);
  return i < 0 ? undefined : i + 1;
}
