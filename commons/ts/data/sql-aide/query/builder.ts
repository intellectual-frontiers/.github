/**
 * The query builder: `select` with joins, projections, common table expressions and set operations, and `insert`, `update` and `delete`
 * with `returning` and upsert, each built from the model so that the type of its rows is inferred and a value of the wrong type, a
 * column a table lacks or a join the foreign keys do not give fails to compile (commons 0009-sql-aide FR-041).
 *
 * A query's scope is its relations by name, each with its columns as typed expressions; a join without a condition takes it from the
 * one foreign key between the relation joined and those already there, and does not compile where there is none.
 *
 * @limits
 * A relation is in a query's scope by its name, so a table cannot be joined to itself (no aliases yet). A join without a condition needs
 * exactly one foreign key between the relation and the scope: the compiler refuses none, and two (a relation that points twice at one
 * table) fail when rendered and ask for the condition. There is no `GROUP BY` or aggregate helper; `valueAs` and `call` type hand-written
 * expressions. A set operation checks at run time that both sides name their columns in the same order. The rows of an insert must all
 * give the same columns. The builder types rows as the model does, and a driver decodes a column of the model by its domain; an expression
 * that is not a column (a `count(*)`) is given as the client gives it.
 *
 * @module
 */
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import type { NewRowOf, PatchOf, TableSpec } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Expr, Operand } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, type DxOf, type ReqOf, sql, type Sql } from "../emit/sql.ts";

/** The names of the columns a statement gives, in order, and the domain of each where it is known: what a driver decodes values by. */
export interface Shaped {
  /** The names of the columns, in order. */
  readonly columns: readonly string[];
  /** The domain of each column, where the expression that gives it is a column of the model. */
  readonly domains?: readonly (DomainSpec | undefined)[];
}

/** The domain of an expression, where it is a column of the model. */
export function domainOf(e: unknown): DomainSpec | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  if ("spec" in e && typeof e.spec === "object" && e.spec !== null && "domain" in e.spec) return e.spec.domain as DomainSpec;
  if ("domain" in e && typeof e.domain === "object" && e.domain !== null) return e.domain as DomainSpec;
  return undefined;
}

/** Any expression, whatever it yields, needs or covers. */
type AnyExpr = Sql<"expression", unknown, string, never>;

/** What an expression yields. */
export type YieldOf<E> = E extends { readonly __t?: infer T } ? T : never;

/** A relation a query may read: a table, a view or a common table expression, with its columns as expressions. */
export interface Relation<N extends string = string, C = unknown, Req extends string = never, Dx extends string = string> extends Sql<
  "relation",
  unknown,
  Req,
  Dx
> {
  /** Its name. */
  readonly name: N;
  /** Its schema. */
  readonly schema: string | undefined;
  /** Its columns, as expressions. */
  readonly c: C;
  /** The table as data, where it is one: what a join reads its foreign keys from. */
  readonly spec?: TableSpec;
}

/** The row of a relation's columns. */
export type RowOfColumns<C> = { readonly [K in keyof C]: YieldOf<C[K]> };

/** The columns of a relation reached by a left join: each may be null. */
export type Nullable<C> = {
  readonly [K in keyof C]: C[K] extends Sql<"expression", infer T, infer R, infer D> ? Sql<"expression", T | null, R, D> : never;
};

type BrandOf<V> = V extends { readonly "@ifc/brand": infer B extends string } ? B : never;
/** The names of the tables whose keys a row's values are. */
export type BrandsIn<Row> = { [K in keyof Row]-?: BrandOf<NonNullable<Row[K]>> }[keyof Row];

/** Whether a relation named `N` with columns `C` is joined to a scope by a foreign key, one way or the other. */
export type Joinable<S, N extends string, C> = [N] extends [keyof S]
  ? false
  : [Extract<{ [A in keyof S]: BrandsIn<RowOfColumns<S[A]>> }[keyof S], N>] extends [never]
    ? [Extract<Exclude<BrandsIn<RowOfColumns<C>>, N>, keyof S>] extends [never]
      ? false
      : true
    : true;

/** Fails to compile where a relation is joined with no condition and no foreign key joins it; the property that is missing says so. */
export type JoinsByKey<S, N extends string, C> = Joinable<S, N, C> extends true ? unknown : { readonly noForeignKeyTo: N };

interface Member {
  readonly name: string;
  readonly relation: AnySql;
  readonly spec?: TableSpec;
}

