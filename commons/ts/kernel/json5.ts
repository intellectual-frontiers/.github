/**
 * JSON5 (https://spec.json5.org/, 1.0.0), read and written with no outside package (commons 0005-typescript-runtime FR-031): the reader
 * takes the whole grammar (comments, trailing commas, unquoted ECMAScript keys, single-quoted and continued strings, hexadecimal,
 * `Infinity`, `NaN`, a leading `+`, a leading or trailing decimal point) and gives a typed `Json` value or the line and column where the
 * text stops being JSON5; the writer gives the form a person edits: a `//` comment at the head, keys bare where they can be, two spaces of
 * indent, a comma after every member, and a short list of plain values on one line. Taken from erga's `lib/ts/json5`, whose reader was
 * the `json5` package.
 *
 * @example
 * ```ts
 * import { parseJson5, toJson5 } from "./json5.ts";
 * parseJson5("{ unquoted: 'and you can quote me on that', trailing: [1, 2,], }");
 * // { kind: "ok", value: { unquoted: "and you can quote me on that", trailing: [1, 2] } }
 * toJson5({ name: "a", tags: ["x", "y"] }, "What this file is");
 * // "// What this file is\n{\n  name: \"a\",\n  tags: [\"x\", \"y\"],\n}\n"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "./result.ts";

/** A JSON value: what a JSON5 file holds once read. An object keeps its members in the order they were written; a number may be `NaN` or infinite. */
export type Json = null | boolean | number | string | readonly Json[] | JsonObject;

/** A JSON object. */
export type JsonObject = { readonly [key: string]: Json };

/** Where a text stops being JSON5, and why. Lines and columns count from 1. */
export type Json5Error = { readonly kind: "json5"; readonly line: number; readonly column: number; readonly message: string };

/** A JSON5 error as one line: `3:14: expected a value`. */
export function formatJson5Error(e: Json5Error): string {
  return `${e.line}:${e.column}: ${e.message}`;
}

/** Whether a value is a JSON object. */
export function isJsonObject(v: Json): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

class Stop extends Error {
  readonly at: number;
  constructor(at: number, message: string) {
    super(message);
    this.at = at;
  }
}

const LINE = /[\n\r\u2028\u2029]/;
const SPACE = /[\t\v\f \u00a0\ufeff\p{Zs}]/u;
const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$\u200c\u200d]/u;
const ESCAPES: Readonly<Record<string, string>> = { "'": "'", '"': '"', "\\": "\\", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };

