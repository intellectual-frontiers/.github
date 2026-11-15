/**
 * SQL as typed partials: the `SQL` tagged template, the chunk tree it builds and the two ways the tree is rendered, as a script and as a
 * statement with bound parameters (commons 0006-sql-aide FR-011, FR-013, FR-014, FR-015).
 *
 * @module
 */
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import { absurd } from "../../../kernel/mod.ts";
import { unindent } from "../core/text.ts";
import type { Dialect, EmitContext, FeaturesOf, NameOf } from "./context.ts";

/** What a partial is, so that a function asking for a relation is not given an expression (FR-013). */
export type SqlKind = "statement" | "expression" | "relation" | "identifier" | "fragment";

/** One piece of the tree a partial renders to. */
export type Chunk =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "name"; readonly parts: readonly string[] }
  | { readonly kind: "value"; readonly value: SqlValue; readonly spec?: DomainSpec }
  | { readonly kind: "sql"; readonly sql: AnySql };

/**
 * A SQL partial: a value that renders itself for an emit context.
 *
 * - `K` is its kind.
 * - `T` is the type of what it yields: a value for an expression, a row for a relation.
 * - `Req` is the union of dialect features it needs; rendering it for a dialect that lacks one does not compile (FR-010).
 * - `Dx` is the union of dialect names it has a case for; `string` means any (FR-011).
 */
export interface Sql<K extends SqlKind = SqlKind, T = unknown, Req extends string = never, Dx extends string = string> {
  /** The kind of partial. */
  readonly sqlKind: K;
  /** The tree, for a context. */
  readonly chunks: (ctx: EmitContext) => readonly Chunk[];
  /** Never set: carries `T`. */
  readonly __t?: T;
  /** Never set: carries `Req`. */
  readonly __req?: Req;
  /** Never set: carries `Dx`. */
  readonly __dx?: (dialect: Dx) => void;
}

/** Any partial, whatever it yields, needs or covers. */
export type AnySql = Sql<SqlKind, unknown, string, never>;

/** The features a partial, or a list of partials, needs. */
export type ReqOf<X> = X extends Sql<SqlKind, unknown, infer R, never> ? R : X extends readonly (infer P)[] ? ReqOf<P> : never;

type DxFn<X> =
  X extends Sql<SqlKind, unknown, string, infer Dx>
    ? (dialect: Dx) => void
    : X extends readonly (infer P)[]
      ? DxFn<P>
      : (dialect: string) => void;
/** The dialects every one of a union of partials has a case for. */
export type DxOf<X> = [X] extends [never] ? string : DxFn<X> extends (dialect: infer I) => void ? (I extends string ? I : never) : never;

/**
 * What a context must be for a partial to render in it. Where the dialect lacks a feature the partial needs, or the partial has no case
 * for the dialect, the context does not fit and the call does not compile; the property that is missing says why.
 */
export type Fits<D extends Dialect, Req extends string, Dx extends string> = ([Req] extends [FeaturesOf<D>]
  ? unknown
  : { readonly dialectLacksFeature: Exclude<Req, FeaturesOf<D>> }) &
  ([NameOf<D>] extends [Dx] ? unknown : { readonly noCaseForDialect: Exclude<NameOf<D>, Dx> });

/** Makes a partial from a function that gives its chunks. */
export const sql = <K extends SqlKind, T = unknown, Req extends string = never, Dx extends string = string>(
  sqlKind: K,
  chunks: (ctx: EmitContext) => readonly Chunk[],
): Sql<K, T, Req, Dx> => ({ sqlKind, chunks });

/** A chunk of text. */
export const chunkText = (t: string): Chunk => ({ kind: "text", text: t });
/** A chunk that is another partial. */
export const chunkOf = (p: AnySql): Chunk => ({ kind: "sql", sql: p });

/**
 * Text that is SQL, taken as written. This is the one way to put a string a person typed into a template: a plain string is not accepted
 * as an interpolation, so that a value is never mistaken for SQL (FR-013).
 *
 * @param t - SQL text
 */
