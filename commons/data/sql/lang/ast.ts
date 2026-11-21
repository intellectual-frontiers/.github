/**
 * The syntax tree of SQL (commons data 0066-sql-ast-parser FR-001 to FR-007): a closed union of nodes told apart by `kind`, each child field typed with the sort of node it may hold, so that a node of the wrong
 * sort in a place does not compile and a `switch` on `kind` that leaves a kind out does not compile either. Every node holds `start` and `end`, the half-open range of its text in UTF-16 units, and nothing else
 * about where it is: no parent and no text.
 *
 * @remarks
 * Every field of a node is always present (an absent child is `undefined`, an absent list is empty), so that all nodes of a kind have one shape. The tree is that of the common ground of SQL: what a dialect
 * writes beyond it is read as one of these kinds (`operator`, a `like` with its word), never a kind that only one dialect has.
 *
 * @example
 * ```ts
 * function columns(e: Expr): number {
 *   switch (e.kind) {
 *     case "name": return 1;
 *     case "binary": return columns(e.left) + columns(e.right);
 *     default: return 0;
 *   }
 * }
 * ```
 *
 * Spec: 0066-sql-ast-parser FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
 *
 * @module
 */
import type { ParamStyle } from "./lexical.ts";

/** What every node has: where its text is. */
export interface Base {
  /** Where its text begins. */
  readonly start: number;
  /** Where its text ends, exclusive. */
  readonly end: number;
}

// names

/** An identifier: its text without the quotes, a doubled closing quote made one. */
export interface Ident extends Base {
  readonly kind: "ident";
  readonly name: string;
  readonly quoted: boolean;
}

/** A qualified name: `a`, `a.b`, `a.b.c`. */
export interface Name extends Base {
  readonly kind: "name";
  readonly parts: readonly Ident[];
}

/** A star, with the qualifier it has: `*`, `t.*`. */
export interface Star extends Base {
  readonly kind: "star";
  readonly qualifier: Name | undefined;
  /** What follows the star: `EXCEPT (a)`, `EXCLUDE (a)`, `REPLACE (x AS a)`, `RENAME (a AS b)`, in the order written. */
  readonly modifiers: readonly StarModifier[];
}

/** A modifier of a star: its keyword (upper case) and its items (a plain column is an item without an alias). */
export interface StarModifier extends Base {
  readonly kind: "star-modifier";
  readonly keyword: string;
  readonly items: readonly SelectItem[];
}

// literals

/** A number, as written. */
export interface NumberLit extends Base {
  readonly kind: "number";
  readonly text: string;
}

/** A string, its value as the dialect reads it, and the prefix before its quote (`E`, `N`, `X`, or empty). */
export interface StringLit extends Base {
  readonly kind: "string";
  readonly value: string;
  readonly prefix: string;
}

/** `TRUE` or `FALSE`. */
export interface BoolLit extends Base {
  readonly kind: "boolean";
  readonly value: boolean;
}

/** `NULL`. */
export interface NullLit extends Base {
  readonly kind: "null";
}

/** A parameter, its style and its text. */
export interface Param extends Base {
  readonly kind: "param";
  readonly style: ParamStyle;
  readonly text: string;
}

// expressions

/** The unary operators. */
export type UnaryOp = "-" | "+" | "NOT";

/** A unary expression. */
export interface Unary extends Base {
  readonly kind: "unary";
  readonly op: UnaryOp;
  readonly arg: Expr;
}

/** The binary operators of the common ground. */
export type BinaryOp = "+" | "-" | "*" | "/" | "%" | "||" | "=" | "<>" | "!=" | "<" | "<=" | ">" | ">=" | "AND" | "OR";

/** A binary expression. */
export interface Binary extends Base {
  readonly kind: "binary";
  readonly op: BinaryOp;
  readonly left: Expr;
  readonly right: Expr;
}

