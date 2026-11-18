// Spec: 0006-logical FR-001, FR-002, FR-010
/**
 * The logical schema (commons data 0006-logical FR-001, FR-002, FR-010): a relational schema as plain data, in terms of tables, columns, keys, constraints and indexes and of no engine. Every
 * element has an identity of its own, made of its words, and carries `from`, the identity of the governance element it was made from, so that it is traced back. Names are lists of words
 * (0005-naming): the physical schema writes them in a case style.
 *
 * @module
 */
import type { Brand } from "@intellectual-frontiers/commons/ts/kernel";
import {
  type Annotation,
  type AnnotationKind,
  annotationsOf,
  type ElementId,
  type Words,
  words,
} from "@intellectual-frontiers/data/governance";

/** The identity of an element of a logical schema, made of its words. */
export type LogicalId = Brand<string, "LogicalId">;

// the one place a text becomes a LogicalId: the functions below build it from words, and nothing else does
const made = (text: string): LogicalId => text as LogicalId;

/** The identity of the schema of a domain. */
export const schemaId = (domain: string): LogicalId => made(`schema:${domain}`);
/** The identity of a table. */
export const tableId = (table: Words): LogicalId => made(`table:${table.join(".")}`);
/** The identity of a column of a table. */
export const columnId = (table: Words, column: Words): LogicalId => made(`column:${table.join(".")}/${column.join(".")}`);
/** The kinds of constraint and index. */
export type ConstraintKind = "pk" | "fk" | "uq" | "ck" | "ix";
/** The identity of a value set: a closed code list. */
export const valueSetId = (name: Words): LogicalId => made(`valueset:${name.join(".")}`);
/** What a feature of an extension makes: the identity of a thing the schema does not have (0009-sql-features). */
export type FeatureKind = "view" | "routine" | "policy" | "partition" | "grant";
/** The identity of what a feature of an extension makes, by its kind and name. */
export const featureId = (kind: FeatureKind, name: Words): LogicalId => made(`${kind}:${name.join(".")}`);
/** The identity of a constraint or an index. */
export const constraintId = (kind: ConstraintKind, name: Words): LogicalId => made(`${kind}:${name.join(".")}`);

/** The logical types: none is an engine's. */
export type LogicalType =
  | { readonly kind: "text"; readonly max?: number }
  | { readonly kind: "integer" }
  | { readonly kind: "decimal"; readonly precision?: number; readonly scale?: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "date" }
  | { readonly kind: "timestamp"; readonly zone: boolean }
  | { readonly kind: "json" }
  | { readonly kind: "bytes" }
  | { readonly kind: "vector"; readonly dimensions: number };

/** What a column takes where no value is given: a literal, the moment of the insert, or a code of a list (by its name). */
export type LogicalDefault =
  | { readonly kind: "literal"; readonly value: string | number | boolean }
  | { readonly kind: "now" }
  | { readonly kind: "code"; readonly name: string };

/** Where a column came from. */
export type ColumnRole = "attribute" | "reference" | "audit" | "code";

/** A column. */
export interface Column {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly type: LogicalType;
  readonly nullable: boolean;
  readonly default?: LogicalDefault;
  /** What governance said it is: the definition of what it was made from. */
  readonly comment: string;
  /** The annotations of governance that this column carries for the layers below. */
  readonly governance: readonly Annotation[];
  readonly role: ColumnRole;
}

/** A foreign key: columns of a table that refer to columns of another. */
export interface ForeignKey {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly columns: readonly Words[];
  readonly references: { readonly table: Words; readonly columns: readonly Words[] };
}

/** Columns that are unique together. */
export interface Unique {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly columns: readonly Words[];
}

/** What a check says. A code is by its name: the physical schema writes its stored value (0005-naming FR-006). */
export type CheckExpression =
  | { readonly kind: "differs"; readonly columns: readonly [Words, Words] }
  | { readonly kind: "oneOf"; readonly column: Words; readonly codes: readonly string[] }
  | { readonly kind: "range"; readonly column: Words; readonly min?: number; readonly max?: number }
  | { readonly kind: "pattern"; readonly column: Words; readonly pattern: string };

/** A check: a named rule every row must satisfy. */
export interface Check {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly expression: CheckExpression;
}

/** An index: how rows are found by columns, in order. */
export interface Index {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly columns: readonly Words[];
}

/** A row of a code table: the code by its name, its label and what it means. */
export interface CodeRow {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
}

/** A value set: a closed code list, which has no table, kept with its codes and what governance said of it. */
export interface ValueSet {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly comment: string;
  readonly codes: readonly CodeRow[];
  readonly governance: readonly Annotation[];
}

/** Why a table exists. */
export type TableRole = "concept" | "code" | "junction" | "values";

/** A table. */
export interface Table {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly name: Words;
  readonly comment: string;
  readonly role: TableRole;
  readonly columns: readonly Column[];
  readonly primaryKey: readonly Words[];
  readonly foreignKeys: readonly ForeignKey[];
  readonly uniques: readonly Unique[];
  readonly checks: readonly Check[];
  readonly indexes: readonly Index[];
  /** The rows of a code table. */
  readonly rows?: readonly CodeRow[];
  /** The annotations of governance that this table carries for the layers below. */
  readonly governance: readonly Annotation[];
}

/** The logical schema of a domain. */
export interface LogicalSchema {
  readonly id: LogicalId;
  readonly from: ElementId;
  readonly domain: string;
  readonly comment: string;
  readonly tables: readonly Table[];
  /** The closed code lists, which no table holds. */
  readonly valueSets: readonly ValueSet[];
  /** The annotations of the domain, which the schema carries. */
  readonly governance: readonly Annotation[];
}

/** Whether two lists of words are the same. */
export const sameWords = (a: Words, b: Words): boolean => a.length === b.length && a.every((w, i) => w === b[i]);

/**
 * The values of the annotations of a kind that an element of the schema carries, typed: a table, a column, a value set or the schema.
 *
 * @param element - what carries them
 * @param kind - the kind of annotation
 * @returns the values, in the order governance gave them
 */
export function carriedOf<T>(element: { readonly governance: readonly Annotation[] }, kind: AnnotationKind<T>): readonly T[] {
  return annotationsOf({ annotations: element.governance }, kind);
}

/**
 * The table of a schema that governance names (`party`, `partyIdentifier`).
 *
 * @param schema - the logical schema
 * @param name - the name as governance writes it, lower camel case
 * @returns the table, or none
 */
export function tableNamed(schema: LogicalSchema, name: string): Table | undefined {
  const w = words(name);
  return schema.tables.find((t) => sameWords(t.name, w));
}

/**
 * The column of a table that governance names (`partyId`, `givenName`).
 *
 * @param table - the table
 * @param name - the name as governance writes it, lower camel case
 * @returns the column, or none
 */
export function columnNamed(table: Table, name: string): Column | undefined {
  const w = words(name);
  return table.columns.find((c) => sameWords(c.name, w));
}
