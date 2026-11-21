/**
 * The tokens of SQL text (commons lang-sql 0001-sql-lang FR-005): a closed set of kinds and the parallel columns the lexer fills, so that a token costs no object, no string and no allocation of its
 * own. A column is read with its accessor, which answers the end of the text past the last token, so that a parser may look ahead without a bounds check.
 *
 * @remarks
 * The columns are arrays of small integers, which the engine keeps packed; they carry the types of the kinds, so that no cast is needed to read one.
 *
 * @example
 * ```ts
 * const t = lex("select a", ansi.compiled).tokens;
 * kindAt(t, 0) === Tok.Word; // true
 * textAt(t, "select a", 1);  // "a"
 * ```
 *
 * Spec: 0001-sql-lang FR-005
 *
 * @module
 */

/** The kinds of token. */
export const Tok = {
  Eof: 0,
  Word: 1,
  QuotedIdent: 2,
  Number: 3,
  String: 4,
  Param: 5,
  Op: 6,
  LParen: 7,
  RParen: 8,
  LBracket: 9,
  RBracket: 10,
  LBrace: 11,
  RBrace: 12,
  Comma: 13,
  Semicolon: 14,
  Dot: 15,
  Error: 16,
} as const;

/** A kind of token. */
export type TokKind = (typeof Tok)[keyof typeof Tok];

/**
 * The tokens of a text, as columns. `id` is, by kind: for a word the keyword's id (0 where it is none); for an operator the operator's id; for a parameter its style
 * (`ParamStyleId`); for a string the index of its syntax plus one (0 for a dollar quote); for a quoted identifier the index of its syntax; otherwise 0.
 */
export interface Tokens {
  readonly kind: readonly TokKind[];
  readonly start: readonly number[];
  readonly end: readonly number[];
  readonly id: readonly number[];
}

/** How many tokens there are, the end of the text included. */
export function tokenCount(t: Tokens): number {
  return t.kind.length;
}

/** The kind of the token at `i`; the end of the text past the last. */
export function kindAt(t: Tokens, i: number): TokKind {
  return t.kind[i] ?? Tok.Eof;
}

/** Where the token at `i` begins; the length of the text past the last. */
export function startAt(t: Tokens, i: number): number {
  return t.start[i] ?? t.start[t.start.length - 1] ?? 0;
}

/** Where the token at `i` ends; the length of the text past the last. */
export function endAt(t: Tokens, i: number): number {
  return t.end[i] ?? t.end[t.end.length - 1] ?? 0;
}

/** The id of the token at `i` (see {@link Tokens}); 0 past the last. */
export function idAt(t: Tokens, i: number): number {
  return t.id[i] ?? 0;
}

/** The text of the token at `i`, cut from the source only now. */
export function textAt(t: Tokens, source: string, i: number): string {
  return source.slice(startAt(t, i), endAt(t, i));
}
