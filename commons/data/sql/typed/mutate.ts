// Spec: 0053-sql-typed FR-007
/**
 * Typed statements (commons data 0053-sql-typed): `insertInto`, `update` and `deleteFrom`. An insert takes the rows of the table's insert type (what the database fills may be left out; an unknown key or a value
 * of another type does not compile), with `onConflictDoNothing` and `onConflictDoUpdate`; an update takes a partial row whose values are values or expressions; neither an update nor a delete can be run until it
 * says `where(...)` or `all()`, so that a missing condition is not a table emptied. `returning` gives the rows it changed, typed as a select's.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { compileWith, exprOf, literalOf, selectOf, TypedError } from "./compile.ts";
import { type Expr, type Node, nodeOf, subNode } from "./expr.ts";
import type { Projection, RowOfProjection, Runner, Scope, Select, SelectAst } from "./select.ts";
import type { Column, Columns, Table } from "./table.ts";

type Any = Table<unknown, unknown, string>;
const target = (t: Any, d: Dialect): string => {
  if (t.source.kind !== "table") throw new TypedError(`${t.alias} is a query and not a table: nothing can be written to it`);
  return d.quote(t.source.name).replace(/^/, t.source.schema === undefined ? "" : `${d.quote(t.source.schema)}.`);
};
const sqlName = (t: Any, key: string): string => {
  const n = (t.sqlNames as Record<string, string>)[key];
  if (n === undefined) throw new TypedError(`${t.alias} has no column ${key}`);
  return n;
};

/** What a statement that changes rows may give back. */
class Returning<R, I, N extends string, Row> {
  protected readonly table: Table<R, I, N>;
  protected readonly projection: readonly (readonly [string, Node])[] | undefined;
  constructor(table: Table<R, I, N>, projection: readonly (readonly [string, Node])[] | undefined) {
    this.table = table;
    this.projection = projection;
  }
  protected tail(c: Parameters<Parameters<typeof compileWith>[2]>[0]): string {
    return this.projection === undefined ? "" : ` RETURNING ${this.projection.map(([k, n]) => `${exprOf(n, c)} AS ${c.d.quote(k)}`).join(", ")}`;
  }
  protected project<P extends Projection>(f: (c: Columns<R>) => P): readonly (readonly [string, Node])[] {
    const p = f(this.table.c);
    return Object.keys(p).map((k) => [k, (p[k] as Expr<unknown>).node] as const);
  }
  declare readonly rowType?: Row;
}

/** A statement that is written and run. */
export interface Statement<Row> {
  toSql(dialect: Dialect): Result<string, TypedError>;
  /** Runs it; the rows it gives back are those of `returning`, none where there was none. */
  run(on: Runner): Promise<readonly Row[]>;
}

function wrap<Row>(write: (d: Dialect) => string): Statement<Row> {
  const toSql = (d: Dialect): Result<string, TypedError> => {
    try {
      return ok(write(d));
    } catch (thrown) {
      if (thrown instanceof TypedError) return err(thrown);
      throw thrown;
    }
  };
  return {
    toSql,
    async run(on) {
      const sql = toSql(on.dialect);
      if (sql.kind === "err") throw sql.error;
      if (!/ RETURNING /.test(sql.value)) {
        await on.driver.exec(sql.value);
        return [];
      }
      return (await on.driver.query(sql.value)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])) as Row);
    },
  };
}