/** A binary expression whose operator is the dialect's own, as written. */
export interface Operator extends Base {
  readonly kind: "operator";
  readonly op: string;
  /** Missing for an operator written before its operand (`@ x`, `|/ x`). */
  readonly left: Expr | undefined;
  readonly right: Expr;
}

/** What `IS` tests. */
export type IsTest = "null" | "true" | "false" | "unknown" | "distinct-from";

/** `x IS [NOT] NULL | TRUE | FALSE | UNKNOWN | DISTINCT FROM other`. */
export interface Is extends Base {
  readonly kind: "is";
  readonly arg: Expr;
  readonly test: IsTest;
  readonly negated: boolean;
  /** The expression after `DISTINCT FROM`. */
  readonly other: Expr | undefined;
}

/** `x [NOT] BETWEEN low AND high`. */
export interface Between extends Base {
  readonly kind: "between";
  readonly arg: Expr;
  readonly negated: boolean;
  readonly low: Expr;
  readonly high: Expr;
}

/** `x [NOT] IN (a, b, ...)`. */
export interface In extends Base {
  readonly kind: "in";
  readonly arg: Expr;
  readonly negated: boolean;
  readonly values: readonly Expr[];
  /** `x IN t`, with no parentheses (SQLite): the one value is the table's name. */
  readonly bare: boolean;
}

/** `x [NOT] IN (query)`. */
export interface InQuery extends Base {
  readonly kind: "in-query";
  readonly arg: Expr;
  readonly negated: boolean;
  readonly query: Query;
}

/** `x [NOT] LIKE pattern [ESCAPE e]`; `op` is the word, upper case (`LIKE`, `ILIKE`, ...). */
export interface Like extends Base {
  readonly kind: "like";
  readonly arg: Expr;
  readonly op: string;
  readonly negated: boolean;
  readonly pattern: Expr;
  readonly escape: Expr | undefined;
}

/** One `WHEN cond THEN result` of a `CASE`. */
export interface When extends Base {
  readonly kind: "when";
  readonly cond: Expr;
  readonly result: Expr;
}

/** `CASE [operand] WHEN ... THEN ... [ELSE e] END`. */
export interface Case extends Base {
  readonly kind: "case";
  readonly operand: Expr | undefined;
  readonly whens: readonly When[];
  readonly otherwise: Expr | undefined;
}

/** `CAST(x AS type)`, and `x::type` where the dialect has it. */
export interface Cast extends Base {
  readonly kind: "cast";
  readonly arg: Expr;
  readonly type: DataType;
  /** `TRY_CAST` and `SAFE_CAST`, which give `NULL` where the cast fails. */
  readonly try: boolean;
  /** The `FORMAT` of `CAST(x AS type FORMAT 'f')`. */
  readonly format: Expr | undefined;
}

/** `EXTRACT(field FROM x)`; the field is upper case. */
export interface ExtractField extends Base {
  readonly kind: "extract";
  readonly field: string;
  readonly arg: Expr;
}

/** `INTERVAL value [unit]`; the unit is upper case. */
export interface Interval extends Base {
  readonly kind: "interval";
  readonly value: Expr;
  readonly unit: string | undefined;
}

/** A named argument of a call: `name => value`, `name := value`. */
export interface NamedArg extends Base {
  readonly kind: "named-arg";
  readonly name: Ident;
  readonly value: Expr;
}

/** `[a, b]` and `ARRAY[a, b]`. */
export interface ArrayLit extends Base {
  readonly kind: "array";
  readonly items: readonly Expr[];
}

/** `x[i]`, and the slice `x[i:j]` (either end may be missing: `x[:j]`, `x[i:]`). */
export interface Subscript extends Base {
  readonly kind: "subscript";
  readonly arg: Expr;
  readonly index: Expr | undefined;
  /** The end of a slice. */
  readonly upper: Expr | undefined;
  readonly slice: boolean;
}

