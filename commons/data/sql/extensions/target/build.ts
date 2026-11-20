// Spec: 0025-sql-target FR-001, FR-002, FR-003, FR-006
/**
 * An ephemeral target (commons data 0025-sql-target): one SQL file made from governance and typed rows, the same bytes every time, committed and diffed in Git, and a database made from it in one
 * transaction.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import { hashOf, snapshotOf } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import {
  bind,
  type Dialect,
  type Literal,
  type Naming,
  naming as defaultNaming,
  type PhysicalError,
  type StatementSource,
  type TableClause,
  writeNames,
} from "@intellectual-frontiers/data/sql/physical";

/** A value of a row. */
export type Cell = string | number | boolean | null;

/** Rows by table, each a record of columns, both by the words of their names. */
export type Rows = Readonly<Record<string, readonly Readonly<Record<string, Cell>>[]>>;

/** What a build is made with. */
export interface TargetOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in. */
  readonly schema?: string;
  readonly sources?: readonly StatementSource[];
  readonly tableClauses?: readonly TableClause[];
  /** The rows. */
  readonly rows?: Rows;
  /** The module the file was made from, for its header. */
  readonly module?: string;
  /** The rows to an `INSERT`; 100 where it is not said. */
  readonly batch?: number;
}

/** Why a target cannot be made from its description, as a value. */
export type TargetError =
  | { readonly kind: "physical"; readonly errors: readonly PhysicalError[] }
  | { readonly kind: "unknown-table"; readonly table: string }
  | { readonly kind: "unknown-column"; readonly table: string; readonly column: string }
  | { readonly kind: "missing-required"; readonly table: string; readonly columns: readonly string[]; readonly row: number }
  | { readonly kind: "duplicate-key"; readonly table: string; readonly key: readonly Cell[] }
  | { readonly kind: "duplicate-column"; readonly table: string; readonly column: string; readonly row: number }
  | { readonly kind: "cycle"; readonly tables: readonly string[] }
  | { readonly kind: "state" };

/** A build: what is run, and the text of the file. */
export interface TargetBuild {
  readonly dialect: Dialect;
  /** The statements, in order: the structure, then the rows. */
  readonly statements: readonly string[];
  /** The text of the file. */
  readonly text: string;
  /** The number of rows of each table, in the order they are written. */
  readonly counts: Readonly<Record<string, number>>;
  /** The hash of the schema's state. */
  readonly state: string;
  /** The hash of the rows. */
  readonly data: string;
}

const dotted = (s: string): string => words(s).join(".");
const compare = (a: Cell, b: Cell): number => (a === b ? 0 : a === null ? -1 : b === null ? 1 : typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : 1);

/**
 * Makes a build.
 *
 * @param schema - the logical schema
 * @param options - the dialect, naming, schema qualifier, extensions and rows
 * @returns the build, or why not
 */
