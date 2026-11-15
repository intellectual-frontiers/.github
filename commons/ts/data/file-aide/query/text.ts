/**
 * The text of a query: `select … from … where … order by key limit … with (…) scan`, read into the same value the builder makes, given the
 * entries it may name, as a `Result` whose failure names the line and the column (commons 0010-file-aide FR-021).
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import type { Entry } from "../algebra/entry.ts";
import {
  type Comparison,
  DEFAULT_OPTIONS,
  type Expr,
  META_FIELDS,
  type Options,
  type Query,
  type QueryValue,
  type Scalar,
  type Source,
} from "./query.ts";

/** Why text is not a query, and where. */
export type ParseError = { readonly line: number; readonly column: number; readonly message: string };

/** Says a parse error in one sentence. */
export const formatParseError = (e: ParseError): string => `line ${e.line}, column ${e.column}: ${e.message}`;

type Token =
  | { readonly kind: "word"; readonly text: string; readonly at: number }
  | { readonly kind: "string"; readonly text: string; readonly at: number }
  | { readonly kind: "number"; readonly value: number; readonly unit: string; readonly at: number }
  | { readonly kind: "symbol"; readonly text: string; readonly at: number }
  | { readonly kind: "end"; readonly at: number };

const SIZE: { readonly [u: string]: number } = { b: 1, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 };
const TIME: { readonly [u: string]: number } = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

function lex(text: string): Result<Token[], { at: number; message: string }> {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? "";
    if (/\s/u.test(c)) {
      i++;
      continue;
    }
    if (c === "-" && text[i + 1] === "-") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    const at = i;
    if (c === "'") {
      let s = "";
      i++;
      for (;;) {
        if (i >= text.length) return err({ at, message: "a string with no closing quote" });
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            s += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        s += text[i++] ?? "";
      }
      out.push({ kind: "string", text: s, at });
      continue;
    }
    const num = /^[0-9]+(?:\.[0-9]+)?([A-Za-z]*)/u.exec(text.slice(i));
    if (num !== null) {
      const unit = (num[1] ?? "").toLowerCase();
      const value = Number(num[0].slice(0, num[0].length - (num[1]?.length ?? 0)));
      if (unit !== "" && SIZE[unit] === undefined && TIME[unit] === undefined)
        return err({ at, message: `${num[0]} is not a number, a size or a duration` });
      out.push({ kind: "number", value, unit, at });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(text.slice(i));
    if (word !== null) {
      out.push({ kind: "word", text: word[0], at });
      i += word[0].length;
      continue;
    }
    const sym = /^(?:<>|!=|<=|>=|[=<>(),*])/u.exec(text.slice(i));
    if (sym !== null) {
      out.push({ kind: "symbol", text: sym[0] === "!=" ? "<>" : sym[0], at });
      i += sym[0].length;
      continue;
    }
    return err({ at, message: `${JSON.stringify(c)} is not part of a query` });
  }
  out.push({ kind: "end", at: text.length });
  return ok(out);
}

/** A failure inside the parser, turned into a `ParseError` before `parseQuery` returns: the parser never lets it out. */
class Failure {
  readonly at: number;
  readonly message: string;
  constructor(at: number, message: string) {
    this.at = at;
    this.message = message;
  }
}

/**
 * Reads the text of a query, given the entries it may name in `from` (a name) or a root (a string).
 *
 * @param text - the query
 * @param entries - the entries of the layout it is for
 */