/** A field of a row: `(r).c`, `(r).*` (a field of `undefined` is the star). */
export interface FieldAccess extends Base {
  readonly kind: "field";
  readonly arg: Expr;
  readonly field: Ident | undefined;
}

/** A literal written with its type's name before the string: `DATE '2020-01-01'`, `int2 '2'`; the type is upper case. */
export interface TypedString extends Base {
  readonly kind: "typed-string";
  readonly type: string;
  readonly value: StringLit;
}

/** A keyword argument of a call: the `FROM`, `FOR`, `IN`, `PLACING` or `SIMILAR` of `SUBSTRING(x FROM 1 FOR 2)`, the `BOTH`, `LEADING` or `TRAILING` of `TRIM`, `VARIADIC`; its value is missing for `TRIM(BOTH FROM x)`'s `BOTH`. */
export interface KeywordArg extends Base {
  readonly kind: "keyword-arg";
  readonly keyword: string;
  readonly value: Expr | undefined;
}

/** `x COLLATE name`. */
export interface Collate extends Base {
  readonly kind: "collate";
  readonly arg: Expr;
  readonly collation: Name;
}

/** A call: `name(args)`, with `DISTINCT`, `FILTER (WHERE ...)` and `OVER`. */
export interface Call extends Base {
  readonly kind: "call";
  readonly name: Name;
  readonly args: readonly Argument[];
  readonly distinct: boolean;
  /** The `ORDER BY` among the arguments: `string_agg(x, ',' ORDER BY y)`. */
  readonly orderBy: readonly OrderItem[];
  /** `WITHIN GROUP (ORDER BY ...)`. */
  readonly withinGroup: readonly OrderItem[];
  /** `IGNORE NULLS` or `RESPECT NULLS` after the arguments. */
  readonly nullTreatment: "ignore" | "respect" | undefined;
  readonly filter: Expr | undefined;
  readonly over: WindowSpec | undefined;
}

/** `EXISTS (query)`. */
export interface Exists extends Base {
  readonly kind: "exists";
  readonly query: Query;
}

/** A query used as a value: `(SELECT ...)`. */
export interface ScalarQuery extends Base {
  readonly kind: "scalar-query";
  readonly query: Query;
}

/** A row: `(a, b)`. */
export interface Tuple extends Base {
  readonly kind: "tuple";
  readonly items: readonly Expr[];
}

/** An expression. */
export type Expr =
  | Name
  | Star
  | NumberLit
  | StringLit
  | BoolLit
  | NullLit
  | Param
  | Unary
  | Binary
  | Operator
  | Is
  | Between
  | In
  | InQuery
  | Like
  | Case
  | Cast
  | ExtractField
  | Interval
  | ArrayLit
  | Subscript
  | FieldAccess
  | TypedString
  | Collate
  | Call
  | Exists
  | ScalarQuery
  | Tuple;

// windows and ordering

/** One end of a window frame. */
export interface FrameBound extends Base {
  readonly kind: "frame-bound";
  readonly type: "unbounded-preceding" | "preceding" | "current-row" | "following" | "unbounded-following";
  /** The distance, for `n PRECEDING` and `n FOLLOWING`. */
  readonly offset: Expr | undefined;
}

/** A window frame: `ROWS | RANGE | GROUPS` from one bound, or between two. */
export interface Frame extends Base {
  readonly kind: "frame";
  readonly unit: "rows" | "range" | "groups";
  readonly from: FrameBound;
  readonly to: FrameBound | undefined;
  /** The `EXCLUDE` of the frame, upper case: `NO OTHERS`, `CURRENT ROW`, `GROUP` or `TIES`. */
  readonly exclude: string | undefined;
}

/** A window: `OVER name`, or `OVER ([name] [PARTITION BY ...] [ORDER BY ...] [frame])`. */
export interface WindowSpec extends Base {
  readonly kind: "window-spec";
  readonly base: Ident | undefined;
  readonly partitionBy: readonly Expr[];
  readonly orderBy: readonly OrderItem[];
  readonly frame: Frame | undefined;
}