interface Join {
  readonly kind: "JOIN" | "LEFT JOIN";
  readonly relation: AnySql;
  readonly on: AnySql;
}

interface QuerySpec {
  readonly members: readonly Member[];
  readonly joins: readonly Join[];
  readonly projection?: readonly (readonly [string, AnySql])[];
  readonly where: readonly AnySql[];
  readonly orderBy: readonly AnySql[];
  readonly limit?: number;
  readonly distinct: boolean;
  readonly scope: Readonly<Record<string, unknown>>;
}

/** A query for rows: its scope `S`, the row it gives, the features it needs and the dialects it has a case for. */
export interface Query<S, Row, Req extends string = never, Dx extends string = string> extends Sql<"statement", Row, Req, Dx>, Shaped {
  /** The names of the columns it gives, in order: what a set operation and a common table expression are held to. */
  readonly columns: readonly string[];
  /** Joins a relation: on a condition over the scope, or, with none, on the foreign key between it and the scope. */
  join<N extends string, C, R extends string = never, D extends string = string>(
    relation: Relation<N, C, R, D> & JoinsByKey<S, N, C>,
  ): Query<S & { readonly [K in N]: C }, Row, Req | R, Dx & D>;
  /** Joins a relation on a condition over the scope. */
  join<N extends string, C, R extends string = never, D extends string = string, R2 extends string = never, D2 extends string = string>(
    relation: Relation<N, C, R, D>,
    on: (scope: S & { readonly [K in N]: C }) => Expr<boolean, R2, D2>,
  ): Query<S & { readonly [K in N]: C }, Row, Req | R | R2, Dx & D & D2>;
  /** The same as `join`, keeping the rows of the scope that no row of the relation matches: its columns may then be null. */
  leftJoin<N extends string, C, R extends string = never, D extends string = string>(
    relation: Relation<N, C, R, D> & JoinsByKey<S, N, C>,
  ): Query<S & { readonly [K in N]: Nullable<C> }, Row, Req | R, Dx & D>;
  /** A left join on a condition over the scope. */
  leftJoin<N extends string, C, R extends string = never, D extends string = string, R2 extends string = never, D2 extends string = string>(
    relation: Relation<N, C, R, D>,
    on: (scope: S & { readonly [K in N]: Nullable<C> }) => Expr<boolean, R2, D2>,
  ): Query<S & { readonly [K in N]: Nullable<C> }, Row, Req | R | R2, Dx & D & D2>;
  /** Keeps the rows that pass a condition over the scope; conditions given one after another must all hold. */
  where<R extends string = never, D extends string = string>(condition: (scope: S) => Expr<boolean, R, D>): Query<S, Row, Req | R, Dx & D>;
  /** Says what each row gives: expressions over the scope by the name of the column they give. The row type is theirs. */
  select<const P extends { readonly [column: string]: AnyExpr }>(
    projection: (scope: S) => P,
  ): Query<S, { readonly [K in keyof P]: YieldOf<P[K]> }, Req | ReqOf<P[keyof P]>, Dx & DxOf<P[keyof P]>>;
  /** Gives each row once. */
  distinct(): Query<S, Row, Req, Dx>;
  /** Orders the rows by expressions over the scope, each ascending unless made with `desc`. */
  orderBy(by: (scope: S) => readonly AnySql[]): Query<S, Row, Req, Dx>;
  /** Keeps at most a number of rows. */
  limit(rows: number): Query<S, Row, Req, Dx>;
}

function render(spec: QuerySpec): (ctx: EmitContext) => readonly Chunk[] {
  return () => {
    const first = spec.members[0];
    if (first === undefined) return [];
    const out: Chunk[] = [chunkText(spec.distinct ? "SELECT DISTINCT " : "SELECT ")];
    if (spec.projection === undefined) out.push(chunkOf(first.relation), chunkText(".*"));
    else
      spec.projection.forEach(([n, e], i) => {
        out.push(...(i === 0 ? [] : [chunkText(", ")]), chunkOf(e), chunkText(" AS "), { kind: "name", parts: [n] });
      });
    out.push(chunkText(" FROM "), chunkOf(first.relation));
    for (const j of spec.joins) out.push(chunkText(` ${j.kind} `), chunkOf(j.relation), chunkText(" ON "), chunkOf(j.on));
    spec.where.forEach((w, i) => out.push(chunkText(i === 0 ? " WHERE " : " AND "), chunkOf(w)));
    spec.orderBy.forEach((o, i) => out.push(chunkText(i === 0 ? " ORDER BY " : ", "), chunkOf(o)));
    if (spec.limit !== undefined) out.push(chunkText(` LIMIT ${spec.limit}`));
    return out;
  };
}

