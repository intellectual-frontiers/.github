/**
 * Tables: named columns whose row types are computed, whose names are literal types, and which render themselves as a reference where
 * they are used and as `CREATE TABLE` where they are defined (commons 0006-sql-aide FR-007, FR-008, FR-017).
 *
 * @module
 */
import type { Brand } from "../../../kernel/mod.ts";
import { fitName } from "../core/text.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Expr } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, renderUnchecked, sql, type Sql } from "../emit/sql.ts";
import type { AnyColumn, ColumnSpec, FillOf, NullOf, Referable, ReqOfColumn, SelfColumn, ValueOf } from "./column.ts";

/** The columns of a table, by name: columns, and references to columns of the same table. */
export type ColumnMap = { readonly [name: string]: AnyColumn | SelfColumn<string, boolean> };

/** The type of the values of one column of a table, a self-reference taking the type of the column it points to. */
export type ValueIn<TN extends string, C, K extends keyof C> =
  C[K] extends SelfColumn<infer Target, infer Null>
    ? Target extends keyof C
      ? NonNullable<ValueOf<TN, C[Target]>> | (Null extends true ? null : never)
      : never
    : ValueOf<TN, C[K]>;

/** The row a table gives when read. */
export type SelectRow<TN extends string, C> = { readonly [K in keyof C]: ValueIn<TN, C, K> };

type RequiredKeys<C> = {
  [K in keyof C]: C[K] extends SelfColumn<string, infer Null>
    ? Null extends true
      ? never
      : K
    : FillOf<C[K]> extends "required"
      ? NullOf<C[K]> extends true
        ? never
        : K
      : never;
}[keyof C];

type OptionalKeys<C> = {
  [K in keyof C]: C[K] extends SelfColumn<string, infer Null>
    ? Null extends true
      ? K
      : never
    : FillOf<C[K]> extends "generated"
      ? never
      : FillOf<C[K]> extends "default"
        ? K
        : NullOf<C[K]> extends true
          ? K
          : never;
}[keyof C];

/** The row a table takes on insert: what must be given, and what may be. A generated column is not in it. */
export type InsertRow<TN extends string, C> = { readonly [K in RequiredKeys<C>]: ValueIn<TN, C, K> } & {
  readonly [K in OptionalKeys<C>]?: ValueIn<TN, C, K>;
};

/** The row a table takes on update: any column that is not generated. */
export type UpdateRow<TN extends string, C> = { readonly [K in RequiredKeys<C> | OptionalKeys<C>]?: ValueIn<TN, C, K> };

/** The features the columns of a table need. */
export type ReqOfColumns<C> = { [K in keyof C]: ReqOfColumn<C[K]> }[keyof C];

/** A column of a table: an expression of its type that knows where it stands, and what a foreign key may point to. */
export interface ColumnRef<TN extends string, CN extends string, T, Req extends string = never> extends Expr<T, Req>, Referable<T, Req> {
  /** The table's name. */
  readonly table: TN;
  /** The column's name. */
  readonly column: CN;
  /** The column alone, with no table before it: what a check or an index of its own table names. */
  readonly bare: Expr<T, Req>;
}

/** The columns of a table as expressions, by name. */
export type Refs<TN extends string, C> = { readonly [K in keyof C & string]: ColumnRef<TN, K, ValueIn<TN, C, K>, ReqOfColumn<C[K]>> };

/** Fails to compile where a self-reference names a column the table does not have (FR-008). */
export type SelfTargetsExist<C> = {
  readonly [K in keyof C]: C[K] extends SelfColumn<infer Target, boolean> ? (Target extends keyof C ? C[K] : never) : C[K];
};

/** A check on the rows of a table. */
export interface TableCheck {
  /** The name of the check, unique in its table. */
  readonly name: string;
  /** The condition, over the table's bare columns. */
  readonly condition: AnySql;
}

/** What a table may say beyond its columns. */
export interface TableOptions<C> {
  /** The schema it lives in, where the dialect has schemas. */
  readonly schema?: string;
  /** Its description, for a table a function makes: a table a person writes takes it from its TSDoc comment. */
  readonly doc?: string;
  /** Who answers for it (FR-025). */
  readonly owner?: string;
  /** The columns of a primary key of more than one column. */
  readonly primaryKey?: readonly (keyof C & string)[];
  /** Sets of columns that are unique together. */
  readonly unique?: readonly (readonly (keyof C & string)[])[];
}