/** One item of an `ORDER BY`. */
export interface OrderItem extends Base {
  readonly kind: "order-item";
  readonly expr: Expr;
  readonly direction: "asc" | "desc" | undefined;
  readonly nulls: "first" | "last" | undefined;
  /** The operator class after an index column. */
  readonly opclass: string | undefined;
  /** The operator of `ORDER BY x USING <`. */
  readonly using: string | undefined;
}

// queries

/** `name AS (window)` of a `WINDOW` clause. */
export interface WindowDef extends Base {
  readonly kind: "window-def";
  readonly name: Ident;
  readonly spec: WindowSpec;
}

/** One item of a select list: an expression and its alias. */
export interface SelectItem extends Base {
  readonly kind: "select-item";
  readonly expr: Expr;
  readonly alias: Ident | undefined;
}

/** `SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... LIMIT ... OFFSET ...`. */
export interface Select extends Base {
  readonly kind: "select";
  readonly distinct: boolean;
  readonly items: readonly SelectItem[];
  readonly from: readonly Source[];
  readonly where: Expr | undefined;
  /** The expressions of `DISTINCT ON (...)`. */
  readonly distinctOn: readonly Expr[];
  readonly groupBy: readonly Expr[];
  /** `GROUP BY ALL`. */
  readonly groupAll: boolean;
  readonly having: Expr | undefined;
  /** The named windows of `WINDOW w AS (...)`. */
  readonly windows: readonly WindowDef[];
  readonly qualify: Expr | undefined;
  readonly orderBy: readonly OrderItem[];
  readonly limit: Expr | undefined;
  readonly offset: Expr | undefined;
  /** The locking clauses (`FOR UPDATE OF t NOWAIT`), as text. */
  readonly locking: string | undefined;
}

/** `UNION`, `INTERSECT` or `EXCEPT`. */
export type SetOperator = "union" | "intersect" | "except";

/** Two queries combined; the `ORDER BY`, `LIMIT` and `OFFSET` that follow it are its own. */
export interface SetOp extends Base {
  readonly kind: "set-op";
  readonly op: SetOperator;
  readonly quantifier: "all" | "distinct" | undefined;
  readonly left: Query;
  readonly right: Query;
  readonly orderBy: readonly OrderItem[];
  readonly limit: Expr | undefined;
  readonly offset: Expr | undefined;
  /** The locking clauses (`FOR UPDATE OF t NOWAIT`), as text. */
  readonly locking: string | undefined;
}

/** `VALUES (...), (...)`. */
export interface Values extends Base {
  readonly kind: "values";
  readonly rows: readonly Tuple[];
}

/** One common table expression: `name [(columns)] AS (query)`. */
export interface Cte extends Base {
  readonly kind: "cte";
  readonly name: Ident;
  readonly columns: readonly Ident[];
  readonly query: CteBody;
  /** `MATERIALIZED` or `NOT MATERIALIZED`, where written. */
  readonly materialized: "materialized" | "not-materialized" | undefined;
  /** The `SEARCH` or `CYCLE` clause after it, as text. */
  readonly trailer: string | undefined;
}

/** `WITH [RECURSIVE] ctes body`. */
export interface With extends Base {
  readonly kind: "with";
  readonly recursive: boolean;
  readonly ctes: readonly Cte[];
  /** What follows: a query, or a data change (`WITH x AS (...) INSERT ...`). */
  readonly body: CteBody;
}

/** What a common table expression or a `WITH` holds: a query, or a data change (`WITH x AS (INSERT ... RETURNING *) ...`). */
export type CteBody = Query | Insert | Update | Delete;

/** A query. */
export type Query = Select | SetOp | Values | With;

// sources

