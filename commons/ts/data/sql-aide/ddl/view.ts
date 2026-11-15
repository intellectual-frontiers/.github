/**
 * Views with typed columns: the columns are declared as a table's are, so that a view's rows are typed and what uses the view is checked
 * like what uses a table (commons 0006-sql-aide FR-017, FR-022).
 *
 * @module
 */
import type { ColumnSpec, ReqOfColumn } from "../algebra/column.ts";
import type { ColumnMap, ColumnRef, SelectRow, ValueIn } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Expr } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, type DxOf, renderUnchecked, type ReqOf, sql, type Sql } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";

/** What a view says beyond its columns and its query. */
export interface ViewOptions {
  /** The schema it lives in, where the dialect has schemas. */
  readonly schema?: string;
  /** Its description, for a view a function makes: a view a person writes takes it from its TSDoc comment. */
  readonly doc?: string;
  /** The entities its query reads, so that it is defined after them. */
  readonly from?: readonly EntityName[];
  /** Whether the view keeps its rows and is refreshed when asked: a dialect needs `materialized-views` for it. */
  readonly materialized?: boolean;
}

/** The columns of a view as expressions, by name. */
export type ViewRefs<VN extends string, C> = { readonly [K in keyof C & string]: ColumnRef<VN, K, ValueIn<VN, C, K>, ReqOfColumn<C[K]>> };

/** A view: used in SQL it is a reference to itself; `ddl` is its definition. */
export interface View<VN extends string, C, Req extends string = never, Dx extends string = string> extends Sql<
  "relation",
  SelectRow<VN, C>,
  Req,
  Dx
> {
  /** What kind of entity this is. */
  readonly entity: "view";
  /** The view's name. */
  readonly name: VN;
  /** The schema it lives in. */
  readonly schema: string | undefined;
  /** Its columns, in the order declared. */
  readonly columns: readonly (readonly [name: string, spec: ColumnSpec])[];
  /** Whether it keeps its rows. */
  readonly materialized: boolean;
  /** Its columns as expressions. */
  readonly c: ViewRefs<VN, C>;
  /** The statement that defines it. */
  readonly ddl: Sql<"statement", unknown, Req, Dx>;
  /** The entities its query reads. */
  readonly dependsOn: () => readonly EntityName[];
}

function isColumn(c: ColumnMap[string]): c is Exclude<ColumnMap[string], { readonly self: string }> {
  return !("self" in c);
}

/**
 * Makes a view whose columns are declared.
 *
 * @param name - the view's name
 * @param columns - the columns its query gives, in order, as a table's columns are written
 * @param query - the query, without `CREATE VIEW`
 * @param options - its schema, what it reads, and whether it is materialized
 * @example
 * const adults = view("adult", { party_id: text(), family_name: text() }, SQL`select party_id, family_name from ${person}`, { from: [person] });
 */
export function view<const VN extends string, const C extends ColumnMap, Q extends AnySql, const O extends ViewOptions = ViewOptions>(
  name: VN,
  columns: C,
  query: Q,
  options?: O,
): View<VN, C, ReqOf<Q> | (O extends { readonly materialized: true } ? "materialized-views" : "views"), DxOf<Q>> {
  type Req = ReqOf<Q> | (O extends { readonly materialized: true } ? "materialized-views" : "views");
  const schema = options?.schema;
  const materialized = options?.materialized === true;
  const specs = Object.entries(columns).flatMap(([n, c]) => (isColumn(c) ? [[n, c.spec] as const] : []));
  const owner = (): EntityName => ({ name, schema });
  const refOf = <T, R extends string>(columnName: string, spec: ColumnSpec): ColumnRef<VN, string, T, R> => {
    const bare: Expr<T, R> = sql("expression", (ctx) => [{ kind: "name", parts: [ctx.naming.column(columnName)] }]);
    return {
      sqlKind: "expression",
      chunks: (ctx) => [{ kind: "name", parts: [...ctx.naming.table(name, schema), ctx.naming.column(columnName)] }],
      table: name,
      column: columnName,
      spec,
      owner,
      bare,
    };
  };
  const ddl = (ctx: EmitContext): Chunk[] => {
    const d = ctx.dialect;
    const self: Chunk = { kind: "name", parts: ctx.naming.table(name, schema) };
    const list = specs.flatMap(([n], i): Chunk[] => {
      const c: Chunk = { kind: "name", parts: [ctx.naming.column(n)] };
      return i === 0 ? [c] : [chunkText(", "), c];
    });
    const out: Chunk[] = [];
    if (materialized) out.push(chunkText("CREATE MATERIALIZED VIEW IF NOT EXISTS "), self);
    else if (d.replacesViews) out.push(chunkText("CREATE OR REPLACE VIEW "), self);
    else out.push(chunkText("DROP VIEW IF EXISTS "), self, chunkText(";\nCREATE VIEW "), self);
    out.push(chunkText(" ("), ...list, chunkText(") AS\n"), chunkOf(query), chunkText(";"));
    const doc = options?.doc ?? ctx.docs.get(made)?.summary;
    const qualified = renderUnchecked(
      sql("identifier", () => [self]),
      ctx,
    );
    const comment = doc === undefined || materialized ? undefined : d.comment("view", qualified, doc);
    if (comment !== undefined) out.push(chunkText(`\n${comment};`));
    return out;
  };
  const made: View<VN, C, Req, DxOf<Q>> = {
    sqlKind: "relation",
    chunks: (ctx) => [{ kind: "name", parts: ctx.naming.table(name, schema) }],
    entity: "view",
    name,
    schema,
    columns: specs,
    materialized,
    // as in `table`: the keys are the keys of `columns`, which Object.fromEntries cannot say
    c: Object.fromEntries(specs.map(([n, s]) => [n, refOf(n, s)])) as ViewRefs<VN, C>,
    ddl: sql("statement", ddl),
    dependsOn: () => options?.from ?? [],
  };
  return made;
}
