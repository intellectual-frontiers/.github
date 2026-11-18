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
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Words } from "@intellectual-frontiers/data/governance";
import type {
  Check,
  CheckExpression,
  Column,
  ForeignKey,
  LogicalDefault,
  LogicalId,
  LogicalType,
  LogicalSchema,
  Table,
} from "@intellectual-frontiers/data/sql/logical";
import { type Naming, naming as defaultNaming, writeCode } from "./case.ts";
import type { Dialect } from "./dialect.ts";
import { upsert } from "./upsert.ts";
import {
  type TableClause,
  GROUPS,
  type BindContext,
  type Group,
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
  const write = (words: Words, element: LogicalId): string => {
    const name = naming.names.write(words);
    if (name.length > dialect.maxName) errors.push({ kind: "length", element, name, max: dialect.maxName });
    return name;
  };

  // the names, written once, and any that are alike
  const tables = new Map<LogicalId, string>();
  const columns = new Map<LogicalId, string>();
  const constraints = new Map<LogicalId, string>();
  const seenTables = new Map<string, LogicalId>();
  const seenConstraints = new Map<string, LogicalId>();
  for (const t of schema.tables) {
    const tn = write(t.name, t.id);
    tables.set(t.id, tn);
    const other = seenTables.get(tn);
    if (other !== undefined) errors.push({ kind: "collision", name: tn, first: other, second: t.id });
    else seenTables.set(tn, t.id);
    const seenColumns = new Map<string, LogicalId>();
    for (const c of t.columns) {
      const cn = write(c.name, c.id);
      columns.set(c.id, cn);
      const o = seenColumns.get(cn);
      if (o !== undefined) errors.push({ kind: "collision", name: cn, table: tn, first: o, second: c.id });
      else seenColumns.set(cn, c.id);
    }
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
      const xn = write(x.name, x.id);
      constraints.set(x.id, xn);
      const o = seenConstraints.get(xn);
      if (o !== undefined) errors.push({ kind: "collision", name: xn, table: tn, first: o, second: x.id });
      else seenConstraints.set(xn, x.id);
    }
  }
  const written: Written = { table: (id) => tables.get(id), column: (id) => columns.get(id), constraint: (id) => constraints.get(id) };
  const list = (ws: readonly Words[]): string => ws.map((w) => q(naming.names.write(w))).join(", ");

  const defaultOf = (d: LogicalDefault): string => {
    switch (d.kind) {
      case "literal":
        return dialect.literal(d.value);
      case "now":
        return dialect.now;
      case "code":
        return dialect.literal(writeCode(naming, d.name));
    }
  };
  const checkOf = (c: Check): string | undefined => {
    const e: CheckExpression = c.expression;
    const col = (w: Words): string => q(naming.names.write(w));
    switch (e.kind) {
      case "differs":
        return `${col(e.columns[0])} <> ${col(e.columns[1])}`;
      case "oneOf":
        return `${col(e.column)} IN (${e.codes.map((x) => dialect.literal(writeCode(naming, x))).join(", ")})`;
      case "range": {
        const parts = [
          ...(e.min === undefined ? [] : [`${col(e.column)} >= ${dialect.literal(e.min)}`]),
          ...(e.max === undefined ? [] : [`${col(e.column)} <= ${dialect.literal(e.max)}`]),
        ];
        return parts.join(" AND ");
      }
      case "pattern": {
        if (dialect.pattern === undefined) {
          errors.push({ kind: "unsupported", element: c.id, why: `${dialect.name} has no regular expression to check a pattern with` });
          return undefined;
        }
        return dialect.pattern(col(e.column), e.pattern);
      }
    }
  };
  const columnLine = (t: Table, c: Column): string => {
    const inlineKey = t.primaryKey.length === 1 && t.primaryKey[0]?.join(".") === c.name.join(".");
    return `${q(columns.get(c.id) ?? "")} ${dialect.type(c.type)}${c.nullable ? "" : " NOT NULL"}${c.default === undefined ? "" : ` DEFAULT ${defaultOf(c.default)}`}${inlineKey ? " PRIMARY KEY" : ""}`;
  };
  const fkClause = (f: ForeignKey): string =>
    `CONSTRAINT ${q(constraints.get(f.id) ?? "")} FOREIGN KEY (${list(f.columns)}) REFERENCES ${q(naming.names.write(f.references.table))} (${list(f.references.columns)})`;

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

  const statements: { group: Group; sql: string; of: readonly LogicalId[] }[] = [];
  for (const sql of dialect.setup?.(used) ?? []) statements.push({ group: "setup", sql, of: [] });
  const context: BindContext = { schema, dialect, naming, written };
  for (const t of order) {
    const lines: string[] = t.columns.map((c) => columnLine(t, c));
    if (t.primaryKey.length > 1) lines.push(`PRIMARY KEY (${list(t.primaryKey)})`);
    for (const f of t.foreignKeys) if (!deferred(f, t)) lines.push(fkClause(f));
    for (const u of t.uniques) lines.push(`CONSTRAINT ${q(constraints.get(u.id) ?? "")} UNIQUE (${list(u.columns)})`);
    for (const c of t.checks) {
      const expr = checkOf(c);
      if (expr !== undefined) lines.push(`CONSTRAINT ${q(constraints.get(c.id) ?? "")} CHECK (${expr})`);
    }
    const clauses: string[] = [];
    for (const clause of options.tableClauses ?? []) {
      const r = clause(context, t);
      if (r.kind === "err") errors.push(...r.error);
      else if (r.value !== undefined) clauses.push(r.value);
    }
    statements.push({
      group: "table",
      sql: `CREATE TABLE IF NOT EXISTS ${q(tables.get(t.id) ?? "")} (\n${lines.map((l) => `${indent}${l}`).join(",\n")}\n)${clauses.map((c) => ` ${c}`).join("")};`,
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
        statements.push({ group: "constraint", sql: `ALTER TABLE ${q(tables.get(t.id) ?? "")} ADD ${fkClause(f)};`, of: [f.id] });
    }
  }
  for (const t of order) {
    for (const i of t.indexes) {
      statements.push({
        group: "index",
        sql: `CREATE INDEX IF NOT EXISTS ${q(constraints.get(i.id) ?? "")} ON ${q(tables.get(t.id) ?? "")} (${list(i.columns)});`,
        of: [i.id],
      });
    }
  }
  for (const t of order) {
    if (t.rows === undefined || t.rows.length === 0) continue;
    const names = t.columns.map((c) => columns.get(c.id) ?? "");
    const key = t.primaryKey.map((k) => naming.names.write(k));
    const rows = t.rows.map((r) => [writeCode(naming, r.code), r.label, r.description]);
    statements.push({ group: "data", sql: upsert(dialect, tables.get(t.id) ?? "", names, key, rows), of: [t.id] });
  }

  for (const source of options.sources ?? []) {
    const r = source(context);
    if (r.kind === "err") errors.push(...r.error);
    else statements.push(...r.value);
  }
  if (errors.length > 0) return err(errors);
  const ordered: Statement[] = GROUPS.flatMap((g) => statements.filter((s) => s.group === g));
  return ok({
    dialect: dialect.name,
    naming: { names: naming.names.name, codes: naming.codes === "name" ? "name" : naming.codes.name },
    statements: ordered,
  });
}