/** Everything known of a table, as data: what the emitter, the graph and the generators read. */
export interface TableSpec {
  /** The table's name. */
  readonly name: string;
  /** The schema it lives in. */
  readonly schema: string | undefined;
  /** Its columns in the order written, self-references resolved. */
  readonly columns: readonly (readonly [name: string, spec: ColumnSpec])[];
  /** The columns of its primary key. */
  readonly primaryKey: readonly string[];
  /** Sets of columns unique together. */
  readonly unique: readonly (readonly string[])[];
  /** Checks on its rows. */
  readonly checks: readonly TableCheck[];
  /** Its description, where it is not taken from a TSDoc comment. */
  readonly doc: string | undefined;
  /** Who answers for it. */
  readonly owner: string | undefined;
}

/**
 * A table. Used in SQL it is a reference to itself; `ddl` is its definition. `TN` is its name, `C` its columns and `Req` the dialect
 * features it needs beyond those of its columns. `C` is not held to be a map of columns here, so that a function may compute it (a hub
 * of Data Vault names its key after itself); `table` holds what it is given to one.
 */
export interface Table<TN extends string, C, Req extends string = never> extends Sql<"relation", SelectRow<TN, C>, Req | ReqOfColumns<C>> {
  /** What kind of entity this is. */
  readonly entity: "table";
  /** The table's name. */
  readonly name: TN;
  /** The schema it lives in. */
  readonly schema: string | undefined;
  /** The table as data. */
  readonly spec: TableSpec;
  /** Its columns as expressions. */
  readonly c: Refs<TN, C>;
  /** The statement that defines it, with its comments. */
  readonly ddl: Sql<"statement", unknown, Req | ReqOfColumns<C>>;
  /** The tables its foreign keys point to. */
  readonly dependsOn: () => readonly { readonly name: string; readonly schema: string | undefined }[];
  /** Says that a value is a key of this table: the one way to make a key from a plain value. */
  readonly key: <T extends string | number | bigint>(value: T) => Brand<T, TN>;
  /** The same table with checks on its rows, written over its bare columns. */
  readonly check: (
    name: string,
    condition: (c: { readonly [K in keyof C & string]: Expr<ValueIn<TN, C, K>, ReqOfColumn<C[K]>> }) => AnySql,
  ) => Table<TN, C, Req>;
}

/** Any table. */
export type AnyTable = Table<string, ColumnMap, string>;

/** The row a table gives when read, from the table itself: `RowOf<typeof person>`. */
export type RowOf<T> = T extends Table<infer TN, infer C, string> ? SelectRow<TN, C> : never;
/** The row a table takes on insert, from the table itself. */
export type NewRowOf<T> = T extends Table<infer TN, infer C, string> ? InsertRow<TN, C> : never;
/** The row a table takes on update, from the table itself. */
export type PatchOf<T> = T extends Table<infer TN, infer C, string> ? UpdateRow<TN, C> : never;

function isSelf(c: AnyColumn | SelfColumn<string, boolean>): c is SelfColumn<string, boolean> {
  return "self" in c;
}

function resolve(columns: ColumnMap): readonly (readonly [string, ColumnSpec])[] {
  return Object.entries(columns).map(([name, c]) => {
    if (!isSelf(c)) return [name, c.spec] as const;
    const target = columns[c.self];
    if (target === undefined || isSelf(target)) throw new Error(`${name} points to ${c.self}, which is not a column of its table`);
    const spec: ColumnSpec = {
      domain: target.spec.domain,
      nullable: c.over.nullable,
      fill: "required",
      identity: false,
      primaryKey: false,
      unique: false,
      references: { table: undefined, column: c.self },
      ...(c.over.doc === undefined ? {} : { doc: c.over.doc }),
    };
    return [name, spec] as const;
  });
}

const action = (a: string): string => a.toUpperCase();

