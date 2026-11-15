/**
 * The emit context: the dialect, the naming strategy, the documentation and the hooks of one rendering (commons 0009-sql-aide FR-010,
 * FR-012, FR-016, FR-024). Nothing here is global: a rendering knows only what its context carries.
 *
 * @module
 */
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import type { Generator } from "../generate/generators.ts";
import type { LintRule } from "../govern/lint.ts";
import type { SourceAdapter } from "../integrate/integration.ts";
import type { Change, Classification } from "../islm/islm.ts";
import type { AnySql } from "./sql.ts";

/** What a dialect extension may change in how a dialect writes a type. */
export interface DialectExtension<N extends string, F extends string> {
  /** The extension's name, as the engine knows it (`vector`, `postgis`). */
  readonly name: string;
  /** The dialect it extends. */
  readonly dialect: N;
  /** The features it adds. */
  readonly features: readonly F[];
  /** How a custom domain of the extension is written, or `undefined` where the extension does not know it. */
  readonly typeOf?: (spec: DomainSpec) => string | undefined;
  /** The statement that makes the extension available in a database (`CREATE EXTENSION IF NOT EXISTS vector`). */
  readonly install?: string;
}

/**
 * A dialect: how one engine writes types, names, literals and parameters, and which features it has. `N` is its name and `F` the union of
 * its features, both known to the compiler, so that asking it for a feature it lacks does not compile (FR-010).
 */
export interface Dialect<N extends string = string, F extends string = string> {
  /** The dialect's name. */
  readonly name: N;
  /** Never set: carries the features for the compiler. */
  readonly __features?: F;
  /** The features, for code that must ask at run time. */
  readonly features: ReadonlySet<string>;
  /** The extensions added with {@link Dialect.with}. */
  readonly extensions: readonly DialectExtension<N, string>[];
  /** The longest name the engine keeps, or `undefined` where it has no limit. */
  readonly maxNameLength: number | undefined;
  /** How a logical type is written. */
  readonly typeOf: (spec: DomainSpec) => string;
  /** How a name is quoted. */
  readonly quoteName: (name: string) => string;
  /** How a value is written as a literal in a script. */
  readonly literal: (value: SqlValue, spec?: DomainSpec) => string;
  /** How the bound parameter at a 1-based position is written. */
  readonly param: (index: number) => string;
  /** The value a driver of this dialect is given for a bound parameter. */
  readonly encode: (value: SqlValue, spec?: DomainSpec) => SqlValue;
  /** Whether a view is replaced by `CREATE OR REPLACE VIEW`; where not, it is dropped and made again. */
  readonly replacesViews: boolean;
  /** How a column the database numbers is written after its type, whether that also makes it the primary key, and what must be made first. */
  readonly identity: (sequence: string) => { readonly suffix: string; readonly isPrimaryKey: boolean; readonly before?: string };
  /** How a generated column's expression is written after its type. */
  readonly generated: (expression: string) => string;
  /** The statement that records a description of an object, or `undefined` where the dialect keeps none. */
  readonly comment: (target: "table" | "column" | "function" | "view", name: string, text: string) => string | undefined;
  /** The same dialect with an extension's features and types added (FR-023). */
  with<F2 extends string>(extension: DialectExtension<N, F2>): Dialect<N, F | F2>;
}

/** The name of a dialect type. */
export type NameOf<D extends Dialect> = D["name"];

/** The features every dialect of `D` has: for a union of dialects, those they all have. */
export type FeaturesOf<D extends Dialect> = (D extends Dialect ? (features: NonNullable<D["__features"]>) => void : never) extends (
  features: infer F,
) => void
  ? F
  : never;

/** What kind of constraint a name is for. */
export type ConstraintKind = "pk" | "fk" | "uq" | "ck";

/** A naming strategy: how the names of emitted objects are made (FR-012). */
export interface Naming {
  /** The parts of a table's name, schema first where there is one. */
  readonly table: (name: string, schema: string | undefined) => readonly string[];
  /** A column's name. */
  readonly column: (column: string) => string;
  /** A constraint's name. */
  readonly constraint: (kind: ConstraintKind, table: string, columns: readonly string[]) => string;
  /** An index's name. */
  readonly index: (table: string, columns: readonly string[], unique: boolean) => string;
  /** How a name is quoted, where the strategy and not the dialect decides (brackets). */
  readonly quote?: (name: string) => string;
}

/** The typical strategy: names as the model gives them, a schema where the entity has one. */
export const typicalNaming = (): Naming => ({
  table: (name, schema) => (schema === undefined ? [name] : [schema, name]),
  column: (column) => column,
  constraint: (kind, table, columns) => `${table}_${columns.join("_")}_${kind}`,
  index: (table, columns, unique) => `${table}_${columns.join("_")}_${unique ? "uidx" : "idx"}`,
});

