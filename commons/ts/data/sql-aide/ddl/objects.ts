/**
 * The objects of a database that are not tables, views or indexes: schemas, sequences, enumerated types, and PostgreSQL's extensions,
 * domains, row-level security and policies (commons 0009-sql-aide FR-022). Each is an entity that asks its dialect for the feature it
 * is, and each is defined so that defining it again changes nothing.
 *
 * @module
 */
import { type Column, column } from "../algebra/column.ts";
import { domain, type DomainSpec } from "../algebra/domain.ts";
import { type AnySql, byDialect, type Chunk, chunkOf, chunkText, sql, type Sql } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";

/** An object of a database: an entity with a definition and a feature it asks for. */
export interface DbObject<Kind extends string, Req extends string, Dx extends string = string> {
  /** What kind of entity this is. */
  readonly entity: Kind;
  /** The object's name. */
  readonly name: string;
  /** The schema it lives in. */
  readonly schema: string | undefined;
  /** The statement that defines it. */
  readonly ddl: Sql<"statement", unknown, Req, Dx>;
  /** The entities it must be defined after. */
  readonly dependsOn: () => readonly EntityName[];
}

const named = (name: string, schema: string | undefined): Chunk => ({
  kind: "name",
  parts: schema === undefined ? [name] : [schema, name],
});

function object<Kind extends string, Req extends string, Dx extends string = string>(
  entity: Kind,
  name: string,
  schema: string | undefined,
  ddl: Sql<"statement", unknown, Req, Dx>,
  after: readonly EntityName[] = [],
): DbObject<Kind, Req, Dx> {
  return { entity, name, schema, ddl, dependsOn: () => after };
}

/**
 * A schema: a namespace for tables and the rest.
 *
 * @param name - the schema's name
 */
export const schema = (name: string): DbObject<"schema", "schemas"> =>
  object(
    "schema",
    name,
    undefined,
    sql("statement", () => [chunkText("CREATE SCHEMA IF NOT EXISTS "), named(name, undefined), chunkText(";")]),
  );

/**
 * A sequence of numbers.
 *
 * @param name - the sequence's name
 * @param options - the schema it lives in
 */
export const sequence = (name: string, options: { readonly schema?: string } = {}): DbObject<"sequence", "sequences"> =>
  object(
    "sequence",
    name,
    options.schema,
    sql("statement", () => [chunkText("CREATE SEQUENCE IF NOT EXISTS "), named(name, options.schema), chunkText(";")]),
  );

/** An enumerated type, and the column that holds its values. */
export interface EnumType<V extends string> extends DbObject<"enum", "enums", "postgres" | "duckdb"> {
  /** The type's values, in order. */
  readonly values: readonly V[];
  /** A column of this type: a dialect needs `enums` for it. */
  readonly column: () => Column<V, false, "required", false, "enums">;
}

/**
 * An enumerated type the database knows by name, for PostgreSQL and DuckDB. A column that must hold in every dialect is `oneOf`, which
 * is text with a check.
 *
 * @param name - the type's name
 * @param values - its values, in order
 * @param options - the schema it lives in
 */
export function enumType<const V extends readonly string[]>(
  name: string,
  values: V,
  options: { readonly schema?: string } = {},
): EnumType<V[number]> {
  const quoted = values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ");
  const self = named(name, options.schema);
  const spec: DomainSpec = { kind: "custom", name: options.schema === undefined ? `"${name}"` : `"${options.schema}"."${name}"` };
  const ddl = byDialect(
    {
      postgres: sql("statement", () => [
        chunkText("DO $$ BEGIN\n    CREATE TYPE "),
        self,
        chunkText(` AS ENUM (${quoted});\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`),
      ]),
      duckdb: sql("statement", () => [chunkText("CREATE TYPE IF NOT EXISTS "), self, chunkText(` AS ENUM (${quoted});`)]),
    },
    "statement",
  );
  return {
    ...object("enum", name, options.schema, sql<"statement", unknown, "enums", "postgres" | "duckdb">("statement", ddl.chunks)),
    values,
    column: () => column(domain<V[number], "enums">(spec)).needs({ name, schema: options.schema }),
  };
}

/**
 * A PostgreSQL extension, made available in the database.
 *
 * @param name - the extension's name, as PostgreSQL knows it (`pgcrypto`, `vector`)
 */
