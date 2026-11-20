// Spec: 0053-sql-typed FR-001, FR-002
/**
 * Typed expressions (commons data 0053-sql-typed): a value of SQL is an `Expr<T>`, where `T` is the TypeScript type of what it gives, nullable where it may be null. The operators take expressions of one type and
 * give expressions, so that a comparison of a number with a text, or a sum of a name, does not compile. An expression is data (a tree); `compile.ts` writes it for a dialect.
 *
 * @module
 */

declare const phantom: unique symbol;

/** What an expression is made of; written for a dialect by `compile.ts`. */
export type Node =
  | { readonly k: "col"; readonly alias: string; readonly name: string }
  | { readonly k: "out"; readonly key: string }
  | { readonly k: "lit"; readonly value: unknown }
  | { readonly k: "bin"; readonly op: "=" | "<>" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "||" | "LIKE"; readonly l: Node; readonly r: Node }
  | { readonly k: "bool"; readonly op: "AND" | "OR"; readonly parts: readonly Node[] }
  | { readonly k: "not"; readonly e: Node }
  | { readonly k: "isnull"; readonly e: Node; readonly negated: boolean }
  | { readonly k: "in"; readonly e: Node; readonly list: readonly Node[]; readonly negated: boolean }
  | { readonly k: "between"; readonly e: Node; readonly low: Node; readonly high: Node }
  | { readonly k: "fn"; readonly name: string; readonly args: readonly Node[]; readonly distinct?: true }
  | { readonly k: "star" }
  | { readonly k: "case"; readonly whens: readonly (readonly [Node, Node])[]; readonly otherwise: Node }
  | { readonly k: "sub"; readonly query: unknown; readonly form: "scalar" | "exists" | "in"; readonly e?: Node; readonly negated?: boolean };

/** An expression that gives a `T`. */
export interface Expr<out T> {
  readonly node: Node;
  readonly [phantom]?: T;
}

/** The type an expression gives. */
export type ValueOf<E> = E extends Expr<infer T> ? T : never;

/** What an operator takes where an expression of type `T` is wanted: the expression, or a plain value of the type. */
export type Operand<T> = Expr<T> | T;

const make = <T>(node: Node): Expr<T> => ({ node });
const isExpr = (v: unknown): v is Expr<unknown> => typeof v === "object" && v !== null && "node" in v && typeof (v as { node: unknown }).node === "object";
/** The node of an operand: an expression's own, or a literal. */
export const nodeOf = (v: unknown): Node => (isExpr(v) ? v.node : { k: "lit", value: v });

/** A value as an expression. */
export const lit = <T extends string | number | boolean | Date | null | readonly number[] | object>(value: T): Expr<T> => make({ k: "lit", value });

const cmp =
  (op: "=" | "<>" | "<" | "<=" | ">" | ">=") =>
  <T>(a: Expr<T>, b: Operand<NonNullable<T>>): Expr<boolean> =>
    make({ k: "bin", op, l: a.node, r: nodeOf(b) });
/** `a = b`; a null is never equal (use `isNull`). */
export const eq = cmp("=");
/** `a <> b`. */
export const ne = cmp("<>");
/** `a < b`. */
export const lt = cmp("<");
/** `a <= b`. */
export const lte = cmp("<=");
/** `a > b`. */
export const gt = cmp(">");
/** `a >= b`. */
export const gte = cmp(">=");

/** `a IS NULL`. */
export const isNull = (a: Expr<unknown>): Expr<boolean> => make({ k: "isnull", e: a.node, negated: false });
/** `a IS NOT NULL`. */
export const isNotNull = (a: Expr<unknown>): Expr<boolean> => make({ k: "isnull", e: a.node, negated: true });
/** `a IN (...)`; an empty list is false. */
export const inList = <T>(a: Expr<T>, values: readonly Operand<NonNullable<T>>[]): Expr<boolean> => make({ k: "in", e: a.node, list: values.map(nodeOf), negated: false });
/** `a NOT IN (...)`; an empty list is true. */
export const notInList = <T>(a: Expr<T>, values: readonly Operand<NonNullable<T>>[]): Expr<boolean> => make({ k: "in", e: a.node, list: values.map(nodeOf), negated: true });
/** `a BETWEEN low AND high`. */
export const between = <T>(a: Expr<T>, low: Operand<NonNullable<T>>, high: Operand<NonNullable<T>>): Expr<boolean> => make({ k: "between", e: a.node, low: nodeOf(low), high: nodeOf(high) });
/** `a LIKE pattern`. */
export const like = (a: Expr<string | null>, pattern: Operand<string>): Expr<boolean> => make({ k: "bin", op: "LIKE", l: a.node, r: nodeOf(pattern) });
/** A case-blind `LIKE`, written the same on every dialect (`lower(a) LIKE lower(pattern)`). */
export const ilike = (a: Expr<string | null>, pattern: Operand<string>): Expr<boolean> =>
  make({ k: "bin", op: "LIKE", l: { k: "fn", name: "lower", args: [a.node] }, r: { k: "fn", name: "lower", args: [nodeOf(pattern)] } });

