// Spec: 0001-formats FR-003
/**
 * TOML 1.0.0 (https://toml.io/en/v1.0.0), read and written with no outside package (commons 0001-formats FR-003). The reader
 * takes the whole language (bare, quoted and dotted keys; tables, arrays of tables and inline tables; the four kinds of string; decimal,
 * hexadecimal, octal and binary integers; floats with `inf` and `nan`; the four kinds of date and time) and holds to its rules: no key or
 * table defined twice, an inline table or a static array never extended, a table made by dotted keys never reopened by a header. It
 * gives a typed `TomlTable`, or the line and column where the text stops being TOML. An integer outside JavaScript's safe range is refused
 * rather than rounded. A date or time stays as its text, with its kind. The writer gives TOML the reader reads back as the same table.
 * Replaces `@std/toml` in erga.
 *
 * @example
 * ```ts
 * import { parseToml } from "./toml.ts";
 * parseToml('[server]\nhost = "127.0.0.1"\nports = [8000, 8001]\n');
 * // { kind: "ok", value: { server: { host: "127.0.0.1", ports: [8000, 8001] } } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A date, a time, or both, as TOML wrote it (a space between date and time made `T`), with which of the four it is. */
export type TomlDateTime = {
  readonly kind: "offset-date-time" | "local-date-time" | "local-date" | "local-time";
  readonly text: string;
};

/** A TOML value. */
export type TomlValue = string | number | boolean | TomlDateTime | readonly TomlValue[] | TomlTable;

/** A TOML table: its keys in the order they were defined. */
export type TomlTable = { readonly [key: string]: TomlValue };

/** Where a text stops being TOML, and why. Lines and columns count from 1. */
export type TomlError = { readonly kind: "toml"; readonly line: number; readonly column: number; readonly message: string };

/** A TOML error as one line: `3:14: expected a value`. */
export function formatTomlError(e: TomlError): string {
  return `${e.line}:${e.column}: ${e.message}`;
}

/** Whether a TOML value is a date or time. */
export function isTomlDateTime(v: TomlValue): v is TomlDateTime {
  return (
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === 2 &&
    "kind" in v &&
    "text" in v &&
    typeof v["text"] === "string" &&
    typeof v["kind"] === "string" &&
    /^(offset-date-time|local-date-time|local-date|local-time)$/.test(v["kind"])
  );
}

/** Whether a TOML value is a table (not an array, not a date or time). */
export function isTomlTable(v: TomlValue): v is TomlTable {
  return typeof v === "object" && !Array.isArray(v) && !isTomlDateTime(v);
}

class Stop extends Error {
  readonly at: number;
  constructor(at: number, message: string) {
    super(message);
    this.at = at;
  }
}

type Mutable = Record<string, TomlValue>;

