/**
 * Data as TypeScript object literals, for files a program writes for people to read and edit (keys bare where they are identifiers, strings
 * in double quotes, two-space indentation and trailing commas), and the reader of exactly that subset, which never runs the file, so a past
 * version from `git show` can be read safely (commons 0005-typescript-runtime FR-011). Taken from Stolos's `src/archon/core/ts-literal.ts`;
 * the reader returns a `Result` instead of throwing.
 *
 * @example
 * ```ts
 * import { parseTsLiteral, tsLiteral } from "./ts-literal.ts";
 * const text = tsLiteral({ timezone: "America/New_York", "otel-ui": true });
 * parseTsLiteral(text); // { kind: "ok", value: { value: { timezone: "America/New_York", "otel-ui": true }, end: text.length } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "./result.ts";

/** A key that needs no quotes: an identifier (letters, digits, `_`, `$`; not starting with a digit). */
export const BARE_KEY: RegExp = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** A key as TypeScript writes it: bare where it can be, else a double-quoted string. */
export function tsKey(key: string): string {
  return BARE_KEY.test(key) ? key : JSON.stringify(key);
}

/** A value that {@link tsLiteral} writes and {@link parseTsLiteral} reads back: what JSON holds. */
export type Literal = null | boolean | number | string | readonly Literal[] | { readonly [key: string]: Literal | undefined };

/**
 * A value as a TypeScript literal, indented for `depth` (two spaces each). Objects and arrays span lines (empty ones stay `{}` and `[]`);
 * properties that are `undefined` are left out, as `JSON.stringify` leaves them out. A number that is not finite is written `null`, as
 * JSON writes it.
 */
export function tsLiteral(value: Literal, depth = 0): string {
  const pad = "  ".repeat(depth + 1);
  const end = "  ".repeat(depth);
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const items: readonly Literal[] = value;
    if (items.length === 0) return "[]";
    return `[\n${items.map((v) => `${pad}${tsLiteral(v, depth + 1)},\n`).join("")}${end}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter((e): e is [string, Literal] => e[1] !== undefined);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([k, v]) => `${pad}${tsKey(k)}: ${tsLiteral(v, depth + 1)},\n`).join("")}${end}}`;
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  return String(value);
}

/** Where a text stopped being a literal, and what was expected there. */
export type LiteralError = { readonly kind: "literal"; readonly at: number; readonly expected: string };

class Stop extends Error {
  readonly at: number;
  readonly expected: string;
  constructor(at: number, expected: string) {
    super(`not a literal at ${at}: expected ${expected}`);
    this.at = at;
    this.expected = expected;
  }
}

/**
 * The value of a literal {@link tsLiteral} wrote, starting at `start`, and where it ended: objects with bare or quoted keys, arrays,
 * double-quoted strings, numbers, `true`, `false` and `null`, with trailing commas and `//` comments. Anything else is an error.
 */
export function parseTsLiteral(text: string, start = 0): Result<{ readonly value: Literal; readonly end: number }, LiteralError> {
  let i = start;
  const ws = (): void => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i] ?? "")) i++;
      if (!text.startsWith("//", i)) return;
      while (i < text.length && text[i] !== "\n") i++;
    }
  };
  const fail = (expected: string): never => {
    throw new Stop(i, expected);
  };
  const str = (): string => {
    const m = /^"(?:[^"\\\n]|\\.)*"/.exec(text.slice(i));
    if (m === null) return fail("a complete string");
    i += m[0].length;
    const s: unknown = JSON.parse(m[0]);
    return typeof s === "string" ? s : fail("a string");
  };
  const value = (): Literal => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const o: { [key: string]: Literal } = {};
      for (;;) {
        ws();
        if (text[i] === "}") {
          i++;
          return o;
        }
        let k: string;
        if (text[i] === '"') k = str();
        else {
          const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(i));
          if (m === null) return fail("a key");
          k = m[0];
          i += k.length;
        }
        ws();
        if (text[i] !== ":") fail("a colon");
        i++;
        Object.defineProperty(o, k, { value: value(), enumerable: true, writable: true, configurable: true });
        ws();
        if (text[i] === ",") i++;
        else if (text[i] !== "}") fail("a comma or }");
      }
    }
    if (c === "[") {
      i++;
      const a: Literal[] = [];
      for (;;) {
        ws();
        if (text[i] === "]") {
          i++;
          return a;
        }
        a.push(value());
        ws();
        if (text[i] === ",") i++;
        else if (text[i] !== "]") fail("a comma or ]");
      }
    }
    if (c === '"') return str();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (m === null) return fail("a value");
    i += m[0].length;
    const v: unknown = JSON.parse(m[0]);
    return typeof v === "number" || typeof v === "boolean" || v === null ? v : fail("a value");
  };
  try {
    const v = value();
    return ok({ value: v, end: i });
  } catch (e) {
    if (e instanceof Stop) return err({ kind: "literal", at: e.at, expected: e.expected });
    throw e;
  }
}

/** The value of `export const <name>[: Type] = <literal>;` in a file {@link tsLiteral} wrote, or why it cannot be read. */
export function exportedLiteral(source: string, name: string): Result<Literal, LiteralError> {
  const m = new RegExp(`export const ${name}(?:\\s*:\\s*[A-Za-z_$][\\w$.<>, \\[\\]]*)?\\s*=\\s*`).exec(source);
  if (m === null) return err({ kind: "literal", at: 0, expected: `export const ${name}` });
  const r = parseTsLiteral(source, m.index + m[0].length);
  return r.kind === "ok" ? ok(r.value.value) : r;
}
