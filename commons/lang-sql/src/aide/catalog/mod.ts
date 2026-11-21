/**
 * Catalog, names and types (commons lang-sql 0010-aide FR-003, FR-004): a {@link Catalog} says the tables and functions of a language; `bind` resolves the names of a query against it, with aliases and the scopes of subqueries, and `typeOf` and `check`
 * give the type of an expression and each use that cannot be right. Everything is data and errors are values, with the span of the name and, for a name close to one that exists, the name that was meant.
 *
 * Spec: 0010-aide FR-003, FR-004
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { children, type Expr, type Name, type Node, type Query, type Select, type Source } from "../../mod.ts";

/** The types of the values of a language. */
export type Type = "int" | "float" | "text" | "bool" | "timestamp" | "null" | "unknown";

/** A table: its columns and their types, in order. */
export interface TableSpec {
  readonly columns: Readonly<Record<string, Type>>;
}

/** A function: the types of its parameters (`undefined` where any), how many it needs at least, and the type it gives. */
export interface FunctionSig {
  readonly name: string;
  readonly params: readonly Type[] | undefined;
  readonly minArgs: number;
  readonly maxArgs: number | undefined;
  readonly result: Type;
}

/** What a language's tables and functions are. */
export interface Catalog {
  readonly tables: Readonly<Record<string, TableSpec>>;
  readonly functions: readonly FunctionSig[];
}

/** A column that a name was resolved to. */
export interface BoundColumn {
  readonly table: string;
  readonly alias: string;
  readonly column: string;
  readonly type: Type;
}

/** Something wrong with the names or types of a query. */
export interface BindError {
  readonly start: number;
  readonly end: number;
  readonly message: string;
  /** The name that was meant, where one is close. */
  readonly suggestion?: string;
}

/** A query with its names resolved. */
export interface Bound {
  readonly select: Select;
  readonly catalog: Catalog;
  /** The column each name of an expression stands for. */
  readonly columns: ReadonlyMap<Name, BoundColumn>;
  /** The tables of the query's own `FROM`, with their aliases. */
  readonly tables: readonly { readonly name: string; readonly alias: string }[];
}

const lc = (s: string): string => s.toLowerCase();