const BARE = /^[A-Za-z0-9_-]+/;
const ESCAPES: Readonly<Record<string, string>> = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
const CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8, 10)}-${String.fromCharCode(31, 127)}]`);
const DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME = /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?/;
const OFFSET = /^(?:[Zz]|[+-](\d{2}):(\d{2}))/;

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
  return d <= days;
}

/** TOML text read as a table, or where and why it is not TOML. */
export function parseToml(text: string): Result<TomlTable, TomlError> {
  let i = 0;
  const root: Mutable = {};
  /** Tables a header defined; tables a header made on its way; tables dotted keys made; inline tables and static arrays; arrays of tables. */
  const defined = new Set<object>();
  const byHeader = new Set<object>();
  const byDots = new Set<object>();
  const frozen = new Set<object>();
  const tableArrays = new Set<object>();
  const fail = (message: string, at = i): never => {
    throw new Stop(at, message);
  };
  const peek = (n = 0): string => text[i + n] ?? "";
  const blank = (): void => {
    while (peek() === " " || peek() === "\t") i++;
  };
  const comment = (): void => {
    if (peek() !== "#") return;
    while (i < text.length && peek() !== "\n" && !(peek() === "\r" && peek(1) === "\n")) {
      if (CONTROL.test(peek()) && peek() !== "\t") fail("no control character in a comment");
      i++;
    }
  };
  const newline = (): boolean => {
    if (peek() === "\n") {
      i++;
      return true;
    }
    if (peek() === "\r" && peek(1) === "\n") {
      i += 2;
      return true;
    }
    return false;
  };
  const endOfLine = (): void => {
    blank();
    comment();
    if (i < text.length && !newline()) fail("the end of the line");
  };
  /** Space, comments and line breaks, as an array allows between its values. */
  const gap = (): void => {
    for (;;) {
      blank();
      comment();
      if (!newline()) return;
    }
  };
  const hexChar = (n: number): string => {
    const h = text.slice(i, i + n);
    if (h.length !== n || !/^[0-9a-fA-F]+$/.test(h)) fail(`${n} hexadecimal digits`);
    const cp = Number.parseInt(h, 16);
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) fail("a Unicode scalar value", i - 2);
    i += n;
    return String.fromCodePoint(cp);
  };
  const escape = (): string => {
    const c = peek();
    i++;
    const simple = ESCAPES[c];
    if (simple !== undefined) return simple;
    if (c === "u") return hexChar(4);
    if (c === "U") return hexChar(8);
    return fail(`a known escape, not \\${c}`, i - 2);
  };
  const basic = (): string => {
    i++;
    let out = "";
    for (;;) {
      const c = peek();
      if (c === "" || c === "\n" || c === "\r") fail("the closing quote of a string");
      i++;
      if (c === '"') return out;
      if (c === "\\") out += escape();
      else if (CONTROL.test(c)) fail("no control character in a string", i - 1);
      else out += c;
    }
  };
  const literal = (): string => {
    i++;
    const start = i;
    for (;;) {
      const c = peek();
      if (c === "" || c === "\n" || c === "\r") fail("the closing quote of a string");
      if (c === "'") break;
      if (CONTROL.test(c)) fail("no control character in a string");
      i++;
    }
    const s = text.slice(start, i);
    i++;
    return s;
  };
  const multiline = (quote: '"' | "'"): string => {
    i += 3;
    newline();
    let out = "";
    for (;;) {
      if (i >= text.length) fail("the closing quotes of a multi-line string");
      if (text.startsWith(quote.repeat(3), i)) {
        let n = 3;
        while (peek(n) === quote && n < 5) n++;
        out += quote.repeat(n - 3);
        i += n;
        return out;
      }
      const c = peek();
      if (newline()) {
        out += "\n";
        continue;
      }
      if (quote === '"' && c === "\\") {
        let j = i + 1;
        while (text[j] === " " || text[j] === "\t") j++;
        if (text[j] === "\n" || (text[j] === "\r" && text[j + 1] === "\n")) {
          i = j;
          while (newline() || peek() === " " || peek() === "\t") if (peek() === " " || peek() === "\t") i++;
          continue;
        }
        i++;
        out += escape();
        continue;
      }
      if (CONTROL.test(c) && c !== "\t") fail("no control character in a string");
      out += c;
      i++;
    }
  };
  const key = (): string => {
    const c = peek();
    if (c === '"') return text.startsWith('"""', i) ? fail("a key on one line") : basic();
    if (c === "'") return text.startsWith("'''", i) ? fail("a key on one line") : literal();
    const m = BARE.exec(text.slice(i));
    if (m === null) return fail("a key");
    i += m[0].length;
    return m[0];
  };
  const dottedKey = (): string[] => {
    const parts = [key()];
    for (;;) {
      blank();
      if (peek() !== ".") return parts;
      i++;
      blank();
      parts.push(key());
    }
  };
  const dateTime = (): TomlDateTime | undefined => {
    const start = i;
    const rest = text.slice(i);
    const d = DATE.exec(rest);
    if (d !== null) {
      if (!validDate(Number(d[1]), Number(d[2]), Number(d[3]))) fail("a real date", start);
      i += d[0].length;
      const sep = peek();
      const t = sep === "T" || sep === "t" || sep === " " ? TIME.exec(text.slice(i + 1)) : null;
      if (t === null) return { kind: "local-date", text: d[0] };
      i += 1;
      time(t, start);
      const o = OFFSET.exec(text.slice(i));
      if (o !== null) {
        if (o[1] !== undefined && (Number(o[1]) > 23 || Number(o[2]) > 59)) fail("a real offset");
        i += o[0].length;
        return { kind: "offset-date-time", text: `${d[0]}T${text.slice(start + 11, i)}` };
      }
      return { kind: "local-date-time", text: `${d[0]}T${text.slice(start + 11, i)}` };
    }
    const t = TIME.exec(rest);
    if (t === null) return undefined;
    time(t, start);
    return { kind: "local-time", text: t[0] };
  };
  const time = (t: RegExpExecArray, start: number): void => {
    if (Number(t[1]) > 23 || Number(t[2]) > 59 || Number(t[3]) > 60) fail("a real time", start);
    i += t[0].length;
  };
  const number = (): number => {
    const start = i;
    const rest = text.slice(i);
    const special = /^([+-]?)(inf|nan)/.exec(rest);
    if (special !== null) {
      i += special[0].length;
      return special[2] === "nan" ? Number.NaN : special[1] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    }
    const radix = /^0(?:x([0-9A-Fa-f](?:_?[0-9A-Fa-f])*)|o([0-7](?:_?[0-7])*)|b([01](?:_?[01])*))/.exec(rest);
    if (radix !== null) {
      i += radix[0].length;
      const [digits, base] = radix[1] !== undefined ? [radix[1], 16] : radix[2] !== undefined ? [radix[2], 8] : [radix[3] ?? "", 2];
      const n = Number.parseInt(digits.replaceAll("_", ""), base);
      if (!Number.isSafeInteger(n)) fail("an integer JavaScript holds exactly (at most 2^53 - 1)", start);
      return n;
    }
    const dec = /^[+-]?(?:0|[1-9](?:_?\d)*)(\.\d(?:_?\d)*)?([eE][+-]?\d(?:_?\d)*)?/.exec(rest);
    if (dec === null) return fail("a value");
    i += dec[0].length;
    const n = Number(dec[0].replaceAll("_", ""));
    if (dec[1] === undefined && dec[2] === undefined && !Number.isSafeInteger(n))
      fail("an integer JavaScript holds exactly (at most 2^53 - 1)", start);
    return n;
  };
  const value = (depth: number): TomlValue => {
    if (depth > 256) fail("less nesting (more than 256 levels)");
    const c = peek();
    let v: TomlValue;
    if (text.startsWith('"""', i)) v = multiline('"');
    else if (text.startsWith("'''", i)) v = multiline("'");
    else if (c === '"') v = basic();
    else if (c === "'") v = literal();
    else if (text.startsWith("true", i)) {
      i += 4;
      v = true;
    } else if (text.startsWith("false", i)) {
      i += 5;
      v = false;
    } else if (c === "[") v = array(depth);
    else if (c === "{") v = inline(depth);
    else v = dateTime() ?? number();
    const after = peek();
    if (!(after === "" || /[ \t\r\n#,\]}]/.test(after))) fail("the end of the value");
    return v;
  };
  const array = (depth: number): TomlValue[] => {
    i++;
    const out: TomlValue[] = [];
    for (;;) {
      gap();
      if (peek() === "]") {
        i++;
        frozen.add(out);
        return out;
      }
      out.push(value(depth + 1));
      gap();
      if (peek() === ",") i++;
      else if (peek() !== "]") fail("a comma or ]");
    }
  };
  const inline = (depth: number): Mutable => {
    i++;
    const table: Mutable = {};
    blank();
    if (peek() === "}") {
      i++;
      frozen.add(table);
      return table;
    }
    for (;;) {
      blank();
      const keyAt = i;
      const path = dottedKey();
      blank();
      if (peek() !== "=") fail("=");
      i++;
      blank();
      assign(table, path, value(depth + 1), keyAt, true);
      blank();
      if (peek() === ",") {
        i++;
        blank();
        if (peek() === "}") fail("a key after the comma (no trailing comma in an inline table)");
        continue;
      }
      if (peek() === "}") {
        i++;
        frozen.add(table);
        return table;
      }
      fail("a comma or }");
    }
  };
  const isTable = (v: TomlValue | undefined): v is Mutable =>
    v !== undefined && typeof v === "object" && !Array.isArray(v) && !isTomlDateTime(v);
  const define = (t: Mutable, k: string, v: TomlValue): void => {
    Object.defineProperty(t, k, { value: v, enumerable: true, writable: true, configurable: true });
  };
  const assign = (table: Mutable, path: readonly string[], v: TomlValue, at: number, inInline: boolean): void => {
    let t = table;
    for (const k of path.slice(0, -1)) {
      const next = Object.hasOwn(t, k) ? t[k] : undefined;
      if (next === undefined) {
        const made: Mutable = {};
        define(t, k, made);
        byDots.add(made);
        if (inInline) frozen.add(made);
        t = made;
      } else if (isTable(next) && byDots.has(next) && !frozen.has(next)) t = next;
      else if (isTable(next) && byDots.has(next) && inInline) t = next;
      else fail(`a key not already defined: ${path.join(".")}`, at);
    }
    const last = path.at(-1) ?? "";
    if (Object.hasOwn(t, last)) fail(`a key not already defined: ${path.join(".")}`, at);
    define(t, last, v);
  };
  const header = (path: readonly string[], array: boolean, at: number): Mutable => {
    let t = root;
    for (const k of path.slice(0, -1)) {
      const next = Object.hasOwn(t, k) ? t[k] : undefined;
      if (next === undefined) {
        const made: Mutable = {};
        define(t, k, made);
        byHeader.add(made);
        t = made;
      } else if (Array.isArray(next) && tableArrays.has(next)) {
        const list: readonly TomlValue[] = next;
        const lastTable = list.at(-1);
        if (!isTable(lastTable)) return fail("a table", at);
        t = lastTable;
      } else if (isTable(next) && !frozen.has(next)) t = next;
      else return fail(`a header that does not extend a value: ${path.join(".")}`, at);
    }
    const last = path.at(-1) ?? "";
    const existing = Object.hasOwn(t, last) ? t[last] : undefined;
    if (array) {
      const made: Mutable = {};
      byHeader.add(made);
      defined.add(made);
      if (existing === undefined) {
        const list: TomlValue[] = [made];
        tableArrays.add(list);
        define(t, last, list);
      } else if (Array.isArray(existing) && tableArrays.has(existing)) (existing as TomlValue[]).push(made);
      else fail(`[[${path.join(".")}]] where a value or table already is`, at);
      return made;
    }
    if (existing === undefined) {
      const made: Mutable = {};
      byHeader.add(made);
      defined.add(made);
      define(t, last, made);
      return made;
    }
    if (isTable(existing) && byHeader.has(existing) && !defined.has(existing)) {
      defined.add(existing);
      return existing;
    }
    return fail(`[${path.join(".")}] defined only once`, at);
  };
  try {
    if (text.startsWith("\ufeff")) i = 1;
    let current = root;
    for (;;) {
      gap();
      if (i >= text.length) return ok(root);
      const at = i;
      if (text.startsWith("[[", i)) {
        i += 2;
        blank();
        const path = dottedKey();
        blank();
        if (!text.startsWith("]]", i)) fail("]]");
        i += 2;
        current = header(path, true, at);
      } else if (peek() === "[") {
        i++;
        blank();
        const path = dottedKey();
        blank();
        if (peek() !== "]") fail("]");
        i++;
        current = header(path, false, at);
      } else {
        const path = dottedKey();
        blank();
        if (peek() !== "=") fail("=");
        i++;
        blank();
        assign(current, path, value(0), at, false);
      }
      endOfLine();
    }
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const before = text.slice(0, e.at).split(/\r?\n/);
    return err({ kind: "toml", line: before.length, column: (before.at(-1)?.length ?? 0) + 1, message: `expected ${e.message}` });
  }
}

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

/** A key as TOML writes it: bare where it can be, else a basic string. */
export function tomlKey(k: string): string {
  return BARE_KEY.test(k) ? k : tomlString(k);
}

/** A string as a TOML basic string: `"`, `\` and every control character escaped. */
export function tomlString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

