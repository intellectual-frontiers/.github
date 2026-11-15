/**
 * Expressions typed by what they yield: two things compare only where their values are of one type (commons 0009-sql-aide FR-013). A
 * value that is not a partial is bound, never written into the text.
 *
 * @module
 */
import type { SqlValue } from "../algebra/domain.ts";
import { type AnySql, bind, type Chunk, chunkOf, chunkText, sql, type Sql } from "./sql.ts";

/** An expression that yields a `T`. */
export type Expr<T, Req extends string = never, Dx extends string = string> = Sql<"expression", T, Req, Dx>;

/** What may stand where a `T` is wanted: an expression that yields one, or a value of it. */
export type Operand<T, Req extends string = never, Dx extends string = string> = Expr<T, Req, Dx> | Extract<T, SqlValue>;

function isExpr(x: unknown): x is AnySql {
  return typeof x === "object" && x !== null && "sqlKind" in x;
}
function chunk<T>(x: Operand<T, string, never>): Chunk {
  return isExpr(x) ? chunkOf(x) : chunkOf(bind(x));
}

function binary(op: string) {
  return <T, R1 extends string = never, R2 extends string = never, D1 extends string = string, D2 extends string = string>(
    a: Operand<T, R1, D1>,
    b: Operand<NoInfer<T>, R2, D2>,
  ): Expr<boolean, R1 | R2, D1 & D2> => sql("expression", () => [chunk(a), chunkText(` ${op} `), chunk(b)]);
}

/** `a = b`. */
export const eq = binary("=");
/** `a <> b`. */
export const ne = binary("<>");
/** `a < b`. */
export const lt = binary("<");
/** `a <= b`. */
export const lte = binary("<=");
/** `a > b`. */
export const gt = binary(">");
/** `a >= b`. */
export const gte = binary(">=");

function logical(op: string, whenEmpty: string) {
  return <R extends string = never, D extends string = string>(...terms: readonly Expr<boolean, R, D>[]): Expr<boolean, R, D> =>
    sql("expression", () => {
      if (terms.length === 0) return [chunkText(whenEmpty)];
      const out: Chunk[] = [chunkText("(")];
      terms.forEach((t, i) => out.push(...(i === 0 ? [chunkOf(t)] : [chunkText(` ${op} `), chunkOf(t)])));
      return [...out, chunkText(")")];
    });
}

/** Every term holds; with no term, true. */
export const and = logical("AND", "TRUE");
/** Some term holds; with no term, false. */
export const or = logical("OR", "FALSE");

/** The term does not hold. */
export const not = <R extends string = never, D extends string = string>(term: Expr<boolean, R, D>): Expr<boolean, R, D> =>
  sql("expression", () => [chunkText("NOT ("), chunkOf(term), chunkText(")")]);

/** The expression is null. */
export const isNull = <T, R extends string = never, D extends string = string>(e: Expr<T, R, D>): Expr<boolean, R, D> =>
  sql("expression", () => [chunkOf(e), chunkText(" IS NULL")]);

/** The expression is not null. */
export const isNotNull = <T, R extends string = never, D extends string = string>(e: Expr<T, R, D>): Expr<boolean, R, D> =>
  sql("expression", () => [chunkOf(e), chunkText(" IS NOT NULL")]);

/** The expression is one of the values. */
export const inList = <T, R extends string = never, D extends string = string>(
  e: Expr<T, R, D>,
  values: readonly Extract<NoInfer<T>, SqlValue>[],
): Expr<boolean, R, D> =>
  sql("expression", () => {
    const out: Chunk[] = [chunkOf(e), chunkText(" IN (")];
    values.forEach((v, i) => out.push(...(i === 0 ? [chunkOf(bind(v))] : [chunkText(", "), chunkOf(bind(v))])));
    return [...out, chunkText(")")];
  });

/** The moment a statement runs, in every dialect. */
export const now: Expr<Date> = sql("expression", () => [chunkText("CURRENT_TIMESTAMP")]);

/**
 * A call of a SQL function, said to yield a `T`.
 *
 * @param fn - the function's name, written as given
 * @param args - its arguments
 */
export const call = <T>(fn: string, ...args: readonly AnySql[]): Expr<T> =>
  sql("expression", () => {
    const out: Chunk[] = [chunkText(`${fn}(`)];
    args.forEach((a, i) => out.push(...(i === 0 ? [chunkOf(a)] : [chunkText(", "), chunkOf(a)])));
    return [...out, chunkText(")")];
  });
