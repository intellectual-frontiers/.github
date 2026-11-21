/**
 * How a dialect's grammar differs from the common ground (commons lang-sql 0002-sql-ast-parser FR-013): the operators it adds with their binding powers, its cast operator, and its like-words. A {@link Grammar} is
 * data, made like a lexical by a function from the parent's, and checked against the dialect's lexical when the dialect is made.
 *
 * @remarks
 * The binding powers are those of {@link Prec}: an operator of the dialect binds as tightly as the level it is given, and associates to the left.
 *
 * @limits
 * A dialect cannot add a prefix operator, a postfix operator other than its cast, or a clause here; those are the grammar of a later specification.
 *
 * @example
 * ```ts
 * const g: Grammar = { ...ANSI_GRAMMAR, castOperator: "::", operators: [{ text: "->", prec: Prec.Other }] };
 * ```
 *
 * Spec: 0002-sql-ast-parser FR-009, FR-013
 *
 * @module
 */

/** The binding powers of the operators, from the loosest; a higher number binds tighter. */
export const Prec = {
  Or: 10,
  And: 20,
  Not: 30,
  Is: 40,
  Compare: 50,
  Like: 55,
  Other: 60,
  Additive: 70,
  Multiplicative: 80,
  Exponent: 85,
  Unary: 90,
  Cast: 100,
} as const;

/** An operator a dialect adds: its text as the lexer reads it and its binding power. */
export interface CustomOperator {
  readonly text: string;
  readonly prec: number;
}

/** How a dialect's grammar differs. */
export interface Grammar {
  /** The binary operators it adds; each becomes an `operator` node. */
  readonly operators: readonly CustomOperator[];
  /** The operator that casts (`::`), or none. */
  readonly castOperator: string | undefined;
  /** The words that are `LIKE` for it (`ILIKE`, `GLOB`), upper case. */
  readonly likeWords: readonly string[];
  /** The binary operators that are keywords (`DIV`, `MOD`, `XOR` in MySQL), upper case, each an `operator` node. */
  readonly wordOperators: readonly CustomOperator[];
  /** Whether any run of operator characters is an operator (PostgreSQL): a run the dialect does not list is read as one `operator` node of the loosest binding power, or as a prefix operator. */
  readonly operatorRuns: boolean;
  /** Whether a select may have no items (`SELECT FROM t`, PostgreSQL). */
  readonly emptySelect: boolean;
  /** Whether a query may begin with `FROM` (`FROM t SELECT a`, `FROM t`; DuckDB). */
  readonly fromFirst: boolean;
  /** Whether `x -> body` and `(x, y) -> body` are lambdas and not operators. */
  readonly lambdas: boolean;
  /** Whether `x:a.b` is a path into a value (Snowflake, Databricks). */
  readonly colonPaths: boolean;
  /** Whether `INDEX name ...` and `KEY name (...)` are elements of `CREATE TABLE` (MySQL, ClickHouse). */
  readonly tableIndexes: boolean;
  /** The words that begin a clause after a query that is kept as text to the end of the query (`SETTINGS`, `FORMAT` of ClickHouse), upper case. */
  readonly queryTail: readonly string[];
  /** Whether a call may be followed by a second list of arguments, the first being its parameters (`quantile(0.5)(x)`; ClickHouse). */
  readonly parametric: boolean;
  /** Whether `SELECT TOP n [PERCENT] [WITH TIES]` is read (T-SQL). */
  readonly selectTop: boolean;
}

/** The grammar of the common ground: nothing is added. */
export const ANSI_GRAMMAR: Grammar = { operators: [], castOperator: undefined, likeWords: [], wordOperators: [], operatorRuns: false, emptySelect: false, fromFirst: false, lambdas: false, colonPaths: false, tableIndexes: false, queryTail: [], parametric: false, selectTop: false };

/** The words the common grammar reserves: they are identifiers only after a `.` or where quoted. */
export const RESERVED_WORDS: readonly string[] = (
  "SELECT FROM WHERE GROUP HAVING ORDER BY LIMIT OFFSET FETCH UNION INTERSECT EXCEPT JOIN INNER LEFT RIGHT FULL CROSS NATURAL OUTER ON USING AS AND OR NOT NULL TRUE FALSE CASE WHEN THEN ELSE END " +
  "IN IS LIKE BETWEEN EXISTS DISTINCT ALL VALUES WITH INSERT INTO UPDATE SET DELETE CREATE TABLE VIEW INDEX ALTER DROP PRIMARY FOREIGN REFERENCES CHECK UNIQUE DEFAULT CONSTRAINT RETURNING WINDOW LATERAL ESCAPE COLLATE"
).split(" ");
