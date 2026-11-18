// Spec: 0023-sql-transforms FR-001, FR-002, FR-003, FR-005
/**
 * A project of transforms (commons data 0023-sql-transforms): models whose SQL asks for the tables of a schema and one another by the words of their names, put in the order of what they ask for,
 * with their tests as SQL and their lineage.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { words } from "@intellectual-frontiers/data/governance";
import { hashOf } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Naming, naming as defaultNaming, qualified, type RefError, type Refs, refsOf } from "@intellectual-frontiers/data/sql/physical";
import { type TransformSettings, type Transforms, settingsOf } from "./settings.ts";

/** How a model's result is kept. */
export type Materialization = "view" | "table" | "incremental" | "ephemeral";

type Value = string | number | boolean;

/** A test of a model: SQL that gives the rows that are wrong. */
export type Check = { readonly name?: string; readonly severity?: "error" | "warn" } & (
  | { readonly kind: "unique"; readonly columns: readonly string[] }
  | { readonly kind: "not-null"; readonly column: string }
  | { readonly kind: "accepted-values"; readonly column: string; readonly values: readonly Value[] }
  | { readonly kind: "relationship"; readonly column: string; readonly to: string; readonly toColumn: string }
  | { readonly kind: "custom"; readonly failing: (refs: Refs) => string }
);

/** What a project says of a model. */
export interface ModelSpec {
  readonly name: string;
  /** The model's SQL, given the references of the schema and of the other models. */
  readonly select: (refs: Refs) => string;
  /** `view` where it is not said. */
  readonly materialization?: Materialization;
  /** The columns a row of an incremental model is known by, as its SQL names them. */
  readonly key?: readonly string[];
  readonly tests?: readonly Check[];
}

/** A test as SQL. */
export interface ResolvedTest {
  readonly name: string;
  readonly kind: Check["kind"];
  readonly severity: "error" | "warn";
  readonly failing: string;
}

/** A model, resolved. */
export interface Model {
  readonly name: string;
  /** The reference to it, written and qualified. */
  readonly ref: string;
  readonly schema: string | undefined;
  readonly table: string;
  readonly materialization: Materialization;
  readonly key: readonly string[];
  readonly sql: string;
  /** The hash of what defines it: its SQL, how it is kept and its key. */
  readonly hash: string;
  /** What its SQL asks for, by the words of their names. */
  readonly reads: readonly string[];
  readonly tests: readonly ResolvedTest[];
}

/** Rows went from one node to another. */
export interface LineageEdge {
  readonly via: string;
  readonly kind: "transform";
  readonly from: string;
  readonly to: string;
}

/** A project of models, in the order they build. */
export interface Project {
  readonly models: readonly Model[];
  readonly lineage: readonly LineageEdge[];
  readonly dialect: Dialect;
  readonly naming: Naming;
  readonly settings: Transforms;
  /** The ledger's table. */
  readonly ledger: { readonly ref: string; readonly schema: string | undefined; readonly table: string };
}

export type TransformError =
  | RefError
  | { readonly kind: "duplicate"; readonly name: string }
  | { readonly kind: "cycle"; readonly models: readonly string[] }
  | { readonly kind: "no-key"; readonly model: string }
  | { readonly kind: "ephemeral-test"; readonly model: string };

/** What a project is made with. */
export interface TransformOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in, as `bind` was given it. */
  readonly schema?: string;
  readonly settings?: TransformSettings;
}

const dotted = (s: string): string => words(s).join(".");

/**
 * A project of models.
 *
 * @param schema - the logical schema
 * @param specs - the models
 * @param options - the dialect, naming, the tables' schema and the settings
 * @returns the project, or why not
 */
