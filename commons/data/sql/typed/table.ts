// Spec: 0053-sql-typed FR-003
/**
 * Typed tables (commons data 0053-sql-typed): a table is a value with the types of its rows (`R`, what a select gives), of what an insert takes (`I`, where what the database fills may be left out) and the
 * name by which it is known in a query (`N`), and with a typed column for each of its keys. The keys are the names a program writes (camel case); the names in SQL are written as the table says.
 * A table is made by hand with `defineTable` or by the generator of this unit from a model, with the types a model says.
 *
 * @module
 */
import { type Expr, subNode } from "./expr.ts";

/** A column of a table in a query: an expression that gives what the column holds. */
export interface Column<T> extends Expr<T> {
  /** The key by which a program knows it. */
  readonly key: string;
  /** The name it has in SQL. */
  readonly name: string;
}

/** The columns of a row type, each an expression that gives its value. */
export type Columns<R> = { readonly [K in keyof R & string]: Column<R[K]> };
/** The same where the table may be missing from a row (the other side of an outer join): every column may be null. */
export type NullableColumns<R> = { readonly [K in keyof R & string]: Column<R[K] | null> };

/** Where a table's rows come from: a table of the database, or a query (a derived table or a common table expression). */
export type Source =
  | { readonly kind: "table"; readonly schema?: string; readonly name: string }
  | { readonly kind: "derived"; readonly query: unknown }
  | { readonly kind: "cte"; readonly name: string; readonly query: unknown };

/** A foreign key as the model says it, by the keys of the columns. */
export interface ForeignKeyInfo {
  readonly columns: readonly string[];
  readonly references: string;
  readonly referencesColumns: readonly string[];
}

/** A table in a query. `R` is the row, `I` what an insert takes, `N` its name in the query (its alias). */
export interface Table<R, I, N extends string> {
  readonly kind: "table";
  /** The name in the query. */
  readonly alias: N;
  readonly source: Source;
  /** key → name in SQL. */
  readonly sqlNames: { readonly [K in keyof R & string]: string };
  readonly primaryKey: readonly (keyof R & string)[];
  readonly foreignKeys: readonly ForeignKeyInfo[];
  readonly c: Columns<R>;
  /** The same table under another name, as a query that joins it to itself needs. */
  as<M extends string>(alias: M): Table<R, I, M>;
  /** The same table in another schema. */
  inSchema(schema: string | undefined): Table<R, I, N>;
  readonly [rowType]?: R;
  readonly [insertType]?: I;
}
declare const rowType: unique symbol;
declare const insertType: unique symbol;

/** What `defineTable` is told. */
export interface TableSpec<R, N extends string> {
  /** The name in a query, which keys the scope of a select. */
  readonly alias: N;
  /** The name in SQL. */
  readonly name: string;
  readonly schema?: string;
  /** key → name in SQL, for each key of the row. */
  readonly columns: { readonly [K in keyof R & string]: string };
  readonly primaryKey?: readonly (keyof R & string)[];
  readonly foreignKeys?: readonly ForeignKeyInfo[];
}

function build<R, I, N extends string>(alias: N, source: Source, sqlNames: { readonly [K in keyof R & string]: string }, primaryKey: readonly (keyof R & string)[], foreignKeys: readonly ForeignKeyInfo[]): Table<R, I, N> {
  const c = Object.fromEntries(
    Object.entries(sqlNames).map(([key, name]) => [key, Object.freeze({ ...subNode<unknown>({ k: "col", alias, name: name as string }), key, name: name as string })]),
  ) as unknown as Columns<R>;
  return Object.freeze({
    kind: "table",
    alias,
    source,
    sqlNames,
    primaryKey,
    foreignKeys,
    c,
    as: <M extends string>(a: M) => build<R, I, M>(a, source, sqlNames, primaryKey, foreignKeys),
    inSchema: (schema: string | undefined) =>
      source.kind === "table"
        ? build<R, I, N>(alias, { kind: "table", ...(schema === undefined ? {} : { schema }), name: source.name }, sqlNames, primaryKey, foreignKeys)
        : build<R, I, N>(alias, source, sqlNames, primaryKey, foreignKeys),
  });
}

/**
 * Makes a table.
 *
 * @example
 * ```ts
 * interface Author { id: number; name: string; bio: string | null }
 * interface AuthorInsert { id?: number; name: string; bio?: string | null }
 * const author = defineTable<Author, AuthorInsert, "author">({ alias: "author", name: "author", columns: { id: "id", name: "name", bio: "bio" }, primaryKey: ["id"] });
 * ```
 */
export const defineTable = <R, I, N extends string>(spec: TableSpec<R, N>): Table<R, I, N> =>
  build<R, I, N>(spec.alias, { kind: "table", ...(spec.schema === undefined ? {} : { schema: spec.schema }), name: spec.name }, spec.columns, spec.primaryKey ?? [], spec.foreignKeys ?? []);

/** A table whose rows are those of a query: the keys of the row are the columns. */
export const derivedTable = <R, N extends string>(alias: N, query: unknown, keys: readonly (keyof R & string)[], kind: "derived" | "cte" = "derived"): Table<R, never, N> =>
  build<R, never, N>(
    alias,
    kind === "cte" ? { kind: "cte", name: alias, query } : { kind: "derived", query },
    Object.fromEntries(keys.map((k) => [k, k])) as unknown as { readonly [K in keyof R & string]: string },
    [],
    [],
  );

/** The row type of a table. */
export type RowOf<T> = T extends Table<infer R, infer _I, infer _N> ? R : never;
/** The insert type of a table. */
export type InsertOf<T> = T extends Table<infer _R, infer I, infer _N> ? I : never;