/** The condition of a join by foreign key: the one key between the relation joined and those in the scope. */
function byForeignKey(spec: QuerySpec, joined: Member): AnySql {
  const found: AnySql[] = [];
  const ref = (m: Member, column: string): AnySql => {
    const c = (spec.scope[m.name] ?? {}) as Readonly<Record<string, AnySql>>;
    const r = c[column];
    if (r === undefined) throw new Error(`${m.name} has no column ${column}`);
    return r;
  };
  const joinedRefs = (joined.relation as unknown as { readonly c: Readonly<Record<string, AnySql>> }).c;
  for (const m of spec.members) {
    for (const [n, c] of m.spec?.columns ?? []) {
      const t = c.references?.table?.();
      if (t !== undefined && t.name === joined.name && t.name !== m.name) {
        const target = joinedRefs[c.references?.column ?? ""];
        if (target !== undefined) found.push(sql("expression", () => [chunkOf(ref(m, n)), chunkText(" = "), chunkOf(target)]));
      }
    }
    for (const [n, c] of joined.spec?.columns ?? []) {
      const t = c.references?.table?.();
      const own = joinedRefs[n];
      if (t !== undefined && t.name === m.name && own !== undefined)
        found.push(sql("expression", () => [chunkOf(own), chunkText(" = "), chunkOf(ref(m, c.references?.column ?? ""))]));
    }
  }
  if (found.length !== 1)
    throw new Error(
      `${joined.name} is joined by ${found.length === 0 ? "no foreign key" : `${found.length} foreign keys`} to ${spec.members.map((m) => m.name).join(", ")}: give the condition`,
    );
  return found[0] ?? sql("expression", () => [chunkText("FALSE")]);
}

function build<S, Row, Req extends string, Dx extends string>(
  spec: QuerySpec,
  columns: readonly string[],
  domains: readonly (DomainSpec | undefined)[],
): Query<S, Row, Req, Dx> {
  const scope = spec.scope as S;
  const joining =
    (kind: Join["kind"]) =>
    (relation: Relation<string, unknown, string, string>, on?: (s: S) => AnySql): Query<S, Row, Req, Dx> => {
      const member: Member =
        relation.spec === undefined ? { name: relation.name, relation } : { name: relation.name, relation, spec: relation.spec };
      const next: QuerySpec = { ...spec, members: [...spec.members, member], scope: { ...spec.scope, [relation.name]: relation.c } };
      const condition = on === undefined ? byForeignKey(spec, member) : on(next.scope as S);
      return build({ ...next, joins: [...spec.joins, { kind, relation, on: condition }] }, columns, domains);
    };
  return {
    sqlKind: "statement",
    chunks: render(spec),
    columns,
    domains,
    // the overloads differ only in their types; one function serves both
    join: joining("JOIN") as Query<S, Row, Req, Dx>["join"],
    leftJoin: joining("LEFT JOIN") as Query<S, Row, Req, Dx>["leftJoin"],
    where: (condition) => build({ ...spec, where: [...spec.where, condition(scope)] }, columns, domains),
    select: (projection) => {
      const p = Object.entries(projection(scope));
      return build(
        { ...spec, projection: p },
        p.map(([n]) => n),
        p.map(([, e]) => domainOf(e)),
      );
    },
    distinct: () => build({ ...spec, distinct: true }, columns, domains),
    orderBy: (by) => build({ ...spec, orderBy: [...spec.orderBy, ...by(scope)] }, columns, domains),
    limit: (rows) => build({ ...spec, limit: Math.max(0, Math.trunc(rows)) }, columns, domains),
  };
}

/**
 * Starts a query of a relation: its rows, until `select` says what each row gives.
 *
 * @param relation - a table, a view or a common table expression
 * @example
 * from(person).join(party).where((s) => eq(s.party.display_name, "Ada")).select((s) => ({ id: s.person.party_id, born: s.person.birth_date }));
 */