function createTable(spec: TableSpec, self: object): (ctx: EmitContext) => readonly Chunk[] {
  return (ctx) => {
    const d = ctx.dialect;
    const docs = ctx.docs.get(self);
    const out: Chunk[] = [];
    const before: string[] = [];
    const lines: Chunk[][] = [];
    const tableName: Chunk = { kind: "name", parts: ctx.naming.table(spec.name, spec.schema) };
    const col = (n: string): Chunk => ({ kind: "name", parts: [ctx.naming.column(n)] });
    const bare = (n: string): AnySql => sql("expression", () => [col(n)]);
    const inlineDocs = d.comment("table", "", "") === undefined;
    const pkInline = spec.primaryKey.length === 1 ? spec.primaryKey[0] : undefined;

    for (const [name, c] of spec.columns) {
      const line: Chunk[] = [];
      const doc = c.doc ?? docs?.members[name];
      if (inlineDocs && doc !== undefined) line.push(chunkText(`-- ${doc.replaceAll("\n", " ")}\n`));
      line.push(col(name), chunkText(` ${d.typeOf(c.domain)}`));
      let isPk = name === pkInline;
      if (c.identity) {
        const id = d.identity(`${spec.name}_${name}_seq`);
        if (id.before !== undefined) before.push(id.before);
        line.push(chunkText(` ${id.suffix}`));
        if (id.isPrimaryKey) isPk = false;
      } else if (!c.nullable) line.push(chunkText(" NOT NULL"));
      if (c.default !== undefined) line.push(chunkText(" DEFAULT "), chunkOf(c.default));
      if (c.generated !== undefined) line.push(chunkText(` ${d.generated(renderUnchecked(c.generated, ctx))}`));
      if (isPk) line.push(chunkText(" PRIMARY KEY"));
      if (c.unique) line.push(chunkText(" UNIQUE"));
      if (c.domain.kind === "enum") {
        line.push(chunkText(" CHECK ("), col(name), chunkText(` IN (${c.domain.values.map((v) => d.literal(v)).join(", ")}))`));
      }
      if (c.check !== undefined) line.push(chunkText(" CHECK ("), chunkOf(c.check(bare(name))), chunkText(")"));
      lines.push(line);
    }
    const constraint = (kind: "pk" | "fk" | "uq" | "ck", columns: readonly string[]): Chunk[] => [
      chunkText("CONSTRAINT "),
      { kind: "name", parts: [fitName(ctx.naming.constraint(kind, spec.name, columns), d.maxNameLength)] },
    ];
    const list = (columns: readonly string[]): Chunk[] => columns.flatMap((n, i) => (i === 0 ? [col(n)] : [chunkText(", "), col(n)]));
    if (spec.primaryKey.length > 1)
      lines.push([...constraint("pk", spec.primaryKey), chunkText(" PRIMARY KEY ("), ...list(spec.primaryKey), chunkText(")")]);
    for (const u of spec.unique) lines.push([...constraint("uq", u), chunkText(" UNIQUE ("), ...list(u), chunkText(")")]);
    for (const [name, c] of spec.columns) {
      const r = c.references;
      if (r === undefined) continue;
      const target = r.table === undefined ? { name: spec.name, schema: spec.schema } : r.table();
      const line: Chunk[] = [
        ...constraint("fk", [name]),
        chunkText(" FOREIGN KEY ("),
        col(name),
        chunkText(") REFERENCES "),
        { kind: "name", parts: ctx.naming.table(target.name, target.schema) },
        chunkText(" ("),
        col(r.column),
        chunkText(")"),
      ];
      if (r.onDelete !== undefined) line.push(chunkText(` ON DELETE ${action(r.onDelete)}`));
      if (r.onUpdate !== undefined) line.push(chunkText(` ON UPDATE ${action(r.onUpdate)}`));
      lines.push(line);
    }
    for (const k of spec.checks) {
      lines.push([
        chunkText("CONSTRAINT "),
        { kind: "name", parts: [fitName(`${spec.name}_${k.name}_ck`, d.maxNameLength)] },
        chunkText(" CHECK ("),
        chunkOf(k.condition),
        chunkText(")"),
      ]);
    }

    for (const b of before) out.push(chunkText(`${b}\n`));
    const tableDoc = spec.doc ?? docs?.summary;
    if (inlineDocs && tableDoc !== undefined) out.push(chunkText(`-- ${tableDoc.replaceAll("\n", " ")}\n`));
    out.push(chunkText("CREATE TABLE IF NOT EXISTS "), tableName, chunkText(" (\n"));
    lines.forEach((line, i) => {
      // a comment line stands before its column; the indentation is the column's
      const first = line[0];
      if (first !== undefined && first.kind === "text" && first.text.startsWith("-- "))
        out.push(chunkText(`    ${first.text}    `), ...line.slice(1));
      else out.push(chunkText("    "), ...line);
      out.push(chunkText(i === lines.length - 1 ? "\n" : ",\n"));
    });
    out.push(chunkText(");"));

    if (!inlineDocs) {
      const qualified = renderUnchecked(
        sql("identifier", () => [tableName]),
        ctx,
      );
      if (tableDoc !== undefined) out.push(chunkText(`\n${d.comment("table", qualified, tableDoc) ?? ""};`));
      for (const [name, c] of spec.columns) {
        const doc = c.doc ?? docs?.members[name];
        if (doc === undefined) continue;
        const columnName = renderUnchecked(
          sql("identifier", () => [col(name)]),
          ctx,
        );
        out.push(chunkText(`\n${d.comment("column", `${qualified}.${columnName}`, doc) ?? ""};`));
      }
    }
    return out;
  };
}

