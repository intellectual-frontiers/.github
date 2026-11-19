// Spec: 0049-sql-assertions FR-001, FR-002, FR-003, FR-005
/**
 * Assertions about a database (commons data 0049-sql-assertions): what must be true of its structure and its rows, written once as values and run in three ways: inside PostgreSQL as pgTAP, inside any of
 * the dialects as one query that returns TAP lines (no extension), and from TypeScript through a driver. The structural assertions are made from the state a schema has (`snapshotOf`), so that a table,
 * a column, a key or an index that a database lacks or has changed is a failing test with the name of what is wrong.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import type { Driver, State } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect, Literal } from "@intellectual-frontiers/data/sql/physical";
import { failed, fromLines, pass, type TapNode } from "./tap.ts";

/** A table or view by the name it has in the database. */
export interface Named {
  readonly name: string;
  readonly schema?: string;
}

/** One thing held to be true of a database. */
export type Assertion =
  | { readonly kind: "has-table"; readonly table: Named }
  | { readonly kind: "has-view"; readonly view: Named }
  | { readonly kind: "has-column"; readonly table: Named; readonly column: string; readonly notNull?: boolean }
  | { readonly kind: "has-primary-key"; readonly table: Named; readonly columns: readonly string[] }
  | { readonly kind: "has-index"; readonly table: Named; readonly index: string }
  | { readonly kind: "rows"; readonly description: string; readonly query: string; readonly expected: readonly (readonly Literal[])[] }
  | { readonly kind: "fails"; readonly description: string; readonly statement: string };

/** What an assertion says of itself, as the description of its line. */
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

/** The condition, in a dialect's own catalog, under which a structural assertion holds; none for one that is not structural. */
function condition(a: Assertion, d: Dialect): string | undefined {
  const schemaOf = (e: Named): string => (e.schema === undefined ? "current_schema()" : q(e.schema));
  switch (a.kind) {
    case "has-table":
    case "has-view": {
      const e = a.kind === "has-table" ? a.table : a.view;
      const type = a.kind === "has-table" ? "table" : "view";
      if (d.name === "sqlite") return `EXISTS (SELECT 1 FROM sqlite_master WHERE type = ${q(type)} AND name = ${q(e.name)})`;
      const kind = a.kind === "has-table" ? "table_type = 'BASE TABLE'" : "table_type = 'VIEW'";
      return `EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ${schemaOf(e)} AND table_name = ${q(e.name)} AND ${kind})`;
    }
    case "has-column": {
      if (d.name === "sqlite") return `EXISTS (SELECT 1 FROM pragma_table_info(${q(a.table.name)}) WHERE name = ${q(a.column)}${a.notNull === undefined ? "" : ` AND "notnull" = ${a.notNull ? 1 : 0}`})`;
      const nullness = a.notNull === undefined ? "" : ` AND is_nullable = ${a.notNull ? "'NO'" : "'YES'"}`;
      return `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ${schemaOf(a.table)} AND table_name = ${q(a.table.name)} AND column_name = ${q(a.column)}${nullness})`;
    }
    case "has-primary-key": {
      const wanted = q(a.columns.join(","));
      if (d.name === "sqlite") return `(SELECT group_concat(name, ',') FROM (SELECT name FROM pragma_table_info(${q(a.table.name)}) WHERE pk > 0 ORDER BY pk)) = ${wanted}`;
      if (d.name === "duckdb") return `(SELECT array_to_string(constraint_column_names, ',') FROM duckdb_constraints() WHERE schema_name = ${schemaOf(a.table)} AND table_name = ${q(a.table.name)} AND constraint_type = 'PRIMARY KEY') = ${wanted}`;
      return `(SELECT string_agg(k.column_name, ',' ORDER BY k.ordinal_position) FROM information_schema.table_constraints t JOIN information_schema.key_column_usage k ON k.constraint_name = t.constraint_name AND k.table_schema = t.table_schema WHERE t.constraint_type = 'PRIMARY KEY' AND t.table_schema = ${schemaOf(a.table)} AND t.table_name = ${q(a.table.name)}) = ${wanted}`;
    }
    case "has-index":
      if (d.name === "sqlite") return `EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ${q(a.index)} AND tbl_name = ${q(a.table.name)})`;
      if (d.name === "duckdb") return `EXISTS (SELECT 1 FROM duckdb_indexes() WHERE index_name = ${q(a.index)} AND table_name = ${q(a.table.name)})`;
      return `EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = ${schemaOf(a.table)} AND indexname = ${q(a.index)} AND tablename = ${q(a.table.name)})`;
    case "rows":
    case "fails":
      return undefined;
    default:
      return absurd(a);
  }
}

const valuesOf = (expected: readonly (readonly Literal[])[], d: Dialect): string => expected.map((row) => `(${row.map((v) => d.literal(v)).join(", ")})`).join(", ");

/** The condition under which the rows a query gives are exactly the rows expected, in any order. */
function rowsCondition(query: string, expected: readonly (readonly Literal[])[], d: Dialect): string {
  const body = query.replace(/;\s*$/, "");
  if (expected.length === 0) return `NOT EXISTS (SELECT 1 FROM (${body}) AS got)`;
  const want = `VALUES ${valuesOf(expected, d)}`;
  return `NOT EXISTS (SELECT * FROM (${body}) AS got EXCEPT SELECT * FROM (${want}) AS want) AND NOT EXISTS (SELECT * FROM (${want}) AS want EXCEPT SELECT * FROM (${body}) AS got)`;
}