function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur.push(Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)));
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** The candidate closest to a name, where one is within two edits (the first in order where two are). */
export function closest(name: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = 3;
  for (const c of candidates) {
    const d = distance(lc(name), lc(c));
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

interface Scope {
  readonly entries: readonly { readonly alias: string; readonly table: string; readonly columns: Readonly<Record<string, Type>> | undefined }[];
  readonly outer: Scope | undefined;
}

const AGG_SKIP: ReadonlySet<string> = new Set(["star"]);

/** Resolves the names of a query against a catalog; every unknown table, unknown column and ambiguous column is an error value. */
export function bind(select: Select, catalog: Catalog): Result<Bound, readonly BindError[]> {
  const errors: BindError[] = [];
  const columns = new Map<Name, BoundColumn>();
  const tables: { name: string; alias: string }[] = [];
  const tableNames = Object.keys(catalog.tables);

  const resolveName = (n: Name, scope: Scope): void => {
    const last = n.parts[n.parts.length - 1]?.name ?? "";
    const qual = n.parts.length > 1 ? n.parts[n.parts.length - 2]?.name : undefined;
    for (let s: Scope | undefined = scope; s !== undefined; s = s.outer) {
      const hits: BoundColumn[] = [];
      let unknownShape = false;
      for (const e of s.entries) {
        if (qual !== undefined && lc(e.alias) !== lc(qual) && lc(e.table) !== lc(qual)) continue;
        if (e.columns === undefined) {
          unknownShape = true;
          continue;
        }
        const key = Object.keys(e.columns).find((c) => lc(c) === lc(last));
        if (key !== undefined) hits.push({ table: e.table, alias: e.alias, column: key, type: e.columns[key] ?? "unknown" });
      }
      if (hits.length > 1) {
        errors.push({ start: n.start, end: n.end, message: `the column ${last} is ambiguous` });
        return;
      }
      const hit = hits[0];
      if (hit !== undefined) {
        columns.set(n, hit);
        return;
      }
      if (unknownShape) return;
    }
    const all = scope.entries.flatMap((e) => (qual !== undefined && lc(e.alias) !== lc(qual) && lc(e.table) !== lc(qual) ? [] : Object.keys(e.columns ?? {})));
    const sug = closest(last, all);
    errors.push({ start: n.start, end: n.end, message: `there is no column ${qual === undefined ? "" : `${qual}.`}${last}${sug === undefined ? "" : `; did you mean ${sug}?`}`, ...(sug === undefined ? {} : { suggestion: sug }) });
  };

  const visitExpr = (e: Node, scope: Scope, aliases: ReadonlySet<string>): void => {
    switch (e.kind) {
      case "name": {
        if (e.parts.length === 1 && aliases.has(lc(e.parts[0]?.name ?? ""))) return;
        resolveName(e, scope);
        return;
      }
      case "scalar-query":
      case "exists":
      case "in-query": {
        if (e.kind === "in-query") visitExpr(e.arg, scope, aliases);
        bindQuery(e.query, scope);
        return;
      }
      case "call":
        for (const a of [...e.args, ...e.parameters]) visitExpr(a, scope, aliases);
        for (const o of e.orderBy) visitExpr(o, scope, aliases);
        if (e.filter !== undefined) visitExpr(e.filter, scope, aliases);
        return;
      case "cast":
        visitExpr(e.arg, scope, aliases);
        return;
      default:
        if (AGG_SKIP.has(e.kind)) return;
        for (const c of children(e)) visitExpr(c, scope, aliases);
    }
  };

  const bindQuery = (q: Query, outer: Scope | undefined): void => {
    if (q.kind !== "select") {
      errors.push({ start: q.start, end: q.end, message: `a ${q.kind} is not bound` });
      return;
    }
    const entries: { alias: string; table: string; columns: Readonly<Record<string, Type>> | undefined }[] = [];
    const ons: Expr[] = [];
    const addSource = (s: Source): void => {
      if (s.kind === "join") {
        addSource(s.left);
        addSource(s.right);
        if (s.on !== undefined) ons.push(s.on);
        return;
      }
      if (s.kind === "table") {
        const name = s.name.parts.map((p) => p.name).join(".");
        const key = Object.keys(catalog.tables).find((t) => lc(t) === lc(name));
        const alias = s.alias?.name.name ?? s.name.parts[s.name.parts.length - 1]?.name ?? name;
        if (key === undefined) {
          const sug = closest(name, tableNames);
          errors.push({ start: s.name.start, end: s.name.end, message: `there is no table ${name}${sug === undefined ? "" : `; did you mean ${sug}?`}`, ...(sug === undefined ? {} : { suggestion: sug }) });
          entries.push({ alias, table: name, columns: undefined });
        } else {
          if (q === select) tables.push({ name: key, alias });
          entries.push({ alias, table: key, columns: catalog.tables[key]?.columns });
        }
      } else if (s.kind === "subquery") {
        bindQuery(s.query, outer);
        entries.push({ alias: s.alias?.name.name ?? "", table: "", columns: undefined });
      } else errors.push({ start: s.start, end: s.end, message: `a ${s.kind} source is not bound` });
    };
    for (const s of q.from) addSource(s);
    const scope: Scope = { entries, outer };
    for (const on of ons) visitExpr(on, scope, new Set());
    const aliases = new Set(q.items.flatMap((i) => (i.alias === undefined ? [] : [lc(i.alias.name)])));
    for (const i of q.items) visitExpr(i.expr, scope, new Set());
    if (q.where !== undefined) visitExpr(q.where, scope, new Set());
    for (const g of q.groupBy) visitExpr(g, scope, new Set());
    if (q.having !== undefined) visitExpr(q.having, scope, aliases);
    for (const o of q.orderBy) visitExpr(o.expr, scope, aliases);
    if (q.limit !== undefined) visitExpr(q.limit, scope, new Set());
    if (q.offset !== undefined) visitExpr(q.offset, scope, new Set());
  };

  bindQuery(select, undefined);
  return errors.length > 0 ? err(errors) : ok({ select, catalog, columns, tables });
}

const NUMERIC: ReadonlySet<Type> = new Set(["int", "float", "timestamp"]);

function compatible(a: Type, b: Type): boolean {
  if (a === "unknown" || b === "unknown" || a === "null" || b === "null") return true;
  if (NUMERIC.has(a) && NUMERIC.has(b)) return true;
  return a === b;
}

const sigOf = (b: Bound, name: string): FunctionSig | undefined => b.catalog.functions.find((f) => lc(f.name) === lc(name));

const CAST_TYPES: Readonly<Record<string, Type>> = { INT: "int", INTEGER: "int", BIGINT: "int", SMALLINT: "int", REAL: "float", FLOAT: "float", DOUBLE: "float", NUMERIC: "float", DECIMAL: "float", TEXT: "text", VARCHAR: "text", CHAR: "text", BOOLEAN: "bool", BOOL: "bool", TIMESTAMP: "timestamp" };

/** The type of an expression of a bound query. */
export function typeOf(e: Expr, b: Bound): Type {
  switch (e.kind) {
    case "number":
      return /^\d+$/.test(e.text) ? "int" : "float";
    case "string":
    case "typed-string":
      return "text";
    case "boolean":
      return "bool";
    case "null":
      return "null";
    case "name":
      return b.columns.get(e)?.type ?? "unknown";
    case "unary":
      return e.op === "NOT" ? "bool" : typeOf(e.arg, b);
    case "binary": {
      if (e.op === "AND" || e.op === "OR" || e.op === "=" || e.op === "<>" || e.op === "!=" || e.op === "<" || e.op === "<=" || e.op === ">" || e.op === ">=") return "bool";
      if (e.op === "||") return "text";
      const l = typeOf(e.left, b);
      const r = typeOf(e.right, b);
      if (l === "unknown" || r === "unknown") return "unknown";
      if (l === "timestamp" && r === "timestamp" && e.op === "-") return "int";
      if (l === "float" || r === "float") return "float";
      return l === "text" || r === "text" ? "unknown" : e.op === "/" ? "float" : "int";
    }
    case "is":
    case "between":
    case "in":
    case "in-query":
    case "like":
    case "exists":
      return "bool";
    case "call":
      return sigOf(b, e.name.parts.map((p) => p.name).join("."))?.result ?? "unknown";
    case "cast":
      return CAST_TYPES[e.type.name.toUpperCase()] ?? "unknown";
    case "case": {
      const ts = [...e.whens.map((w) => typeOf(w.result, b)), ...(e.otherwise === undefined ? [] : [typeOf(e.otherwise, b)])].filter((t) => t !== "null");
      const first = ts[0];
      return first !== undefined && ts.every((t) => t === first) ? first : "unknown";
    }
    default:
      return "unknown";
  }
}

/** Every use in a bound query that cannot be right: a comparison of text with a number, arithmetic on text, a function with the wrong number or types of arguments. */
export function check(b: Bound): readonly BindError[] {
  const out: BindError[] = [];
  const visit = (n: Node): void => {
    switch (n.kind) {
      case "scalar-query":
      case "exists":
        return;
      case "in-query":
        visit(n.arg);
        return;
      case "binary": {
        const l = typeOf(n.left, b);
        const r = typeOf(n.right, b);
        const cmp = n.op === "=" || n.op === "<>" || n.op === "!=" || n.op === "<" || n.op === "<=" || n.op === ">" || n.op === ">=";
        const arith = n.op === "+" || n.op === "-" || n.op === "*" || n.op === "/" || n.op === "%";
        if (cmp && !compatible(l, r)) out.push({ start: n.start, end: n.end, message: `${l} cannot be compared with ${r}` });
        if (arith && ((l === "text" && r !== "unknown") || (r === "text" && l !== "unknown") || l === "bool" || r === "bool")) out.push({ start: n.start, end: n.end, message: `arithmetic on ${l === "text" || l === "bool" ? l : r}` });
        break;
      }
      case "like": {
        const l = typeOf(n.arg, b);
        if (l !== "text" && l !== "unknown" && l !== "null") out.push({ start: n.start, end: n.end, message: `${n.op} needs text, and the left side is ${l}` });
        break;
      }
      case "call": {
        const name = n.name.parts.map((p) => p.name).join(".");
        const sig = sigOf(b, name);
        if (sig !== undefined) {
          const argc = n.args.length;
          if (argc < sig.minArgs || (sig.maxArgs !== undefined && argc > sig.maxArgs)) out.push({ start: n.start, end: n.end, message: `${sig.name} takes ${sig.maxArgs === sig.minArgs ? sig.minArgs : `${sig.minArgs} to ${sig.maxArgs ?? "any number of"}`} arguments, and ${argc} are given` });
          else if (sig.params !== undefined) {
            for (const [i, a] of n.args.entries()) {
              if (a.kind === "star" || a.kind === "named-arg" || a.kind === "keyword-arg" || a.kind === "lambda") continue;
              const want = sig.params[Math.min(i, sig.params.length - 1)];
              const got = typeOf(a, b);
              if (want !== undefined && !compatible(want, got)) out.push({ start: a.start, end: a.end, message: `${sig.name} takes ${want} as argument ${i + 1}, and ${got} is given` });
            }
          }
        }
        break;
      }
      default:
        break;
    }
    for (const c of children(n)) visit(c);
  };
  for (const i of b.select.items) visit(i.expr);
  if (b.select.where !== undefined) visit(b.select.where);
  for (const o of b.select.orderBy) visit(o.expr);
  return out;
}
