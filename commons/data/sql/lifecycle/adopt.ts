// Spec: 0055-sql-introspect FR-004
/**
 * Adopting a database that exists (commons data 0055-sql-introspect): what `introspect` read, as a logical schema, so that a database nobody modelled can be given typed tables (0053-sql-typed), a dictionary,
 * lifecycle states and checks. The names are the words of the names the database has, the types are the logical types of the engine's (a type of no known family is an error that names it), and the keys,
 * the unique constraints, the foreign keys and the indexes are kept. Nothing is invented: a column's meaning is not in a catalog, so its comment is empty.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { conceptId, words } from "@intellectual-frontiers/data/governance";
import { type Column, columnId, constraintId, type ForeignKey, type Index, type LogicalDefault, type LogicalSchema, schemaId, type Table, tableId, type Unique } from "@intellectual-frontiers/data/sql/logical";
import { logicalOf, type Observed, type ObservedColumn } from "./introspect.ts";

/** A column or table that cannot be adopted. */
export interface AdoptError {
  readonly table: string;
  readonly column?: string;
  readonly why: string;
}

function defaultOf(c: ObservedColumn): LogicalDefault | undefined {
  const d = c.default?.trim();
  if (d === undefined || d === "") return undefined;
  if (/^(current_timestamp|now\(\)|localtimestamp|current_timestamp\(\d*\))/i.test(d)) return { kind: "now" };
  if (/^-?\d+(\.\d+)?$/.test(d)) return { kind: "literal", value: Number(d) };
  if (/^(true|false)$/i.test(d)) return { kind: "literal", value: d.toLowerCase() === "true" };
  const quoted = /^'((?:[^']|'')*)'(::[\w ]+)?$/.exec(d);
  return quoted === null ? undefined : { kind: "literal", value: quoted[1]!.replaceAll("''", "'") };
}

/**
 * The logical schema of what a database holds.
 *
 * @param observed - what `introspect` read
 * @param domain - the name of the domain the schema is of
 * @returns the schema, or every column whose type is of no known family
 */
export function adopt(observed: Observed, domain: string): Result<LogicalSchema, readonly AdoptError[]> {
  const errors: AdoptError[] = [];
  const tables: Table[] = observed.tables.map((t): Table => {
    const name = words(t.name);
    const from = conceptId(domain, t.name);
    const columns = t.columns.map((c): Column => {
      const type = logicalOf(c.type);
      if (type === undefined) errors.push({ table: t.name, column: c.name, why: `the type ${JSON.stringify(c.type)} is of no family the library knows` });
      const d = defaultOf(c);
      return { id: columnId(name, words(c.name)), from, name: words(c.name), type: type ?? { kind: "text" }, nullable: c.nullable, ...(d === undefined ? {} : { default: d }), comment: "", governance: [], role: "attribute" };
    });
    const foreignKeys = t.foreignKeys.map((f, i): ForeignKey => ({ id: constraintId("fk", [...name, "fk", String(i + 1)]), from, name: [...name, "fk", String(i + 1)], columns: f.columns.map((c) => words(c)), references: { table: words(f.references.table), columns: f.references.columns.map((c) => words(c)) } }));
    const uniques = t.uniques.map((u, i): Unique => ({ id: constraintId("uq", [...name, "uq", String(i + 1)]), from, name: [...name, "uq", String(i + 1)], columns: u.columns.map((c) => words(c)) }));
    const indexes = t.indexes.map((x, i): Index => ({ id: constraintId("ix", [...name, "ix", String(i + 1)]), from, name: [...name, "ix", String(i + 1)], columns: x.columns.map((c) => words(c)) }));
    return { id: tableId(name), from, name, comment: "", role: "concept", columns, primaryKey: t.primaryKey.map((k) => words(k)), foreignKeys, uniques, checks: [], indexes, governance: [] };
  });
  if (errors.length > 0) return err(errors);
  return ok({ id: schemaId(domain), from: conceptId(domain, domain), domain, comment: `Adopted from a ${observed.dialect} database`, tables, valueSets: [], governance: [] });
}