export function targetBuild(schema: LogicalSchema, options: TargetOptions): Result<TargetBuild, readonly TargetError[]> {
  const { dialect } = options;
  const nm = options.naming ?? defaultNaming();
  const errors: TargetError[] = [];
  const physical = bind(schema, {
    dialect,
    naming: nm,
    ...(options.sources === undefined ? {} : { sources: options.sources }),
    ...(options.schema === undefined ? {} : { schema: options.schema }),
    ...(options.tableClauses === undefined ? {} : { tableClauses: options.tableClauses }),
  });
  if (physical.kind === "err") return err([{ kind: "physical", errors: physical.error }]);
  const state = snapshotOf(schema, { dialect, naming: nm, ...(options.schema === undefined ? {} : { schema: options.schema }) });
  if (state.kind === "err") return err([{ kind: "state" }]);
  const problems: PhysicalError[] = [];
  const names = writeNames(schema, dialect, nm, problems, options.schema);
  // the order of the tables: after the tables they refer to, otherwise as the schema has them
  const order: Table[] = [];
  const done = new Set<string>();
  const visiting: string[] = [];
  const visit = (t: Table): void => {
    const k = t.name.join(".");
    if (done.has(k)) return;
    if (visiting.includes(k)) {
      errors.push({ kind: "cycle", tables: [...visiting.slice(visiting.indexOf(k)), k] });
      done.add(k);
      return;
    }
    visiting.push(k);
    for (const f of t.foreignKeys) {
      const to = f.references.table.join(".");
      const target = schema.tables.find((x) => x.name.join(".") === to);
      if (target !== undefined && to !== k) visit(target);
    }
    visiting.pop();
    done.add(k);
    order.push(t);
  };
  for (const t of schema.tables) visit(t);
  const given = options.rows ?? {};
  for (const name of Object.keys(given)) if (!schema.tables.some((t) => t.name.join(".") === dotted(name))) errors.push({ kind: "unknown-table", table: name });
  const q = (n: string): string => dialect.quote(n);
  const inserts: string[] = [];
  const counts: Record<string, number> = {};
  const batch = Math.max(1, options.batch ?? 100);
  const canonical: unknown[] = [];
  for (const t of order) {
    const key = Object.keys(given).find((k) => dotted(k) === t.name.join("."));
    const rows = key === undefined ? [] : (given[key] ?? []);
    if (rows.length === 0) continue;
    const label = t.name.join(".");
    // each row as the table's columns, by position
    const resolved: Cell[][] = [];
    const columns = t.columns.filter((c) => rows.some((r) => Object.keys(r).some((k) => dotted(k) === c.name.join("."))));
    rows.forEach((r, i) => {
      const cells = new Map<string, Cell>();
      for (const [k, v] of Object.entries(r)) {
        const c = t.columns.find((x) => x.name.join(".") === dotted(k));
        if (c === undefined) {
          if (!errors.some((e) => e.kind === "unknown-column" && e.table === label && e.column === k)) errors.push({ kind: "unknown-column", table: label, column: k });
          continue;
        }
        if (cells.has(c.name.join("."))) errors.push({ kind: "duplicate-column", table: label, column: k, row: i });
        cells.set(c.name.join("."), v);
      }
      const missing = t.columns.filter((c) => !c.nullable && c.default === undefined && !cells.has(c.name.join("."))).map((c) => c.name.join("."));
      if (missing.length > 0) errors.push({ kind: "missing-required", table: label, columns: missing, row: i });
      resolved.push(columns.map((c) => cells.get(c.name.join(".")) ?? null));
    });
    const pk = t.primaryKey.map((w) => columns.findIndex((c) => c.name.join(".") === w.join(".")));
    if (pk.length > 0 && pk.every((i) => i >= 0)) {
      resolved.sort((a, b) => {
        for (const i of pk) {
          const c = compare(a[i] ?? null, b[i] ?? null);
          if (c !== 0) return c;
        }
        return 0;
      });
      for (let i = 1; i < resolved.length; i++)
        if (pk.every((k) => resolved[i]![k] === resolved[i - 1]![k])) errors.push({ kind: "duplicate-key", table: label, key: pk.map((k) => resolved[i]![k] ?? null) });
    } else resolved.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    counts[label] = resolved.length;
    canonical.push([label, columns.map((c) => c.name.join(".")), resolved]);
    const ref = names.ref(t.id);
    const cols = columns.map((c) => q(names.column(c.id) ?? "")).join(", ");
    for (let i = 0; i < resolved.length; i += batch)
      inserts.push(`INSERT INTO ${ref} (${cols}) VALUES\n${resolved.slice(i, i + batch).map((r) => `(${r.map((v) => dialect.literal(v as Literal)).join(", ")})`).join(",\n")};`);
  }
  if (errors.length > 0) return err(errors);
  const stateHash = hashOf(state.value);
  const data = hashOf(canonical);
  const header = [
    `-- Generated by @intellectual-frontiers/data${options.module === undefined ? "" : ` from ${options.module}`}. Do not edit: change the source and build again.`,
    `-- dialect: ${dialect.name}`,
    `-- schema: ${stateHash}`,
    `-- rows: ${data}`,
  ].join("\n");
  const statements = [...physical.value.statements.map((s) => s.sql), ...inserts];
  return ok({ dialect, statements, text: `${header}\n\n${statements.join("\n\n")}\n`, counts, state: stateHash, data });
}

/** One table that has more rows than a limit. */
export interface SizeFinding {
  readonly table: string;
  readonly rows: number;
  readonly limit: number;
}

/**
 * The tables of a build with more rows than a limit.
 *
 * @param build - the build
 * @param limit - the most rows a table may have
 * @returns what is over the limit
 */
export const sizeFindings = (build: TargetBuild, limit: number): readonly SizeFinding[] =>
  Object.entries(build.counts).filter(([, rows]) => rows > limit).map(([table, rows]) => ({ table, rows, limit }));
