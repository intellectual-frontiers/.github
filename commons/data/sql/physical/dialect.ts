// Spec: 0007-physical FR-004, FR-005
/**
 * The dialect (commons data 0007-physical FR-004): how one engine writes what a logical schema says. A dialect is a value: how a name is quoted and a literal written, the type of each logical
 * type, how the moment of the insert is a default, whether it can say a pattern, whether it has `COMMENT ON`, and how long a name may be. The library's three are extensions of `sql/dialects/`,
 * which contribute themselves through the engine's point `physical.dialect`; what a dialect cannot express is an error of `bind`, never SQL its engine refuses.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import {
  type Composition,
  contribute,
  defineExtension,
  type Extension,
  extensionId,
  type IdError,
  point,
} from "@intellectual-frontiers/data/engine";
import type { LogicalDefault, LogicalType } from "@intellectual-frontiers/data/sql/logical";

/** What a dialect can do beyond the common ground. */
export type Feature =
  | "comment-on"
  | "regex-check"
  | "add-constraint"
  | "or-replace-view"
  | "row-security"
  | "grants"
  | "routines"
  | "partitions"
  | "alter-column"
  | "schemas"
  | "updatable-views"
  | "instead-of-triggers"
  | "triggers"
  | "event-triggers";

/** How a database file is attached for reading, and detached. */
export interface Attach {
  attach(file: string, alias: string): string;
  detach(alias: string): string;
}

/** The forms of `DROP` and `ADD COLUMN` that a dialect writes with `IF [NOT] EXISTS` (0012-sql-idempotency FR-001). */
export type IfExistsForm = "addColumn" | "dropColumn" | "dropConstraint" | "dropTable" | "dropIndex";

/** Queries on a dialect's catalog that return a row if and only if the thing exists, or none where the engine cannot say (0012-sql-idempotency FR-001). */
export interface Probes {
  table(table: string, schema?: string): string;
  column(table: string, column: string, schema?: string): string;
  constraint(table: string, name: string, schema?: string): string | undefined;
  index(name: string, schema?: string): string;
  /** A query that returns a row if and only if the constraint exists and its rows have been checked (0015-sql-safety FR-009). */
  validConstraint?(table: string, name: string, schema?: string): string;
}

/** What a dialect needs to make a table again: statements to run first (so that rows that refer to it are not checked until the end) and whether tables that refer to it stop it. */
export interface Rebuild {
  readonly prelude: readonly string[];
  /** Whether a table that other tables' foreign keys refer to cannot be dropped. */
  readonly blockedByParents: boolean;
}

/** A column as a database's catalog says it is. */
export interface LiveColumn {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
}

/** A table as a database's catalog says it is. */
export interface LiveTable {
  readonly name: string;
  readonly columns: readonly LiveColumn[];
  readonly primaryKey: readonly string[];
  /** The names of the indexes that no constraint owns. */
  readonly indexes: readonly string[];
  /** The names and kinds of its foreign keys, uniques and checks, where the dialect can list them. */
  readonly constraints?: readonly { readonly name: string; readonly kind: "foreignKey" | "unique" | "check" }[];
}

/** A way to run a query and read its rows. */
export type Query = (sql: string) => Promise<readonly Record<string, unknown>[]>;

/** How a dialect reads its own catalog (0019-sql-convergence FR-001). */
export interface Catalog {
  /** What the dialect compares, in words, so that what it does not is said. */
  readonly compares: readonly string[];
  read(query: Query, schema?: string): Promise<readonly LiveTable[]>;
}

/** How a dialect keeps one instance from applying a plan while another does. */
export interface Advisory {
  acquire(key: number): string;
  release(key: number): string;
}

/** How a dialect asks for its locks with a limit, and how its error for giving up is told (0015-sql-safety FR-008). */
export interface Locks {
  /** The statements that make the rest of the transaction wait at most so long for a lock and run at most so long. */
  timeouts(lockMs: number, statementMs: number): readonly string[];
  /** Whether an error message is the engine giving up on a lock. */
  timedOut(message: string): boolean;
}

/** A literal a statement may hold. */
export type Literal = string | number | boolean | null;

/** One engine's way of writing. */
export interface Dialect {
  readonly name: string;
  readonly features: readonly Feature[];
  /** The longest a name may be. */
  readonly maxName: number;
  /** The default that is the moment of the insert. */
  readonly now: string;
  quote(name: string): string;
  literal(value: Literal): string;
  type(type: LogicalType): string;
  /** The expression that hashes a text expression, or none where the engine has no hash (0014-sql-protected-access FR-011). */
  hash?(text: string): string | undefined;
  /** A condition that is true when the role that reads is a member of a role, or none where the engine has no way to say it. */
  hasRole?(role: string): string | undefined;
  /** Why the dialect cannot store a type, or nothing where it can (0009-sql-features FR-003). */
  unsupported?(type: LogicalType): string | undefined;
  /** Why the dialect cannot add a column like this to a table that exists, or nothing where it can (0011-sql-lifecycle FR-006). */
  addColumnRefusal?(column: {
    readonly type: LogicalType;
    readonly nullable: boolean;
    readonly default?: LogicalDefault;
  }): string | undefined;
  /** Which forms of `DROP` and `ADD COLUMN` the dialect writes with `IF [NOT] EXISTS`. */
  readonly ifExists?: readonly IfExistsForm[];
  /** How the dialect reads its catalog; none where it cannot. */
  readonly catalog?: Catalog;
  /** How the dialect keeps one instance applying at a time; none where there is only one. */
  readonly advisory?: Advisory;
  /** Whether `DROP TABLE` and `DROP VIEW` take `CASCADE`, so that a table can be made again under views that read it (0023-sql-transforms). */
  readonly cascade?: boolean;
  /** How a database file of the same engine is attached for reading and let go; none where the engine cannot (0022-sql-integrations). */
  readonly attach?: Attach;
  /** How a table is made again where the dialect cannot change it in place (0017-sql-rewrite). */
  readonly rebuild?: Rebuild;
  /** How the dialect asks for its locks with a limit; none where it has no such thing. */
  readonly locks?: Locks;
  /** Whether a foreign key or a check can be added without checking the rows that are there, and checked afterwards. */
  readonly deferredValidation?: boolean;
  /** How to ask the catalog whether a table, column, constraint or index exists. */
  readonly probes?: Probes;
  /** Statements to run before the tables, for the types a schema uses (0009-sql-features FR-003). */
  setup?(types: readonly LogicalType[]): readonly string[];
  /** A check that a column matches a regular expression, or none where the engine has no way to say it. */
  pattern?(column: string, pattern: string): string;
}

/** A name in double quotes, a quote in it doubled: how SQL's standard writes an identifier. */
export const quoteName = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** A literal as SQL's standard writes it: text in single quotes with a quote doubled, true and false, a number as it is, null. */
export function standardLiteral(value: Literal): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

/** The contribution point an extension fills to add a dialect. */
export const dialectPoint = point<Dialect>("physical.dialect");

/**
 * The dialects of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the dialects its extensions contribute
 */
export function dialectsFrom(composition: Composition): readonly Dialect[] {
  return composition.contributions(dialectPoint);
}

/**
 * An extension that contributes a dialect, named `sql.dialect.<name>`.
 *
 * @param d - the dialect
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function dialectExtension(d: Dialect, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId(`sql.dialect.${d.name}`);
  return id.kind === "err" ? err(id.error) : ok(defineExtension({ id: id.value, version, contributes: [contribute(dialectPoint, d)] }));
}
