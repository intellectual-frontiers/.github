/**
 * Tests as typed values: an assertion is written once and run in three ways, inside PostgreSQL as pgTAP, inside any of the dialects as
 * SQL that returns TAP lines, and from TypeScript through whatever can run a query (commons 0009-sql-aide FR-029, FR-030). The tests
 * that a model's tables, columns, keys, indexes and views exist are made from the model.
 *
 * @module
 */
import { absurd } from "../../../kernel/mod.ts";
import type { SqlValue } from "../algebra/domain.ts";
import type { TableSpec } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import { type AnySql, renderUnchecked } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";
import { failed, fromLines, pass, skipped, type TapNode } from "./tap.ts";

/** One thing a test holds to be true of a database. */
export type Assertion =
  | { readonly kind: "has-table"; readonly table: EntityName }
  | { readonly kind: "has-view"; readonly view: EntityName }
  | { readonly kind: "has-column"; readonly table: EntityName; readonly column: string; readonly notNull?: boolean }
  | { readonly kind: "has-primary-key"; readonly table: EntityName; readonly columns: readonly string[] }
  | { readonly kind: "has-index"; readonly table: EntityName; readonly index: string }
  | { readonly kind: "rows"; readonly description: string; readonly query: AnySql; readonly expected: readonly (readonly SqlValue[])[] }
  | { readonly kind: "fails"; readonly description: string; readonly statement: AnySql };

/** What an assertion says of itself, as the description of its test line. */
export function describeAssertion(a: Assertion): string {
  switch (a.kind) {
    case "has-table":
      return `table ${a.table.name} exists`;
    case "has-view":
      return `view ${a.view.name} exists`;
    case "has-column":
      return `${a.table.name}.${a.column} exists${a.notNull === undefined ? "" : a.notNull ? " and is not null" : " and may be null"}`;
    case "has-primary-key":
      return `${a.table.name} has the primary key (${a.columns.join(", ")})`;
    case "has-index":
      return `index ${a.index} on ${a.table.name} exists`;
    case "rows":
    case "fails":
      return a.description;
    default:
      return absurd(a);
  }
}

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;

/** The condition, in a dialect's own catalog, under which a structural assertion holds; `undefined` for an assertion that is not structural. */
function condition(a: Assertion, ctx: EmitContext): string | undefined {
  const dialect = ctx.dialect.name;
  const schemaOf = (e: EntityName): string => (e.schema === undefined ? "current_schema()" : q(e.schema));
  const tableOf = (e: EntityName): string => q(ctx.naming.table(e.name, e.schema).at(-1) ?? e.name);
  switch (a.kind) {
    case "has-table":
    case "has-view": {
      const e = a.kind === "has-table" ? a.table : a.view;
      const type = a.kind === "has-table" ? "table" : "view";
      if (dialect === "sqlite") return `EXISTS (SELECT 1 FROM sqlite_master WHERE type = ${q(type)} AND name = ${tableOf(e)})`;
      const kind = a.kind === "has-table" ? "table_type = 'BASE TABLE'" : "table_type = 'VIEW'";
      return `EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ${schemaOf(e)} AND table_name = ${tableOf(e)} AND ${kind})`;
    }
    case "has-column": {
      const column = q(ctx.naming.column(a.column));
      if (dialect === "sqlite") {
        const nullness = a.notNull === undefined ? "" : ` AND "notnull" = ${a.notNull ? 1 : 0}`;
        return `EXISTS (SELECT 1 FROM pragma_table_info(${tableOf(a.table)}) WHERE name = ${column}${nullness})`;
      }
      const nullness = a.notNull === undefined ? "" : ` AND is_nullable = ${a.notNull ? "'NO'" : "'YES'"}`;
      return `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ${schemaOf(a.table)} AND table_name = ${tableOf(a.table)} AND column_name = ${column}${nullness})`;
    }
    case "has-primary-key": {
      const wanted = q(a.columns.map((c) => ctx.naming.column(c)).join(","));
      if (dialect === "sqlite") {
        return `(SELECT group_concat(name, ',') FROM (SELECT name FROM pragma_table_info(${tableOf(a.table)}) WHERE pk > 0 ORDER BY pk)) = ${wanted}`;
      }
      if (dialect === "duckdb") {
        return `(SELECT array_to_string(constraint_column_names, ',') FROM duckdb_constraints() WHERE schema_name = ${schemaOf(a.table)} AND table_name = ${tableOf(a.table)} AND constraint_type = 'PRIMARY KEY') = ${wanted}`;
      }
      return `(SELECT string_agg(k.column_name, ',' ORDER BY k.ordinal_position) FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name = t.constraint_name AND k.table_schema = t.table_schema AND k.table_name = t.table_name WHERE t.constraint_type = 'PRIMARY KEY' AND t.table_schema = ${schemaOf(a.table)} AND t.table_name = ${tableOf(a.table)}) = ${wanted}`;
    }
    case "has-index": {
      if (dialect === "sqlite")
        return `EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ${q(a.index)} AND tbl_name = ${tableOf(a.table)})`;
      if (dialect === "duckdb")
        return `EXISTS (SELECT 1 FROM duckdb_indexes() WHERE index_name = ${q(a.index)} AND table_name = ${tableOf(a.table)})`;
      return `EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = ${schemaOf(a.table)} AND indexname = ${q(a.index)} AND tablename = ${tableOf(a.table)})`;
    }
    case "rows":
    case "fails":
      return undefined;
    default:
      return absurd(a);
  }
}