export function transformer(schema: LogicalSchema, specs: readonly ModelSpec[], options: TransformOptions): Result<Project, readonly TransformError[]> {
  const { dialect } = options;
  const nm = options.naming ?? defaultNaming();
  const settings = settingsOf(options.settings);
  const errors: TransformError[] = [];
  const q = (n: string): string => dialect.quote(n);
  const where = (name: string): { schema: string | undefined; table: string } => {
    const home = settings.schema ?? options.schema;
    const has = dialect.features.includes("schemas");
    return home !== undefined && has
      ? { schema: home, table: nm.names.write(words(name)) }
      : { schema: undefined, table: nm.names.write([...(home === undefined ? [] : words(home)), ...words(name)]) };
  };
  const refOf = (name: string): string => {
    const w = where(name);
    return qualified(dialect, w.schema, w.table);
  };
  const byName = new Map<string, ModelSpec>();
  for (const s of specs) {
    if (byName.has(dotted(s.name))) errors.push({ kind: "duplicate", name: s.name });
    byName.set(dotted(s.name), s);
  }
  for (const s of specs) {
    if ((s.materialization ?? "view") === "incremental" && (s.key === undefined || s.key.length === 0)) errors.push({ kind: "no-key", model: s.name });
    if (s.materialization === "ephemeral" && (s.tests?.length ?? 0) > 0) errors.push({ kind: "ephemeral-test", model: s.name });
  }
  // what each model asks for
  const asked = new Map<string, readonly string[]>();
  for (const s of specs) {
    const kit = refsOf(schema, dialect, nm, options.schema, (n) => (byName.has(dotted(n)) ? refOf(n) : undefined));
    s.select(kit.refs);
    errors.push(...kit.errors());
    asked.set(dotted(s.name), [...kit.used().map((u) => dotted(u.name))]);
  }
  // the order, a model after what it reads, otherwise as declared
  const order: ModelSpec[] = [];
  const done = new Set<string>();
  const visiting: string[] = [];
  const visit = (s: ModelSpec): void => {
    const k = dotted(s.name);
    if (done.has(k)) return;
    if (visiting.includes(k)) {
      errors.push({ kind: "cycle", models: [...visiting.slice(visiting.indexOf(k)), k] });
      done.add(k);
      return;
    }
    visiting.push(k);
    for (const d of asked.get(k) ?? []) {
      const m = byName.get(d);
      if (m !== undefined) visit(m);
    }
    visiting.pop();
    done.add(k);
    order.push(s);
  };
  for (const s of specs) visit(s);
  if (errors.length > 0) return err(errors);
  // the SQL, with an ephemeral model written in where it is read
  const sqlOf = new Map<string, string>();
  const models: Model[] = [];
  for (const s of order) {
    const k = dotted(s.name);
    const kit = refsOf(schema, dialect, nm, options.schema, (n) => {
      const m = byName.get(dotted(n));
      return m === undefined ? undefined : m.materialization === "ephemeral" ? `(${sqlOf.get(dotted(n)) ?? ""})` : refOf(n);
    });
    const sql = s.select(kit.refs).trim().replace(/;+\s*$/, "");
    sqlOf.set(k, sql);
    const materialization = s.materialization ?? "view";
    const w = where(s.name);
    const ref = refOf(s.name);
    const colOf = (rel: string, col: string): string => (byName.has(dotted(rel)) ? q(col) : kit.refs.column(rel, col));
    const tests: ResolvedTest[] = (s.tests ?? []).map((c) => {
      const severity = c.severity ?? "error";
      const mk = (kind: Check["kind"], label: string, failing: string): ResolvedTest => ({ name: c.name ?? `${s.name} ${label}`, kind, severity, failing });
      switch (c.kind) {
        case "unique": {
          const cols = c.columns.map(q).join(", ");
          return mk("unique", `${c.columns.join(", ")} is unique`, `SELECT ${cols}, COUNT(*) AS ${q("rows")} FROM ${ref} GROUP BY ${cols} HAVING COUNT(*) > 1`);
        }
        case "not-null":
          return mk("not-null", `${c.column} is not null`, `SELECT * FROM ${ref} WHERE ${q(c.column)} IS NULL`);
        case "accepted-values":
          return mk(
            "accepted-values",
            `${c.column} is one of the accepted values`,
            `SELECT * FROM ${ref} WHERE ${q(c.column)} IS NOT NULL AND ${q(c.column)} NOT IN (${c.values.map((v) => dialect.literal(v)).join(", ")})`,
          );
        case "relationship":
          return mk(
            "relationship",
            `${c.column} refers to ${c.to}`,
            `SELECT * FROM ${ref} AS r WHERE r.${q(c.column)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${kit.refs.table(c.to)} AS t WHERE t.${colOf(c.to, c.toColumn)} = r.${q(c.column)})`,
          );
        case "custom":
          return mk("custom", "custom test", c.failing(kit.refs).trim().replace(/;+\s*$/, ""));
      }
    });
    errors.push(...kit.errors());
    models.push({
      name: s.name,
      ref,
      schema: w.schema,
      table: w.table,
      materialization,
      key: s.key ?? [],
      sql,
      hash: hashOf([sql, materialization, s.key ?? []]),
      reads: asked.get(k) ?? [],
      tests,
    });
  }
  if (errors.length > 0) return err(errors);
  const lineage: LineageEdge[] = models.flatMap((m) => m.reads.map((r) => ({ via: m.name, kind: "transform" as const, from: r, to: dotted(m.name) })));
  const led = where(settings.ledger);
  return ok({ models, lineage, dialect, naming: nm, settings, ledger: { ref: qualified(dialect, led.schema, led.table), schema: led.schema, table: led.table } });
}
