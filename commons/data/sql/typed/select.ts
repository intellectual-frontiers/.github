// Spec: 0053-sql-typed FR-004, FR-005
/**
 * The typed query builder (commons data 0053-sql-typed): `from(table)` and joins build a scope of typed columns, keyed by the names of the tables in the query; a join gives its table's columns as they are, or
 * nullable where an outer join may leave them out; `select` names what is wanted and gives the type of a row; the clauses (where, group by, having, order by, limit, offset, distinct), set operations,
 * subqueries and common table expressions follow. A query is data; `toSql` writes it for a dialect and `run` runs it through a driver.
 *
 * @example
 * ```ts
 * const q = from(author)
 *   .leftJoin(book, (s) => eq(s.book.authorId, s.author.id))
 *   .where((s) => like(s.author.name, "A%"))
 *   .groupBy((s) => [s.author.id, s.author.name])
 *   .select((s) => ({ id: s.author.id, name: s.author.name, books: countOf(s.book.id) }))
 *   .orderBy((_, o) => [desc(o.books)]);
 * // rows: { id: number; name: string; books: number }[]
 * ```
 *
 * @module
 */
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { compileSelect, decoderOf, TypedError } from "./compile.ts";
import { and, type Expr, type Node, type Order, outOf, subNode, type ValueOf } from "./expr.ts";
import { type Columns, derivedTable, type NullableColumns, type Table } from "./table.ts";

/** What a select names: a key for each column of the row, and the expression that gives it. */
export type Projection = { readonly [key: string]: Expr<unknown> };
/** The row a projection gives. */
export type RowOfProjection<P extends Projection> = { [K in keyof P]: ValueOf<P[K]> };

/** The columns that are in scope: the columns of each table of the query, by its name. */
export type Scope = { readonly [alias: string]: { readonly [key: string]: Expr<unknown> } };
type NullAll<S extends Scope> = { readonly [A in keyof S]: { readonly [K in keyof S[A]]: S[A][K] extends Expr<infer T> ? Expr<T | null> : never } };

/** A join. */
export interface JoinAst {
  readonly kind: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";
  readonly table: Table<unknown, unknown, string>;
  readonly on?: Node;
}
/** What a select is, as data. */
export interface SelectAst {
  readonly from: Table<unknown, unknown, string>;
  readonly joins: readonly JoinAst[];
  readonly where: readonly Node[];
  readonly groupBy: readonly Node[];
  readonly having: readonly Node[];
  readonly projection: readonly (readonly [string, Node])[];
  readonly distinct: boolean;
  readonly orderBy: readonly Order[];
  readonly limit?: number;
  readonly offset?: number;
  readonly sets: readonly { readonly op: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT"; readonly query: SelectAst }[];
}

const asTable = (t: Table<never, never, string>): Table<unknown, unknown, string> => t as unknown as Table<unknown, unknown, string>;
const scopeOf = (t: Table<never, never, string>): Record<string, unknown> => ({ [t.alias]: t.c });

/** Where a query is run: a driver and the dialect it is written for. */
export interface Runner {
  readonly driver: Driver;
  readonly dialect: Dialect;
}

/** A query that has a table and may have joins and conditions, and has not yet said what it wants. */
export class From<S extends Scope> {
  private readonly ast: Omit<SelectAst, "projection" | "distinct" | "orderBy" | "sets">;
  private readonly scope: S;
  constructor(ast: Omit<SelectAst, "projection" | "distinct" | "orderBy" | "sets">, scope: S) {
    this.ast = ast;
    this.scope = scope;
}