/**
 * One query that gives a TAP line for each assertion, in order, in the column `tap`: SQL any dialect runs, with no extension. An assertion that a statement fails cannot be made by a query, so its line
 * says it was skipped; `runAssertions` and pgTAP do run it.
 */
export function tapQuery(assertions: readonly Assertion[], d: Dialect): string {
  if (assertions.length === 0) return "SELECT '1..0' AS tap";
  const lines = assertions.map((a, i) => {
    const n = i + 1;
    const description = describeAssertion(a).replaceAll("#", "\\#");
    if (a.kind === "fails") return `SELECT ${n} AS n, ${q(`ok ${n} - ${description} # SKIP a statement that fails cannot be tried by a query`)} AS tap`;
    const holds = a.kind === "rows" ? rowsCondition(a.query, a.expected, d) : (condition(a, d) ?? "FALSE");
    return `SELECT ${n} AS n, CASE WHEN ${holds} THEN 'ok' ELSE 'not ok' END || ${q(` ${n} - ${description}`)} AS tap`;
  });
  return `SELECT tap FROM (\n${lines.join("\nUNION ALL\n")}\n) AS results ORDER BY n`;
}

/** The assertions as a pgTAP script, for a PostgreSQL where the `pgtap` extension is installed: a plan, a test for each assertion, and `finish()`. */
export function pgTapScript(assertions: readonly Assertion[], d: Dialect): string {
  const dollar = (s: string): string => `$ifc$${s.replace(/;\s*$/, "")}$ifc$`;
  const table = (e: Named): string => (e.schema === undefined ? q(e.name) : `${q(e.schema)}, ${q(e.name)}`);
  const tests = assertions.map((a) => {
    const desc = q(describeAssertion(a));
    switch (a.kind) {
      case "has-table":
        return `SELECT has_table(${table(a.table)}, ${desc});`;
      case "has-view":
        return `SELECT has_view(${table(a.view)}, ${desc});`;
      case "has-column":
        return a.notNull === undefined ? `SELECT has_column(${table(a.table)}, ${q(a.column)}, ${desc});` : `SELECT ${a.notNull ? "col_not_null" : "col_is_null"}(${table(a.table)}, ${q(a.column)}, ${desc});`;
      case "has-primary-key":
        return `SELECT col_is_pk(${table(a.table)}, ARRAY[${a.columns.map(q).join(", ")}], ${desc});`;
      case "has-index":
        return `SELECT has_index(${table(a.table)}, ${q(a.index)}, ${desc});`;
      case "rows":
        return a.expected.length === 0 ? `SELECT is_empty(${dollar(a.query)}, ${desc});` : `SELECT set_eq(${dollar(a.query)}, ${dollar(`VALUES ${valuesOf(a.expected, d)}`)}, ${desc});`;
      case "fails":
        return `SELECT throws_ok(${dollar(a.statement)}, NULL, NULL, ${desc});`;
      default:
        return absurd(a);
    }
  });
  return [`SELECT plan(${assertions.length});`, ...tests, "SELECT * FROM finish();"].join("\n");
}

/**
 * Runs assertions from TypeScript through a driver, and gives their results as TAP nodes: the structural ones and the rows by the same SQL as `tapQuery`, and a statement that must fail by running it
 * (in a transaction that is rolled back, so that a statement that is not refused changes nothing).
 */
export async function runAssertions(assertions: readonly Assertion[], driver: Driver, d: Dialect): Promise<readonly TapNode[]> {
  const out: TapNode[] = [];
  for (const a of assertions) {
    const description = describeAssertion(a);
    if (a.kind === "fails") {
      let threw = false;
      await driver.exec("BEGIN");
      try {
        await driver.exec(a.statement);
      } catch {
        threw = true;
      } finally {
        await driver.exec("ROLLBACK").catch(() => undefined);
      }
      out.push(threw ? pass(description) : failed(description, { found: "the statement ran" }));
      continue;
    }
    try {
      const rows = await driver.query(tapQuery([a], d));
      const node = fromLines([String(rows[0]?.["tap"] ?? "")])[0];
      out.push(node !== undefined && node.kind === "test" && node.ok ? pass(description) : failed(description));
    } catch (thrown) {
      out.push(failed(description, { error: thrown instanceof Error ? thrown.message : String(thrown) }));
    }
  }
  return out;
}

/** The tests that every table, column, primary key and index of a state exists as the state says; a view is added by hand. A column the database numbers is held to exist, and its nullability is not asserted. */
export function structuralTests(state: State, d: Dialect): readonly Assertion[] {
  void d;
  const out: Assertion[] = [];
  for (const t of state.tables) {
    const table: Named = { name: t.name, ...(state.qualifier === undefined ? {} : { schema: state.qualifier }) };
    out.push({ kind: "has-table", table });
    for (const c of t.columns) out.push({ kind: "has-column", table, column: c.name, notNull: !c.nullable });
    if (t.primaryKey.length > 0) out.push({ kind: "has-primary-key", table, columns: t.primaryKey });
    for (const k of t.constraints) if (k.kind === "index") out.push({ kind: "has-index", table, index: k.name });
  }
  return out;
}

/** A test that a query gives exactly the rows expected, in any order. */
export const rows = (description: string, query: string, expected: readonly (readonly Literal[])[]): Assertion => ({ kind: "rows", description, query, expected });
/** A test that a statement fails: a constraint that holds refuses it. */
export const fails = (description: string, statement: string): Assertion => ({ kind: "fails", description, statement });