/** The expected rows of a `rows` assertion as a `VALUES` list, each value a literal of the dialect. */
function valuesOf(expected: readonly (readonly SqlValue[])[], ctx: EmitContext): string {
  return expected.map((row) => `(${row.map((v) => ctx.dialect.literal(v)).join(", ")})`).join(", ");
}

/** The condition under which the rows a query gives are exactly the rows expected, in any order. */
function rowsCondition(query: string, expected: readonly (readonly SqlValue[])[], ctx: EmitContext): string {
  if (expected.length === 0) return `NOT EXISTS (SELECT 1 FROM (${query}) AS got)`;
  const want = `VALUES ${valuesOf(expected, ctx)}`;
  return `NOT EXISTS (SELECT * FROM (${query}) AS got EXCEPT SELECT * FROM (${want}) AS want) AND NOT EXISTS (SELECT * FROM (${want}) AS want EXCEPT SELECT * FROM (${query}) AS got)`;
}

/**
 * One query that gives a TAP line for each assertion, in order, in the column `tap`: SQL any of the dialects runs, with no extension
 * (FR-029). An assertion that a statement fails cannot be made by a query, so its line says it was skipped; `runAssertions` and pgTAP
 * do run it.
 *
 * @param assertions - the assertions
 * @param ctx - the context to render for
 */
export function tapQuery(assertions: readonly Assertion[], ctx: EmitContext): string {
  if (assertions.length === 0) return "SELECT '1..0' AS tap";
  const lines = assertions.map((a, i) => {
    const n = i + 1;
    const description = describeAssertion(a).replaceAll("#", "\\#");
    if (a.kind === "fails")
      return `SELECT ${n} AS n, ${q(`ok ${n} - ${description} # SKIP a statement that fails cannot be tried by a query`)} AS tap`;
    const holds = a.kind === "rows" ? rowsCondition(renderUnchecked(a.query, ctx), a.expected, ctx) : (condition(a, ctx) ?? "FALSE");
    return `SELECT ${n} AS n, CASE WHEN ${holds} THEN 'ok' ELSE 'not ok' END || ${q(` ${n} - ${description}`)} AS tap`;
  });
  return `SELECT tap FROM (\n${lines.join("\nUNION ALL\n")}\n) AS results ORDER BY n`;
}

/**
 * The assertions as a pgTAP script, for a PostgreSQL where the `pgtap` extension is installed: a plan, a test for each assertion, and
 * `finish()`. Each statement gives TAP lines.
 *
 * @param assertions - the assertions
 * @param ctx - a PostgreSQL context
 */
export function pgTapScript(assertions: readonly Assertion[], ctx: EmitContext): string {
  const dollar = (s: string): string => `$ifc$${s}$ifc$`;
  const tests = assertions.map((a) => {
    const d = q(describeAssertion(a));
    const table = (e: EntityName): string => (e.schema === undefined ? q(e.name) : `${q(e.schema)}, ${q(e.name)}`);
    switch (a.kind) {
      case "has-table":
        return `SELECT has_table(${table(a.table)}, ${d});`;
      case "has-view":
        return `SELECT has_view(${table(a.view)}, ${d});`;
      case "has-column":
        if (a.notNull === undefined) return `SELECT has_column(${table(a.table)}, ${q(a.column)}, ${d});`;
        return `SELECT ${a.notNull ? "col_not_null" : "col_is_null"}(${table(a.table)}, ${q(a.column)}, ${d});`;
      case "has-primary-key":
        return `SELECT col_is_pk(${table(a.table)}, ARRAY[${a.columns.map(q).join(", ")}], ${d});`;
      case "has-index":
        return `SELECT has_index(${table(a.table)}, ${q(a.index)}, ${d});`;
      case "rows":
        return a.expected.length === 0
          ? `SELECT is_empty(${dollar(renderUnchecked(a.query, ctx))}, ${d});`
          : `SELECT set_eq(${dollar(renderUnchecked(a.query, ctx))}, ${dollar(`VALUES ${valuesOf(a.expected, ctx)}`)}, ${d});`;
      case "fails":
        return `SELECT throws_ok(${dollar(renderUnchecked(a.statement, ctx))}, NULL, NULL, ${d});`;
      default:
        return absurd(a);
    }
  });
  return [`SELECT plan(${assertions.length});`, ...tests, "SELECT * FROM finish();"].join("\n");
}