/** An insert. */
export class Insert<R, I, N extends string, Row = never> extends Returning<R, I, N, Row> {
  /** Where the rows come from, where they are those of a select. */
  private readonly query: { readonly keys: readonly string[]; readonly ast: SelectAst } | undefined;
  private readonly rows: readonly I[];
  private readonly conflict: { readonly target: readonly string[]; readonly set?: Readonly<Record<string, unknown>> } | undefined;
  constructor(table: Table<R, I, N>, rows: readonly I[], conflict: { readonly target: readonly string[]; readonly set?: Readonly<Record<string, unknown>> } | undefined, projection?: readonly (readonly [string, Node])[], query?: { readonly keys: readonly string[]; readonly ast: SelectAst }) {
    super(table, projection);
    this.rows = rows;
    this.conflict = conflict;
    this.query = query;
  }
  /** Where a row's key is already there, leave it. With the keys of a unique constraint or key; none is any. */
  onConflictDoNothing(...keys: readonly (keyof R & string)[]): Insert<R, I, N, Row> {
    return new Insert(this.table, this.rows, { target: keys }, this.projection, this.query);
  }
  /** Where a row's key is already there, change the row: each key of `set` to a value or an expression of the table's columns. */
  onConflictDoUpdate(keys: readonly [keyof R & string, ...(keyof R & string)[]], set: { readonly [K in keyof R & string]?: R[K] | Expr<R[K]> }): Insert<R, I, N, Row> {
    return new Insert(this.table, this.rows, { target: keys, set }, this.projection, this.query);
  }
  /** What to give back of each row inserted. */
  returning<P extends Projection>(f: (c: Columns<R>) => P): Insert<R, I, N, RowOfProjection<P>> & Statement<RowOfProjection<P>> {
    return withStatement(new Insert<R, I, N, RowOfProjection<P>>(this.table, this.rows, this.conflict, this.project(f), this.query));
  }
  toSql(d: Dialect): Result<string, TypedError> {
    return wrap<Row>((dd) => this.write(dd)).toSql(d);
  }
  run(on: Runner): Promise<readonly Row[]> {
    return wrap<Row>((dd) => this.write(dd)).run(on);
  }
  private write(d: Dialect): string {
    const t = this.table as unknown as Any;
    const first = this.rows[0] as Record<string, unknown> | undefined;
    if (first === undefined && this.query === undefined) throw new TypedError("an insert has at least one row");
    const keys = this.query !== undefined ? [...this.query.keys] : Object.keys(first ?? {}).filter((k) => (first ?? {})[k] !== undefined);
    if (keys.length === 0) throw new TypedError("a row has at least one value (a table whose columns all have defaults is filled with DEFAULT VALUES, which dialects do not share)");
    const values = (this.query !== undefined ? [] : this.rows).map((row, i) => {
      const r = row as Record<string, unknown>;
      const own = Object.keys(r).filter((k) => r[k] !== undefined);
      if (own.length !== keys.length || own.some((k) => !keys.includes(k))) throw new TypedError(`row ${i + 1} has other columns than the first: rows of one insert have the same columns (insert the others apart)`);
      return `(${keys.map((k) => literalOf(r[k], d)).join(", ")})`;
    });
    return compileWith(d, t.alias, (c) => {
      const head = `INSERT INTO ${target(t, d)} (${keys.map((k) => d.quote(sqlName(t, k))).join(", ")})`;
      let sql = this.query !== undefined ? `${head} ${selectOf(this.query.ast, { d, ctes: c.ctes })}` : `${head} VALUES ${values.join(", ")}`;
      if (this.conflict !== undefined) {
        sql += ` ON CONFLICT${this.conflict.target.length === 0 ? "" : ` (${this.conflict.target.map((k) => d.quote(sqlName(t, k))).join(", ")})`}`;
        if (this.conflict.set === undefined) sql += " DO NOTHING";
        else {
          const set = Object.entries(this.conflict.set).filter(([, v]) => v !== undefined);
          if (set.length === 0) throw new TypedError("onConflictDoUpdate sets at least one column");
          sql += ` DO UPDATE SET ${set.map(([k, v]) => `${d.quote(sqlName(t, k))} = ${exprOf(nodeOf(v), c)}`).join(", ")}`;
        }
      }
      return sql + this.tail(c);
    });
  }
}

/** An update that has its values and not yet its condition. */
export class PendingUpdate<R, I, N extends string> {
  private readonly table: Table<R, I, N>;
  private readonly values: Readonly<Record<string, unknown>>;
  constructor(table: Table<R, I, N>, values: Readonly<Record<string, unknown>>) {
    this.table = table;
    this.values = values;
  }
  /** The rows to change. */
  where(condition: (c: Columns<R>) => Expr<boolean>): Update<R, I, N> {
    return new Update(this.table, this.values, condition(this.table.c).node);
  }
  /** Every row of the table: said on purpose. */
  all(): Update<R, I, N> {
    return new Update(this.table, this.values, undefined);
  }
}

