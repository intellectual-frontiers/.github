// Spec: 0005-naming FR-001, FR-002
/**
 * Names (commons data 0005-naming): a name in governance is a TypeScript identifier, lower camel case, and says nothing of a database. It crosses the layers as a list of words, which
 * `words` makes and nothing else does: the logical schema chooses the words of each element of a relational schema, and the physical schema writes them in the case style of its target.
 *
 * @example
 * ```ts
 * words("givenName");   // ["given", "name"]
 * words("line1");       // ["line", "1"]
 * words("HTTPServer");  // ["http", "server"]
 * ```
 *
 * @module
 */

/** A name of governance: lower camel case, a letter first and then letters and digits. */
export const NAME = /^[a-z][a-zA-Z0-9]*$/;

// a run of capitals that ends before a capital that begins a word (HTTP in HTTPServer), a word with its capital, or a run of digits
const WORD = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g;

/**
 * The lower-case words of a name: split where lower case turns upper, around digits, and at the end of a run of capitals.
 *
 * @param name - a name of governance
 * @returns its words, lower case, in order; one word at least for a valid name
 */
export function words(name: string): readonly string[] {
  return (name.match(WORD) ?? []).map((w) => w.toLowerCase());
}
