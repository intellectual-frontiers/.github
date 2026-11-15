/**
 * Integrations: data brought into a model's tables as typed values (commons 0009-sql-aide FR-032, FR-033, FR-034). An integration has a
 * source (rows written in TypeScript, a file DuckDB reads, a table of an attached database, or rows an adapter gives), a contract (the
 * columns of its target it gives, typed by the target), a landing relation the source is put in first, and a load into the target by a
 * strategy: `append`, `upsert`, `replace` or `snapshot`. What it renders is a script of the engine's own statements (`read_csv`,
 * `ATTACH`, `ON CONFLICT`); the library runs nothing.
 *
 * @limits
 * A load is a script the caller runs whole; it begins no transaction, so a `replace` or `snapshot` that fails halfway leaves what it did
 * unless the caller wraps it in one. Files are read only by DuckDB (`read_csv`); PostgreSQL's `COPY` is not used. An attached database is
 * a file of the same engine: DuckDB attaching SQLite or PostgreSQL needs an extension it would download, and is not tested.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "../../../kernel/mod.ts";
import type { ColumnSpec } from "../algebra/column.ts";
import type { SqlValue } from "../algebra/domain.ts";
import type { InsertRow, Table, TableSpec } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import { type Chunk, chunkText, sql, type Sql } from "../emit/sql.ts";
import { type EntityName, entityKey } from "../model/entity.ts";

/** How a load puts the landed rows into its target. */
export type Strategy =
  /** Every landed row is inserted: run twice, the rows are there twice. */
  | "append"
  /** A landed row whose key is in the target changes that row; any other is inserted. Run twice, the target is as after once. */
  | "upsert"
  /** The target's rows are deleted and the landed rows inserted. */
  | "replace"
  /** The target is made to hold the landed rows by key: upserted, and a row whose key was not landed is deleted. */
  | "snapshot";

/** Where an integration's rows come from. */
export type SourceKind = "rows" | "csv" | "attached" | "adapter";

/**
 * What a source that is not SQL is: a typed hook that gives rows, which the library lands as it lands rows written in TypeScript
 * (FR-034). The library carries no adapter; a caller writes one for its API, queue or spreadsheet.
 */
export interface SourceAdapter<Row> {
  /** The adapter's name, for lineage and for what it reports. */
  readonly name: string;
  /** Reads the rows, or says why it could not. */
  read(): Promise<Result<readonly Row[], string>>;
}

/** Why the rows of an adapter could not be had. */
export type AdapterError = { readonly kind: "adapter"; readonly adapter: string; readonly integration: string; readonly message: string };

/** A source as data. */
export type SourceSpec =
  | { readonly kind: "rows"; readonly rows: readonly Readonly<Record<string, unknown>>[] }
  | { readonly kind: "csv"; readonly path: string; readonly delimiter: string }
  | { readonly kind: "attached"; readonly file: string; readonly alias: string; readonly relation: string }
  | { readonly kind: "adapter"; readonly adapter: SourceAdapter<Readonly<Record<string, unknown>>> };

/** The feature an integration whose adapter has not been read asks for: no dialect has it, so its load does not render (FR-034). */
export type AdapterPending = "rows read from the adapter";

/** A value with its brand taken off: what a file, a table elsewhere or a person writing seed data gives. */
export type Plain<T> = T extends { readonly "@ifc/brand": string }
  ? T extends string
    ? string
    : T extends number
      ? number
      : T extends bigint
        ? bigint
        : T
  : T;

/** The row an integration lands for a table: the row it takes on insert, with its keys as plain values. */
export type LandingRow<T> =
  T extends Table<infer TN, infer C, string> ? { readonly [K in keyof InsertRow<TN, C>]: Plain<InsertRow<TN, C>[K]> } : never;

/** The columns a table must be given on insert. */
export type RequiredColumn<T> = {
  [K in keyof LandingRow<T>]-?: object extends Pick<LandingRow<T>, K> ? never : K;
}[keyof LandingRow<T>] &
  string;

/** The columns a table may be given on insert. */
export type InsertColumn<T> = keyof LandingRow<T> & string;

/** Fails to compile where a contract leaves out a column the target must be given; the property that is missing says which. */
export type Covers<T, Cols extends readonly string[]> = [Exclude<RequiredColumn<T>, Cols[number]>] extends [never]
  ? unknown
  : { readonly missingRequiredColumns: Exclude<RequiredColumn<T>, Cols[number]> };