export function from<N extends string, C, R extends string = never, D extends string = string>(
  relation: Relation<N, C, R, D>,
): Query<{ readonly [K in N]: C }, RowOfColumns<C>, R, D> {
  const member: Member =
    relation.spec === undefined ? { name: relation.name, relation } : { name: relation.name, relation, spec: relation.spec };
  const columns = relation.spec?.columns.map(([n]) => n) ?? Object.keys(relation.c ?? {});
  const domains =
    relation.spec?.columns.map(([, c]) => c.domain) ??
    columns.map((n) => domainOf((relation.c as Readonly<Record<string, unknown>> | undefined)?.[n]));
  return build(
    { members: [member], joins: [], where: [], orderBy: [], distinct: false, scope: { [relation.name]: relation.c } },
    columns,
    domains,
  );
}

/** A common table expression: a query given a name, read as a relation whose columns are the query's. */
export interface Cte<N extends string, Row, Req extends string, Dx extends string> extends Relation<
  N,
  { readonly [K in keyof Row]: Expr<Row[K]> },
  Req,
  Dx
> {
  /** The query it names. */
  readonly query: Sql<"statement", Row, Req, Dx> & Shaped;
}

/**
 * Names a query, so that another reads it as a relation; {@link withCtes} puts it before the query that reads it.
 *
 * @param cteName - the name it is read by
 * @param query - the query
 */
export function cte<const N extends string, Row, Req extends string, Dx extends string>(
  cteName: N,
  query: Sql<"statement", Row, Req, Dx> & Shaped,
): Cte<N, Row, Req, Dx> {
  const c = Object.fromEntries(
    query.columns.map((n, i) => [
      n,
      { ...sql("expression", (ctx) => [{ kind: "name", parts: [cteName, ctx.naming.column(n)] }]), domain: query.domains?.[i] },
    ]),
  );
  return {
    sqlKind: "relation",
    chunks: () => [{ kind: "name", parts: [cteName] }],
    name: cteName,
    schema: undefined,
    // the columns are the query's, each an expression of its value
    c: c as unknown as { readonly [K in keyof Row]: Expr<Row[K]> },
    query,
  };
}

/**
 * A query with common table expressions before it: `WITH a AS (...), b AS (...) SELECT ...`.
 *
 * @param ctes - the expressions, each before those that read it
 * @param query - the query that reads them
 */
export function withCtes<const E extends readonly Cte<string, unknown, string, string>[], Row, Req extends string, Dx extends string>(
  ctes: E,
  query: Sql<"statement", Row, Req, Dx> & Shaped,
): Sql<"statement", Row, Req | ReqOf<E[number]["query"]> | "cte", Dx & DxOf<E[number]["query"]>> & Shaped {
  return {
    sqlKind: "statement",
    columns: query.columns,
    ...(query.domains === undefined ? {} : { domains: query.domains }),
    chunks: () => {
      const out: Chunk[] = [chunkText("WITH ")];
      ctes.forEach((e, i) => {
        const list = e.query.columns.flatMap((n, j): Chunk[] => [...(j === 0 ? [] : [chunkText(", ")]), { kind: "name", parts: [n] }]);
        out.push(
          chunkText(i === 0 ? "" : ", "),
          { kind: "name", parts: [e.name] },
          chunkText(" ("),
          ...list,
          chunkText(") AS ("),
          chunkOf(e.query),
          chunkText(")"),
        );
      });
      return [...out, chunkText(" "), chunkOf(query)];
    },
  };
}

function setOperation(op: string) {
  return <Row, R1 extends string, D1 extends string, R2 extends string, D2 extends string>(
    a: Sql<"statement", Row, R1, D1> & Shaped,
    b: Sql<"statement", NoInfer<Row>, R2, D2> & Shaped,
  ): Sql<"statement", Row, R1 | R2, D1 & D2> & Shaped => {
    if (a.columns.join(",") !== b.columns.join(","))
      throw new Error(`${op} of queries whose columns differ: (${a.columns.join(", ")}) and (${b.columns.join(", ")})`);
    return {
      sqlKind: "statement",
      columns: a.columns,
      ...(a.domains === undefined ? {} : { domains: a.domains }),
      chunks: () => [chunkOf(a), chunkText(` ${op} `), chunkOf(b)],
    };
  };
}

/** The rows of both queries, each once; both give the same row, column for column. */
export const union = setOperation("UNION");
/** The rows of both queries, as many times as they come. */
export const unionAll = setOperation("UNION ALL");
/** The rows both queries give. */
export const intersect = setOperation("INTERSECT");
/** The rows the first query gives and the second does not. */
export const except = setOperation("EXCEPT");