/** The alias of a source: `AS name [(columns)]`. */
export interface Alias extends Base {
  readonly kind: "alias";
  readonly name: Ident;
  readonly columns: readonly Ident[];
  /** The types of a list of column definitions (`AS t (a int, b text)`), in the order of the columns; an entry is missing for a column written without one. */
  readonly types: readonly (DataType | undefined)[];
}

/** A table named in `FROM`, with its alias. */
export interface TableRef extends Base {
  readonly kind: "table";
  readonly name: Name;
  readonly alias: Alias | undefined;
  /** `NOT INDEXED` or `INDEXED BY name` after the table (SQLite), as text. */
  readonly hint: string | undefined;
}

/** A query used as a source: `[LATERAL] (query) [alias]`. */
export interface SubquerySource extends Base {
  readonly kind: "subquery";
  readonly query: Query;
  readonly alias: Alias | undefined;
  readonly lateral: boolean;
}

/** A function used as a source: `[LATERAL] fn(args) [alias]`. */
export interface TableFn extends Base {
  readonly kind: "table-fn";
  readonly call: Call;
  readonly alias: Alias | undefined;
  readonly lateral: boolean;
  /** `WITH ORDINALITY`. */
  readonly ordinality: boolean;
}

/** The types of join. */
export type JoinType = "inner" | "left" | "right" | "full" | "cross" | "semi" | "anti";

/** A join of two sources, with `ON` or `USING`. */
export interface Join extends Base {
  readonly kind: "join";
  readonly type: JoinType;
  readonly natural: boolean;
  readonly left: Source;
  readonly right: Source;
  readonly on: Expr | undefined;
  readonly using: readonly Ident[];
  /** The alias of the `USING` list: `JOIN t USING (i) AS x`. */
  readonly usingAlias: Ident | undefined;
  /** The alias of a parenthesized join: `(a JOIN b ON ...) AS t`. */
  readonly alias: Alias | undefined;
}

/** A source of rows. */
export type Source = TableRef | SubquerySource | TableFn | Join;

// data changes

/** `INSERT INTO table [(columns)] query | DEFAULT VALUES [RETURNING ...]`; a source of `undefined` is `DEFAULT VALUES`. */
export interface Insert extends Base {
  readonly kind: "insert";
  readonly table: Name;
  /** The alias of the table (`INSERT INTO t AS x`). */
  readonly alias: Ident | undefined;
  /** The columns: names, or parts of them (`a[1]`, `r.f`). */
  readonly columns: readonly Expr[];
  readonly source: Query | undefined;
  /** The `OR` of `INSERT OR REPLACE`, or `REPLACE` for `REPLACE INTO`, upper case. */
  readonly conflict: string | undefined;
  readonly onConflict: OnConflict | undefined;
  readonly returning: readonly SelectItem[];
}

/** `ON CONFLICT [(target) | ON CONSTRAINT name] [WHERE ...] DO NOTHING | DO UPDATE SET ... [WHERE ...]`. */
export interface OnConflict extends Base {
  readonly kind: "on-conflict";
  readonly targets: readonly Expr[];
  readonly constraint: Ident | undefined;
  readonly targetWhere: Expr | undefined;
  /** Whether the action is `DO UPDATE` (and not `DO NOTHING`). */
  readonly update: boolean;
  readonly assignments: readonly Assignment[];
  readonly where: Expr | undefined;
}

/** One `target = value` of an `UPDATE`. */
export interface Assignment extends Base {
  readonly kind: "assignment";
  /** The column, or a part of one (`a[1]`, `r.f`), or a row of columns (`(a, b)`). */
  readonly target: Expr;
  readonly value: Expr;
}

/** `UPDATE table SET ... [FROM ...] [WHERE ...] [RETURNING ...]`. */
export interface Update extends Base {
  readonly kind: "update";
  readonly table: TableRef;
  readonly assignments: readonly Assignment[];
  readonly from: readonly Source[];
  readonly where: Expr | undefined;
  readonly returning: readonly SelectItem[];
}

