// Spec: 0022-sql-integrations FR-001, FR-009
/**
 * An integration resolved (commons data 0022-sql-integrations FR-001, FR-009): its table and columns found in a logical schema by the words of their names, written by the naming layer, with the
 * types the target gives them, and its lineage.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, expressor, type Naming, naming as defaultNaming, type PhysicalError, writeNames } from "@intellectual-frontiers/data/sql/physical";

/** What a source that is not SQL is: a hook that reads rows, or says why it could not. */
export interface SourceAdapter {
  readonly name: string;
  read(): Promise<Result<readonly Readonly<Record<string, unknown>>[], string>>;
}

/** Where an integration's rows come from. */
export type SourceSpec =
  | { readonly kind: "rows"; readonly rows: readonly Readonly<Record<string, unknown>>[] }
  | { readonly kind: "csv"; readonly text: string; readonly delimiter?: string; readonly label?: string }
  | { readonly kind: "attached"; readonly file: string; readonly relation: string; readonly alias?: string }
  | { readonly kind: "adapter"; readonly adapter: SourceAdapter };

/** How the landed rows are put in the target. */
export type Strategy = "append" | "upsert" | "replace" | "snapshot";

/** What a project says of an integration. */
export interface IntegrationSpec {
  readonly name: string;
  /** The target, by the words of its name. */
  readonly table: string;
  readonly source: SourceSpec;
  /** The contract: the columns the source gives, by the words of their names. Rows and CSV give them themselves; a table or an adapter must be told. */
  readonly columns?: readonly string[];
  /** `upsert` where it is not said. */
  readonly strategy?: Strategy;
  /** The columns a row is known by; the table's primary key where it is not said. */
  readonly key?: readonly string[];
}

/** One column of the contract, resolved. */
export interface ContractColumn {
  /** The words of its name, joined by a dot: how a row's keys and a CSV's header are matched. */
  readonly words: string;
  /** The name it is written by. */
  readonly name: string;
  /** The type as the target writes it. */
  readonly type: string;
  /** Whether the target requires a value: not optional and with no default. */
  readonly required: boolean;
}

/** An integration resolved against a schema and a dialect. */
export interface Loader {
  readonly spec: IntegrationSpec;
  /** The target's reference, quoted and qualified. */
  readonly ref: string;
  /** The target's name as written, with the schema's words where the dialect has no schemas. */
  readonly tableName: string;
  readonly columns: readonly ContractColumn[];
  readonly key: readonly ContractColumn[];
  readonly strategy: Strategy;
  readonly dialect: Dialect;
  readonly naming: Naming;
  /** The reference to a table of the library's own (the ledger) in the target's schema. */
  readonly qualify: (name: string) => string;
  /** The name a table of the library's own is written by. */
  readonly tableNameOf: (name: string) => string;
}

/** Why an integration cannot be made or run, as a value. */
export type IntegrationError =
  | { readonly kind: "unknown-table"; readonly table: string }
  | { readonly kind: "unknown-column"; readonly table: string; readonly column: string }
  | { readonly kind: "missing-required"; readonly table: string; readonly columns: readonly string[] }
  | { readonly kind: "no-key"; readonly name: string; readonly strategy: Strategy }
  | { readonly kind: "no-columns"; readonly name: string }
  | { readonly kind: "names"; readonly errors: readonly PhysicalError[] };

/** What a loader is made with. */
export interface LoaderOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in, as `bind` was given it. */
  readonly schema?: string;
}

const dotted = (s: string): string => words(s).join(".");

/**
 * An integration resolved against a schema.
 *
 * @param schema - the logical schema
 * @param spec - what the project says
 * @param options - the dialect, naming and schema qualifier the tables were bound with
 * @returns the loader, or why not
 */