/** An update that can be written and run. */
export class Update<R, I, N extends string, Row = never> extends Returning<R, I, N, Row> {
  private readonly values: Readonly<Record<string, unknown>>;
  private readonly condition: Node | undefined;
  constructor(table: Table<R, I, N>, values: Readonly<Record<string, unknown>>, condition: Node | undefined, projection?: readonly (readonly [string, Node])[]) {
    super(table, projection);
    this.values = values;
    this.condition = condition;
  }
  returning<P extends Projection>(f: (c: Columns<R>) => P): Update<R, I, N, RowOfProjection<P>> & Statement<RowOfProjection<P>> {
    return withStatement(new Update<R, I, N, RowOfProjection<P>>(this.table, this.values, this.condition, this.project(f)));
  }
  toSql(d: Dialect): Result<string, TypedError> {
    return wrap<Row>((dd) => this.write(dd)).toSql(d);
  }
  run(on: Runner): Promise<readonly Row[]> {
    return wrap<Row>((dd) => this.write(dd)).run(on);
  }
  private write(d: Dialect): string {
    const t = this.table as unknown as Any;
    const set = Object.entries(this.values).filter(([, v]) => v !== undefined);
    if (set.length === 0) throw new TypedError("an update sets at least one column");
    return compileWith(d, t.alias, (c) => `UPDATE ${target(t, d)} SET ${set.map(([k, v]) => `${d.quote(sqlName(t, k))} = ${exprOf(nodeOf(v), c)}`).join(", ")}${this.condition === undefined ? "" : ` WHERE ${exprOf(this.condition, c)}`}${this.tail(c)}`);
  }
}

/** A delete that has not yet its condition. */
export class PendingDelete<R, I, N extends string> {
  private readonly table: Table<R, I, N>;
  constructor(table: Table<R, I, N>) {
    this.table = table;
  }
  /** The rows to delete. */
  where(condition: (c: Columns<R>) => Expr<boolean>): Delete<R, I, N> {
    return new Delete(this.table, condition(this.table.c).node);
  }
  /** Every row of the table: said on purpose. */
  all(): Delete<R, I, N> {
    return new Delete(this.table, undefined);
  }
}

/** A delete that can be written and run. */
export class Delete<R, I, N extends string, Row = never> extends Returning<R, I, N, Row> {
  private readonly condition: Node | undefined;
  constructor(table: Table<R, I, N>, condition: Node | undefined, projection?: readonly (readonly [string, Node])[]) {
    super(table, projection);
    this.condition = condition;
  }
  returning<P extends Projection>(f: (c: Columns<R>) => P): Delete<R, I, N, RowOfProjection<P>> & Statement<RowOfProjection<P>> {
    return withStatement(new Delete<R, I, N, RowOfProjection<P>>(this.table, this.condition, this.project(f)));
  }
  toSql(d: Dialect): Result<string, TypedError> {
    return wrap<Row>((dd) => this.write(dd)).toSql(d);
  }
  run(on: Runner): Promise<readonly Row[]> {
    return wrap<Row>((dd) => this.write(dd)).run(on);
  }
  private write(d: Dialect): string {
    const t = this.table as unknown as Any;
    return compileWith(d, t.alias, (c) => `DELETE FROM ${target(t, d)}${this.condition === undefined ? "" : ` WHERE ${exprOf(this.condition, c)}`}${this.tail(c)}`);
  }
}

/** The value that an insert proposed for a column, in `onConflictDoUpdate` (`excluded`). */
export const excluded = <T>(column: Column<T>): Expr<T> => subNode<T>({ k: "col", alias: "excluded", name: column.name });

const withStatement = <T>(s: T): T => s;

/** `INSERT INTO`: at least one row, of the table's insert type. */
export const insertInto = <R, I, N extends string>(table: Table<R, I, N>) => ({
  /** The rows of a select, whose keys are keys of the table: `INSERT INTO t (keys) SELECT ...`. A select that is followed by an upsert is given a condition (SQLite reads `ON CONFLICT` after a bare select as part of it). */
  select: <K extends keyof R & string>(keys: readonly [K, ...K[]], query: Select<Scope, { readonly [P in K]: R[P] }>): Insert<R, I, N> => new Insert(table, [], undefined, undefined, { keys, ast: query.ast }),
  values: (rows: I | readonly [I, ...I[]]): Insert<R, I, N> => new Insert(table, Array.isArray(rows) ? (rows as readonly I[]) : [rows as I], undefined),
});
/** `UPDATE`: the values of the columns to change, which are values or expressions of the table's columns. */
export const update = <R, I, N extends string>(table: Table<R, I, N>) => ({
  set: (values: { readonly [K in keyof R & string]?: R[K] | Expr<R[K]> } | ((c: Columns<R>) => { readonly [K in keyof R & string]?: R[K] | Expr<R[K]> })): PendingUpdate<R, I, N> =>
    new PendingUpdate(table, (typeof values === "function" ? values(table.c) : values) as Readonly<Record<string, unknown>>),
});
/** `DELETE FROM`. */
export const deleteFrom = <R, I, N extends string>(table: Table<R, I, N>): PendingDelete<R, I, N> => new PendingDelete(table);