  private join<N extends string, R, I, Out extends Scope>(kind: JoinAst["kind"], table: Table<R, I, N>, on: ((s: never) => Expr<boolean>) | undefined, widen: Record<string, unknown>): From<Out> {
    if (table.alias in this.scope) throw new TypedError(`the name ${table.alias} is used twice in the query: give one of the tables another with \`.as(...)\``);
    const scope = { ...(kind === "RIGHT" || kind === "FULL" ? nullAllOf(this.scope) : this.scope), ...widen } as unknown as Out;
    const joined: JoinAst = { kind, table: asTable(table as never), ...(on === undefined ? {} : { on: on(scope as never).node }) };
    return new From<Out>({ ...this.ast, joins: [...this.ast.joins, joined] }, scope);
  }
  /** `INNER JOIN`: the rows that have a partner. */
  innerJoin<N extends string, R, I>(table: Table<R, I, N extends keyof S ? never : N>, on: (s: S & { readonly [A in N]: Columns<R> }) => Expr<boolean>): From<S & { readonly [A in N]: Columns<R> }> {
    return this.join("INNER", table as never, on as never, scopeOf(table as never));
  }
  /** `LEFT JOIN`: every row, and the columns of the table are null where there is no partner. */
  leftJoin<N extends string, R, I>(table: Table<R, I, N extends keyof S ? never : N>, on: (s: S & { readonly [A in N]: Columns<R> }) => Expr<boolean>): From<S & { readonly [A in N]: NullableColumns<R> }> {
    return this.join("LEFT", table as never, on as never, { [table.alias]: nullOf((table as unknown as { c: Record<string, unknown> }).c) });
  }
  /** `RIGHT JOIN`: every row of the table, and the columns of the tables before are null where there is no partner. */
  rightJoin<N extends string, R, I>(table: Table<R, I, N extends keyof S ? never : N>, on: (s: S & { readonly [A in N]: Columns<R> }) => Expr<boolean>): From<NullAll<S> & { readonly [A in N]: Columns<R> }> {
    return this.join("RIGHT", table as never, on as never, scopeOf(table as never));
  }
  /** `FULL JOIN`: every row of both; the columns of either are null where there is no partner. */
  fullJoin<N extends string, R, I>(table: Table<R, I, N extends keyof S ? never : N>, on: (s: S & { readonly [A in N]: Columns<R> }) => Expr<boolean>): From<NullAll<S> & { readonly [A in N]: NullableColumns<R> }> {
    return this.join("FULL", table as never, on as never, { [table.alias]: nullOf((table as unknown as { c: Record<string, unknown> }).c) });
  }
  /** `CROSS JOIN`: every row with every row. */
  crossJoin<N extends string, R, I>(table: Table<R, I, N extends keyof S ? never : N>): From<S & { readonly [A in N]: Columns<R> }> {
    return this.join("CROSS", table as never, undefined, scopeOf(table as never));
  }
  /** A condition on the rows; more than one is all of them. */
  where(condition: (s: S) => Expr<boolean>): From<S> {
    return new From({ ...this.ast, where: [...this.ast.where, condition(this.scope).node] }, this.scope);
  }
  /** What the rows are grouped by. */
  groupBy(keys: (s: S) => readonly Expr<unknown>[]): From<S> {
    return new From({ ...this.ast, groupBy: [...this.ast.groupBy, ...keys(this.scope).map((k) => k.node)] }, this.scope);
  }
  /** A condition on the groups. */
  having(condition: (s: S) => Expr<boolean>): From<S> {
    return new From({ ...this.ast, having: [...this.ast.having, condition(this.scope).node] }, this.scope);
  }
  /** What is wanted: a key and an expression for each column of the row. */
  select<P extends Projection>(projection: (s: S) => P): Select<S, RowOfProjection<P>> {
    const p = projection(this.scope);
    const keys = Object.keys(p);
    if (keys.length === 0) throw new TypedError("a select names at least one column");
    return new Select<S, RowOfProjection<P>>({ ...this.ast, projection: keys.map((k) => [k, (p[k] as Expr<unknown>).node] as const), distinct: false, orderBy: [], sets: [] }, this.scope, keys);
  }
}

const nullOf = (c: Record<string, unknown>): Record<string, unknown> => c;
const nullAllOf = (s: Scope): Scope => s;

/** A query that says what it wants; `Row` is the type of a row it gives. */
export class Select<S extends Scope, Row> {
  /** The type of a row, for the type checker only. */
  declare readonly row?: Row;
  readonly ast: SelectAst;
  private readonly scope: S;
  private readonly keys: readonly string[];
  constructor(ast: SelectAst, scope: S, keys: readonly string[]) {
    this.ast = ast;
    this.scope = scope;
    this.keys = keys;
}

