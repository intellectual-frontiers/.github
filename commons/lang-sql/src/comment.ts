/**
 * The comments of SQL text (commons lang-sql 0001-sql-lang FR-009 to FR-012): a comment is kept, never dropped, with its kind, its marker, its span, the text between its markers and its place, so that a
 * parser can attach it to a node and a later feature can read the documentation a person wrote. The lexer fills the columns; {@link commentAt} makes one comment an object, only when asked.
 *
 * @remarks
 * The place of a comment is what the attachment needs and no more: `before` is the number of tokens that precede it, `ownLine` says whether only white space stands between the start of its line and
 * it, and `blankAfter` whether a blank line (or the end of the text) follows it. A comment that is `ownLine` and not `blankAfter` is, to a person, the comment of what follows; one that is not `ownLine`
 * is the comment of what precedes it on its line.
 *
 * @example
 * ```ts
 * const lexed = lex("-- the key\nid int", ansi.compiled);
 * commentAt(lexed.comments, lexed.text, 0)?.text; // " the key"
 * ```
 *
 * Spec: 0001-sql-lang FR-009, FR-010, FR-012
 *
 * @module
 */
import type { Span } from "./span.ts";

/** The kinds of comment: a line comment, a block comment, an optimizer hint (`/*+ ... *\/`) and a conditional comment (`/*! ... *\/`). */
export type CommentStyle = "line" | "block" | "hint" | "conditional";

/** The numbers the columns keep for the styles. */
export const StyleCode = { Line: 0, Block: 1, Hint: 2, Conditional: 3 } as const;

const STYLES: readonly CommentStyle[] = ["line", "block", "hint", "conditional"];

/** The bits of a comment's flags. */
export const CommentFlag = { OwnLine: 1, BlankAfter: 2, Unterminated: 4 } as const;

/** The comments of a text, as columns, in the order of the text. */
export interface Comments {
  readonly style: readonly number[];
  readonly marker: readonly string[];
  readonly start: readonly number[];
  readonly end: readonly number[];
  readonly innerStart: readonly number[];
  readonly innerEnd: readonly number[];
  readonly before: readonly number[];
  readonly flags: readonly number[];
}

/** A comment of a text. */
export interface Comment {
  readonly kind: "comment";
  readonly style: CommentStyle;
  /** What opens it: `--`, `#`, `//`, `/*`. */
  readonly marker: string;
  /** From the first character of its marker to the end of its closing marker (or of the line, or of the text). */
  readonly span: Span;
  /** What is between its markers, as written. */
  readonly text: string;
  /** Its place among the comments of the text, from 0. */
  readonly index: number;
  /** How many tokens precede it: the token before it is `before - 1`, and the token after it is `before`. */
  readonly before: number;
  /** Whether only white space stands between the start of its line and it. */
  readonly ownLine: boolean;
  /** Whether a blank line, or the end of the text, follows it. */
  readonly blankAfter: boolean;
  /** Whether it is closed: a line comment always is, a block comment that is not closed ends at the end of the text. */
  readonly terminated: boolean;
}

/** The comments of the columns, the number of them. */
export function commentCount(c: Comments): number {
  return c.start.length;
}

/**
 * One comment as an object.
 *
 * @param c - the columns
 * @param text - the text they are of
 * @param i - the comment's place among them
 * @returns the comment, or `undefined` where there is none at `i`
 */
export function commentAt(c: Comments, text: string, i: number): Comment | undefined {
  const start = c.start[i];
  const end = c.end[i];
  if (start === undefined || end === undefined) return undefined;
  const flags = c.flags[i] ?? 0;
  return {
    kind: "comment",
    style: STYLES[c.style[i] ?? 1] ?? "block",
    marker: c.marker[i] ?? "",
    span: { start, end },
    text: text.slice(c.innerStart[i] ?? start, c.innerEnd[i] ?? end),
    index: i,
    before: c.before[i] ?? 0,
    ownLine: (flags & CommentFlag.OwnLine) !== 0,
    blankAfter: (flags & CommentFlag.BlankAfter) !== 0,
    terminated: (flags & CommentFlag.Unterminated) === 0,
  };
}

/** Every comment of a text, in order, as objects. */
export function allComments(c: Comments, text: string): readonly Comment[] {
  const out: Comment[] = [];
  for (let i = 0; i < c.start.length; i++) {
    const one = commentAt(c, text, i);
    if (one !== undefined) out.push(one);
  }
  return out;
}
