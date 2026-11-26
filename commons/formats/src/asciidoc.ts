// Spec: 0003-formats-asciidoc FR-001
/**
 * The rules that keep text from being read as AsciiDoc markup (commons 0003-formats-asciidoc FR-001 to FR-004): a run of text made safe for a paragraph, a list item or a cell (`textAdoc`), a line that begins safely (`lead`), code in a line (`codeAdoc`) and the fence of a source block (`fence`).
 * They are pure functions over text, so that two writers of AsciiDoc (the documentation library's and the dossier's) share one copy of the rules. What they write uses no include, no macro that needs an extension and no attribute that is not an attribute reference of the base language.
 *
 * @example
 * ```ts
 * import { textAdoc } from "./asciidoc.ts";
 * textAdoc("a * b"); // "pass:c[a * b]"
 * ```
 *
 * @module
 */

/** Text that AsciiDoc would read as markup, or replace, is passed through with only its special characters made safe; any other text is as it is. */
const MARKUP = /[*_`#^~{}|+\\<>&]|--|\.\.\.|\(C\)|\(R\)|\(TM\)|\bhttps?:\/\//;

/** A square bracket as the attribute that holds its place: a bracket in text can close a macro, or (doubled) make an anchor, wherever it is written. */
const BRACKET: Readonly<Record<string, string>> = { "[": "{startsb}", "]": "{endsb}" };

/** A run of text with no bracket in it, safe for a paragraph, a list item or a cell. */
const safe = (t: string): string => (MARKUP.test(t) ? `pass:c[${t}]` : t);

/** A run of text for a paragraph, a list item or a cell. */
export function textAdoc(t: string): string {
  return /[[\]]/.test(t) ? t.split(/([[\]])/).map((x) => BRACKET[x] ?? (x === "" ? "" : safe(x))).join("") : safe(t);
}

/** What a line must not begin with, or AsciiDoc reads it as a list, a heading, a block title, a comment, an attribute or an admonition. */
const LEADS = /^\s*([-*>]\s|=+\s|\.[^\s.]|\.+\s|:[\w-]+:|\[|\d+\.\s|\/\/|(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s|<<<|'''|\+$)/;

/** A line of text that begins safely: `{empty}` holds the place of what AsciiDoc would read as markup. */
export const lead = (line: string): string => (LEADS.test(line) ? `{empty}${line}` : line);

/** Code in a line: its text is passed through as it is, brackets apart. */
export function codeAdoc(t: string): string {
  const one = (x: string): string => (/[+`\\]/.test(x) ? `pass:c[${x}]` : `+${x}+`);
  return `\`${/[[\]]/.test(t) ? t.split(/([[\]])/).map((x) => BRACKET[x] ?? (x === "" ? "" : one(x))).join("") : one(t)}\``;
}

/** The fence of a source block: longer than any line of dashes the text holds. */
export function fence(t: string): string {
  const longest = Math.max(3, ...[...t.matchAll(/^-{4,}\s*$/gm)].map((m) => m[0].trim().length));
  return "-".repeat(longest + 1);
}

