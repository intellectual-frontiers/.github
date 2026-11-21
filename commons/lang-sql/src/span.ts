/**
 * Spans and positions of SQL text (commons lang-sql 0001-sql-lang FR-014): a span is a half-open range of offsets, and a position is a line and a column, each from 1, with the offset, found from an
 * offset by a binary search over the starts of the lines, made once. Offsets, columns and lengths are UTF-16 code units, as a JavaScript string and a `unist` position have them.
 *
 * @example
 * ```ts
 * const index = lineIndex("select 1\nfrom t");
 * positionAt(index, 9); // { line: 2, column: 1, offset: 9 }
 * ```
 *
 * Spec: 0001-sql-lang FR-014
 *
 * @module
 */

/** A half-open range of offsets in a text: `start` is in it, `end` is not. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** A place in a text: a line and a column, each counted from 1, and the offset, counted from 0. */
export interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

/** The starts of the lines of one text, made once by {@link lineIndex}. */
export interface LineIndex {
  /** The offset at which each line begins; the first is 0. */
  readonly starts: readonly number[];
  /** The length of the text. */
  readonly length: number;
}

/**
 * Makes the index of the lines of a text: a line ends at `\n`, `\r\n` or a lone `\r`.
 *
 * @param text - the text
 * @returns the offsets at which its lines begin
 */
export function lineIndex(text: string): LineIndex {
  const starts: number[] = [0];
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) starts.push(i + 1);
    else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i++;
      starts.push(i + 1);
    }
  }
  return { starts, length: n };
}

/**
 * The position of an offset; an offset outside the text is placed at its nearest end.
 *
 * @param index - the index of the text's lines
 * @param offset - an offset in the text
 * @returns its line, column and offset
 */
export function positionAt(index: LineIndex, offset: number): Position {
  const at = offset < 0 ? 0 : offset > index.length ? index.length : Math.trunc(offset);
  const starts = index.starts;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if ((starts[mid] ?? 0) <= at) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: at - (starts[lo] ?? 0) + 1, offset: at };
}