/** JSON5 (or JSON) text read as a JSON value, or where and why it is not JSON5. */
export function parseJson5(text: string): Result<Json, Json5Error> {
  let i = 0;
  const fail = (message: string, at = i): never => {
    throw new Stop(at, message);
  };
  const peek = (): string => text[i] ?? "";
  const skip = (): void => {
    for (;;) {
      const c = peek();
      if (c !== "" && (SPACE.test(c) || LINE.test(c))) i++;
      else if (text.startsWith("//", i)) {
        while (i < text.length && !LINE.test(peek())) i++;
      } else if (text.startsWith("/*", i)) {
        const end = text.indexOf("*/", i + 2);
        if (end < 0) fail("a comment that is not closed");
        i = end + 2;
      } else return;
    }
  };
  const hex = (n: number): number => {
    const h = text.slice(i, i + n);
    if (h.length !== n || !/^[0-9a-fA-F]+$/.test(h)) fail(`${n} hexadecimal digits`);
    i += n;
    return Number.parseInt(h, 16);
  };
  const escape = (): string => {
    const c = peek();
    i++;
    if (c === "") return fail("the rest of an escape");
    const simple = ESCAPES[c];
    if (simple !== undefined) return simple;
    if (c === "0") {
      if (/[0-9]/.test(peek())) fail("no digit after \\0");
      return "\0";
    }
    if (/[1-9]/.test(c)) fail("no escaped digit", i - 1);
    if (c === "x") return String.fromCharCode(hex(2));
    if (c === "u") return String.fromCharCode(hex(4));
    if (c === "\r") {
      if (peek() === "\n") i++;
      return "";
    }
    if (LINE.test(c)) return "";
    return c;
  };
  const string = (): string => {
    const quote = peek();
    i++;
    let out = "";
    for (;;) {
      const c = peek();
      if (c === "") fail("a closing quote");
      i++;
      if (c === quote) return out;
      if (c === "\\") out += escape();
      else if (c === "\n" || c === "\r") fail("no line break inside a string", i - 1);
      else out += c;
    }
  };
  const identifier = (): string => {
    let out = "";
    for (let first = true; ; first = false) {
      let c = peek();
      if (c === "\\") {
        if (text[i + 1] !== "u") fail("\\u in a key");
        i += 2;
        c = String.fromCharCode(hex(4));
      } else {
        const cp = text.codePointAt(i);
        c = cp === undefined ? "" : String.fromCodePoint(cp);
        if (c === "" || !(first ? ID_START : ID_PART).test(c)) {
          if (first) fail("a key");
          return out;
        }
        i += c.length;
      }
      if (!(first ? ID_START : ID_PART).test(c)) fail("a key");
      out += c;
    }
  };
  const number = (): number => {
    const m =
      /^([+-]?)(Infinity|NaN|0[xX][0-9a-fA-F]+|(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?|\.[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(
        text.slice(i),
      );
    if (m === null) return fail("a value");
    const [whole = "", sign = "", body = ""] = m;
    i += whole.length;
    if (ID_PART.test(peek())) fail("a number that ends where it should");
    const magnitude =
      body === "Infinity"
        ? Number.POSITIVE_INFINITY
        : body === "NaN"
          ? Number.NaN
          : /^0[xX]/.test(body)
            ? Number.parseInt(body.slice(2), 16)
            : Number(body);
    return sign === "-" ? -magnitude : magnitude;
  };
  const word = (w: string): boolean => {
    if (!text.startsWith(w, i) || ID_PART.test(text[i + w.length] ?? "")) return false;
    i += w.length;
    return true;
  };
  const value = (depth: number): Json => {
    if (depth > 512) fail("less nesting (more than 512 levels)");
    skip();
    const c = peek();
    if (c === "{") {
      i++;
      const o: Record<string, Json> = {};
      for (;;) {
        skip();
        if (peek() === "}") {
          i++;
          return o;
        }
        const key = peek() === '"' || peek() === "'" ? string() : identifier();
        skip();
        if (peek() !== ":") fail("a colon");
        i++;
        Object.defineProperty(o, key, { value: value(depth + 1), enumerable: true, writable: true, configurable: true });
        skip();
        if (peek() === ",") i++;
        else if (peek() !== "}") fail("a comma or }");
      }
    }
    if (c === "[") {
      i++;
      const a: Json[] = [];
      for (;;) {
        skip();
        if (peek() === "]") {
          i++;
          return a;
        }
        a.push(value(depth + 1));
        skip();
        if (peek() === ",") i++;
        else if (peek() !== "]") fail("a comma or ]");
      }
    }
    if (c === '"' || c === "'") return string();
    if (word("null")) return null;
    if (word("true")) return true;
    if (word("false")) return false;
    return number();
  };
  try {
    const v = value(0);
    skip();
    if (i < text.length) fail("the end of the text");
    return ok(v);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const before = text.slice(0, e.at).split(/\r\n|[\n\r\u2028\u2029]/);
    return err({ kind: "json5", line: before.length, column: (before.at(-1)?.length ?? 0) + 1, message: `expected ${e.message}` });
  }
}

/** Whether a key may stand without quotes: an ECMAScript identifier of ASCII letters, digits, `_` and `$`, not starting with a digit. */
export function isBareKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

const plainValue = (v: Json): boolean => !(Array.isArray(v) || isJsonObject(v));

function scalar(v: Json): string {
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "NaN";
    if (!Number.isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
    if (Object.is(v, -0)) return "-0";
  }
  return JSON.stringify(v);
}

function write(v: Json, depth: number, width: number): string {
  const pad = (n: number): string => "  ".repeat(n);
  if (Array.isArray(v)) {
    const items: readonly Json[] = v;
    if (items.length === 0) return "[]";
    const line = items.map(scalar).join(", ");
    if (items.every(plainValue) && new TextEncoder().encode(line).length + depth * 2 <= width) return `[${line}]`;
    return `[\n${items.map((item) => `${pad(depth + 1)}${write(item, depth + 1, width)},\n`).join("")}${pad(depth)}]`;
  }
  if (isJsonObject(v)) {
    const entries = Object.entries(v);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([k, item]) => `${pad(depth + 1)}${isBareKey(k) ? k : JSON.stringify(k)}: ${write(item, depth + 1, width)},\n`).join("")}${pad(depth)}}`;
  }
  return scalar(v);
}

/** The lines of a comment: none for empty text, and no last empty line for a final line break. */
function linesOf(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  if (text.endsWith("\n")) lines.pop();
  return lines;
}

/**
 * A value as JSON5 text: `comment` first, one `//` line for each of its lines (none where it is empty), then the value, ending in a line
 * break. A list of plain values stays on one line while it fits in `width` bytes (100 by default).
 */
export function toJson5(value: Json, comment = "", width = 100): string {
  const head = linesOf(comment)
    .map((l) => (l === "" ? "//\n" : `// ${l}\n`))
    .join("");
  return `${head}${write(value, 0, width)}\n`;
}