/** Every table in one schema, whatever the entity says. */
export const qualifiedNaming = (schema: string, base: Naming = typicalNaming()): Naming => ({ ...base, table: (name) => [schema, name] });

/** Every table's name behind a prefix (`dcp_party`). */
export const prefixedNaming = (prefix: string, base: Naming = typicalNaming()): Naming => ({
  ...base,
  table: (name, schema) => base.table(`${prefix}${name}`, schema),
});

/** Names quoted in brackets, as SQL Server writes them. */
export const bracketNaming = (base: Naming = typicalNaming()): Naming => ({ ...base, quote: (name) => `[${name.replaceAll("]", "]]")}]` });

/** Where a rendering is meant to run: some things are refused in production (FR-039). */
export type Execution = "sandbox" | "test" | "production";

/** What is known of an entity from its TSDoc comment (FR-005, FR-025). */
export interface EntityDoc {
  /** The first paragraph: what the SQL comment says. */
  readonly summary: string;
  /** The `@remarks` block, for the data dictionary. */
  readonly remarks?: string;
  /** The `@deprecated` text, where there is one. */
  readonly deprecated?: string;
  /** The summaries of members: columns of a table, arguments of a routine. */
  readonly members: Readonly<Record<string, string>>;
}

/** The documentation of a model's entities, by the entity itself. */
export type Docs = ReadonlyMap<object, EntityDoc>;

/** What happens during an emit, told to the hooks that listen. */
export type EmitEvent =
  | { readonly kind: "entity"; readonly entity: string; readonly name: string }
  | { readonly kind: "file"; readonly path: string; readonly sha256: string };

/** The typed hooks of a rendering (FR-024). Later layers add theirs to this interface's use, not to a registry. */
export interface Hooks {
  /** Replaces parts of the naming strategy. */
  readonly naming?: { readonly [K in keyof Naming]?: Naming[K] };
  /** Hears what is emitted. */
  readonly onEmit?: (event: EmitEvent) => void;
  /** Lint rules added to those a model is held to (FR-027). */
  readonly lint?: readonly LintRule[];
  /** Says again how a change of an ISLM plan is classified: what it returns replaces what the plan said (FR-036). */
  readonly classify?: (change: Change) => ChangeClass | undefined;
  /** Sources of integrations that are not SQL, by name, for integrations made with `fromSource` (FR-034). */
  readonly sources?: readonly SourceAdapter<Readonly<Record<string, unknown>>>[];
  /** Ways to keep a transform model beyond the five the library has, by name: a model asks for one as `plugin:<name>` (FR-043). */
  readonly materializations?: { readonly [name: string]: (query: AnySql, self: readonly string[], ctx: EmitContext) => string };
  /** Generators beyond the library's own (FR-045). */
  readonly generators?: readonly Generator[];
}

/** What a classification hook may say of a change. */
export interface ChangeClass {
  /** Whether it may be run on every apply. */
  readonly classification?: Classification;
  /** Whether it destroys data. */
  readonly destructive?: boolean;
  /** Whether it can run in a transaction. */
  readonly transactional?: boolean;
}

/** A plugin: a named bundle of hooks, passed to the context and to nothing else (FR-024). */
export interface Plugin {
  /** The plugin's name. */
  readonly name: string;
  /** The plugin's version. */
  readonly version: string;
  /** Its hooks. */
  readonly hooks?: Hooks;
}

/** The context of one rendering. */
export interface EmitContext<D extends Dialect = Dialect> {
  /** The dialect rendered for. */
  readonly dialect: D;
  /** The naming strategy, with the hooks' changes applied. */
  readonly naming: Naming;
  /** Where the rendering is meant to run. */
  readonly execution: Execution;
  /** The documentation of the model's entities. */
  readonly docs: Docs;
  /** The plugins passed in. */
  readonly plugins: readonly Plugin[];
}

/**
 * Makes the context of a rendering.
 *
 * @param init - the dialect, and whatever differs from the typical naming, a sandbox and no plugins
 * @example
 * const ctx = context({ dialect: postgres(), naming: qualifiedNaming("arca") });
 */
export function context<D extends Dialect>(init: {
  readonly dialect: D;
  readonly naming?: Naming;
  readonly execution?: Execution;
  readonly docs?: readonly Docs[];
  readonly plugins?: readonly Plugin[];
}): EmitContext<D> {
  const plugins = init.plugins ?? [];
  let naming = init.naming ?? typicalNaming();
  for (const p of plugins) if (p.hooks?.naming !== undefined) naming = { ...naming, ...p.hooks.naming };
  const docs = new Map<object, EntityDoc>();
  for (const d of init.docs ?? []) for (const [k, v] of d) docs.set(k, v);
  return { dialect: init.dialect, naming, execution: init.execution ?? "sandbox", docs, plugins };
}

/** Tells every plugin of a context what was emitted. */
export function emitted(ctx: EmitContext, event: EmitEvent): void {
  for (const p of ctx.plugins) p.hooks?.onEmit?.(event);
}