/** One step of lineage: rows went from one node to another by an integration, a load or a transform (FR-028). */
export interface LineageEdge {
  /** The integration, load or transform that moved them. */
  readonly via: string;
  /** What kind of thing that is. */
  readonly kind: "integration" | "load" | "transform";
  /** Where they came from: a relation's qualified name, or `csv:`, `attached:` or `adapter:` and what names it. */
  readonly from: string;
  /** Where they went: a relation's qualified name. */
  readonly to: string;
}

/**
 * An integration. `K` is the kind of its source and `Req` the features its load asks of a dialect: rendering the load for a dialect that
 * lacks one (a file for PostgreSQL, an attached database for PostgreSQL, an adapter not yet read for any) does not compile.
 */
export interface Integration<K extends SourceKind = SourceKind, Req extends string = string> {
  /** What kind of entity this is. */
  readonly entity: "integration";
  /** The integration's name. */
  readonly name: string;
  /** The schema of its landing relation, which is its target's. */
  readonly schema: string | undefined;
  /** Never set: carries the kind of its source. */
  readonly __kind?: K;
  /** Its source, as data. */
  readonly source: SourceSpec;
  /** The contract: the columns of the target the source gives, in the target's order. */
  readonly columns: readonly string[];
  /** The relation the source is landed in, made and dropped by the load. */
  readonly landing: EntityName;
  /** The table loaded. */
  readonly target: EntityName;
  /** The table loaded, as data. */
  readonly targetSpec: TableSpec;
  /** How it is loaded. */
  readonly strategy: Strategy;
  /** The columns a row is known by in the target, for `upsert` and `snapshot`. */
  readonly key: readonly string[];
  /** The script that lands the source and loads the target: run it whole, in a transaction where the caller wants one. */
  readonly load: Sql<"fragment", unknown, Req>;
  /** It is defined after its target. */
  readonly dependsOn: () => readonly EntityName[];
  /** Where its rows came from and went, computed from its source, landing and target (FR-028). */
  readonly lineage: () => readonly LineageEdge[];
}

/** Any integration. */
export type AnyIntegration = Integration<SourceKind, string>;

/** What every way of making an integration may say of its load. */
export interface LoadOptions<Col extends string> {
  /** How the target is loaded; `upsert` where not said. */
  readonly strategy?: Strategy;
  /** The columns a row is known by in the target; its primary key where not said. They must be in the contract. */
  readonly key?: readonly Col[];
}

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const textChunk = chunkText;

function relationName(e: EntityName): (ctx: EmitContext) => Chunk {
  return (ctx) => ({ kind: "name", parts: ctx.naming.table(e.name, e.schema) });
}
const colName =
  (n: string): ((ctx: EmitContext) => Chunk) =>
  (ctx) => ({ kind: "name", parts: [ctx.naming.column(n)] });

function list(ctx: EmitContext, names: readonly string[], prefix?: string): Chunk[] {
  return names.flatMap((n, i) => [
    ...(i === 0 ? [] : [textChunk(", ")]),
    ...(prefix === undefined ? [] : [textChunk(`${prefix}.`)]),
    colName(n)(ctx),
  ]);
}

function sourceLabel(s: SourceSpec): string {
  switch (s.kind) {
    case "rows":
      return "rows:typescript";
    case "csv":
      return `csv:${s.path}`;
    case "attached":
      return `attached:${s.file}#${s.relation}`;
    case "adapter":
      return `adapter:${s.adapter.name}`;
    default:
      return absurd(s);
  }
}