/** A table the writing statements take: its name, its columns as expressions, and its columns as data. */
export interface Writable<C> extends Relation<string, C, string, string> {
  /** The table as data. */
  readonly spec: TableSpec;
}

type BareOf<C> = {
  readonly [K in keyof C]: C[K] extends { readonly bare: infer B } ? B : never;
};

/** What a writing statement gives back, with `returning`. */
export interface Returning<C, Req extends string, Dx extends string> extends Sql<"statement", never, Req, Dx> {
  /** Gives back expressions over the table's columns, by name, for each row written; the row type is theirs. */
  returning<const P extends { readonly [column: string]: AnyExpr }>(
    projection: (c: BareOf<C>) => P,
  ): Sql<"statement", { readonly [K in keyof P]: YieldOf<P[K]> }, Req | "returning" | ReqOf<P[keyof P]>, Dx & DxOf<P[keyof P]>> & {
    readonly columns: readonly string[];
  };
}

/** An insert, which may say what to do with a row whose key is already there. */
export interface Insert<C, Cols extends string, Req extends string, Dx extends string> extends Returning<C, Req, Dx> {
  /** A row whose key is there is left as it is. */
  onConflictDoNothing(key: readonly Cols[]): Returning<C, Req | "upsert", Dx>;
  /** A row whose key is there is changed to the row given: the columns named, or every column given that is not in the key. */
  onConflictDoUpdate(key: readonly Cols[], set?: readonly Cols[]): Returning<C, Req | "upsert", Dx>;
}

function writing<C, Req extends string, Dx extends string>(
  t: Writable<C>,
  body: (ctx: EmitContext) => readonly Chunk[],
): Returning<C, Req, Dx> {
  const bare = Object.fromEntries(
    Object.entries(t.c as Readonly<Record<string, { readonly bare: AnySql }>>).map(([n, r]) => [n, { ...r.bare, domain: domainOf(r) }]),
  );
  return {
    sqlKind: "statement",
    chunks: body,
    returning: (projection) => {
      // the bare columns are the table's own, by name
      const p = Object.entries(projection(bare as BareOf<C>));
      return {
        sqlKind: "statement",
        columns: p.map(([n]) => n),
        domains: p.map(([, e]) => domainOf(e)),
        chunks: (ctx) => [
          ...body(ctx),
          chunkText(" RETURNING "),
          ...p.flatMap(([n, e], i): Chunk[] => [
            ...(i === 0 ? [] : [chunkText(", ")]),
            chunkOf(e),
            chunkText(" AS "),
            { kind: "name", parts: [n] },
          ]),
        ],
      };
    },
  };
}

const col = (n: string): Chunk => ({ kind: "name", parts: [n] });
const colList = (ctx: EmitContext, names: readonly string[]): Chunk[] =>
  names.flatMap((n, i) => [...(i === 0 ? [] : [chunkText(", ")]), col(ctx.naming.column(n))]);

/**
 * Inserts rows, each typed as the row the table takes on insert. The rows must all give the same columns.
 *
 * @param into - the table
 * @param rows - the rows
 * @example
 * insertInto(party, [{ party_id: party.key("p1"), party_kind_code: "person", display_name: "Ada" }]).returning((c) => ({ id: c.party_id }));
 */
