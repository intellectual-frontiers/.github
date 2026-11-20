// Spec: 0053-sql-typed FR-006
/**
 * Writing a query for a dialect (commons data 0053-sql-typed): the tree of expressions, selects and statements as SQL text, with the dialect's quoting and literals. Every value is a literal written by the
 * dialect (text is quoted and a quote in it doubled), so that a value cannot become SQL; a value a dialect cannot hold is an error that says so.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { type Dialect, qualified } from "@intellectual-frontiers/data/sql/physical";
import type { Node } from "./expr.ts";
import type { SelectAst } from "./select.ts";
import type { Table } from "./table.ts";

/** A query that cannot be written. */
export class TypedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypedError";
  }
}

/** What writing a query needs: the dialect, the common table expressions found so far, and the alias whose columns are written bare (the target of an update or delete). */
interface Ctx {
  readonly d: Dialect;
  readonly ctes: Map<string, string>;
  readonly bare?: string;
}

function literal(value: unknown, d: Dialect): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return d.literal(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypedError(`${value} is not a number a database holds`);
    return d.literal(value);
  }
  if (typeof value === "bigint") return d.literal(Number(value));
  if (value instanceof Date) return d.literal(value.toISOString());
  if (value instanceof Uint8Array) throw new TypedError("bytes are not written as a literal; no dialect of this library holds them the same way");
  if (Array.isArray(value)) return d.literal(`[${value.join(",")}]`);
  return d.literal(JSON.stringify(value));
}

/** An expression as SQL. */
export function expr(n: Node, c: Ctx): string {
  const d = c.d;
  switch (n.k) {
    case "col":
      return c.bare === n.alias ? d.quote(n.name) : `${d.quote(n.alias)}.${d.quote(n.name)}`;
    case "out":
      return d.quote(n.key);
    case "lit":
      return literal(n.value, d);
    case "bin":
      return `(${expr(n.l, c)} ${n.op} ${expr(n.r, c)})`;
    case "bool":
      return n.parts.length === 0 ? (n.op === "AND" ? "(1 = 1)" : "(1 = 0)") : `(${n.parts.map((p) => expr(p, c)).join(` ${n.op} `)})`;
    case "not":
      return `(NOT ${expr(n.e, c)})`;
    case "isnull":
      return `(${expr(n.e, c)} IS ${n.negated ? "NOT " : ""}NULL)`;
    case "in":
      return n.list.length === 0 ? (n.negated ? "(1 = 1)" : "(1 = 0)") : `(${expr(n.e, c)} ${n.negated ? "NOT " : ""}IN (${n.list.map((x) => expr(x, c)).join(", ")}))`;
    case "between":
      return `(${expr(n.e, c)} BETWEEN ${expr(n.low, c)} AND ${expr(n.high, c)})`;
    case "fn":
      return `${n.name}(${n.distinct === true ? "DISTINCT " : ""}${n.args.map((a) => expr(a, c)).join(", ")})`;
    case "star":
      return "*";
    case "case":
      return `(CASE ${n.whens.map(([w, t]) => `WHEN ${expr(w, c)} THEN ${expr(t, c)}`).join(" ")} ELSE ${expr(n.otherwise, c)} END)`;
    case "sub": {
      const inner = select(n.query as SelectAst, { d, ctes: c.ctes });
      if (n.form === "exists") return `EXISTS (${inner})`;
      if (n.form === "in") return `(${expr(n.e as Node, c)} ${n.negated === true ? "NOT " : ""}IN (${inner}))`;
      return `(${inner})`;
    }
    default:
      return absurd(n);
  }
}

function source(t: Table<unknown, unknown, string>, c: Ctx): string {
  const d = c.d;
  const s = t.source;
  switch (s.kind) {
    case "table":
      return `${qualified(d, s.schema, s.name)} AS ${d.quote(t.alias)}`;
    case "derived":
      return `(${select(s.query as SelectAst, { d, ctes: c.ctes })}) AS ${d.quote(t.alias)}`;
    case "cte":
      if (!c.ctes.has(s.name)) {
        c.ctes.set(s.name, "");
        c.ctes.set(s.name, select(s.query as SelectAst, { d, ctes: c.ctes }));
      }
      return `${d.quote(s.name)} AS ${d.quote(t.alias)}`;
    default:
      return absurd(s);
  }
}

function body(a: SelectAst, c: Ctx): string {
  const d = c.d;
  const parts = [`SELECT ${a.distinct ? "DISTINCT " : ""}${a.projection.map(([k, n]) => `${expr(n, c)} AS ${d.quote(k)}`).join(", ")}`, `FROM ${source(a.from, c)}`];
  for (const j of a.joins) parts.push(`${j.kind} JOIN ${source(j.table, c)}${j.on === undefined ? "" : ` ON ${expr(j.on, c)}`}`);
  if (a.where.length > 0) parts.push(`WHERE ${a.where.map((w) => expr(w, c)).join(" AND ")}`);
  if (a.groupBy.length > 0) parts.push(`GROUP BY ${a.groupBy.map((g) => expr(g, c)).join(", ")}`);
  if (a.having.length > 0) parts.push(`HAVING ${a.having.map((h) => expr(h, c)).join(" AND ")}`);
  return parts.join(" ");
}

function select(a: SelectAst, c: Ctx): string {
  const parts = [body(a, c)];
  for (const s of a.sets) parts.push(`${s.op} ${body(s.query, c)}`);
  if (a.orderBy.length > 0) parts.push(`ORDER BY ${a.orderBy.map((o) => `${expr(o.e.node, c)} ${o.dir}`).join(", ")}`);
  if (a.limit !== undefined) parts.push(`LIMIT ${a.limit}`);
  if (a.offset !== undefined) parts.push(`${a.limit === undefined ? "LIMIT -1 " : ""}OFFSET ${a.offset}`);
  return parts.join(" ");
}

/** The common table expressions of a statement, as its `WITH`. */
const withOf = (c: Ctx): string => (c.ctes.size === 0 ? "" : `WITH ${[...c.ctes].map(([n, q]) => `${c.d.quote(n)} AS (${q})`).join(", ")} `);

/** A select as SQL, with its common table expressions first. */
export function compileSelect(a: SelectAst, d: Dialect): string {
  const c: Ctx = { d, ctes: new Map() };
  const text = select(a, c);
  return `${withOf(c)}${text}`;
}

/** A statement written with the target's own columns bare, and the common table expressions that it asks for. */
export function compileWith(d: Dialect, alias: string, write: (c: Ctx) => string): string {
  const c: Ctx = { d, ctes: new Map(), bare: alias };
  const text = write(c);
  return `${withOf(c)}${text}`;
}

export { literal as literalOf, expr as exprOf };
export type { Ctx };

/**
 * How a row is read back: a bigint is a number, and so is what `count`, `sum` and `avg` give, which some drivers return as text (DuckDB's and PostgreSQL's wide integers and decimals), so that a row has the type
 * its expressions say.
 */
export function decoderOf(projection: readonly (readonly [string, Node])[]): (row: Readonly<Record<string, unknown>>) => Record<string, unknown> {
  const numeric = new Set(projection.filter(([, n]) => n.k === "fn" && (n.name === "count" || n.name === "sum" || n.name === "avg")).map(([k]) => k));
  return (row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : numeric.has(k) && typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v]),
    );
}
