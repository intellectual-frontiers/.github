/**
 * Typed indexes: an index names columns of its own table, its method is one the dialect has, and each thing it asks for (a condition,
 * covered columns, building without a lock) is a feature the dialect must have (commons 0009-sql-aide FR-018).
 *
 * @module
 */
import type { ReqOfColumns, Table, ValueIn } from "../algebra/table.ts";
import { fitName } from "../core/text.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Expr } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, sql, type Sql } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";

/** The index methods of PostgreSQL; an extension may add its own (`hnsw`). */
export type IndexMethod = "btree" | "hash" | "gin" | "gist" | "brin" | "spgist";

/** The bare columns of a table, for an index's condition or expressions. */
export type BareColumns<TN extends string, C> = { readonly [K in keyof C & string]: Expr<ValueIn<TN, C, K>> };

/** What an index says beyond its columns, as data. */
interface IndexSpec {
  readonly name?: string;
  readonly unique: boolean;
  readonly method?: string;
  readonly where?: AnySql;
  readonly include: readonly string[];
  readonly expressions: readonly AnySql[];
  readonly concurrently: boolean;
}

/**
 * An index: an entity defined after its table. Each method gives a new index that asks its dialect for one more thing, so that an index
 * a dialect cannot build does not render for it.
 */
export interface Index<TN extends string, C, Req extends string = never> {
  /** What kind of entity this is. */
  readonly entity: "index";
  /** The index's name as given, or the name made from its table and columns. */
  readonly name: string;
  /** The schema of its table. */
  readonly schema: string | undefined;
  /** The table it is on. */
  readonly table: EntityName;
  /** Its key columns. */
  readonly columns: readonly string[];
  /** Whether its values are unique. */
  readonly isUnique: boolean;
  /** Whether it is built without locking writes, and so outside a transaction. */
  readonly isConcurrent: boolean;
  /** The statement that defines it. */
  readonly ddl: Sql<"statement", unknown, Req>;
  /** The table it is on. */
  readonly dependsOn: () => readonly EntityName[];
  /** The name it has in a context: the name given, or the naming strategy's, fitted to the dialect. */
  readonly nameIn: (ctx: EmitContext) => string;
  /** The index is given a name of its own. */
  readonly named: (name: string) => Index<TN, C, Req>;
  /** The index's values are unique. */
  readonly unique: () => Index<TN, C, Req>;
  /** The index uses a method other than the dialect's own: the dialect, or an extension of it, must have the method. */
  readonly using: <M extends string>(method: M) => Index<TN, C, Exclude<Req, "index:btree"> | `index:${M}`>;
  /** Only the rows that pass a condition, written over the table's bare columns, are in the index. */
  readonly where: (condition: (c: BareColumns<TN, C>) => AnySql) => Index<TN, C, Req | "index:partial">;
  /** Columns kept in the index beside its keys, so that a query is answered from the index alone. */
  readonly include: (columns: readonly (keyof C & string)[]) => Index<TN, C, Req | "index:include">;
  /** Expressions over the table's bare columns, indexed after its key columns. */
  readonly expressions: (expressions: (c: BareColumns<TN, C>) => readonly AnySql[]) => Index<TN, C, Req | "index:expression">;
  /** The index is built without locking the table against writes; such a statement cannot run in a transaction. */
  readonly concurrently: () => Index<TN, C, Req | "index:concurrently">;
}

function build<TN extends string, C, Req extends string>(
  on: Table<TN, C, string>,
  columns: readonly string[],
  spec: IndexSpec,
): Index<TN, C, Req> {
  const table: EntityName = { name: on.name, schema: on.schema };
  // the bare columns are the table's own, by name: Object.fromEntries cannot say so
  const bare = Object.fromEntries(
    on.spec.columns.map(([n]) => [n, sql("expression", (ctx) => [{ kind: "name", parts: [ctx.naming.column(n)] }])]),
  ) as BareColumns<TN, C>;
  const nameIn = (ctx: EmitContext): string =>
    fitName(spec.name ?? ctx.naming.index(on.name, columns, spec.unique), ctx.dialect.maxNameLength);
  const ddl = (ctx: EmitContext): Chunk[] => {
    const col = (n: string): Chunk => ({ kind: "name", parts: [ctx.naming.column(n)] });
    const keys: Chunk[][] = columns.map((n) => [col(n)]);
    for (const e of spec.expressions) keys.push([chunkText("("), chunkOf(e), chunkText(")")]);
    const out: Chunk[] = [
      chunkText(`CREATE ${spec.unique ? "UNIQUE " : ""}INDEX ${spec.concurrently ? "CONCURRENTLY " : ""}IF NOT EXISTS `),
      { kind: "name", parts: [nameIn(ctx)] },
      chunkText(" ON "),
      { kind: "name", parts: ctx.naming.table(on.name, on.schema) },
    ];
    if (spec.method !== undefined && spec.method !== "btree") out.push(chunkText(` USING ${spec.method}`));
    out.push(chunkText(" ("), ...keys.flatMap((k, i) => (i === 0 ? k : [chunkText(", "), ...k])), chunkText(")"));
    if (spec.include.length > 0)
      out.push(
        chunkText(" INCLUDE ("),
        ...spec.include.flatMap((n, i) => (i === 0 ? [col(n)] : [chunkText(", "), col(n)])),
        chunkText(")"),
      );
    if (spec.where !== undefined) out.push(chunkText(" WHERE "), chunkOf(spec.where));
    out.push(chunkText(";"));
    return out;
  };
  return {
    entity: "index",
    name: spec.name ?? `${on.name}_${columns.join("_")}_${spec.unique ? "uidx" : "idx"}`,
    schema: on.schema,
    table,
    columns,
    isUnique: spec.unique,
    isConcurrent: spec.concurrently,
    ddl: sql("statement", ddl),
    dependsOn: () => [table],
    nameIn,
    named: (name) => build(on, columns, { ...spec, name }),
    unique: () => build(on, columns, { ...spec, unique: true }),
    using: (method) => build(on, columns, { ...spec, method }),
    where: (condition) => build(on, columns, { ...spec, where: condition(bare) }),
    include: (include) => build(on, columns, { ...spec, include }),
    expressions: (expressions) => build(on, columns, { ...spec, expressions: expressions(bare) }),
    concurrently: () => build(on, columns, { ...spec, concurrently: true }),
  };
}

/**
 * Makes an index on a table, with the dialect's own method.
 *
 * @param on - the table
 * @param columns - its key columns, each a column of that table: another name does not compile
 * @example
 * const byFamily = index(person, ["family_name", "given_name"]);
 * const live = index(party, ["display_name"]).unique().where((c) => isNull(c.deleted_at));
 * const words = index(book, []).using("gin").expressions((c) => [call("to_tsvector", bind("simple"), c.title)]);
 */
export function index<TN extends string, C, TReq extends string, const K extends readonly (keyof C & string)[]>(
  on: Table<TN, C, TReq>,
  columns: K,
): Index<TN, C, "index:btree" | TReq | ReqOfColumns<C>> {
  return build(on, columns, { unique: false, include: [], expressions: [], concurrently: false });
}