export function loader(schema: LogicalSchema, spec: IntegrationSpec, options: LoaderOptions): Result<Loader, readonly IntegrationError[]> {
  const { dialect } = options;
  const nm = options.naming ?? defaultNaming();
  const table = schema.tables.find((t) => t.name.join(".") === dotted(spec.table));
  if (table === undefined) return err([{ kind: "unknown-table", table: spec.table }]);
  const physical: PhysicalError[] = [];
  const names = writeNames(schema, dialect, nm, physical, options.schema);
  if (physical.length > 0) return err([{ kind: "names", errors: physical }]);
  const ex = expressor(dialect, nm, names, []);
  const given =
    spec.columns ??
    (spec.source.kind === "rows"
      ? Object.keys(spec.source.rows[0] ?? {})
      : spec.source.kind === "csv"
        ? (spec.source.text.split(/\r?\n/, 1)[0] ?? "").split(spec.source.delimiter ?? ",").map((h) => h.replaceAll('"', "").trim())
        : []);
  if (given.length === 0) return err([{ kind: "no-columns", name: spec.name }]);
  const q = (n: string): string => dialect.quote(n);
  const errors: IntegrationError[] = [];
  const columns: ContractColumn[] = [];
  for (const g of given) {
    const c = table.columns.find((x) => x.name.join(".") === dotted(g));
    if (c === undefined) {
      errors.push({ kind: "unknown-column", table: spec.table, column: g });
      continue;
    }
    const name = names.column(c.id) ?? "";
    const rest = ex.columnLine(table, c, false).slice(q(name).length + 1);
    columns.push({ words: c.name.join("."), name, type: rest.split(/ NOT NULL| DEFAULT | PRIMARY KEY/)[0] ?? rest, required: !c.nullable && c.default === undefined });
  }
  if (errors.length > 0) return err(errors);
  const missing = table.columns.filter((c) => !c.nullable && c.default === undefined && !columns.some((x) => x.words === c.name.join("."))).map((c) => c.name.join("."));
  if (missing.length > 0) return err([{ kind: "missing-required", table: spec.table, columns: missing }]);
  const strategy = spec.strategy ?? "upsert";
  const keyWords = spec.key?.map(dotted) ?? table.primaryKey.map((w) => w.join("."));
  const key = keyWords.map((k) => columns.find((c) => c.words === k));
  if ((strategy === "upsert" || strategy === "snapshot") && (key.length === 0 || key.some((k) => k === undefined)))
    return err([{ kind: "no-key", name: spec.name, strategy }]);
  return ok({
    spec,
    ref: names.ref(table.id),
    tableName: names.table(table.id) ?? "",
    columns,
    key: key.filter((k): k is ContractColumn => k !== undefined),
    strategy,
    dialect,
    naming: nm,
    qualify: names.qualify,
    tableNameOf: names.tableName,
  });
}

/** Rows went from one node to another. */
export interface LineageEdge {
  readonly via: string;
  readonly kind: "integration" | "load";
  readonly from: string;
  readonly to: string;
}

/** A label of where the rows come from. */
export const sourceLabel = (s: SourceSpec): string =>
  s.kind === "rows" ? "rows:typescript" : s.kind === "csv" ? `csv:${s.label ?? "text"}` : s.kind === "attached" ? `attached:${s.file}#${s.relation}` : `adapter:${s.adapter.name}`;

/**
 * The edges of an integration: its source to its landing, its landing to its target.
 *
 * @param l - the loader
 * @returns the edges, in that order
 */
export function lineageOf(l: Loader): readonly LineageEdge[] {
  const landing = `landing:${l.spec.name}`;
  return [
    { via: l.spec.name, kind: "integration", from: sourceLabel(l.spec.source), to: landing },
    { via: l.spec.name, kind: "load", from: landing, to: l.tableName },
  ];
}

/**
 * Every node whose rows reach a node, nearest first.
 *
 * @param edges - the lineage
 * @param node - a node as the edges name it
 * @returns the nodes
 */
export function upstream(edges: readonly LineageEdge[], node: string): readonly string[] {
  const out: string[] = [];
  let frontier = [node];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const n of frontier)
      for (const e of edges)
        if (e.to === n && !out.includes(e.from) && e.from !== node) {
          out.push(e.from);
          next.push(e.from);
        }
    frontier = next;
  }
  return out;
}