export function parseQuery(
  text: string,
  entries: readonly Entry<string, object, unknown>[] = [],
): Result<Query<Readonly<Record<string, unknown>>>, ParseError> {
  const where = (at: number): { line: number; column: number } => {
    const before = text.slice(0, at).split("\n");
    return { line: before.length, column: (before[before.length - 1]?.length ?? 0) + 1 };
  };
  const lexed = lex(text);
  if (lexed.kind === "err") return err({ ...where(lexed.error.at), message: lexed.error.message });
  const ts = lexed.value;
  let i = 0;
  const peek = (): Token => ts[i] ?? { kind: "end", at: text.length };
  const isWord = (w: string): boolean => {
    const t = peek();
    return t.kind === "word" && t.text.toLowerCase() === w;
  };
  const isSymbol = (s: string): boolean => {
    const t = peek();
    return t.kind === "symbol" && t.text === s;
  };
  const fail = (message: string, t: Token = peek()): never => {
    throw new Failure(t.at, message);
  };
  const word = (w: string): void => {
    if (!isWord(w)) fail(`expected ${w}`);
    i++;
  };
  const symbol = (s: string): void => {
    if (!isSymbol(s)) fail(`expected ${s}`);
    i++;
  };
  const ident = (): { name: string; at: number } => {
    const t = peek();
    if (t.kind !== "word") return fail("expected a field");
    i++;
    return { name: t.text, at: t.at };
  };
  const literal = (): Scalar => {
    const t = peek();
    i++;
    switch (t.kind) {
      case "string":
        return t.text;
      case "number":
        if (t.unit === "") return t.value;
        if (SIZE[t.unit] !== undefined) return t.value * (SIZE[t.unit] ?? 1);
        return fail("a duration is only for within", t);
      case "word": {
        const w = t.text.toLowerCase();
        if (w === "true") return true;
        if (w === "false") return false;
        if (w === "null") return null;
        return fail(`${t.text} is not a value`, t);
      }
      case "symbol":
      case "end":
        return fail("expected a value", t);
    }
  };
  const fieldsSeen: { name: string; at: number }[] = [];

  const predicate = (): Expr => {
    const f = ident();
    fieldsSeen.push(f);
    const field = f.name;
    let negate = false;
    if (isWord("not")) {
      i++;
      negate = true;
    }
    let e: Expr;
    const t = peek();
    if (t.kind === "symbol" && ["=", "<>", "<", "<=", ">", ">="].includes(t.text)) {
      if (negate) fail("not goes before in, between, glob or regex");
      i++;
      // the comparisons the lexer gives, one of six
      e = { kind: "compare", field, op: t.text as Comparison, value: literal() };
    } else if (isWord("in")) {
      i++;
      symbol("(");
      const values = [literal()];
      while (isSymbol(",")) {
        i++;
        values.push(literal());
      }
      symbol(")");
      e = { kind: "in", field, values };
    } else if (isWord("between")) {
      i++;
      const low = literal();
      word("and");
      e = { kind: "between", field, low, high: literal() };
    } else if (isWord("glob") || isWord("regex")) {
      const kind = isWord("glob") ? "glob" : "regex";
      i++;
      const p = peek();
      if (p.kind !== "string") return fail(`${kind} takes a string`);
      i++;
      e = { kind, field, pattern: p.text };
    } else if (isWord("within")) {
      i++;
      const d = peek();
      if (d.kind !== "number" || TIME[d.unit] === undefined) return fail("within takes a duration such as 7d, 12h, 30m or 10s");
      i++;
      e = { kind: "within", field, ms: d.value * (TIME[d.unit] ?? 1) };
    } else return fail("expected =, <>, <, <=, >, >=, in, between, glob, regex or within");
    return negate ? { kind: "not", item: e } : e;
  };
  const unary = (): Expr => {
    if (isWord("not")) {
      i++;
      return { kind: "not", item: unary() };
    }
    if (isSymbol("(")) {
      i++;
      const e = expr();
      symbol(")");
      return e;
    }
    return predicate();
  };
  const conj = (): Expr => {
    const items = [unary()];
    while (isWord("and")) {
      i++;
      items.push(unary());
    }
    return items.length === 1 ? (items[0] ?? { kind: "true" }) : { kind: "and", items };
  };
  const expr = (): Expr => {
    const items = [conj()];
    while (isWord("or")) {
      i++;
      items.push(conj());
    }
    return items.length === 1 ? (items[0] ?? { kind: "true" }) : { kind: "or", items };
  };
  const option = (o: Options): Options => {
    const name = ident();
    symbol("=");
    const t = peek();
    i++;
    const flag = (): boolean => {
      const w = t.kind === "word" ? t.text.toLowerCase() : "";
      if (w === "on" || w === "true") return true;
      if (w === "off" || w === "false") return false;
      return fail(`${name.name} is on or off`, t);
    };
    switch (name.name.toLowerCase()) {
      case "ignore":
        return { ...o, ignore: flag() };
      case "hidden":
        return { ...o, hidden: flag() };
      case "regex":
        return { ...o, regex: flag() };
      case "parallel":
        if (t.kind !== "number" || t.unit !== "" || t.value < 1) return fail("parallel is a number of at least 1", t);
        return { ...o, parallel: t.value };
      default:
        return fail(`${name.name} is not an option: ignore, hidden, regex or parallel`, ts[i - 3] ?? t);
    }
  };

  try {
    word("select");
    let select: "*" | { name: string; at: number }[] = "*";
    if (isSymbol("*")) i++;
    else {
      select = [ident()];
      while (isSymbol(",")) {
        i++;
        select.push(ident());
      }
    }
    word("from");
    const src = peek();
    let from: Source;
    if (src.kind === "string") from = { kind: "root", root: src.text.replace(/^\.\/?/, "").replace(/\/$/, "") };
    else if (src.kind === "word") {
      const e = entries.find((x) => x.name === src.text);
      if (e === undefined)
        fail(`${src.text} is not an entry of the layout${entries.length === 0 ? "" : `: ${entries.map((x) => x.name).join(", ")}`}`, src);
      from = { kind: "entry", entry: e ?? fail("unreachable", src) };
    } else return fail("expected an entry, or a root as a string");
    i++;
    let whereExpr: Expr = { kind: "true" };
    if (isWord("where")) {
      i++;
      whereExpr = expr();
    }
    let orderByKey = false;
    if (isWord("order")) {
      i++;
      word("by");
      word("key");
      orderByKey = true;
    }
    let limit: number | undefined;
    if (isWord("limit")) {
      i++;
      const t = peek();
      if (t.kind !== "number" || t.unit !== "" || !Number.isInteger(t.value)) return fail("limit takes a whole number");
      i++;
      limit = t.value;
    }
    let options = DEFAULT_OPTIONS;
    if (isWord("with")) {
      i++;
      symbol("(");
      options = option(options);
      while (isSymbol(",")) {
        i++;
        options = option(options);
      }
      symbol(")");
    }
    let scan = false;
    if (isWord("scan")) {
      i++;
      scan = true;
    }
    if (peek().kind !== "end") fail("expected the end of the query");
    const known = new Set<string>([
      ...(from.kind === "entry" ? from.entry.pattern.segments.filter((s) => !s.derived).map((s) => s.name) : ["type"]),
      ...META_FIELDS,
    ]);
    for (const f of [...(select === "*" ? [] : select), ...fieldsSeen]) {
      if (!known.has(f.name))
        return err({ ...where(f.at), message: `${f.name} is not a field of ${from.kind === "entry" ? from.entry.name : "a tree"}` });
    }
    const value: QueryValue = {
      select: select === "*" ? "*" : select.map((f) => f.name),
      from,
      where: whereExpr,
      orderByKey,
      limit,
      with: options,
      scan,
    };
    return ok({ value });
  } catch (thrown) {
    if (thrown instanceof Failure) return err({ ...where(thrown.at), message: thrown.message });
    throw thrown;
  }
}
