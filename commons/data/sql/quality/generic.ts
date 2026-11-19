// Spec: 0052-sql-quality FR-005
/**
 * The generic tests of SQL-DQ (commons data 0052-sql-quality): the four that dbt has built in (`not_null`, `unique`, `accepted_values`, `relationships`) and those of the packages that are used most
 * (`expression_is_true`, `unique_combination_of_columns`, `not_empty_string`, `accepted_range`, `at_least_one`, `not_constant`, `equal_rowcount`, `equality`). Each is SQL that gives the rows that are wrong,
 * written with the quoting and the literals of the dialect.
 *
 * @module
 */
import { columnTest, modelTest, type Relation } from "./test.ts";

/** Every row has a value in the column. */
export const notNull = columnTest("not_null", (c) => `SELECT * FROM ${c.from} WHERE ${c.column} IS NULL`);

/** No value of the column is in more than one row. */
export const unique = columnTest("unique", (c) => `SELECT ${c.column} AS unique_field, count(*) AS n_records FROM ${c.from} WHERE ${c.column} IS NOT NULL GROUP BY ${c.column} HAVING count(*) > 1`);

/** The column holds only the values that are listed; a null is not looked at, as in dbt (it is for `notNull`). */
export const acceptedValues = columnTest<{ readonly values: readonly (string | number | boolean)[] }>("accepted_values", (c, a) => {
  const inList = a.values.length === 0 ? "1 = 0" : `${c.column} IN (${a.values.map((v) => c.dialect.literal(v)).join(", ")})`;
  return `SELECT ${c.column} AS value_field, count(*) AS n_records FROM ${c.from} WHERE ${c.column} IS NOT NULL AND NOT (${inList}) GROUP BY ${c.column}`;
});

/** Every value of the column that is not null is the value of a column of another relation. `where` filters the relation tested; `toWhere` the other. */
export const relationships = columnTest<{ readonly to: Relation; readonly field: string; readonly toWhere?: string }>("relationships", (c, a) => {
  const parent = c.qualify(a.to);
  const source = a.toWhere === undefined ? parent : `(SELECT * FROM ${parent} WHERE ${a.toWhere})`;
  const field = `parent.${c.dialect.quote(a.field)}`;
  return `SELECT dq_t.${c.column} AS from_field FROM ${c.from} LEFT JOIN ${source} AS parent ON dq_t.${c.column} = ${field} WHERE dq_t.${c.column} IS NOT NULL AND ${field} IS NULL`;
});

/** The expression, written in the dialect, is true of every row (of the column's table, if on a column). */
export const expressionIsTrue = modelTest<{ readonly expression: string }>("expression_is_true", (c, a) => `SELECT * FROM ${c.from} WHERE NOT COALESCE((${a.expression}), FALSE)`);

/** No combination of the columns is in more than one row. */
export const uniqueCombinationOfColumns = modelTest<{ readonly columns: readonly [string, ...string[]] }>("unique_combination_of_columns", (c, a) => {
  const cols = a.columns.map((x) => c.dialect.quote(x)).join(", ");
  return `SELECT ${cols}, count(*) AS n_records FROM ${c.from} GROUP BY ${cols} HAVING count(*) > 1`;
});

/** No value of the column is empty or only white space; a null is for `notNull`. */
export const notEmptyString = columnTest<{ readonly trim?: boolean } | void>("not_empty_string", (c, a) => `SELECT * FROM ${c.from} WHERE ${a !== undefined && a.trim === false ? c.column : `trim(${c.column})`} = ''`);

/** Every value of the column is in a range; `inclusive` is true where it is not said. */
export const acceptedRange = columnTest<{ readonly min?: number; readonly max?: number; readonly inclusive?: boolean }>("accepted_range", (c, a) => {
  const inc = a.inclusive ?? true;
  const parts: string[] = [];
  if (a.min !== undefined) parts.push(`${c.column} ${inc ? "<" : "<="} ${a.min}`);
  if (a.max !== undefined) parts.push(`${c.column} ${inc ? ">" : ">="} ${a.max}`);
  return `SELECT * FROM ${c.from} WHERE ${parts.length === 0 ? "1 = 0" : parts.join(" OR ")}`;
});

/** The column has at least one value that is not null. */
export const atLeastOne = columnTest("at_least_one", (c) => `SELECT 1 AS missing FROM (SELECT count(${c.column}) AS n FROM ${c.from}) AS dq_count WHERE n = 0`);

/** The column does not hold one value in all its rows. */
export const notConstant = columnTest("not_constant", (c) => `SELECT 1 AS constant FROM (SELECT count(DISTINCT ${c.column}) AS n FROM ${c.from}) AS dq_count WHERE n = 1`);

/** The model has as many rows as another relation. */
export const equalRowcount = modelTest<{ readonly to: Relation }>("equal_rowcount", (c, a) => `SELECT 1 AS differs FROM (SELECT (SELECT count(*) FROM ${c.from}) AS a, (SELECT count(*) FROM ${c.qualify(a.to)}) AS b) AS dq_count WHERE a <> b`);

/** The model has the same rows as another relation, in the columns that are named (the rows that are in one and not in the other are the failing rows). */
export const equality = modelTest<{ readonly to: Relation; readonly columns: readonly [string, ...string[]] }>("equality", (c, a) => {
  const cols = a.columns.map((x) => c.dialect.quote(x)).join(", ");
  const other = c.qualify(a.to);
  return `SELECT * FROM (SELECT ${cols} FROM ${c.from} EXCEPT SELECT ${cols} FROM ${other}) AS dq_left UNION ALL SELECT * FROM (SELECT ${cols} FROM ${other} EXCEPT SELECT ${cols} FROM ${c.from}) AS dq_right`;
});