/** `DELETE FROM table [WHERE ...] [RETURNING ...]`. */
export interface Delete extends Base {
  readonly kind: "delete";
  readonly table: TableRef;
  /** The sources of `USING`. */
  readonly using: readonly Source[];
  readonly where: Expr | undefined;
  readonly returning: readonly SelectItem[];
}

// definitions

/** A data type: its words, upper case, joined by a space (`DOUBLE PRECISION`, `TIMESTAMP WITH TIME ZONE`, `INTEGER[]`), and its arguments. */
export interface DataType extends Base {
  readonly kind: "data-type";
  readonly name: string;
  readonly args: readonly Expr[];
  /** The name of its `COLLATE`, as written. */
  readonly collation: string | undefined;
}

/** `[CONSTRAINT name] NOT NULL`. */
export interface NotNull extends Base {
  readonly kind: "not-null";
  readonly name: Ident | undefined;
}

/** `[CONSTRAINT name] DEFAULT expr`. */
export interface Default extends Base {
  readonly kind: "default";
  readonly name: Ident | undefined;
  readonly expr: Expr;
}

/** `[CONSTRAINT name] PRIMARY KEY [(columns)]`; the columns are empty on a column. */
export interface PrimaryKey extends Base {
  readonly kind: "primary-key";
  readonly name: Ident | undefined;
  readonly columns: readonly Ident[];
}

/** `[CONSTRAINT name] UNIQUE [(columns)]`; the columns are empty on a column. */
export interface Unique extends Base {
  readonly kind: "unique";
  readonly name: Ident | undefined;
  readonly columns: readonly Ident[];
}

/** `[CONSTRAINT name] CHECK (expr)`. */
export interface Check extends Base {
  readonly kind: "check";
  readonly name: Ident | undefined;
  readonly expr: Expr;
  /** `NO INHERIT` or `NOT VALID` after it, as text. */
  readonly options: string | undefined;
}

/** What a foreign key does when the row it refers to changes. */
export type RefAction = "cascade" | "restrict" | "set-null" | "set-default" | "no-action";

/** `REFERENCES table [(columns)] [ON DELETE action] [ON UPDATE action]`. */
export interface Reference extends Base {
  readonly kind: "reference";
  readonly table: Name;
  readonly columns: readonly Ident[];
  readonly onDelete: RefAction | undefined;
  readonly onUpdate: RefAction | undefined;
  /** What follows (`MATCH FULL`, `NOT DEFERRABLE`, `DEFERRABLE INITIALLY DEFERRED`), as text. */
  readonly options: string | undefined;
}

/** `[CONSTRAINT name] [FOREIGN KEY (columns)] REFERENCES ...`; the columns are empty on a column. */
export interface ForeignKey extends Base {
  readonly kind: "foreign-key";
  readonly name: Ident | undefined;
  readonly columns: readonly Ident[];
  readonly reference: Reference;
}

/** A constraint of a column. */
export type ColumnConstraint = NotNull | Default | PrimaryKey | Unique | Check | ForeignKey | ColumnOption;

/** An option of a column that the grammar does not read apart (`AUTOINCREMENT`, `UNSIGNED`, `GENERATED ALWAYS AS (expr) STORED`), as text, with the expression of `AS (expr)` where there is one. */
export interface ColumnOption extends Base {
  readonly kind: "column-option";
  readonly name: Ident | undefined;
  readonly text: string;
  readonly expr: Expr | undefined;
}

/** `LIKE table [INCLUDING ...]` among the elements of a `CREATE TABLE`; the options are text. */
export interface TableLike extends Base {
  readonly kind: "table-like";
  readonly table: Name;
  readonly options: string | undefined;
}

/** A constraint of a table. */
export type TableConstraint = PrimaryKey | Unique | Check | ForeignKey | TableLike | ColumnOption;