export function insertInto<T extends Writable<unknown> & { readonly __t?: unknown }, const R extends readonly NewRowOf<T>[]>(
  into: T,
  rows: R,
): Insert<T["c"], keyof NewRowOf<T> & string, ReqOf<T>, DxOf<T>> {
  const first = rows[0];
  if (first === undefined) throw new Error(`an insert into ${into.name} needs a row`);
  const names = Object.keys(first);
  const domains = new Map(into.spec.columns);
  for (const r of rows)
    if (Object.keys(r).join(",") !== names.join(",")) throw new Error(`the rows of an insert into ${into.name} must give the same columns`);
  const values = (ctx: EmitContext): Chunk[] => {
    const out: Chunk[] = [chunkText("INSERT INTO "), chunkOf(into), chunkText(" ("), ...colList(ctx, names), chunkText(") VALUES ")];
    rows.forEach((r, i) => {
      out.push(chunkText(i === 0 ? "(" : ", ("));
      names.forEach((n, j) => {
        const v = (r as Readonly<Record<string, unknown>>)[n];
        const d = domains.get(n)?.domain;
        // a value of a row the compiler held to the table's insert row is a SqlValue of its column
        out.push(
          ...(j === 0 ? [] : [chunkText(", ")]),
          d === undefined ? { kind: "value", value: v as SqlValue } : { kind: "value", value: v as SqlValue, spec: d },
        );
      });
      out.push(chunkText(")"));
    });
    return out;
  };
  const base = writing<T["c"], ReqOf<T>, DxOf<T>>(into, values);
  const conflict = (key: readonly string[], tail: (ctx: EmitContext) => Chunk[]): Returning<T["c"], ReqOf<T> | "upsert", DxOf<T>> =>
    writing(into, (ctx) => [...values(ctx), chunkText(" ON CONFLICT ("), ...colList(ctx, key), chunkText(")"), ...tail(ctx)]);
  return {
    ...base,
    onConflictDoNothing: (key) => conflict(key, () => [chunkText(" DO NOTHING")]),
    onConflictDoUpdate: (key, set) =>
      conflict(key, (ctx) => {
        const keys: readonly string[] = key;
        const cols: readonly string[] = set ?? names.filter((n) => !keys.includes(n));
        return [
          chunkText(" DO UPDATE SET "),
          ...cols.flatMap((n, i): Chunk[] => [
            ...(i === 0 ? [] : [chunkText(", ")]),
            col(ctx.naming.column(n)),
            chunkText(" = excluded."),
            col(ctx.naming.column(n)),
          ]),
        ];
      }),
  };
}

/** The values an update sets: a value of each column's type, or an expression that yields one. */
export type SetOf<T> = { readonly [K in keyof PatchOf<T>]?: Operand<Exclude<PatchOf<T>[K], undefined>, string, string> };

/** An update or a delete that has not said which rows: it must, or say that it means every row. */
export interface Which<C, Req extends string, Dx extends string> {
  /** The rows that pass a condition over the table's columns. */
  where<R extends string = never, D extends string = string>(condition: (c: C) => Expr<boolean, R, D>): Returning<C, Req | R, Dx & D>;
  /** Every row of the table. */
  everyRow(): Returning<C, Req, Dx>;
}

function isSql(x: unknown): x is AnySql {
  return typeof x === "object" && x !== null && "sqlKind" in x;
}

function which<C, Req extends string, Dx extends string>(t: Writable<C>, head: (ctx: EmitContext) => Chunk[]): Which<C, Req, Dx> {
  return {
    where: (condition) => {
      const cond = condition(t.c);
      return writing(t, (ctx) => [...head(ctx), chunkText(" WHERE "), chunkOf(cond)]);
    },
    everyRow: () => writing(t, head),
  };
}

/**
 * Changes rows: the columns set are typed as the table takes them on update.
 *
 * @param table0 - the table
 * @param set - the values, or expressions over the table, of the columns changed
 * @example
 * update(party, { display_name: "Ada King" }).where((c) => eq(c.party_id, party.key("p1")));
 */
export function update<T extends Writable<unknown> & { readonly __t?: unknown }>(
  table0: T,
  set: SetOf<T>,
): Which<T["c"], ReqOf<T>, DxOf<T>> {
  const entries = Object.entries(set);
  if (entries.length === 0) throw new Error(`an update of ${table0.name} sets no column`);
  const domains = new Map(table0.spec.columns);
  return which(table0, (ctx) => [
    chunkText("UPDATE "),
    chunkOf(table0),
    chunkText(" SET "),
    ...entries.flatMap(([n, v], i): Chunk[] => {
      const d = domains.get(n)?.domain;
      // the compiler held each value to its column's type
      const value: Chunk = isSql(v)
        ? chunkOf(v)
        : d === undefined
          ? { kind: "value", value: v as SqlValue }
          : { kind: "value", value: v as SqlValue, spec: d };
      return [...(i === 0 ? [] : [chunkText(", ")]), col(ctx.naming.column(n)), chunkText(" = "), value];
    }),
  ]);
}

/**
 * Deletes rows.
 *
 * @param table0 - the table
 * @example
 * deleteFrom(party).where((c) => isNotNull(c.deleted_at));
 */
export function deleteFrom<T extends Writable<unknown> & { readonly __t?: unknown }>(table0: T): Which<T["c"], ReqOf<T>, DxOf<T>> {
  return which(table0, () => [chunkText("DELETE FROM "), chunkOf(table0)]);
}
