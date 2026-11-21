/**
 * What the tests of the SQL language core share (commons data 0065-sql-lang): the dialects under test, the check that a lexed text can be put back from its parts, and the corpus.
 *
 * Spec: 0065-sql-lang FR-004
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { absurd } from "@intellectual-frontiers/core";
import { fileURLToPath } from "node:url";
import {
  ansi,
  type Dialect,
  type Expr,
  kindAt,
  type Lexed,
  lex,
  type Parsed,
  parse,
  Tok,
  textAt,
  toSexp,
  tokenCount,
} from "@intellectual-frontiers/data/sql/lang";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/lang/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";

/** The dialects of this folder. */
export const DIALECTS: readonly Dialect[] = [ansi, sqlite, postgres, duckdb];

/** The corpus of the benchmark and of the tests. */
export const CORPUS: string = readFileSync(fileURLToPath(new URL("./lang-corpus.sql", import.meta.url)), "utf8");

const SPACE = /^[\s﻿]*$/;

/** What is wrong with how a lexed text is cut into parts, or nothing: every character is in one token, one comment or white space, in order. */
export function wholeness(l: Lexed): string | undefined {
  const parts: { start: number; end: number; what: string }[] = [];
  const t = l.tokens;
  for (let i = 0; i < tokenCount(t); i++) {
    if (kindAt(t, i) === Tok.Eof) continue;
    parts.push({ start: t.start[i] ?? 0, end: t.end[i] ?? 0, what: `token ${i}` });
  }
  for (let i = 0; i < l.comments.start.length; i++)
    parts.push({ start: l.comments.start[i] ?? 0, end: l.comments.end[i] ?? 0, what: `comment ${i}` });
  parts.sort((a, b) => a.start - b.start);
  let at = 0;
  for (const p of parts) {
    if (p.end <= p.start) return `${p.what} is empty`;
    if (p.start < at) return `${p.what} overlaps what precedes it`;
    if (!SPACE.test(l.text.slice(at, p.start))) return `text between ${at} and ${p.start} is not white space`;
    at = p.end;
  }
  if (!SPACE.test(l.text.slice(at))) return `text after ${at} is not white space`;
  const last = tokenCount(t) - 1;
  if (kindAt(t, last) !== Tok.Eof) return "the last token is not the end of the text";
  return undefined;
}

/** The kinds of the tokens of a text, with the end of the text left out. */
export function kindsOf(d: Dialect, text: string): readonly number[] {
  const l = lex(text, d.compiled);
  return l.tokens.kind.slice(0, -1);
}

/** The texts of the tokens of a text, with the end of the text left out. */
export function textsOf(d: Dialect, text: string): readonly string[] {
  const l = lex(text, d.compiled);
  const out: string[] = [];
  for (let i = 0; i < tokenCount(l.tokens) - 1; i++) out.push(textAt(l.tokens, text, i));
  return out;
}

/** The folder of the golden files, and what each dialect's folder is called. */
export const GOLDEN = fileURLToPath(new URL("./golden/lang/", import.meta.url));

/** The dialect of a folder of golden files. */
export const GOLDEN_DIALECTS: Readonly<Record<string, Dialect>> = { ansi, sqlite, postgres, duckdb };

/** Every comment's place, one to a line: placement, the node's kind and range, and the text. */
export function describeAttachments(p: Parsed): string {
  return p.attachments.all
    .map((a) => `${a.placement} ${a.node.kind}@${a.node.start}-${a.node.end} ${JSON.stringify(a.comment.text)}`)
    .join("\n");
}

/** What a golden file of SQL must say: the tree of its text, and the places of its comments where it has any. */
export function goldenOf(d: Dialect, sql: string): { readonly sexp: string; readonly comments: string | undefined } {
  const p = parse(sql, d);
  const errors = p.errors.map((e) => `error ${JSON.stringify(e)}`).join("\n");
  return {
    sexp: `${toSexp(p.script)}${errors === "" ? "" : `\n${errors}`}\n`,
    comments: p.comments.length === 0 ? undefined : `${describeAttachments(p)}\n`,
  };
}

/** An expression with every operator parenthesized, so that its grouping can be read. */
export function show(e: Expr): string {
  switch (e.kind) {
    case "name":
      return e.parts.map((p) => p.name).join(".");
    case "number":
      return e.text;
    case "string":
      return JSON.stringify(e.value);
    case "boolean":
      return e.value ? "TRUE" : "FALSE";
    case "null":
      return "NULL";
    case "param":
      return e.text;
    case "star":
      return "*";
    case "unary":
      return `(${e.op} ${show(e.arg)})`;
    case "binary":
    case "operator":
      return `(${show(e.left)} ${e.op} ${show(e.right)})`;
    case "is":
      return `(${show(e.arg)} IS ${e.negated ? "NOT " : ""}${e.test}${e.other === undefined ? "" : ` ${show(e.other)}`})`;
    case "between":
      return `(${show(e.arg)} ${e.negated ? "NOT " : ""}BETWEEN ${show(e.low)} AND ${show(e.high)})`;
    case "in":
      return `(${show(e.arg)} ${e.negated ? "NOT " : ""}IN [${e.values.map(show).join(", ")}])`;
    case "like":
      return `(${show(e.arg)} ${e.negated ? "NOT " : ""}${e.op} ${show(e.pattern)})`;
    case "cast":
      return `(${show(e.arg)} :: ${e.type.name})`;
    case "call":
      return `${e.name.parts.map((p) => p.name).join(".")}(${e.args.map((a) => (a.kind === "named-arg" ? `${a.name.name} => ${show(a.value)}` : show(a))).join(", ")})`;
    case "tuple":
      return `<${e.items.map(show).join(", ")}>`;
    case "case":
    case "exists":
    case "extract":
    case "in-query":
    case "interval":
    case "scalar-query":
    case "array":
    case "subscript":
    case "collate":
      return `{${e.kind}}`;
    default:
      return absurd(e);
  }
}

/** The expression of a script's first select item. */
export function firstItem(p: Parsed): Expr {
  const s = p.script.statements[0];
  if (s === undefined || s.kind !== "select") throw new Error("not a select");
  const item = s.items[0];
  if (item === undefined) throw new Error("no item");
  return item.expr;
}

/** The folder of this library. */
export const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The names of the thirty dialects, in order. */
export const DIALECT_NAMES: readonly string[] = [
  "athena",
  "bigquery",
  "clickhouse",
  "databricks",
  "doris",
  "dremio",
  "drill",
  "druid",
  "duckdb",
  "dune",
  "exasol",
  "fabric",
  "hive",
  "materialize",
  "mysql",
  "oracle",
  "postgres",
  "presto",
  "redshift",
  "risingwave",
  "singlestore",
  "snowflake",
  "solr",
  "spark",
  "spark2",
  "sqlite",
  "starrocks",
  "teradata",
  "trino",
  "tsql",
];

/** Every dialect of the library, loaded, in the order of {@link DIALECT_NAMES}. */
export const ALL_DIALECTS: readonly Dialect[] = await Promise.all(
  DIALECT_NAMES.map(async (n) => {
    const m: unknown = await import(`@intellectual-frontiers/data/sql/lang/dialects/${n}`);
    if (typeof m !== "object" || m === null || !("dialect" in m) || !isDialect(m.dialect)) throw new Error(`${n} exports no dialect`);
    return m.dialect;
  }),
);

function isDialect(v: unknown): v is Dialect {
  return typeof v === "object" && v !== null && "name" in v && "lexical" in v && "compiled" in v && "grammar" in v;
}