function build<TN extends string, C, Req extends string>(spec: TableSpec, name: TN, columns: C): Table<TN, C, Req> {
  const owner = (): { readonly name: string; readonly schema: string | undefined } => ({ name: spec.name, schema: spec.schema });
  const refOf = <T, R extends string>(columnName: string, columnSpec: ColumnSpec): ColumnRef<TN, string, T, R> => {
    const bare: Expr<T, R> = sql("expression", (ctx) => [{ kind: "name", parts: [ctx.naming.column(columnName)] }]);
    return {
      sqlKind: "expression",
      chunks: (ctx) => [{ kind: "name", parts: [...ctx.naming.table(spec.name, spec.schema), ctx.naming.column(columnName)] }],
      table: name,
      column: columnName,
      spec: columnSpec,
      owner,
      bare,
    };
  };
  const refs = Object.fromEntries(spec.columns.map(([n, s]) => [n, refOf(n, s)]));
  const bareRefs = Object.fromEntries(spec.columns.map(([n, s]) => [n, refOf(n, s).bare]));
  const self: Table<TN, C, Req> = {
    sqlKind: "relation",
    chunks: (ctx) => [{ kind: "name", parts: ctx.naming.table(spec.name, spec.schema) }],
    entity: "table",
    name,
    schema: spec.schema,
    spec,
    // the keys of `refs` are the keys of `columns`, each a ColumnRef of its column: Object.fromEntries cannot say so
    c: refs as Refs<TN, C>,
    get ddl(): Sql<"statement", unknown, Req | ReqOfColumns<C>> {
      return sql("statement", createTable(spec, self));
    },
    dependsOn: () =>
      spec.columns.flatMap(([, c]) => {
        const t = c.references?.table;
        return t === undefined ? [] : [t()];
      }),
    key: <T extends string | number | bigint>(value: T): Brand<T, TN> => value as Brand<T, TN>,
    check: (checkName, condition) =>
      build<TN, C, Req>(
        { ...spec, checks: [...spec.checks, { name: checkName, condition: condition(bareRefs as Parameters<typeof condition>[0]) }] },
        name,
        columns,
      ),
  };
  return self;
}

/**
 * Makes a table.
 *
 * @param name - the table's name, a literal
 * @param columns - its columns, by name; a reference to a column of the same table is `self("column")`
 * @param options - its schema, owner, composite key and unique sets
 * @example
 * const party = table("party", { party_id: pk.ulid(), name: text() });
 * const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), born: date().nullable() });
 */
export function table<const TN extends string, const C extends ColumnMap>(
  name: TN,
  columns: C & SelfTargetsExist<C>,
  options: TableOptions<C> = {},
): Table<TN, C> {
  const resolved = resolve(columns);
  const primaryKey = options.primaryKey ?? resolved.filter(([, c]) => c.primaryKey).map(([n]) => n);
  return build<TN, C, never>(
    {
      name,
      schema: options.schema,
      columns: resolved,
      primaryKey,
      unique: options.unique ?? [],
      checks: [],
      doc: options.doc,
      owner: options.owner,
    },
    name,
    columns,
  );
}