/** A column of a table: its name, type and constraints. */
export interface ColumnDef extends Base {
  readonly kind: "column-def";
  readonly name: Ident;
  readonly type: DataType;
  readonly constraints: readonly ColumnConstraint[];
}

/** `CREATE TABLE [IF NOT EXISTS] name (columns and constraints)`; the elements are in the order of the text. */
export interface CreateTable extends Base {
  readonly kind: "create-table";
  readonly name: Name;
  readonly ifNotExists: boolean;
  /** Whether it is `TEMP` or `TEMPORARY`. */
  readonly temporary: boolean;
  readonly elements: readonly (ColumnDef | TableConstraint)[];
  /** The query of `AS query`, for a table made from one. */
  readonly query: Query | undefined;
  /** The text after the column list or the name that the parser does not read (an engine, partitions, options), as written. */
  readonly options: string | undefined;
}

/** `CREATE [UNIQUE] INDEX [IF NOT EXISTS] [name] ON table (items) [WHERE ...]`. */
export interface CreateIndex extends Base {
  readonly kind: "create-index";
  readonly unique: boolean;
  readonly concurrently: boolean;
  readonly ifNotExists: boolean;
  readonly name: Name | undefined;
  /** `ON ONLY table`. */
  readonly only: boolean;
  readonly table: Name;
  readonly items: readonly OrderItem[];
  readonly where: Expr | undefined;
  /** The method of `USING method`, as written. */
  readonly method: string | undefined;
  /** What follows the columns (`INCLUDE (...)`, `WITH (...)`, `NULLS NOT DISTINCT`), as text. */
  readonly options: string | undefined;
}

/** `CREATE [OR REPLACE] VIEW name [(columns)] AS query`. */
export interface CreateView extends Base {
  readonly kind: "create-view";
  readonly orReplace: boolean;
  readonly name: Name;
  readonly columns: readonly Ident[];
  /** The `WITH (...)` before `AS`, as text. */
  readonly options: string | undefined;
  readonly query: Query;
  /** The `WITH CHECK OPTION` after the query, as text. */
  readonly checkOption: string | undefined;
}

/** `ADD [COLUMN] [IF NOT EXISTS] column`. */
export interface AddColumn extends Base {
  readonly kind: "add-column";
  readonly ifNotExists: boolean;
  readonly column: ColumnDef;
}

/** `DROP [COLUMN] [IF EXISTS] name`. */
export interface DropColumn extends Base {
  readonly kind: "drop-column";
  readonly ifExists: boolean;
  readonly name: Ident;
  /** `CASCADE` or `RESTRICT`, where written. */
  readonly behavior: "cascade" | "restrict" | undefined;
}

/** `ADD constraint`. */
export interface AddConstraint extends Base {
  readonly kind: "add-constraint";
  readonly constraint: TableConstraint;
  /** `NOT VALID`, as text. */
  readonly options: string | undefined;
}

/** `DROP CONSTRAINT [IF EXISTS] name`. */
export interface DropConstraint extends Base {
  readonly kind: "drop-constraint";
  readonly ifExists: boolean;
  readonly name: Ident;
}

/** `RENAME TO name`. */
export interface RenameTable extends Base {
  readonly kind: "rename-table";
  readonly to: Ident;
}

/** `RENAME [COLUMN] from TO to`. */
export interface RenameColumn extends Base {
  readonly kind: "rename-column";
  readonly from: Ident;
  readonly to: Ident;
}

/** One action of an `ALTER TABLE`. */
export type AlterAction = AddColumn | DropColumn | AddConstraint | DropConstraint | RenameTable | RenameColumn;

/** `ALTER TABLE [IF EXISTS] name action [, action ...]`. */
export interface AlterTable extends Base {
  readonly kind: "alter-table";
  readonly ifExists: boolean;
  readonly table: Name;
  readonly actions: readonly AlterAction[];
}

