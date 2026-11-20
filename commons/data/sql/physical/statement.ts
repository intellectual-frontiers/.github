// Spec: 0007-physical FR-003, FR-006, FR-009, FR-010, FR-011
/**
 * What `bind` makes and what an extension may add (commons data 0007-physical): a statement is a piece of SQL with its group and the logical elements it was made from, so that what is in a
 * database is traced back; a physical schema is the statements in the order the groups say; and a source is what an extension is given to add statements for a bound schema, with the
 * written name of every table and column.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { type Composition, point } from "@intellectual-frontiers/data/engine";
import type { LogicalId, LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import type { Dialect } from "./dialect.ts";
import type { Naming } from "./case.ts";

/** Where a statement goes: tables, then what is added to them, then indexes, then the reference data, then documentation, then policies. */
export type Group = "setup" | "table" | "constraint" | "index" | "data" | "view" | "routine" | "documentation" | "policy";

/** The groups in the order their statements are run. */
export const GROUPS: readonly Group[] = ["setup", "table", "constraint", "index", "data", "view", "routine", "documentation", "policy"];

/** Whether a statement is the core's, made from the logical schema, or an extension's (0011-sql-lifecycle FR-003). */
export type Origin = "core" | "extension";

/** One piece of SQL, ending in `;`. */
export interface Statement {
  readonly group: Group;
  /** Who made it: `bind` sets it, so an extension never has to. */
  readonly origin?: Origin;
  readonly sql: string;
  /** The elements of the logical schema it was made from. */
  readonly of: readonly LogicalId[];
}

/** What is wrong with a binding; `bind` returns all of it together. */
export type PhysicalError =
  | { readonly kind: "unsupported"; readonly element: LogicalId; readonly why: string }
  | { readonly kind: "length"; readonly element: LogicalId; readonly name: string; readonly max: number }
  | { readonly kind: "collision"; readonly name: string; readonly table?: string; readonly first: LogicalId; readonly second: LogicalId }
  | { readonly kind: "cycle"; readonly tables: readonly string[] };

/** The names that were written, by the logical element they are the name of. */
export interface Written {
  /** The schema tables are qualified by, where the dialect has schemas and one was given. */
  readonly qualifier: string | undefined;
  /** The reference to a table of the schema, quoted and qualified (0013-sql-qualified-names FR-004). */
  ref(id: LogicalId): string;
  /** The reference to a table of an extension, by the bare name it is written by: qualified, or with the schema's words added where the dialect has no schemas. */
  qualify(name: string): string;
  /** The name a table of an extension is written by once the schema's words are added where the dialect has no schemas. */
  tableName(name: string): string;
  table(id: LogicalId): string | undefined;
  column(id: LogicalId): string | undefined;
  constraint(id: LogicalId): string | undefined;
}

/** What a source is given. */
export interface BindContext {
  readonly schema: LogicalSchema;
  readonly dialect: Dialect;
  readonly naming: Naming;
  readonly written: Written;
  /** The schema the tables are in, as the project gave it. */
  readonly schemaName?: string;
}

/** What an extension gives `bind`: statements for a bound schema, or its errors. */
export type StatementSource = (context: BindContext) => Result<readonly Statement[], readonly PhysicalError[]>;

/** What an extension gives `bind` to add to the end of a table's `CREATE TABLE`: a clause, nothing for a table it has none for, or its errors (0009-sql-features FR-004). */
export type TableClause = (context: BindContext, table: Table) => Result<string | undefined, readonly PhysicalError[]>;

/** The contribution point an extension fills to add a clause to a table. */
export const tableClausesPoint = point<TableClause>("physical.tableClauses");

/**
 * The table clauses of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the clauses its extensions contribute
 */
export function clausesFrom(composition: Composition): readonly TableClause[] {
  return composition.contributions(tableClausesPoint);
}

/** The contribution point an extension fills to add statements. */
export const statementsPoint = point<StatementSource>("physical.statements");

/**
 * The sources of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the sources its extensions contribute
 */
export function sourcesFrom(composition: Composition): readonly StatementSource[] {
  return composition.contributions(statementsPoint);
}

/** A bound schema: the statements, in the order of their groups. */
export interface Physical {
  readonly dialect: string;
  readonly naming: { readonly names: string; readonly codes: string };
  readonly statements: readonly Statement[];
}

/**
 * The statements as the text of a script: a blank line between them, the same text every time.
 *
 * @param physical - the bound schema
 * @returns the script
 */
export function render(physical: Physical): string {
  return `${physical.statements.map((s) => s.sql).join("\n\n")}\n`;
}
