// Spec: 0007-physical FR-003, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * Binding (commons data 0007-physical): a logical schema, a dialect and a naming made into the statements that create the schema and load its reference data. Names are written by the
 * case style; a table follows the tables its foreign keys refer to; indexes follow tables and data follows both; every statement carries the logical elements it was made from; and what
 * the dialect cannot express, or a name that is too long or alike, is an error value, all of them together.
 *
 * @remarks
 * A foreign key that closes a cycle of tables is added afterwards where the dialect can add a constraint, and is an error where it cannot.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Column, ForeignKey, LogicalId, LogicalType, LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import { type Naming, naming as defaultNaming, writeCode } from "./case.ts";
import { expressor, writeNames } from "./express.ts";
import type { Dialect } from "./dialect.ts";
import { upsert } from "./upsert.ts";
import {
  type TableClause,
  GROUPS,
  type BindContext,
  type Group,
  type Origin,
  type Physical,
  type PhysicalError,
  type Statement,
  type StatementSource,
  type Written,
} from "./statement.ts";

/** What `bind` is given besides the schema. */
export interface BindOptions {
  readonly dialect: Dialect;
  /** How names and codes are written; snake case where none is given. */
  readonly naming?: Naming;
  /** What extensions add, in order. */
  readonly sources?: readonly StatementSource[];
  /** The schema the tables are in (0013-sql-qualified-names): qualified where the dialect has schemas, else its words come first in each table's name. */
  readonly schema?: string;
  /** What extensions add to the end of a table, in order. */
  readonly tableClauses?: readonly TableClause[];
}

const indent = "    ";

/**
 * Binds a logical schema to a dialect.
 *
 * @param schema - the logical schema
 * @param options - the dialect, the naming and the statements extensions add
 * @returns the bound schema, or every error
 */
