/**
 * Text helpers the emitter stands on: un-indenting template text and writing one name in the case each target uses
 * (commons 0006-sql-aide FR-012, FR-015).
 *
 * @module
 */

/**
 * Removes the indentation every line shares and the blank first and last lines, so that SQL written inside indented TypeScript reads as if
 * written by hand.
 *
 * @param text - text as it stands in a template literal
 * @example
 * unindent("\n    select 1\n      from t\n  "); // "select 1\n  from t"
 */
export function unindent(text: string): string {
  const lines = text
    .replace(/^[ \t]*\n/, "")
    .replace(/\n[ \t]*$/, "")
    .split("\n");
  let shared = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    if (indent < shared) shared = indent;
  }
  if (shared === Infinity) shared = 0;
  return lines.map((line) => (line.trim() === "" ? "" : line.slice(shared).trimEnd())).join("\n");
}

/** The words of a name written in snake case, kebab case or camel case. */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== "")
    .map((w) => w.toLowerCase());
}

/** The plural of an English word, by the common rules: enough for names of tables, and never used to decide anything. */
function pluralOf(word: string): string {
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** One name as each target writes it, so that SQL, TypeScript and Rust generated from a model agree (commons 0006-sql-aide FR-012). */
export interface Token {
  /** The name as given, the SQL token. */
  readonly sql: string;
  /** `snake_case`: a Rust member or module. */
  readonly snake: string;
  /** `camelCase`: a TypeScript or JavaScript variable. */
  readonly camel: string;
  /** `PascalCase`: a TypeScript type or a Rust structure. */
  readonly pascal: string;
  /** The same name with its last word in the plural. */
  readonly plural: Token;
}

/**
 * Makes the token of a name.
 *
 * @param name - a name in snake, kebab or camel case
 * @example
 * token("party_identifier").pascal; // "PartyIdentifier"
 * token("party").plural.snake; // "parties"
 */
export function token(name: string): Token {
  const ws = words(name);
  const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);
  return {
    sql: name,
    snake: ws.join("_"),
    camel: ws.map((w, i) => (i === 0 ? w : cap(w))).join(""),
    pascal: ws.map(cap).join(""),
    get plural(): Token {
      const last = ws[ws.length - 1];
      return token(last === undefined ? name : [...ws.slice(0, -1), pluralOf(last)].join("_"));
    },
  };
}

/**
 * A name no longer than an engine allows: a name that is too long keeps its beginning and ends with eight hexadecimal digits made from
 * the whole of it, so that two long names that begin alike stay different.
 *
 * @param name - the name wanted
 * @param max - the longest name the engine keeps, or `undefined` where it has no limit
 * @example
 * fitName("a".repeat(80), 63).length; // 63
 */
export function fitName(name: string, max: number | undefined): string {
  if (max === undefined || name.length <= max) return name;
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${name.slice(0, max - 9)}_${h.toString(16).padStart(8, "0")}`;
}