export const extension = (name: string): DbObject<"extension", "extensions"> =>
  object(
    "extension",
    name,
    undefined,
    sql("statement", () => [chunkText("CREATE EXTENSION IF NOT EXISTS "), named(name, undefined), chunkText(";")]),
  );

/** A PostgreSQL domain: a type with a rule, and the column that holds its values. */
export interface PgDomain<T> extends DbObject<"domain", "domains"> {
  /** A column of this domain: a dialect needs `domains` for it. */
  readonly column: () => Column<T, false, "required", false, "domains">;
}

/**
 * A PostgreSQL domain: a base type with a check every value must pass, named so that many columns share it.
 *
 * @param name - the domain's name
 * @param base - the column whose type the domain has
 * @param options - its check, written over `VALUE`, and the schema it lives in
 * @example
 * const email = pgDomain("email", text(), { check: raw("VALUE ~ '^[^@]+@[^@]+$'") });
 */
export function pgDomain<T>(
  name: string,
  base: Column<T>,
  options: { readonly check?: AnySql; readonly schema?: string } = {},
): PgDomain<T> {
  const self = named(name, options.schema);
  const ddl = sql<"statement", unknown, "domains">("statement", (ctx) => [
    chunkText("DO $$ BEGIN\n    CREATE DOMAIN "),
    self,
    chunkText(` AS ${ctx.dialect.typeOf(base.spec.domain)}`),
    ...(options.check === undefined ? [] : [chunkText(" CHECK ("), chunkOf(options.check), chunkText(")")]),
    chunkText(";\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;"),
  ]);
  const spec: DomainSpec = { kind: "custom", name: options.schema === undefined ? `"${name}"` : `"${options.schema}"."${name}"` };
  return {
    ...object("domain", name, options.schema, ddl),
    column: () => column(domain<T, "domains">(spec)).needs({ name, schema: options.schema }),
  };
}

/**
 * Turns on row-level security for a table, so that a role sees and changes only the rows a policy lets it.
 *
 * @param table - the table
 */
export const rowLevelSecurity = (table: EntityName): DbObject<"rls", "rls"> =>
  object(
    "rls",
    `${table.name}_rls`,
    table.schema,
    sql("statement", (ctx) => [
      chunkText("ALTER TABLE "),
      { kind: "name", parts: ctx.naming.table(table.name, table.schema) },
      chunkText(" ENABLE ROW LEVEL SECURITY;"),
    ]),
    [table],
  );

/** What a policy lets a role do. */
export interface PolicyOptions {
  /** The command it is for; all where none is given. */
  readonly for?: "all" | "select" | "insert" | "update" | "delete";
  /** The roles it is for; every role where none is given. */
  readonly to?: readonly string[];
  /** The rows the role may see or change. */
  readonly using?: AnySql;
  /** The rows the role may write. */
  readonly withCheck?: AnySql;
}

/**
 * A PostgreSQL policy on a table whose row-level security is on. It is dropped and made again, so that changing it is defining it.
 *
 * @param name - the policy's name
 * @param table - the table it is on
 * @param options - the command, the roles and the conditions
 */
export function policy(name: string, table: EntityName, options: PolicyOptions): DbObject<"policy", "rls"> {
  const ddl = sql<"statement", unknown, "rls">("statement", (ctx) => {
    const on: Chunk = { kind: "name", parts: ctx.naming.table(table.name, table.schema) };
    const out: Chunk[] = [
      chunkText("DROP POLICY IF EXISTS "),
      named(name, undefined),
      chunkText(" ON "),
      on,
      chunkText(";\nCREATE POLICY "),
      named(name, undefined),
    ];
    out.push(chunkText(" ON "), on);
    if (options.for !== undefined) out.push(chunkText(` FOR ${options.for.toUpperCase()}`));
    if (options.to !== undefined && options.to.length > 0)
      out.push(chunkText(` TO ${options.to.map((r) => `"${r.replaceAll('"', '""')}"`).join(", ")}`));
    if (options.using !== undefined) out.push(chunkText(" USING ("), chunkOf(options.using), chunkText(")"));
    if (options.withCheck !== undefined) out.push(chunkText(" WITH CHECK ("), chunkOf(options.withCheck), chunkText(")"));
    out.push(chunkText(";"));
    return out;
  });
  return object("policy", name, table.schema, ddl, [table, { name: `${table.name}_rls`, schema: table.schema }]);
}