function scalar(v: TomlValue): string {
  if (typeof v === "string") return tomlString(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "nan";
    if (!Number.isFinite(v)) return v > 0 ? "inf" : "-inf";
    if (Object.is(v, -0)) return "-0.0";
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return v.toExponential();
    return String(v);
  }
  if (Array.isArray(v)) return `[${v.map(scalar).join(", ")}]`;
  if (isTomlDateTime(v)) return v.text;
  const entries = Object.entries(v);
  return entries.length === 0 ? "{}" : `{ ${entries.map(([k, x]) => `${tomlKey(k)} = ${scalar(x)}`).join(", ")} }`;
}

const isTableArray = (v: TomlValue): v is readonly TomlTable[] =>
  Array.isArray(v) && v.length > 0 && v.every((x: TomlValue) => isTomlTable(x));

function section(table: TomlTable, path: readonly string[], out: string[]): void {
  const entries = Object.entries(table);
  for (const [k, v] of entries) if (!isTomlTable(v) && !isTableArray(v)) out.push(`${tomlKey(k)} = ${scalar(v)}`);
  for (const [k, v] of entries) {
    const name = [...path, k].map(tomlKey).join(".");
    if (isTomlTable(v)) {
      out.push("", `[${name}]`);
      section(v, [...path, k], out);
    } else if (isTableArray(v)) {
      for (const t of v) {
        out.push("", `[[${name}]]`);
        section(t, [...path, k], out);
      }
    }
  }
}

/** A table as TOML text: plain values first, then each table under its header and each array of tables under `[[...]]`, ending in a line break. */
export function toToml(table: TomlTable): string {
  const out: string[] = [];
  section(table, [], out);
  while (out[0] === "") out.shift();
  return out.length === 0 ? "" : `${out.join("\n")}\n`;
}
