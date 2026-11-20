// Spec: 0048-sql-objects FR-001, FR-002, FR-003, FR-004
/**
 * The objects of a database that are not tables, views or indexes (commons data 0048-sql-objects): schemas, sequences, enumerated types, PostgreSQL's domains and extensions. Each is a value that says what
 * it is; `objectsSource` writes them for a dialect that has them, in the setup group, before the tables, so that a table or a routine can use them. Each is made so that making it again changes nothing
 * (PostgreSQL has no `IF NOT EXISTS` for a type or a domain, so those are guarded by a look at the catalog). An object a dialect cannot have is an error value naming it, unless the project says to
 * carry it.
 *
 * @limits
 * An enumerated type that exists is not changed: a value added to the list is not added to the type. A column of governance is typed by its datatype and its code list's check, not by these types: they are for
 * routines, for columns a project types by hand, and for what other tools read.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { type AnyCodeList, words } from "@intellectual-frontiers/data/governance";
import { featureId, type LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { type BindContext, type Dialect, type PhysicalError, qualified, type Statement, type StatementSource, writeCode } from "@intellectual-frontiers/data/sql/physical";

/** An object of a database. */
export type DbObject =
  | { readonly kind: "schema"; readonly name: string }
  | { readonly kind: "sequence"; readonly name: string; readonly schema?: string; readonly start?: number; readonly increment?: number; readonly cache?: number; readonly cycle?: boolean }
  | { readonly kind: "enum"; readonly name: string; readonly schema?: string; readonly values: readonly string[] }
  | { readonly kind: "domain"; readonly name: string; readonly schema?: string; readonly type: LogicalType; readonly notNull?: boolean; readonly default?: string; readonly check?: string }
  | { readonly kind: "extension"; readonly name: string; readonly schema?: string };

/** A schema. */
export const schema = (name: string): DbObject => ({ kind: "schema", name });
/** A sequence of numbers. */
export const sequence = (name: string, options: { readonly schema?: string; readonly start?: number; readonly increment?: number; readonly cache?: number; readonly cycle?: boolean } = {}): DbObject => ({ kind: "sequence", name, ...options });
/** An enumerated type: its values are what a column of it may hold, in order. */
export const enumType = (name: string, values: readonly string[], options: { readonly schema?: string } = {}): DbObject => ({ kind: "enum", name, values, ...options });
/** A domain (PostgreSQL): a type with a rule, which a column or a routine can use as it uses the type. */
export const pgDomain = (name: string, type: LogicalType, options: { readonly schema?: string; readonly notNull?: boolean; readonly default?: string; readonly check?: string } = {}): DbObject => ({ kind: "domain", name, type, ...options });
/** A PostgreSQL extension. */
export const extension = (name: string, options: { readonly schema?: string } = {}): DbObject => ({ kind: "extension", name, ...options });

/** The enumerated type of a closed code list, its values written as the dialect's codes are (`employed_by`). */
export function enumOf(list: AnyCodeList, options: { readonly schema?: string; readonly name?: string } = {}): (context: Pick<BindContext, "naming">) => DbObject {
  return ({ naming }) => ({ kind: "enum", name: options.name ?? naming.names.write(words(list.name)), values: Object.keys(list.codes).map((c) => writeCode(naming, c)), ...(options.schema === undefined ? {} : { schema: options.schema }) });
}

/** What a project says of objects. */
export interface ObjectsSettings {
  /** What to do with an object the dialect cannot have: `refuse` (an error value, the default) or `carry` (nothing is written). */
  readonly unsupported?: "refuse" | "carry";
}

/** Which kinds of object a dialect has. */
export function canHave(dialect: Dialect, kind: DbObject["kind"]): boolean {
  const has: Readonly<Record<string, readonly DbObject["kind"][]>> = {
    postgres: ["schema", "sequence", "enum", "domain", "extension"],
    duckdb: ["schema", "sequence", "enum"],
    sqlite: [],
  };
  return (has[dialect.name] ?? []).includes(kind);
}

const lit = (d: Dialect, s: string): string => d.literal(s);

/** The statement that makes an object, for a dialect that has it. */
export function statementOf(o: DbObject, dialect: Dialect): string {
  const q = dialect.quote;
  const at = (name: string, schemaName: string | undefined): string => qualified(dialect, schemaName, name);
  switch (o.kind) {
    case "schema":
      return `CREATE SCHEMA IF NOT EXISTS ${q(o.name)};`;
    case "sequence":
      return `CREATE SEQUENCE IF NOT EXISTS ${at(o.name, o.schema)}${o.start === undefined ? "" : ` START WITH ${o.start}`}${o.increment === undefined ? "" : ` INCREMENT BY ${o.increment}`}${o.cache === undefined || dialect.name === "duckdb" ? "" : ` CACHE ${o.cache}`}${o.cycle === true ? " CYCLE" : ""};`;
    case "enum": {
      const values = o.values.map((v) => lit(dialect, v)).join(", ");
      if (dialect.name === "duckdb") return `CREATE TYPE IF NOT EXISTS ${at(o.name, o.schema)} AS ENUM (${values});`;
      return guarded(dialect, o.name, o.schema, "e", `CREATE TYPE ${at(o.name, o.schema)} AS ENUM (${values})`);
    }
    case "domain": {
      const ty = dialect.type(o.type);
      return guarded(dialect, o.name, o.schema, "d", `CREATE DOMAIN ${at(o.name, o.schema)} AS ${ty}${o.default === undefined ? "" : ` DEFAULT ${o.default}`}${o.notNull === true ? " NOT NULL" : ""}${o.check === undefined ? "" : ` CHECK (${o.check})`}`);
    }
    case "extension":
      return `CREATE EXTENSION IF NOT EXISTS ${q(o.name)}${o.schema === undefined ? "" : ` SCHEMA ${q(o.schema)}`};`;
  }
}

/** PostgreSQL has no `IF NOT EXISTS` for a type or a domain: the statement is run where the catalog has none of that name. */
function guarded(dialect: Dialect, name: string, schemaName: string | undefined, typtype: "e" | "d", create: string): string {
  const where = schemaName === undefined ? "n.nspname = current_schema()" : `n.nspname = ${lit(dialect, schemaName)}`;
  return `DO $obj$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = ${lit(dialect, name)} AND t.typtype = '${typtype}' AND ${where}) THEN ${create}; END IF; END $obj$;`;
}

/**
 * The statements of some objects.
 *
 * @param objects - the objects, or what makes them from the bind context (`enumOf`)
 * @param settings - what a project says
 * @returns a statement source
 */
export function objectsSource(objects: readonly (DbObject | ((c: Pick<BindContext, "naming">) => DbObject))[], settings: ObjectsSettings = {}): StatementSource {
  return (context: BindContext) => {
    const out: Statement[] = [];
    const errors: PhysicalError[] = [];
    for (const made of objects) {
      const o = typeof made === "function" ? made(context) : made;
      if (!canHave(context.dialect, o.kind)) {
        if ((settings.unsupported ?? "refuse") === "refuse") errors.push({ kind: "unsupported", element: featureId("object", [o.kind, o.name]), why: `${context.dialect.name} has no ${o.kind === "domain" ? "domains" : o.kind === "enum" ? "enumerated types" : o.kind === "sequence" ? "sequences" : o.kind === "extension" ? "extensions" : "schemas"}, so ${o.name} cannot be made` });
        continue;
      }
      out.push({ group: "setup", sql: statementOf(o, context.dialect), of: [featureId("object", [o.kind, o.name])] });
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}
