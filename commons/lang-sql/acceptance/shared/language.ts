/**
 * The language of both utilities (commons lang-sql 0011-acceptance FR-001, FR-002): the dialect `sqlfs` (the common ground with the like-words `GLOB` and `ILIKE` and the units of sizes and times), its profile (queries of one table, `files`, with no join,
 * aggregate or subquery), its catalog, and `analyze`, which reads, conforms, binds, types and plans a query with the helpers of aide and gives every error with its span.
 *
 * Spec: 0011-acceptance FR-001, FR-002
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ansi, createRegistry, declareDialect, type Dialect, parse, type Registry, type Select } from "../../src/mod.ts";
import { bind, type Catalog, check } from "../../src/aide/catalog/mod.ts";
import { plan, type Plan } from "../../src/aide/plan/mod.ts";
import { conform, defineProfile, type Profile } from "../../src/aide/profile/mod.ts";
import { renderDiagnostic } from "../../src/aide/text/mod.ts";
import type { Row, Value } from "../../src/aide/exec/mod.ts";

/** A thing a file system has: one row of the table `files`. */
export interface Entry {
  readonly name: string;
  /** Relative to the root, with `/`. */
  readonly path: string;
  /** What follows the last dot of the name, empty where the name has none. */
  readonly ext: string;
  /** `f` (file), `d` (directory), `l` (symbolic link) or `o` (anything else). */
  readonly kind: "f" | "d" | "l" | "o";
  readonly size: number;
  /** Seconds since the epoch, whole. */
  readonly mtime: number;
  /** The permission bits, as the number they are. */
  readonly mode: number;
  readonly owner: string;
  /** 1 for an entry of the root. */
  readonly depth: number;
}

/** The columns of `files`, in order. */
export const COLUMNS = ["name", "path", "ext", "kind", "size", "mtime", "mode", "owner", "depth"] as const;

/** An entry as a row. */
export function toRow(e: Entry): Row {
  return { name: e.name, path: e.path, ext: e.ext, kind: e.kind, size: e.size, mtime: e.mtime, mode: e.mode, owner: e.owner, depth: e.depth };
}

/** The entry of a path, from what is known of it. */
export function entryOf(path: string, kind: Entry["kind"], size: number, mtime: number, mode: number, owner: string): Entry {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return { name, path, ext: dot < 0 ? "" : name.slice(dot + 1), kind, size, mtime, mode, owner, depth: path.split("/").length };
}

const UNITS = [
  { unit: "B", factor: 1 },
  { unit: "KB", factor: 1024 },
  { unit: "MB", factor: 1024 * 1024 },
  { unit: "GB", factor: 1024 * 1024 * 1024 },
  { unit: "S", factor: 1 },
  { unit: "M", factor: 60 },
  { unit: "H", factor: 3600 },
  { unit: "D", factor: 86400 },
  { unit: "W", factor: 604800 },
];

/** The dialect: the common ground, `GLOB` and `ILIKE`, and units after numbers. */
export const sqlfs: Dialect = declareDialect({
  name: "sqlfs",
  extends: ansi,
  lexical: (l) => ({ ...l, keywords: [...l.keywords, "GLOB", "ILIKE"] }),
  grammar: (g) => ({ ...g, likeWords: ["GLOB", "ILIKE"], units: UNITS }),
});

/** The functions of the language, as the catalog types them. */
export const FUNCTIONS: Catalog["functions"] = [
  { name: "now", params: [], minArgs: 0, maxArgs: 0, result: "timestamp" },
  { name: "lower", params: ["text"], minArgs: 1, maxArgs: 1, result: "text" },
  { name: "upper", params: ["text"], minArgs: 1, maxArgs: 1, result: "text" },
  { name: "length", params: ["text"], minArgs: 1, maxArgs: 1, result: "int" },
  { name: "basename", params: ["text"], minArgs: 1, maxArgs: 1, result: "text" },
  { name: "dirname", params: ["text"], minArgs: 1, maxArgs: 1, result: "text" },
  { name: "regexp", params: ["text", "text"], minArgs: 2, maxArgs: 2, result: "bool" },
  { name: "glob", params: ["text", "text"], minArgs: 2, maxArgs: 2, result: "bool" },
];