/** What can run SQL for a test: a query that gives rows, and a script that gives none. Any driver adapter is one. */
export interface Runner {
  /** Runs a query and gives its rows as objects. */
  readonly query: (text: string) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  /** Runs a statement. */
  readonly exec: (text: string) => Promise<void>;
}

/**
 * Runs assertions from TypeScript through a runner, and gives their results as TAP nodes: the structural ones and the rows by the same
 * SQL as `tapQuery`, and a statement that must fail by running it.
 *
 * @param assertions - the assertions
 * @param runner - what runs the SQL
 * @param ctx - the context of the runner's dialect
 */
export async function runAssertions(assertions: readonly Assertion[], runner: Runner, ctx: EmitContext): Promise<readonly TapNode[]> {
  const out: TapNode[] = [];
  for (const a of assertions) {
    const description = describeAssertion(a);
    if (a.kind === "fails") {
      let threw = false;
      try {
        await runner.exec(renderUnchecked(a.statement, ctx));
      } catch {
        threw = true;
      }
      out.push(threw ? pass(description) : failed(description, { found: "the statement ran" }));
      continue;
    }
    try {
      const rows = await runner.query(tapQuery([a], ctx));
      const line = String(rows[0]?.["tap"] ?? "");
      const node = fromLines([line])[0];
      out.push(node !== undefined && node.kind === "test" && node.ok ? pass(description) : failed(description));
    } catch (thrown) {
      out.push(failed(description, { error: thrown instanceof Error ? thrown.message : String(thrown) }));
    }
  }
  return out;
}

/** What the structural tests are made from: tables, views and indexes as the model has them. */
export interface Structure {
  /** The tables. */
  readonly tables?: readonly { readonly spec: TableSpec }[];
  /** The views. */
  readonly views?: readonly EntityName[];
  /** The indexes, each with its table and the name it has in a context. */
  readonly indexes?: readonly { readonly table: EntityName; readonly nameIn: (ctx: EmitContext) => string }[];
}

/**
 * The tests that every table, column, primary key, view and index of a model exists as the model says (FR-030). A column the database
 * numbers is held to exist; whether the catalog calls it nullable differs by dialect, so that is not asserted of it.
 *
 * @param structure - the tables, views and indexes of a model
 * @param ctx - the context, for the names of indexes
 */
export function structuralTests(structure: Structure, ctx: EmitContext): readonly Assertion[] {
  const out: Assertion[] = [];
  for (const { spec } of structure.tables ?? []) {
    const table: EntityName = { name: spec.name, schema: spec.schema };
    out.push({ kind: "has-table", table });
    for (const [name, c] of spec.columns)
      out.push(
        c.identity ? { kind: "has-column", table, column: name } : { kind: "has-column", table, column: name, notNull: !c.nullable },
      );
    if (spec.primaryKey.length > 0) out.push({ kind: "has-primary-key", table, columns: spec.primaryKey });
  }
  for (const v of structure.views ?? []) out.push({ kind: "has-view", view: { name: v.name, schema: v.schema } });
  for (const i of structure.indexes ?? []) out.push({ kind: "has-index", table: i.table, index: i.nameIn(ctx) });
  return out;
}

/**
 * A test that a query gives exactly the rows expected, in any order.
 *
 * @param description - what the test shows
 * @param query - the query
 * @param expected - the rows, each a list of values in the order of the query's columns
 */
export const rows = (description: string, query: AnySql, expected: readonly (readonly SqlValue[])[]): Assertion => ({
  kind: "rows",
  description,
  query,
  expected,
});

/**
 * A test that a statement fails: a constraint that holds refuses it.
 *
 * @param description - what the test shows
 * @param statement - the statement that must be refused
 */
export const fails = (description: string, statement: AnySql): Assertion => ({ kind: "fails", description, statement });

/** Says that a test was not run in a dialect, and why. */
export const notRun = (description: string, reason: string): TapNode => skipped(description, reason);
