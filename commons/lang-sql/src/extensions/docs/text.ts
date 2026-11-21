/**
 * The text of documentation comments (commons lang-sql 0004-sql-docs FR-001): a comment with its markers taken off, whatever kind it is. A line comment loses its marker, any run of the marker's last character that
 * follows it (`---`, `///`, `##`) and one space; a block comment loses its delimiters, and on each line its white space, any `*` and one space; consecutive comments are joined by a new line.
 *
 * @example
 * ```ts
 * docText(parse("--- The people.\n--- Of the company.\nCREATE TABLE t (a INT)").comments); // "The people.\nOf the company."
 * ```
 *
 * Spec: 0004-sql-docs FR-001
 *
 * @module
 */
import type { Comment } from "../../mod.ts";

/** The lines of one comment as documentation. */
function lines(c: Comment): string[] {
  if (c.style === "line") {
    const last = c.marker.charAt(c.marker.length - 1);
    let t = c.text;
    while (t.startsWith(last)) t = t.slice(1);
    if (t.startsWith(" ")) t = t.slice(1);
    return [t.trimEnd()];
  }
  const out = c.text.split(/\r\n|\r|\n/).map((line, i) => {
    let t = line.trimStart();
    if (i === 0 && c.style === "hint" && t.startsWith("+")) t = t.slice(1);
    while (t.startsWith("*")) t = t.slice(1);
    if (t.startsWith(" ")) t = t.slice(1);
    return t.trimEnd();
  });
  while (out.length > 0 && out[0] === "") out.shift();
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

/**
 * The documentation text of comments, in order, joined by new lines.
 *
 * @param comments - comments of any kind
 * @returns their text with the markers taken off
 */
export function docText(comments: readonly Comment[]): string {
  return comments.flatMap(lines).join("\n");
}