/** The statements that put the source's rows into the landing relation. */
function fill(ctx: EmitContext, s: SourceSpec, landing: EntityName, columns: readonly (readonly [string, ColumnSpec])[]): Chunk[] {
  const names = columns.map(([n]) => n);
  const into = [textChunk("INSERT INTO "), relationName(landing)(ctx), textChunk(" ("), ...list(ctx, names), textChunk(")")];
  switch (s.kind) {
    case "rows": {
      if (s.rows.length === 0) return [];
      const out: Chunk[] = [...into, textChunk(" VALUES\n")];
      s.rows.forEach((row, i) => {
        out.push(textChunk(i === 0 ? "(" : ",\n("));
        columns.forEach(([n, c], j) => {
          if (j > 0) out.push(textChunk(", "));
          // the compiler held each row to the target's insert row; a value of a column is a SqlValue of the column's domain
          out.push({ kind: "value", value: (row[n] ?? null) as SqlValue, spec: c.domain });
        });
        out.push(textChunk(")"));
      });
      return [...out, textChunk(";\n")];
    }
    case "csv": {
      const casts = columns.flatMap(([n, c], i) => [
        textChunk(i === 0 ? "CAST(" : ", CAST("),
        colName(n)(ctx),
        textChunk(` AS ${ctx.dialect.typeOf(c.domain)})`),
      ]);
      return [
        ...into,
        textChunk(" SELECT "),
        ...casts,
        textChunk(` FROM read_csv(${q(s.path)}, header = true, all_varchar = true, delim = ${q(s.delimiter)});\n`),
      ];
    }
    case "attached": {
      const alias: Chunk = { kind: "name", parts: [s.alias] };
      const from: Chunk[] = [
        ...into,
        textChunk(" SELECT "),
        ...list(ctx, names),
        textChunk(" FROM "),
        { kind: "name", parts: [s.alias, s.relation] },
        textChunk(";\n"),
      ];
      switch (ctx.dialect.name) {
        case "duckdb":
          return [
            textChunk(`ATTACH ${q(s.file)} AS `),
            alias,
            textChunk(" (READ_ONLY);\n"),
            ...from,
            textChunk("DETACH "),
            alias,
            textChunk(";\n"),
          ];
        case "sqlite":
          return [
            textChunk(`ATTACH DATABASE ${q(s.file)} AS `),
            alias,
            textChunk(";\n"),
            ...from,
            textChunk("DETACH DATABASE "),
            alias,
            textChunk(";\n"),
          ];
        default:
          throw new Error(`${ctx.dialect.name} cannot attach a database`);
      }
    }
    case "adapter":
      throw new Error(`the rows of adapter ${s.adapter.name} have not been read: read them with readAdapter first`);
    default:
      return absurd(s);
  }
}

/** The statements that load the target from the landing relation. */
function loadInto(ctx: EmitContext, i: Omit<AnyIntegration, "load" | "lineage" | "dependsOn">): Chunk[] {
  const target = relationName(i.target)(ctx);
  const landing = relationName(i.landing)(ctx);
  const insert = [
    textChunk("INSERT INTO "),
    target,
    textChunk(" ("),
    ...list(ctx, i.columns),
    textChunk(")\nSELECT "),
    ...list(ctx, i.columns),
    textChunk(" FROM "),
    landing,
  ];
  const nonKey = i.columns.filter((c) => !i.key.includes(c));
  const set = nonKey.flatMap((n, j) => [textChunk(j === 0 ? "" : ", "), colName(n)(ctx), textChunk(" = excluded."), colName(n)(ctx)]);
  // SQLite reads ON CONFLICT after a SELECT as a join's unless the SELECT has a WHERE
  const upsert = [
    ...insert,
    textChunk(" WHERE TRUE\nON CONFLICT ("),
    ...list(ctx, i.key),
    ...(nonKey.length === 0 ? [textChunk(") DO NOTHING;\n")] : [textChunk(") DO UPDATE SET "), ...set, textChunk(";\n")]),
  ];
  switch (i.strategy) {
    case "append":
      return [...insert, textChunk(";\n")];
    case "upsert":
      return upsert;
    case "replace":
      return [textChunk("DELETE FROM "), target, textChunk(";\n"), ...insert, textChunk(";\n")];
    case "snapshot": {
      const same = i.key.flatMap((k, j) => [
        textChunk(j === 0 ? "" : " AND "),
        textChunk("l."),
        colName(k)(ctx),
        textChunk(" = "),
        target,
        textChunk("."),
        colName(k)(ctx),
      ]);
      return [
        ...upsert,
        textChunk("DELETE FROM "),
        target,
        textChunk(" WHERE NOT EXISTS (SELECT 1 FROM "),
        landing,
        textChunk(" AS l WHERE "),
        ...same,
        textChunk(");\n"),
      ];
    }
    default:
      return absurd(i.strategy);
  }
}