export const raw = (t: string): Sql<"fragment"> => sql("fragment", () => [chunkText(t)]);

/** Nothing at all. */
export const empty: Sql<"fragment"> = sql("fragment", () => []);

/**
 * A name, quoted as the context quotes names.
 *
 * @param parts - the parts of the name, a schema first where there is one
 */
export const name = (...parts: readonly string[]): Sql<"identifier"> => sql("identifier", () => [{ kind: "name", parts }]);

/**
 * A value to bind: a literal in a script, a parameter in a statement. A string must come through here.
 *
 * @param value - the value
 * @param spec - its logical type, where the dialect needs it to write the value
 */
export const bind = <T extends SqlValue>(value: T, spec?: DomainSpec): Sql<"expression", T> =>
  sql("expression", () => [spec === undefined ? { kind: "value", value } : { kind: "value", value, spec }]);

/** Partials one after another, with a separator between them. */
export function join<const P extends readonly AnySql[]>(
  parts: P,
  separator = ", ",
): Sql<"fragment", unknown, ReqOf<P[number]>, DxOf<P[number]>> {
  return sql("fragment", () => parts.flatMap((p, i) => (i === 0 ? [chunkOf(p)] : [chunkText(separator), chunkOf(p)])));
}

/** The same partial, said to be of another kind: for SQL written by hand whose kind the template cannot know. */
export const asKind = <K extends SqlKind, T, Req extends string, Dx extends string>(
  kind: K,
  p: Sql<SqlKind, unknown, Req, Dx>,
): Sql<K, T, Req, Dx> => sql(kind, p.chunks);

/** What may stand in a template: a partial, a list of partials, or a value that is not a string. */
export type Interpolation = AnySql | readonly AnySql[] | number | bigint | boolean | null | Date | Uint8Array;

function isSql(x: Interpolation): x is AnySql {
  return typeof x === "object" && x !== null && "sqlKind" in x;
}
function isList(x: Interpolation): x is readonly AnySql[] {
  return Array.isArray(x);
}

/**
 * The tagged template of SQL. Its text is un-indented; each interpolation is a partial, a list of partials (one a line) or a value to bind.
 * What it needs and which dialects it covers are those of its interpolations.
 *
 * @example
 * const q = SQL`select * from ${person} where ${person.c.last_name} = ${bind("Lovelace")}`;
 * render(q, context({ dialect: sqlite() }));
 */
export function SQL<const E extends readonly Interpolation[]>(
  strings: TemplateStringsArray,
  ...interpolations: E
): Sql<"fragment", unknown, ReqOf<E[number]>, DxOf<E[number]>> {
  const mark = (i: number): string => `\u0000${i}\u0000`;
  const whole = unindent(strings.map((s, i) => (i < interpolations.length ? s + mark(i) : s)).join(""));
  const pieces = whole.split(/\u0000(\d+)\u0000/);
  return sql("fragment", () => {
    const out: Chunk[] = [];
    pieces.forEach((piece, i) => {
      if (i % 2 === 0) {
        if (piece !== "") out.push(chunkText(piece));
        return;
      }
      const x = interpolations[Number(piece)];
      if (x === undefined) return;
      if (isSql(x)) out.push(chunkOf(x));
      else if (isList(x)) x.forEach((p, j) => out.push(...(j === 0 ? [chunkOf(p)] : [chunkText("\n"), chunkOf(p)])));
      else out.push({ kind: "value", value: x });
    });
    return out;
  });
}

/**
 * One partial for each dialect. Rendering it for a dialect it has no case for does not compile (FR-011), so a model written for three
 * dialects names all three.
 *
 * @param cases - the partial of each dialect, by the dialect's name
 * @example
 * const newId = byDialect({ postgres: raw("gen_random_uuid()"), duckdb: raw("uuid()"), sqlite: raw("lower(hex(randomblob(16)))") });
 */