/** `DROP TABLE | VIEW | INDEX [IF EXISTS] names [CASCADE | RESTRICT]`. */
export interface Drop extends Base {
  readonly kind: "drop";
  readonly object: "table" | "view" | "index";
  readonly ifExists: boolean;
  readonly names: readonly Name[];
  readonly concurrently: boolean;
  readonly behavior: "cascade" | "restrict" | undefined;
}

// scripts

/** A parameter of a routine. */
export interface RoutineParam extends Base {
  readonly kind: "routine-param";
  readonly mode: "in" | "out" | "inout" | "variadic" | undefined;
  readonly name: Ident | undefined;
  readonly type: DataType;
  readonly default: Expr | undefined;
}

/** How a routine's body is written. */
export type BodyStyle = "dollar" | "string" | "block" | "return" | "external";

/** The body of a routine: its style, its text, and where the text is in the whole text. */
export interface RoutineBody extends Base {
  readonly kind: "routine-body";
  readonly style: BodyStyle;
  /** The text between its delimiters; for a string body, the string's value. */
  readonly text: string;
  /** Where the text begins in the whole text. */
  readonly bodyStart: number;
  /** Where the text ends in the whole text. */
  readonly bodyEnd: number;
  /** Whether the source between `bodyStart` and `bodyEnd` is `text`: false where a string body has escapes. */
  readonly exact: boolean;
  /** The expression of `RETURN expression`. */
  readonly expr: Expr | undefined;
}

/** `CREATE [OR REPLACE] FUNCTION | PROCEDURE name (parameters) ...`: its header and its body. */
export interface CreateRoutine extends Base {
  readonly kind: "create-routine";
  readonly object: "function" | "procedure";
  readonly orReplace: boolean;
  readonly name: Name;
  readonly params: readonly RoutineParam[];
  readonly returns: DataType | undefined;
  readonly setof: boolean;
  /** The columns of `RETURNS TABLE (...)`. */
  readonly table: readonly ColumnDef[];
  /** The language, lower case. */
  readonly language: string | undefined;
  /** The other characteristics as written (`IMMUTABLE`, `SECURITY DEFINER`, `COST 10`). */
  readonly options: string | undefined;
  readonly body: RoutineBody | undefined;
}

/**
 * A statement of a kind the grammar does not read: a command (`SET`, `SHOW`, `EXPLAIN`, `GRANT`, ...) or a `CREATE`, `ALTER` or `DROP` of an object it does not read (a function, a sequence, a type). It holds no node:
 * its keyword and, for those three, its object, upper case, and the text after them as written.
 */
export interface Command extends Base {
  readonly kind: "command";
  readonly keyword: string;
  readonly object: string | undefined;
  readonly text: string;
}

/** A statement the parser could not read: its range, from its first token to the one before the `;` that ends it. */
export interface Unparsed extends Base {
  readonly kind: "unparsed";
}

/** A statement. */
export type Statement =
  Query | Insert | Update | Delete | CreateTable | CreateIndex | CreateView | AlterTable | Drop | CreateRoutine | Command | Unparsed;

/** A script: its statements. */
export interface Script extends Base {
  readonly kind: "script";
  readonly statements: readonly Statement[];
}

/** Every node. */
export type Node =
  | Ident
  | Expr
  | Argument
  | FrameBound
  | Frame
  | WindowSpec
  | WindowDef
  | StarModifier
  | OnConflict
  | TableLike
  | OrderItem
  | When
  | SelectItem
  | Query
  | Cte
  | Alias
  | Source
  | Assignment
  | DataType
  | ColumnConstraint
  | Reference
  | ColumnDef
  | RoutineParam
  | RoutineBody
  | Statement
  | AlterAction
  | Script;

/** An argument of a call. */
export type Argument = Expr | NamedArg | KeywordArg;

/** The kinds of node. */
export type Kind = Node["kind"];

/** The node of a kind. */
export type NodeOf<K extends Kind> = Extract<Node, { readonly kind: K }>;