  /** `SELECT DISTINCT`. */
  distinct(): Select<S, Row> {
    return new Select({ ...this.ast, distinct: true }, this.scope, this.keys);
  }
  /** The order: terms made of the columns in scope or of the columns of the row, by their keys. */
  orderBy(order: (s: S, out: { readonly [K in keyof Row & string]: Expr<Row[K]> }) => readonly Order[]): Select<S, Row> {
    const out = Object.fromEntries(this.keys.map((k) => [k, outOf<unknown>(k)])) as { readonly [K in keyof Row & string]: Expr<Row[K]> };
    return new Select({ ...this.ast, orderBy: [...this.ast.orderBy, ...order(this.scope, out)] }, this.scope, this.keys);
  }
  /** At most this many rows. */
  limit(n: number): Select<S, Row> {
    if (!Number.isInteger(n) || n < 0) throw new TypedError(`limit ${n} is not a count`);
    return new Select({ ...this.ast, limit: n }, this.scope, this.keys);
  }
  /** Skip this many rows. */
  offset(n: number): Select<S, Row> {
    if (!Number.isInteger(n) || n < 0) throw new TypedError(`offset ${n} is not a count`);
    return new Select({ ...this.ast, offset: n }, this.scope, this.keys);
  }
  private set(op: SelectAst["sets"][number]["op"], other: Select<Scope, Row>): Select<S, Row> {
    return new Select({ ...this.ast, sets: [...this.ast.sets, { op, query: other.ast }] }, this.scope, this.keys);
  }
  /** The rows of both, without repeats; the other must give the same row. */
  union(other: Select<Scope, Row>): Select<S, Row> {
    return this.set("UNION", other);
  }
  /** The rows of both, with repeats. */
  unionAll(other: Select<Scope, Row>): Select<S, Row> {
    return this.set("UNION ALL", other);
  }
  /** The rows that are in both. */
  intersect(other: Select<Scope, Row>): Select<S, Row> {
    return this.set("INTERSECT", other);
  }
  /** The rows of this that are not in the other. */
  except(other: Select<Scope, Row>): Select<S, Row> {
    return this.set("EXCEPT", other);
  }
  /** The SQL for a dialect, or why it cannot be written (a value the dialect cannot hold). */
  toSql(dialect: Dialect): Result<string, TypedError> {
    try {
      return ok(compileSelect(this.ast, dialect));
    } catch (thrown) {
      if (thrown instanceof TypedError) return err(thrown);
      throw thrown;
    }
  }
  /** Runs it and gives the rows, as the driver gives them with a bigint made a number. */
  async run(on: Runner): Promise<readonly Row[]> {
    const sql = this.toSql(on.dialect);
    if (sql.kind === "err") throw sql.error;
    const read = decoderOf(this.ast.projection);
    return (await on.driver.query(sql.value)).map((r) => read(r) as Row);
  }
  /** At most one row: the first, or none. */
  async first(on: Runner): Promise<Row | undefined> {
    return (await this.limit(1).run(on))[0];
  }
  /** As a table that a query may read from, under a name: `FROM (select) AS name`. */
  asTable<N extends string>(alias: N): Table<Row, never, N> {
    return derivedTable<Row, N>(alias, this.ast, this.keys as never);
  }
  /** As a common table expression: `WITH name AS (select)`, which the query that uses it begins with. */
  asCte<N extends string>(name: N): Table<Row, never, N> {
    return derivedTable<Row, N>(name, this.ast, this.keys as never, "cte");
  }
  /** As a value, for a query whose select has one column and gives one row: `(select)`. */
  asValue(): Expr<Row[keyof Row] | null> {
    return subNode({ k: "sub", query: this.ast, form: "scalar" });
  }
  /** `EXISTS (select)`. */
  exists(): Expr<boolean> {
    return subNode({ k: "sub", query: this.ast, form: "exists" });
  }
  /** `a IN (select)`, for a select of one column of the type of `a`. */
  contains<T>(a: Expr<T>): Expr<boolean> {
    return subNode({ k: "sub", query: this.ast, form: "in", e: a.node });
  }
  /** `a NOT IN (select)`. */
  excludes<T>(a: Expr<T>): Expr<boolean> {
    return subNode({ k: "sub", query: this.ast, form: "in", e: a.node, negated: true });
  }
}

/** Starts a query from a table. */
export function from<R, I, N extends string>(table: Table<R, I, N>): From<{ readonly [A in N]: Columns<R> }> {
  return new From({ from: asTable(table as never), joins: [], where: [], groupBy: [], having: [] }, { [table.alias]: table.c } as never);
}

/** The condition that a row of a table is the one with a key: every column of the key equals its value. */
export function keyIs<R, I, N extends string>(table: Table<R, I, N>, key: { readonly [K in keyof R & string]?: R[K] }): Expr<boolean> {
  const parts = table.primaryKey.map((k) => {
    const v = (key as Record<string, unknown>)[k];
    if (v === undefined || v === null) throw new TypedError(`the key of ${table.alias} needs a value for ${k}`);
    return subNode<boolean>({ k: "bin", op: "=", l: (table.c as Record<string, Expr<unknown>>)[k]!.node, r: { k: "lit", value: v } });
  });
  if (parts.length === 0) throw new TypedError(`${table.alias} has no primary key`);
  return and(...parts);
}