/** Every condition holds; with none it is true. */
export const and = (...parts: readonly Expr<boolean>[]): Expr<boolean> => make({ k: "bool", op: "AND", parts: parts.map((p) => p.node) });
/** Some condition holds; with none it is false. */
export const or = (...parts: readonly Expr<boolean>[]): Expr<boolean> => make({ k: "bool", op: "OR", parts: parts.map((p) => p.node) });
/** `NOT a`. */
export const not = (a: Expr<boolean>): Expr<boolean> => make({ k: "not", e: a.node });

/** `a + b`, of numbers. */
export const add = <T extends number | null>(a: Expr<T>, b: Operand<number>): Expr<T> => make({ k: "bin", op: "+", l: a.node, r: nodeOf(b) });
/** `a - b`, of numbers. */
export const sub = <T extends number | null>(a: Expr<T>, b: Operand<number>): Expr<T> => make({ k: "bin", op: "-", l: a.node, r: nodeOf(b) });
/** `a * b`, of numbers. */
export const mul = <T extends number | null>(a: Expr<T>, b: Operand<number>): Expr<T> => make({ k: "bin", op: "*", l: a.node, r: nodeOf(b) });
/** The texts joined (`||`). */
export const concat = <T extends string | null>(a: Expr<T>, b: Operand<string>): Expr<T> => make({ k: "bin", op: "||", l: a.node, r: nodeOf(b) });
/** `lower(a)`. */
export const lower = <T extends string | null>(a: Expr<T>): Expr<T> => make({ k: "fn", name: "lower", args: [a.node] });
/** `upper(a)`. */
export const upper = <T extends string | null>(a: Expr<T>): Expr<T> => make({ k: "fn", name: "upper", args: [a.node] });
/** The first that is not null; the last is a value that is, so the result is not null. */
export const coalesce = <T>(a: Expr<T>, fallback: Operand<NonNullable<T>>): Expr<NonNullable<T>> => make({ k: "fn", name: "coalesce", args: [a.node, nodeOf(fallback)] });
/** `CASE WHEN ... THEN ... ELSE ... END`. */
export const choose = <T>(whens: readonly (readonly [Expr<boolean>, Operand<T>])[], otherwise: Operand<T>): Expr<T> =>
  make({ k: "case", whens: whens.map(([c, v]) => [c.node, nodeOf(v)] as const), otherwise: nodeOf(otherwise) });

/** `count(*)`. */
export const count = (): Expr<number> => make({ k: "fn", name: "count", args: [{ k: "star" }] });
/** `count(a)`: the rows where it is not null. */
export const countOf = (a: Expr<unknown>): Expr<number> => make({ k: "fn", name: "count", args: [a.node] });
/** `count(DISTINCT a)`. */
export const countDistinct = (a: Expr<unknown>): Expr<number> => make({ k: "fn", name: "count", args: [a.node], distinct: true });
/** `sum(a)`: null where there is no row. */
export const sum = (a: Expr<number | null>): Expr<number | null> => make({ k: "fn", name: "sum", args: [a.node] });
/** `avg(a)`: null where there is no row. */
export const avg = (a: Expr<number | null>): Expr<number | null> => make({ k: "fn", name: "avg", args: [a.node] });
/** `min(a)`: null where there is no row. */
export const min = <T>(a: Expr<T>): Expr<T | null> => make({ k: "fn", name: "min", args: [a.node] });
/** `max(a)`: null where there is no row. */
export const max = <T>(a: Expr<T>): Expr<T | null> => make({ k: "fn", name: "max", args: [a.node] });

/** One term of an `ORDER BY`. */
export interface Order {
  readonly e: Expr<unknown>;
  readonly dir: "ASC" | "DESC";
}
/** Ascending. */
export const asc = (e: Expr<unknown>): Order => ({ e, dir: "ASC" });
/** Descending. */
export const desc = (e: Expr<unknown>): Order => ({ e, dir: "DESC" });

/** An expression of a subquery's output column, for the `ORDER BY` of a select; the select makes these. */
export const outOf = <T>(key: string): Expr<T> => make({ k: "out", key });
export const subNode = <T>(node: Node): Expr<T> => make(node);