function make<K extends SourceKind, Req extends string>(
  name: string,
  into: { readonly spec: TableSpec },
  source: SourceSpec,
  contract: readonly string[],
  options: LoadOptions<string>,
): Integration<K, Req> {
  const spec = into.spec;
  const columns = spec.columns.filter(([n]) => contract.includes(n));
  const unknown = contract.filter((c) => !spec.columns.some(([n]) => n === c));
  if (unknown.length > 0) throw new Error(`integration ${name}: ${spec.name} has no column ${unknown.join(", ")}`);
  const strategy = options.strategy ?? "upsert";
  const key = options.key ?? spec.primaryKey;
  if ((strategy === "upsert" || strategy === "snapshot") && (key.length === 0 || key.some((k) => !contract.includes(k))))
    throw new Error(`integration ${name}: an ${strategy} needs a key of columns the source gives, and (${key.join(", ")}) is not one`);
  const target: EntityName = { name: spec.name, schema: spec.schema };
  const landing: EntityName = { name: `${name}_landing`, schema: spec.schema };
  const base = {
    entity: "integration" as const,
    name,
    schema: spec.schema,
    source,
    columns: columns.map(([n]) => n),
    landing,
    target,
    targetSpec: spec,
    strategy,
    key,
  };
  const landingColumns = (ctx: EmitContext): Chunk[] =>
    columns.flatMap(([n, c], i) => [
      textChunk(i === 0 ? "    " : ",\n    "),
      colName(n)(ctx),
      textChunk(` ${ctx.dialect.typeOf(c.domain)}`),
    ]);
  return {
    ...base,
    load: sql("fragment", (ctx) => [
      textChunk(`-- integration ${name}: ${sourceLabel(source)} into `),
      relationName(target)(ctx),
      textChunk(` by ${strategy}\nDROP TABLE IF EXISTS `),
      relationName(landing)(ctx),
      textChunk(";\nCREATE TABLE "),
      relationName(landing)(ctx),
      textChunk(" (\n"),
      ...landingColumns(ctx),
      textChunk("\n);\n"),
      ...fill(ctx, source, landing, columns),
      ...loadInto(ctx, base),
      textChunk("DROP TABLE "),
      relationName(landing)(ctx),
      textChunk(";"),
    ]),
    dependsOn: () => [target],
    lineage: () => [
      { via: name, kind: "integration", from: sourceLabel(source), to: entityKey(landing) },
      { via: name, kind: "load", from: entityKey(landing), to: entityKey(target) },
    ],
  };
}

/**
 * Seed or reference data: an integration whose source is rows written in TypeScript, each typed as the row its target takes on insert
 * (FR-032). The rows must all give the same columns: those are the contract.
 *
 * @param name - the integration's name
 * @param into - the target table
 * @param rows - the rows
 * @param options - the strategy, `upsert` where not said, and the key
 * @example
 * const kinds = seed("party_kinds", partyKind, [{ code: "person", label: "Person" }, { code: "organization", label: "Organization" }]);
 */
export function seed<T extends Table<string, unknown, string>>(
  name: string,
  into: T,
  rows: readonly LandingRow<T>[],
  options: LoadOptions<InsertColumn<T>> = {},
): Integration<"rows", "upsert"> {
  const first = rows[0];
  const contract = first === undefined ? [] : Object.keys(first);
  for (const r of rows) {
    const keys = Object.keys(r);
    if (keys.length !== contract.length || keys.some((k) => !contract.includes(k)))
      throw new Error(
        `integration ${name}: every row must give the same columns (${contract.join(", ")}), and one gives ${keys.join(", ")}`,
      );
  }
  // a row typed as the target's insert row is a record of its columns' values
  return make(name, into, { kind: "rows", rows: rows as readonly Readonly<Record<string, unknown>>[] }, contract, options);
}

/**
 * An integration whose source is a CSV file with a header line, read by DuckDB's `read_csv` (FR-033). Every field is read as text and
 * cast to its column's type; an empty field is null. A dialect needs `read-files` for it.
 *
 * @param name - the integration's name
 * @param into - the target table
 * @param from - the file, the columns it gives (by the header's names, which are the target's) and its delimiter
 * @example
 * const people = fromCsv("people", person, { path: "people.csv", columns: ["party_id", "given_name", "family_name"] });
 */
export function fromCsv<T extends Table<string, unknown, string>, const Cols extends readonly InsertColumn<T>[]>(
  name: string,
  into: T,
  from: { readonly path: string; readonly columns: Cols; readonly delimiter?: string } & Covers<T, Cols>,
  options: LoadOptions<Cols[number]> = {},
): Integration<"csv", "read-files" | "upsert"> {
  return make(name, into, { kind: "csv", path: from.path, delimiter: from.delimiter ?? "," }, from.columns, options);
}

/**
 * An integration whose source is a table of another database file of the same engine, attached for the load and detached after it
 * (DuckDB's and SQLite's `ATTACH`, FR-033). A dialect needs `attach` for it.
 *
 * @param name - the integration's name
 * @param into - the target table
 * @param from - the file, the table in it, the columns it gives (named as the target's) and the name it is attached under
 * @example
 * const archived = fromAttached("archived", person, { file: "old.db", relation: "person", columns: ["party_id", "given_name", "family_name"] });
 */