export function byDialect<const C extends { readonly [dialect: string]: AnySql }, T = unknown>(
  cases: C,
): Sql<"fragment", T, never, keyof C & string>;
/** The same, said to be of a kind. */
export function byDialect<const C extends { readonly [dialect: string]: AnySql }, K extends SqlKind, T = unknown>(
  cases: C,
  kind: K,
): Sql<K, T, never, keyof C & string>;
/** Both forms. */
export function byDialect(cases: { readonly [dialect: string]: AnySql }, kind: SqlKind = "fragment"): Sql<SqlKind, unknown, never, string> {
  return sql(kind, (ctx) => {
    const chosen = cases[ctx.dialect.name];
    if (chosen === undefined) throw new Error(`byDialect has no case for ${ctx.dialect.name}`);
    return [chunkOf(chosen)];
  });
}

/** The dialect of a context's type; for a context that may be one of several, all of them. */
export type DialectOf<C> = C extends EmitContext<infer D> ? D : never;

/** A statement with its bound parameters, as a driver takes it. */
export interface Statement {
  /** The text, with the dialect's parameter marks. */
  readonly text: string;
  /** The values, in the order of the marks. */
  readonly params: readonly SqlValue[];
}

type Mode = { readonly kind: "script" } | { readonly kind: "statement"; readonly params: SqlValue[] };

function quoteName(ctx: EmitContext, n: string): string {
  return ctx.naming.quote === undefined ? ctx.dialect.quoteName(n) : ctx.naming.quote(n);
}

function write(chunks: readonly Chunk[], ctx: EmitContext, mode: Mode): string {
  let out = "";
  for (const c of chunks) {
    switch (c.kind) {
      case "text":
        out += c.text;
        break;
      case "name":
        out += c.parts.map((p) => quoteName(ctx, p)).join(".");
        break;
      case "value":
        if (mode.kind === "script") out += ctx.dialect.literal(c.value, c.spec);
        else {
          mode.params.push(ctx.dialect.encode(c.value, c.spec));
          out += ctx.dialect.param(mode.params.length);
        }
        break;
      case "sql": {
        const inner = write(c.sql.chunks(ctx), ctx, mode);
        // a partial of several lines keeps the indentation of the line it stands on
        const lineStart = out.lastIndexOf("\n") + 1;
        const lead = out.slice(lineStart);
        out += /^[ \t]+$/.test(lead) ? inner.replaceAll("\n", `\n${lead}`) : inner;
        break;
      }
      default:
        absurd(c);
    }
  }
  return out;
}

/** Renders without the compile-time check of fit: for the library's own code, which is generic over dialects. */
export function renderUnchecked(p: AnySql, ctx: EmitContext): string {
  return write(p.chunks(ctx), ctx, { kind: "script" });
}

/** The statement form without the compile-time check of fit. */
export function statementUnchecked(p: AnySql, ctx: EmitContext): Statement {
  const params: SqlValue[] = [];
  const t = write(p.chunks(ctx), ctx, { kind: "statement", params });
  return { text: t, params };
}

/**
 * Renders a partial as a script: every value written as a literal the dialect quotes safely (FR-014).
 *
 * @param p - the partial
 * @param ctx - the context; it must fit the partial, or the call does not compile
 */
export function render<Req extends string, Dx extends string, C extends EmitContext>(
  p: Sql<SqlKind, unknown, Req, Dx>,
  ctx: C & Fits<DialectOf<C>, Req, Dx>,
): string {
  return renderUnchecked(p, ctx);
}

/**
 * Renders a partial as a statement: its text with the dialect's parameter marks, and the values to bind (FR-014).
 *
 * @param p - the partial
 * @param ctx - the context; it must fit the partial, or the call does not compile
 */
export function statement<Req extends string, Dx extends string, C extends EmitContext>(
  p: Sql<SqlKind, unknown, Req, Dx>,
  ctx: C & Fits<DialectOf<C>, Req, Dx>,
): Statement {
  return statementUnchecked(p, ctx);
}
