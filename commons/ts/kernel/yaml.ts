/**
 * YAML 1.2 for data (commons 0005-typescript-runtime FR-038), read and written with no outside package. The reader takes what data files,
 * front matter and configuration use: block mappings and sequences (a sequence may sit at its key's indentation, and a mapping may begin
 * on a sequence's dash), flow collections over several lines, plain scalars folded over several lines, single- and double-quoted scalars
 * with every escape of YAML 1.2, literal and folded block scalars with their chomping and indentation indicators, comments and one
 * document between `---` and `...`. Plain scalars resolve by the core schema (null, booleans, integers in decimal, octal and hexadecimal,
 * floats with `.inf` and `.nan`) or, with the failsafe schema, stay text. It refuses, with the line and column and the reason, what makes
 * data ambiguous or unsafe to read: anchors and aliases (and so no "billion laughs"), tags, complex keys, directives, more than one
 * document, a key given twice and a tab used for indentation. The writer gives block YAML that the reader reads back as the same value.
 * Replaces `@std/yaml` in erga.
 *
 * @example
 * ```ts
 * import { parseYaml, toYaml } from "./yaml.ts";
 * parseYaml("name: skill\ntags: [a, b]\nsteps:\n  - run: build\n    times: 2\n");
 * // { kind: "ok", value: { name: "skill", tags: ["a", "b"], steps: [{ run: "build", times: 2 }] } }
 * toYaml({ name: "skill", on: true }); // "name: skill\non: true\n" (YAML 1.2: "on" is only text)
 * ```
 *
 * @module
 */
import type { Json } from "./json5.ts";
import { err, ok, type Result } from "./result.ts";

/** Where a text stops being YAML this reader takes, and why. Lines and columns count from 1. */
export type YamlError = { readonly kind: "yaml"; readonly line: number; readonly column: number; readonly message: string };

/** A YAML error as one line: `3:14: anchors and aliases are not read`. */
export function formatYamlError(e: YamlError): string {
  return `${e.line}:${e.column}: ${e.message}`;
}

/** How plain scalars resolve: by YAML 1.2's core schema (the default), or all as text (failsafe). */
export type YamlOptions = { readonly schema?: "core" | "failsafe" };

class Stop extends Error {
  readonly at: number;
  constructor(at: number, message: string) {
    super(message);
    this.at = at;
  }
}

const NULL = /^(?:~|null|Null|NULL|)$/;
const BOOL = /^(?:true|True|TRUE|false|False|FALSE)$/;
const INT = /^[-+]?[0-9]+$/;
const OCT = /^0o[0-7]+$/;
const HEX = /^0x[0-9a-fA-F]+$/;
const FLOAT = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const INF = /^[-+]?(?:\.inf|\.Inf|\.INF)$/;
const NAN = /^(?:\.nan|\.NaN|\.NAN)$/;

/** A plain scalar resolved by YAML 1.2's core schema. */
export function resolveCore(s: string): Json {
  if (NULL.test(s)) return null;
  if (BOOL.test(s)) return s.toLowerCase() === "true";
  if (INT.test(s)) return Number(s);
  if (OCT.test(s)) return Number.parseInt(s.slice(2), 8);
  if (HEX.test(s)) return Number.parseInt(s.slice(2), 16);
  if (FLOAT.test(s)) return Number(s);
  if (INF.test(s)) return s.startsWith("-") ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  if (NAN.test(s)) return Number.NaN;
  return s;
}

const DOUBLE_ESCAPES: Readonly<Record<string, string>> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\x85",
  _: "\xa0",
  L: "\u2028",
  P: "\u2029",
};