/** The catalog: one table. */
export const CATALOG: Catalog = {
  tables: { files: { columns: { name: "text", path: "text", ext: "text", kind: "text", size: "int", mtime: "timestamp", mode: "int", owner: "text", depth: "int" } } },
  functions: FUNCTIONS,
};

/** The profile: queries of one table, with no join, no aggregate and no subquery. */
export const PROFILE: Profile = defineProfile({
  name: "sqlfs",
  statements: ["select"],
  forbidNodes: ["join", "subquery", "scalar-query", "exists", "in-query", "with", "set-op", "values", "table-fn", "table-op", "window-spec"],
  functions: FUNCTIONS.map((f) => f.name),
  tables: ["files"],
  maxDepth: 60,
  maxNodes: 2000,
  maxTables: 1,
});

/** A registry that holds the dialect and its functions, as a library outside the core registers one. */
export function registry(): Registry {
  const r = createRegistry();
  r.register(sqlfs);
  r.registerFunctions(
    "sqlfs",
    FUNCTIONS.map((f) => ({ name: f.name, minArgs: f.minArgs, maxArgs: f.maxArgs, aggregate: false, returns: f.result })),
  );
  return r;
}

/** Something wrong with a query. */
export interface Diagnostic {
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

/** A query that is read, conformed, bound, typed and planned. */
export interface Analyzed {
  readonly text: string;
  readonly select: Select;
  readonly plan: Plan;
}

/** Reads a query and plans it; every error of every step is an error value with its span. */
export function analyze(text: string): Result<Analyzed, readonly Diagnostic[]> {
  const parsed = parse(text, sqlfs);
  const conformed = conform(parsed, PROFILE);
  if (conformed.kind === "err") return err(conformed.error);
  const stmt = parsed.script.statements[0];
  if (parsed.script.statements.length !== 1 || stmt === undefined || stmt.kind !== "select") return err([{ start: 0, end: text.length, message: "a query is one SELECT" }]);
  const bound = bind(stmt, CATALOG);
  if (bound.kind === "err") return err(bound.error);
  const typed = check(bound.value);
  if (typed.length > 0) return err(typed);
  const planned = plan(stmt, bound.value);
  if (planned.kind === "err") return err(planned.error);
  return ok({ text, select: stmt, plan: planned.value });
}

/** A query's errors as the text a person reads, each with its line and a caret. */
export function describeDiagnostics(text: string, diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map((d) => renderDiagnostic(text, d)).join("\n");
}

/** What a query gives. */
export interface Result2 {
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
}

/** The rows as text: a table with a header, JSON, or the paths, one on a line. */
export function format(result: Result2, how: "table" | "json" | "paths"): string {
  if (how === "json") return JSON.stringify(result.rows);
  if (how === "paths") return result.rows.map((r) => String(r["path"] ?? Object.values(r)[0] ?? "")).join("\n");
  const cols = result.columns;
  const cells = result.rows.map((r) => cols.map((c) => show(r[c] ?? null)));
  const widths = cols.map((c, i) => Math.max(c.length, ...cells.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]): string => r.map((x, i) => x.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return [line(cols), line(widths.map((w) => "-".repeat(w))), ...cells.map(line)].join("\n");
}

function show(v: Value): string {
  return v === null ? "NULL" : typeof v === "string" ? v.replace(/\n/g, "\\n") : String(v);
}

/** The names of the columns a query selects, in order (`*` is all of them). */
export function columnsOf(a: Analyzed): readonly string[] {
  const out: string[] = [];
  for (const [i, it] of a.select.items.entries()) {
    if (it.expr.kind === "star") out.push(...COLUMNS);
    else out.push(it.alias?.name ?? (it.expr.kind === "name" ? (it.expr.parts[it.expr.parts.length - 1]?.name ?? `column${i + 1}`) : `column${i + 1}`));
  }
  return out;
}