export function fromAttached<T extends Table<string, unknown, string>, const Cols extends readonly InsertColumn<T>[]>(
  name: string,
  into: T,
  from: { readonly file: string; readonly relation: string; readonly columns: Cols; readonly alias?: string } & Covers<T, Cols>,
  options: LoadOptions<Cols[number]> = {},
): Integration<"attached", "attach" | "upsert"> {
  return make(
    name,
    into,
    { kind: "attached", file: from.file, relation: from.relation, alias: from.alias ?? `${name}_source` },
    from.columns,
    options,
  );
}

/**
 * An integration whose source is not SQL: its rows come from an adapter (FR-034). Its load does not render until the rows are read with
 * {@link readAdapter}, which gives the same integration with the rows as its source.
 *
 * @param name - the integration's name
 * @param into - the target table
 * @param adapter - the adapter, which gives rows typed as the target's insert row
 * @param columns - the columns its rows give
 */
export function fromAdapter<T extends Table<string, unknown, string>, const Cols extends readonly InsertColumn<T>[]>(
  name: string,
  into: T,
  adapter: SourceAdapter<Pick<LandingRow<T>, Cols[number]>>,
  columns: Cols & Covers<T, Cols>,
  options: LoadOptions<Cols[number]> = {},
): Integration<"adapter", AdapterPending | "upsert"> {
  // an adapter of rows typed by the target is an adapter of records of its columns
  const general = adapter as unknown as SourceAdapter<Readonly<Record<string, unknown>>>;
  return make(name, into, { kind: "adapter", adapter: general }, columns, options);
}

/**
 * An integration whose source is not SQL and is given by a plugin of the context, by name (FR-024, FR-034): {@link readAdapter} with that
 * context reads it. Its rows are not typed by the compiler, since the plugin is chosen where the context is made; a row that gives a
 * column outside the contract is refused when read.
 *
 * @param name - the integration's name
 * @param into - the target table
 * @param sourceName - the name of the source a plugin gives
 * @param columns - the columns its rows give
 */
export function fromSource<T extends Table<string, unknown, string>, const Cols extends readonly InsertColumn<T>[]>(
  name: string,
  into: T,
  sourceName: string,
  columns: Cols & Covers<T, Cols>,
  options: LoadOptions<Cols[number]> = {},
): Integration<"adapter", AdapterPending | "upsert"> {
  const missing: SourceAdapter<Readonly<Record<string, unknown>>> = {
    name: sourceName,
    read: () => Promise.resolve(err(`no plugin of the context gives the source ${sourceName}`)),
  };
  return make(name, into, { kind: "adapter", adapter: missing }, columns, options);
}

/**
 * Reads the rows of an integration's adapter and gives the integration with those rows as its source, whose load renders; or the reason
 * the adapter gave.
 *
 * @param integration - an integration made with {@link fromAdapter}
 */
export async function readAdapter<Req extends string>(
  integration: Integration<"adapter", Req>,
  ctx?: EmitContext,
): Promise<Result<Integration<"rows", Exclude<Req, AdapterPending>>, AdapterError>> {
  const s = integration.source;
  if (s.kind !== "adapter")
    return err({ kind: "adapter", adapter: "", integration: integration.name, message: "its source is not an adapter" });
  // a source a plugin of the context gives, by the adapter's name, comes before the adapter the integration was made with
  const adapter = ctx?.plugins.flatMap((p) => p.hooks?.sources ?? []).find((a) => a.name === s.adapter.name) ?? s.adapter;
  let read: Result<readonly Readonly<Record<string, unknown>>[], string>;
  try {
    read = await adapter.read();
  } catch (thrown) {
    read = err(thrown instanceof Error ? thrown.message : String(thrown));
  }
  if (read.kind === "err") return err({ kind: "adapter", adapter: adapter.name, integration: integration.name, message: read.error });
  const unknown = read.value.flatMap((r) => Object.keys(r).filter((k) => !integration.columns.includes(k)));
  if (unknown.length > 0)
    return err({
      kind: "adapter",
      adapter: adapter.name,
      integration: integration.name,
      message: `its rows give columns the contract does not: ${[...new Set(unknown)].join(", ")}`,
    });
  return ok(
    make(integration.name, { spec: integration.targetSpec }, { kind: "rows", rows: read.value }, integration.columns, {
      strategy: integration.strategy,
      key: integration.key,
    }),
  );
}
