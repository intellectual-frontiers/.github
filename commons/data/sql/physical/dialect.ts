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
  | "alter-column";

/** The forms of `DROP` and `ADD COLUMN` that a dialect writes with `IF [NOT] EXISTS` (0012-sql-idempotency FR-001). */
export type IfExistsForm = "addColumn" | "dropColumn" | "dropConstraint" | "dropTable" | "dropIndex";

/** Queries on a dialect's catalog that return a row if and only if the thing exists, or none where the engine cannot say (0012-sql-idempotency FR-001). */
export interface Probes {
  table(table: string): string;
  column(table: string, column: string): string;
  constraint(table: string, name: string): string | undefined;
  index(name: string): string;
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
