/**
 * Reading rows: a query over a relation whose rows are the relation's, so that what uses the query (a routine that returns them, a
 * transform, a driver) is typed by it (commons 0006-sql-aide FR-041).
 *
 * @module
 */
import type { Expr } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, sql, type Sql } from "../emit/sql.ts";

/** What a query is made of, as data. */
interface SelectSpec {
  readonly from: AnySql;
  readonly where: readonly AnySql[];
  readonly orderBy: readonly AnySql[];
  readonly limit?: number;
}

/** A query for the rows of a relation: every method gives a new query. */
export interface Select<Row, Req extends string = never, Dx extends string = string> extends Sql<"statement", Row, Req, Dx> {
  /** Keeps the rows that pass a condition; conditions given one after another must all hold. */
  readonly where: <R extends string = never, D extends string = string>(condition: Expr<boolean, R, D>) => Select<Row, Req | R, Dx & D>;
  /** Orders the rows by expressions, each ascending unless made with `desc`. */
  readonly orderBy: (...by: readonly AnySql[]) => Select<Row, Req, Dx>;
  /** Keeps at most a number of rows. */
  readonly limit: (rows: number) => Select<Row, Req, Dx>;
}

function build<Row, Req extends string, Dx extends string>(spec: SelectSpec): Select<Row, Req, Dx> {
  return {
    sqlKind: "statement",
    chunks: () => {
      const out: Chunk[] = [chunkText("SELECT * FROM "), chunkOf(spec.from)];
      spec.where.forEach((w, i) => out.push(chunkText(i === 0 ? " WHERE " : " AND "), chunkOf(w)));
      spec.orderBy.forEach((o, i) => out.push(chunkText(i === 0 ? " ORDER BY " : ", "), chunkOf(o)));
      if (spec.limit !== undefined) out.push(chunkText(` LIMIT ${spec.limit}`));
      return out;
    },
    where: (condition) => build({ ...spec, where: [...spec.where, condition] }),
    orderBy: (...by) => build({ ...spec, orderBy: [...spec.orderBy, ...by] }),
    limit: (rows) => build({ ...spec, limit: Math.max(0, Math.trunc(rows)) }),
  };
}

/**
 * Reads the rows of a relation: a table, a view, or what a routine returns.
 *
 * @param from - the relation
 * @example
 * const lovelaces = select(person).where(eq(person.c.family_name, "Lovelace")).orderBy(person.c.given_name).limit(10);
 */
export function select<Row, Req extends string = never, Dx extends string = string>(
  from: Sql<"relation", Row, Req, Dx>,
): Select<Row, Req, Dx> {
  return build({ from, where: [], orderBy: [] });
}

/** An expression in descending order, for `orderBy`. */
export const desc = (by: AnySql): Sql<"fragment"> => sql("fragment", () => [chunkOf(by), chunkText(" DESC")]);

/**
 * Says what rows SQL written by hand gives, so that it can stand where typed rows are wanted. The compiler takes the word for it; a test
 * that runs the SQL in an engine is what holds it true.
 *
 * @example
 * const pairs = rowsAs<{ readonly a: number; readonly b: string }>()(SQL`SELECT 1 AS a, 'x' AS b`);
 */
export const rowsAs =
  <Row>() =>
  <Req extends string, Dx extends string>(query: Sql<"fragment" | "statement", unknown, Req, Dx>): Sql<"statement", Row, Req, Dx> =>
    sql("statement", query.chunks);

/**
 * Says what value an expression written by hand gives, as `rowsAs` does for rows.
 *
 * @example
 * const initial = valueAs<string>()(SQL`upper(substr(${given}, 1, 1))`);
 */
export const valueAs =
  <T>() =>
  <Req extends string, Dx extends string>(expression: Sql<"fragment" | "expression", unknown, Req, Dx>): Sql<"expression", T, Req, Dx> =>
    sql("expression", expression.chunks);
