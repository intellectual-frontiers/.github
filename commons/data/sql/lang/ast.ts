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
  readonly left: Expr;
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

/** A call: `name(args)`, with `DISTINCT`, `FILTER (WHERE ...)` and `OVER`. */
export interface Call extends Base {
  readonly kind: "call";
  readonly name: Name;
  readonly args: readonly (Expr | NamedArg)[];
  readonly distinct: boolean;
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
}

// queries

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
  readonly groupBy: readonly Expr[];
  readonly having: Expr | undefined;
  readonly orderBy: readonly OrderItem[];
  readonly limit: Expr | undefined;
  readonly offset: Expr | undefined;
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
  readonly query: Query;
}

/** `WITH [RECURSIVE] ctes body`. */
export interface With extends Base {
  readonly kind: "with";
  readonly recursive: boolean;
  readonly ctes: readonly Cte[];
  readonly body: Query;
}

/** A query. */
export type Query = Select | SetOp | Values | With;

// sources

/** The alias of a source: `AS name [(columns)]`. */
export interface Alias extends Base {
  readonly kind: "alias";
  readonly name: Ident;
  readonly columns: readonly Ident[];
}

/** A table named in `FROM`, with its alias. */
export interface TableRef extends Base {
  readonly kind: "table";
  readonly name: Name;
  readonly alias: Alias | undefined;
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
}

/** The types of join. */
export type JoinType = "inner" | "left" | "right" | "full" | "cross";

/** A join of two sources, with `ON` or `USING`. */
export interface Join extends Base {
  readonly kind: "join";
  readonly type: JoinType;
  readonly natural: boolean;
  readonly left: Source;
  readonly right: Source;
  readonly on: Expr | undefined;
  readonly using: readonly Ident[];
}

/** A source of rows. */
export type Source = TableRef | SubquerySource | TableFn | Join;

// data changes

/** `INSERT INTO table [(columns)] query | DEFAULT VALUES [RETURNING ...]`; a source of `undefined` is `DEFAULT VALUES`. */
export interface Insert extends Base {
  readonly kind: "insert";
  readonly table: Name;
  readonly columns: readonly Ident[];
  readonly source: Query | undefined;
  readonly returning: readonly SelectItem[];
}

/** One `target = value` of an `UPDATE`. */
export interface Assignment extends Base {
  readonly kind: "assignment";
  readonly target: Name;
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
  readonly where: Expr | undefined;
  readonly returning: readonly SelectItem[];
}

// definitions

/** A data type: its words, upper case, joined by a space (`DOUBLE PRECISION`, `TIMESTAMP WITH TIME ZONE`, `INTEGER[]`), and its arguments. */
export interface DataType extends Base {
  readonly kind: "data-type";
  readonly name: string;
  readonly args: readonly Expr[];
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
}

/** `[CONSTRAINT name] [FOREIGN KEY (columns)] REFERENCES ...`; the columns are empty on a column. */
export interface ForeignKey extends Base {
  readonly kind: "foreign-key";
  readonly name: Ident | undefined;
  readonly columns: readonly Ident[];
  readonly reference: Reference;
}

/** A constraint of a column. */
export type ColumnConstraint = NotNull | Default | PrimaryKey | Unique | Check | ForeignKey;

/** A constraint of a table. */
export type TableConstraint = PrimaryKey | Unique | Check | ForeignKey;

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
  readonly elements: readonly (ColumnDef | TableConstraint)[];
}

/** `CREATE [UNIQUE] INDEX [IF NOT EXISTS] [name] ON table (items) [WHERE ...]`. */
export interface CreateIndex extends Base {
  readonly kind: "create-index";
  readonly unique: boolean;
  readonly ifNotExists: boolean;
  readonly name: Name | undefined;
  readonly table: Name;
  readonly items: readonly OrderItem[];
  readonly where: Expr | undefined;
}

/** `CREATE [OR REPLACE] VIEW name [(columns)] AS query`. */
export interface CreateView extends Base {
  readonly kind: "create-view";
  readonly orReplace: boolean;
  readonly name: Name;
  readonly columns: readonly Ident[];
  readonly query: Query;
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
}

/** `ADD constraint`. */
export interface AddConstraint extends Base {
  readonly kind: "add-constraint";
  readonly constraint: TableConstraint;
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
  readonly behavior: "cascade" | "restrict" | undefined;
}

// scripts

/** A statement the parser could not read: its range, from its first token to the one before the `;` that ends it. */
export interface Unparsed extends Base {
  readonly kind: "unparsed";
}

/** A statement. */
export type Statement = Query | Insert | Update | Delete | CreateTable | CreateIndex | CreateView | AlterTable | Drop | Unparsed;

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
  | Statement
  | AlterAction
  | Script;

/** An argument of a call. */
export type Argument = Expr | NamedArg;

/** The kinds of node. */
export type Kind = Node["kind"];

/** The node of a kind. */
export type NodeOf<K extends Kind> = Extract<Node, { readonly kind: K }>;