export function bind(schema: LogicalSchema, options: BindOptions): Result<Physical, readonly PhysicalError[]> {
  const { dialect } = options;
  const naming = options.naming ?? defaultNaming();
  const errors: PhysicalError[] = [];
  const q = (name: string): string => dialect.quote(name);
  const names = writeNames(schema, dialect, naming, errors, options.schema);
  const { tables, columns, constraints } = names;
  const written: Written = names;
  const x = expressor(dialect, naming, names, errors);
  const { list, columnLine, fkClause } = x;
  const columnOf = (t: Table, c: Column): string => columnLine(t, c);

  // what the dialect cannot store, and what it must run first
  const used: LogicalType[] = [];
  for (const t of schema.tables)
    for (const c of t.columns) {
      const why = dialect.unsupported?.(c.type);
      if (why !== undefined) errors.push({ kind: "unsupported", element: c.id, why });
      else if (!used.some((u) => JSON.stringify(u) === JSON.stringify(c.type))) used.push(c.type);
    }

  // the order of the tables: each after the tables its foreign keys refer to
  const byName = new Map(schema.tables.map((t) => [t.name.join("."), t]));
  const order: Table[] = [];
  const state = new Map<string, "visiting" | "done">();
  const cyclic = new Set<string>();
  const visit = (t: Table, path: string[]): void => {
    const key = t.name.join(".");
    const s = state.get(key);
    if (s === "done") return;
    if (s === "visiting") {
      for (const p of path.slice(path.indexOf(key))) cyclic.add(p);
      return;
    }
    state.set(key, "visiting");
    for (const f of t.foreignKeys) {
      const target = byName.get(f.references.table.join("."));
      if (target !== undefined && target !== t) visit(target, [...path, key]);
    }
    state.set(key, "done");
    order.push(t);
  };
  for (const t of schema.tables) visit(t, []);
  const breakable = dialect.features.includes("add-constraint");
  if (cyclic.size > 0 && !breakable)
    errors.push({ kind: "cycle", tables: [...cyclic].map((k) => naming.names.write(byName.get(k)?.name ?? [])) });
  const deferred = (f: ForeignKey, t: Table): boolean =>
    breakable &&
    cyclic.has(t.name.join(".")) &&
    cyclic.has(f.references.table.join(".")) &&
    f.references.table.join(".") !== t.name.join(".");

  const statements: { group: Group; origin: Origin; sql: string; of: readonly LogicalId[] }[] = [];
  if (names.qualifier !== undefined)
    statements.push({ group: "setup", origin: "core", sql: `CREATE SCHEMA IF NOT EXISTS ${q(names.qualifier)};`, of: [] });
  for (const sql of dialect.setup?.(used) ?? []) statements.push({ group: "setup", origin: "core", sql, of: [] });
  const context: BindContext = {
    schema,
    dialect,
    naming,
    written,
    ...(options.schema === undefined ? {} : { schemaName: options.schema }),
  };
  for (const t of order) {
    const lines: string[] = t.columns.map((c) => columnOf(t, c));
    if (t.primaryKey.length > 1) lines.push(`PRIMARY KEY (${list(t.primaryKey)})`);
    for (const f of t.foreignKeys) if (!deferred(f, t)) lines.push(fkClause(f));
    for (const u of t.uniques) lines.push(x.uniqueClause(u));
    for (const c of t.checks) {
      const clause = x.checkClause(c);
      if (clause !== undefined) lines.push(clause);
    }
    const clauses: string[] = [];
    for (const clause of options.tableClauses ?? []) {
      const r = clause(context, t);
      if (r.kind === "err") errors.push(...r.error);
      else if (r.value !== undefined) clauses.push(r.value);
    }
    statements.push({
      group: "table",
      origin: "core",
      sql: `CREATE TABLE IF NOT EXISTS ${names.ref(t.id)} (\n${lines.map((l) => `${indent}${l}`).join(",\n")}\n)${clauses.map((c) => ` ${c}`).join("")};`,
      of: [
        t.id,
        ...t.columns.map((c) => c.id),
        ...t.foreignKeys.filter((f) => !deferred(f, t)).map((f) => f.id),
        ...t.uniques.map((u) => u.id),
        ...t.checks.map((c) => c.id),
      ],
    });
    for (const f of t.foreignKeys) {
      if (deferred(f, t))
        statements.push({
          group: "constraint",
          origin: "core",
          sql: `ALTER TABLE ${names.ref(t.id)} ADD ${fkClause(f)};`,
          of: [f.id],
        });
    }
  }
  for (const t of order) {
    for (const i of t.indexes) {
      statements.push({
        group: "index",
        origin: "core",
        sql: `CREATE INDEX IF NOT EXISTS ${q(constraints.get(i.id) ?? "")} ON ${names.ref(t.id)} (${list(i.columns)});`,
        of: [i.id],
      });
    }
  }
  for (const t of order) {
    if (t.rows === undefined || t.rows.length === 0) continue;
    const columnNames = t.columns.map((c) => columns.get(c.id) ?? "");
    const key = t.primaryKey.map((k) => naming.names.write(k));
    const rows = t.rows.map((r) => [writeCode(naming, r.code), r.label, r.description]);
    statements.push({
      group: "data",
      origin: "core",
      sql: upsert(dialect, tables.get(t.id) ?? "", columnNames, key, rows, names.qualifier),
      of: [t.id],
    });
  }

  for (const source of options.sources ?? []) {
    const r = source(context);
    if (r.kind === "err") errors.push(...r.error);
    else statements.push(...r.value.map((st) => ({ ...st, origin: "extension" as const })));
  }
  if (errors.length > 0) return err(errors);
  const ordered: Statement[] = GROUPS.flatMap((g) => statements.filter((s) => s.group === g));
  return ok({
    dialect: dialect.name,
    naming: { names: naming.names.name, codes: naming.codes === "name" ? "name" : naming.codes.name },
    statements: ordered,
  });
}