/** A YAML text read as a JSON value (an empty document is `null`), or where and why it is not YAML this reader takes. */
export function parseYaml(text: string, options: YamlOptions = {}): Result<Json, YamlError> {
  const failsafe = options.schema === "failsafe";
  const src = text.startsWith("\ufeff") ? text.slice(1) : text;
  let i = 0;
  const fail = (message: string, at = i): never => {
    throw new Stop(at, message);
  };
  const peek = (n = 0): string => src[i + n] ?? "";
  const lineStart = (at: number): number => src.lastIndexOf("\n", at - 1) + 1;
  const column = (at = i): number => at - lineStart(at);
  const atLineEnd = (): boolean => peek() === "" || peek() === "\n" || (peek() === "\r" && peek(1) === "\n");
  const eatLineEnd = (): void => {
    if (peek() === "\r") i++;
    if (peek() === "\n") i++;
  };
  const spaces = (): void => {
    while (peek() === " " || peek() === "\t") i++;
  };
  /** The rest of a line: space, then a comment or nothing. */
  const restOfLine = (): void => {
    spaces();
    if (peek() === "#") while (!atLineEnd()) i++;
    if (!atLineEnd()) fail("the end of the line");
    eatLineEnd();
  };
  const marker = (m: "---" | "..."): boolean => column() === 0 && src.startsWith(m, i) && /^[ \t\r\n]?$/.test(src[i + 3] ?? "");
  /** Past blank lines and comment lines, to the first character of the next content (or the end); refusing a tab in indentation. */
  const toContent = (): void => {
    for (;;) {
      const start = i;
      while (peek() === " ") i++;
      if (peek() === "\t") {
        let j = i;
        while (src[j] === " " || src[j] === "\t") j++;
        if (src[j] === "\n" || src[j] === "\r" || src[j] === "#" || src[j] === undefined) i = j;
        else fail("spaces for indentation, not a tab");
      }
      if (peek() === "#") while (!atLineEnd()) i++;
      if (peek() === "" || !atLineEnd()) {
        if (peek() !== "") i = start + (i - start);
        return;
      }
      eatLineEnd();
    }
  };
  const refuseSpecial = (): void => {
    const c = peek();
    if (c === "&" || c === "*") fail("no anchor or alias (they are not read, so no value is ever repeated or expanded)");
    if (c === "!") fail("no tag (a value's type comes from the schema)");
    if (c === "?" && /[ \t\r\n]/.test(peek(1) || "\n")) fail("a simple key (complex keys are not read)");
    if (c === "%" && column() === 0) fail("no directive");
    if (c === "@" || c === "`") fail(`no ${c} at the start of a plain scalar (it is reserved)`);
  };
  const hex = (n: number): string => {
    const h = src.slice(i, i + n);
    if (h.length !== n || !/^[0-9a-fA-F]+$/.test(h)) fail(`${n} hexadecimal digits`);
    i += n;
    return String.fromCodePoint(Number.parseInt(h, 16));
  };
  /** Line breaks inside a quoted scalar folded: one break is a space, each further empty line a line break. */
  const foldQuoted = (): string => {
    let breaks = 0;
    while (atLineEnd() && peek() !== "") {
      eatLineEnd();
      breaks++;
      spaces();
    }
    return breaks === 1 ? " " : "\n".repeat(breaks - 1);
  };
  const trimEnd = (s: string): string => s.replace(/[ \t]+$/, "");
  const doubleQuoted = (): string => {
    i++;
    let out = "";
    for (;;) {
      const c = peek();
      if (c === "") fail("the closing quote");
      if (c === '"') {
        i++;
        return out;
      }
      if (c === "\\") {
        i++;
        const e = peek();
        if (atLineEnd() && e !== "") {
          eatLineEnd();
          spaces();
          while (atLineEnd() && peek() !== "") {
            eatLineEnd();
            out += "\n";
            spaces();
          }
          continue;
        }
        i++;
        const simple = DOUBLE_ESCAPES[e];
        if (simple !== undefined) out += simple;
        else if (e === "x") out += hex(2);
        else if (e === "u") out += hex(4);
        else if (e === "U") out += hex(8);
        else fail(`a known escape, not \\${e}`, i - 2);
        continue;
      }
      if (atLineEnd()) {
        out = trimEnd(out) + foldQuoted();
        continue;
      }
      out += c;
      i++;
    }
  };
  const singleQuoted = (): string => {
    i++;
    let out = "";
    for (;;) {
      const c = peek();
      if (c === "") fail("the closing quote");
      if (c === "'") {
        if (peek(1) === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i++;
        return out;
      }
      if (atLineEnd()) {
        out = trimEnd(out) + foldQuoted();
        continue;
      }
      out += c;
      i++;
    }
  };
  const scalarOf = (s: string): Json => (failsafe ? s : resolveCore(s));
  /** A plain scalar: in flow, up to `,[]{}`; in block, folded over lines indented more than `parent`. */
  const plain = (parent: number, flow: boolean): string => {
    refuseSpecial();
    const first = peek();
    if (first === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) fail("a value, not a sequence entry here");
    if (/[|>]/.test(first)) fail("a block scalar only after a key or a dash");
    if (/[,\]}]/.test(first) && flow) fail("a value");
    let out = "";
    for (;;) {
      let line = "";
      for (;;) {
        const c = peek();
        if (atLineEnd()) break;
        if (c === ":" && (/[ \t\r\n]/.test(peek(1) || "\n") || (flow && /[,\]}[{]/.test(peek(1))))) break;
        if (c === "#" && /[ \t]$/.test(line)) break;
        if (flow && /[,[\]{}]/.test(c)) break;
        line += c;
        i++;
      }
      out += trimEnd(line);
      if (peek() === "#" || peek() === ":" || (flow && /[,[\]{}]/.test(peek())) || !atLineEnd() || peek() === "") return out;
      const save = i;
      let breaks = 0;
      while (atLineEnd() && peek() !== "") {
        eatLineEnd();
        breaks++;
        while (peek() === " " || peek() === "\t") i++;
        if (peek() === "#") {
          i = save;
          return out;
        }
      }
      if (peek() === "" || (!flow && column() <= parent) || marker("---") || marker("...")) {
        i = save;
        return out;
      }
      if (!flow && peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n") && column() <= parent + 1) {
        i = save;
        return out;
      }
      out += breaks === 1 ? " " : "\n".repeat(breaks - 1);
    }
  };
  const blockScalar = (parent: number): string => {
    const literal = peek() === "|";
    i++;
    let chomp: "clip" | "strip" | "keep" = "clip";
    let explicit = 0;
    for (let k = 0; k < 2; k++) {
      const c = peek();
      if (c === "-" || c === "+") {
        chomp = c === "-" ? "strip" : "keep";
        i++;
      } else if (/[1-9]/.test(c)) {
        explicit = Number(c);
        i++;
      }
    }
    restOfLine();
    const lines: string[] = [];
    let indent = explicit > 0 ? parent + explicit : -1;
    let trailingBreak = false;
    for (;;) {
      if (peek() === "") break;
      const start = i;
      let n = 0;
      while (peek() === " ") {
        i++;
        n++;
      }
      if (atLineEnd()) {
        if (indent >= 0 && n > indent) lines.push(src.slice(start + indent, i));
        else lines.push("");
        if (peek() === "") {
          i = start + n;
          break;
        }
        eatLineEnd();
        trailingBreak = true;
        continue;
      }
      if (indent < 0) {
        if (n <= parent) {
          i = start;
          break;
        }
        indent = n;
      }
      if (n < indent || ((marker("---") || marker("...")) && n === 0)) {
        i = start;
        break;
      }
      let end = i;
      while (!atLineEnd()) end = ++i;
      lines.push(src.slice(start + indent, end));
      trailingBreak = peek() !== "";
      eatLineEnd();
    }
    let last = lines.length;
    while (last > 0 && lines[last - 1] === "") last--;
    const content = lines.slice(0, last);
    const trailing = lines.length - last;
    let body: string;
    if (literal) body = content.join("\n");
    else {
      body = "";
      let empty = 0;
      let moreIndented = false;
      let started = false;
      for (const line of content) {
        if (line === "") {
          empty++;
          continue;
        }
        const more = line.startsWith(" ") || line.startsWith("\t");
        if (!started) body += "\n".repeat(empty);
        else if (more || moreIndented) body += "\n".repeat(empty + 1);
        else body += empty === 0 ? " " : "\n".repeat(empty);
        body += line;
        moreIndented = more;
        started = true;
        empty = 0;
      }
    }
    if (content.length === 0) return chomp === "keep" ? "\n".repeat(trailing + (trailingBreak && trailing === 0 ? 1 : 0)) : "";
    switch (chomp) {
      case "strip":
        return body;
      case "clip":
        return trailingBreak || trailing > 0 ? `${body}\n` : body;
      case "keep":
        return `${body}${"\n".repeat(trailing + (trailingBreak ? 1 : 0))}`;
    }
  };
  const define = (o: Record<string, Json>, k: string, v: Json, at: number): void => {
    if (Object.hasOwn(o, k)) fail(`the key ${JSON.stringify(k)} only once`, at);
    Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  };
  const keyText = (k: Json): string =>
    typeof k === "string" ? k : k === null ? "null" : typeof k === "number" || typeof k === "boolean" ? String(k) : fail("a scalar key");
  /** Space, line breaks and comments inside a flow collection. */
  const flowGap = (): void => {
    for (;;) {
      spaces();
      if (peek() === "#") while (!atLineEnd()) i++;
      if (atLineEnd() && peek() !== "") eatLineEnd();
      else return;
    }
  };
  const flowNode = (depth: number): Json => {
    if (depth > 256) fail("less nesting (more than 256 levels)");
    flowGap();
    const c = peek();
    if (c === "[") {
      i++;
      const out: Json[] = [];
      for (;;) {
        flowGap();
        if (peek() === "]") {
          i++;
          return out;
        }
        out.push(flowNode(depth + 1));
        flowGap();
        if (peek() === ":") fail("no mapping inside a flow sequence");
        if (peek() === ",") i++;
        else if (peek() !== "]") fail("a comma or ]");
      }
    }
    if (c === "{") {
      i++;
      const out: Record<string, Json> = {};
      for (;;) {
        flowGap();
        if (peek() === "}") {
          i++;
          return out;
        }
        const at = i;
        const k = keyText(flowNode(depth + 1));
        flowGap();
        let v: Json = null;
        if (peek() === ":") {
          i++;
          flowGap();
          if (peek() !== "," && peek() !== "}") v = flowNode(depth + 1);
        }
        define(out, k, v, at);
        flowGap();
        if (peek() === ",") i++;
        else if (peek() !== "}") fail("a comma or }");
      }
    }
    if (c === '"') return doubleQuoted();
    if (c === "'") return singleQuoted();
    return scalarOf(plain(-1, true));
  };
  /** Whether a mapping key starts here: a scalar followed, on the same line, by `:` and space or the line's end. */
  const startsKey = (): boolean => {
    const save = i;
    try {
      const c = peek();
      if (c === '"') doubleQuoted();
      else if (c === "'") singleQuoted();
      else if (c === "[" || c === "{") return false;
      else {
        if (c === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) return false;
        if (/[&*!|>%@`]/.test(c) || (c === "?" && /[ \t\r\n]/.test(peek(1) || "\n"))) {
          for (let j = i; j < src.length && src[j] !== "\n"; j++) if (src[j] === ":" && /[ \t\r\n]/.test(src[j + 1] ?? "\n")) return true;
          return false;
        }
        while (!atLineEnd()) {
          if (peek() === ":" && /[ \t\r\n]/.test(peek(1) || "\n")) return true;
          if (peek() === "#" && /[ \t]/.test(src[i - 1] ?? "")) return false;
          i++;
        }
        return false;
      }
      spaces();
      return peek() === ":" && /[ \t\r\n]/.test(peek(1) || "\n");
    } catch {
      return false;
    } finally {
      i = save;
    }
  };
  /** A value on the line of its key or dash, or below it: `parent` is the indentation of that key or dash. */
  const valueAfter = (parent: number, depth: number, seqAtParent: boolean): Json => {
    spaces();
    if (peek() === "#" || atLineEnd()) {
      restOfLine();
      toContent();
      if (peek() === "" || marker("---") || marker("...")) return null;
      const col = column();
      if (col > parent) return blockNode(col, depth + 1);
      if (seqAtParent && col === parent && peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) return sequence(col, depth + 1);
      return null;
    }
    const c = peek();
    let v: Json;
    if (c === "|" || c === ">") return blockScalar(parent);
    if (c === "[" || c === "{") v = flowNode(depth + 1);
    else if (c === '"') v = doubleQuoted();
    else if (c === "'") v = singleQuoted();
    else {
      if (startsKey()) fail("a value, not another key on the same line");
      v = scalarOf(plain(parent, false));
    }
    restOfLine();
    return v;
  };
  const sequence = (col: number, depth: number): Json[] => {
    const out: Json[] = [];
    for (;;) {
      i++;
      if (peek() === " " || peek() === "\t") {
        spaces();
        if (!(peek() === "#" || atLineEnd())) {
          const inner = column();
          if (peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) out.push(sequence(inner, depth + 1));
          else if (startsKey()) out.push(mapping(inner, depth + 1));
          else out.push(valueAfter(col, depth, false));
        } else out.push(valueAfter(col, depth, false));
      } else out.push(valueAfter(col, depth, false));
      toContent();
      if (peek() === "" || marker("---") || marker("...")) return out;
      const next = column();
      if (next > col) fail("the indentation of the sequence");
      if (next < col || !(peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n"))) return out;
    }
  };
  const mapping = (col: number, depth: number): Record<string, Json> => {
    const out: Record<string, Json> = {};
    for (;;) {
      refuseSpecial();
      const at = i;
      const c = peek();
      const k = c === '"' ? doubleQuoted() : c === "'" ? singleQuoted() : keyText(scalarOf(plain(col, false)));
      spaces();
      if (peek() !== ":") fail("a colon after the key");
      i++;
      define(out, k, valueAfter(col, depth, true), at);
      toContent();
      if (peek() === "" || marker("---") || marker("...")) return out;
      const next = column();
      if (next > col) fail("the indentation of the mapping");
      if (next < col) return out;
      if (peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) return out;
    }
  };
  const blockNode = (col: number, depth: number): Json => {
    if (depth > 256) fail("less nesting (more than 256 levels)");
    refuseSpecial();
    if (peek() === "-" && /[ \t\r\n]/.test(peek(1) || "\n")) return sequence(col, depth);
    if (startsKey()) return mapping(col, depth);
    const c = peek();
    let v: Json;
    if (c === "[" || c === "{") v = flowNode(depth + 1);
    else if (c === '"') v = doubleQuoted();
    else if (c === "'") v = singleQuoted();
    else if (c === "|" || c === ">") return blockScalar(col - 1);
    else v = scalarOf(plain(col - 1, false));
    restOfLine();
    return v;
  };
  try {
    toContent();
    if (peek() === "%") fail("no directive");
    if (marker("---")) {
      i += 3;
      spaces();
      if (atLineEnd() || peek() === "#") {
        restOfLine();
        toContent();
      }
    }
    let value: Json = null;
    if (!(peek() === "" || marker("...") || marker("---"))) value = blockNode(column(), 0);
    toContent();
    if (marker("...")) {
      i += 3;
      restOfLine();
      toContent();
    }
    if (marker("---")) fail("one document (more than one is not read)");
    if (peek() !== "") fail("the end of the document");
    return ok(value);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const before = src.slice(0, e.at).split(/\r?\n/);
    return err({ kind: "yaml", line: before.length, column: (before.at(-1)?.length ?? 0) + 1, message: `expected ${e.message}` });
  }
}

const isObject = (v: Json): v is { readonly [key: string]: Json } => typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether text can be written as a plain scalar and read back as the same text by the core schema. */
export function isPlainSafe(s: string): boolean {
  if (s === "" || s !== s.trim() || /[\n\r\t]/.test(s)) return false;
  if (typeof resolveCore(s) !== "string") return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return false;
  if (/: |:$| #/.test(s)) return false;
  if (s === "---" || s === "...") return false;
  return /^[\x20-\x7e\u00a0-\ud7ff\ue000-\ufffd]*$/.test(s);
}

function scalar(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") {
    if (Number.isNaN(v)) return ".nan";
    if (!Number.isFinite(v)) return v > 0 ? ".inf" : "-.inf";
    if (Object.is(v, -0)) return "-0.0";
    return String(v);
  }
  if (typeof v === "string") return isPlainSafe(v) ? v : JSON.stringify(v);
  return Array.isArray(v) ? "[]" : "{}";
}

const empty = (v: Json): boolean => (Array.isArray(v) ? v.length === 0 : isObject(v) ? Object.keys(v).length === 0 : false);

function block(v: Json, indent: number, out: string[]): void {
  const pad = "  ".repeat(indent);
  if (Array.isArray(v)) {
    for (const item of v as readonly Json[]) {
      if ((Array.isArray(item) || isObject(item)) && !empty(item)) {
        const inner: string[] = [];
        block(item, 0, inner);
        out.push(`${pad}- ${(inner[0] ?? "").trimStart()}`);
        for (const line of inner.slice(1)) out.push(`${pad}  ${line}`);
      } else out.push(`${pad}- ${scalar(item)}`);
    }
    return;
  }
  if (isObject(v)) {
    for (const [k, item] of Object.entries(v)) {
      const key = isPlainSafe(k) ? k : JSON.stringify(k);
      if ((Array.isArray(item) || isObject(item)) && !empty(item)) {
        out.push(`${pad}${key}:`);
        block(item, indent + 1, out);
      } else out.push(`${pad}${key}: ${scalar(item)}`);
    }
    return;
  }
  out.push(`${pad}${scalar(v)}`);
}

/** A value as block YAML, ending in a line break: mappings and sequences by indentation, text plain where it reads back the same, else double-quoted. */
export function toYaml(value: Json): string {
  if ((Array.isArray(value) || isObject(value)) && empty(value)) return `${scalar(value)}\n`;
  const out: string[] = [];
  block(value, 0, out);
  return `${out.join("\n")}\n`;
}
