// Spec: 0011-sql-lifecycle FR-002, FR-004
/**
 * The state of a database (commons data 0011-sql-lifecycle FR-002): the written structure of its tables as a plain value, made from a logical schema bound to a dialect and a naming. It is
 * addressed by its hash, so two states of the same structure are one state whatever order their tables were made in, and a state of another dialect or another naming is another state.
 * What a person said of the past (`renamedFrom`) is a hint carried beside the structure and is not part of it.
 *
 * @module
 */
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, type LogicalSchema, type Table } from "@intellectual-frontiers/data/sql/logical";
import {
  type Dialect,
  expressor,
  type Naming,
  naming as defaultNaming,
  type PhysicalError,
  type TableClause,
  writeCode,
  writeNames,
} from "@intellectual-frontiers/data/sql/physical";
import { hashOf } from "./hash.ts";

/** A column as written. */
export interface StateColumn {
  readonly id: string;
  /** The words of its name, which are what it is, whatever case style writes them. */
  readonly words: readonly string[];
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly default?: string;
  /** The words the column had, where governance says it was renamed. A hint: it is not part of the structure. */
  readonly renamedFrom?: readonly string[];
}

/** A foreign key, a unique, a check or an index as written; `signature` is what it is, apart from its name. */
export interface StateConstraint {
  readonly id: string;
  readonly kind: "foreignKey" | "unique" | "check" | "index";
  readonly name: string;
  readonly signature: string;
  /** The clause that makes it, as `CREATE TABLE` or `ADD` writes it. */
  readonly text: string;
}

/** A row of a code table as written. */
export interface StateRow {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
}

/** A table as written. */
export interface StateTable {
  readonly id: string;
  readonly words: readonly string[];
  readonly name: string;
  readonly columns: readonly StateColumn[];
  /** The written names of the primary key's columns, in order. */
  readonly primaryKey: readonly string[];
  readonly constraints: readonly StateConstraint[];
  readonly rows: readonly StateRow[];
  /** What an extension adds to the end of `CREATE TABLE` (a partition), as written. */
  readonly clause?: string;
  /** The words the table had, where governance says it was renamed. A hint: it is not part of the structure. */
  readonly renamedFrom?: readonly string[];
}

/** The state of a database. */
export interface State {
  readonly format: 1;
  readonly dialect: string;
  readonly naming: { readonly names: string; readonly codes: string };
  /** The schema the tables are qualified by, where the dialect has schemas and one was given (0013-sql-qualified-names FR-006). */
  readonly qualifier?: string;
  readonly tables: readonly StateTable[];
}

/** What a state is made with. */
export interface StateOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in. */
  readonly schema?: string;
  /** What extensions add to the end of a table; the lifecycle diffs them as part of the table. */
  readonly tableClauses?: readonly TableClause[];
}

const { lifecycle } = vocabularies;

/**
 * The state a logical schema leaves a database in.
 *
 * @param schema - the logical schema
 * @param options - the dialect, the naming and the table clauses
 * @returns the state, or every error of writing it
 */
export function snapshotOf(
  schema: LogicalSchema,
  options: StateOptions,
): { readonly kind: "ok"; readonly value: State } | { readonly kind: "err"; readonly error: readonly PhysicalError[] } {
  const { dialect } = options;
  const naming = options.naming ?? defaultNaming();
  const errors: PhysicalError[] = [];
  const names = writeNames(schema, dialect, naming, errors, options.schema);
  const x = expressor(dialect, naming, names, errors);
  const written = (w: readonly string[]): string => naming.names.write(w);
  const context = { schema, dialect, naming, written: names, ...(options.schema === undefined ? {} : { schemaName: options.schema }) };
  const tables = schema.tables.map((t: Table): StateTable => {
    const tn = names.tables.get(t.id) ?? "";
    const columns = t.columns.map((c): StateColumn => {
      const old = carriedOf(c, lifecycle.renamedFrom)[0];
      return {
        id: c.id,
        words: c.name,
        name: names.columns.get(c.id) ?? "",
        type: dialect.type(c.type),
        nullable: c.nullable,
        ...(c.default === undefined ? {} : { default: x.defaultOf(c.default) }),
        ...(old === undefined ? {} : { renamedFrom: words(old) }),
      };
    });
    const constraints: StateConstraint[] = [];
    for (const f of t.foreignKeys)
      constraints.push({
        id: f.id,
        kind: "foreignKey",
        name: names.constraints.get(f.id) ?? "",
        signature: `fk:${f.columns.map((c) => c.join(".")).join(",")}>${f.references.table.join(".")}(${f.references.columns.map((c) => c.join(".")).join(",")})`,
        text: x.fkClause(f),
      });
    for (const u of t.uniques)
      constraints.push({
        id: u.id,
        kind: "unique",
        name: names.constraints.get(u.id) ?? "",
        signature: `uq:${u.columns.map((c) => c.join(".")).join(",")}`,
        text: x.uniqueClause(u),
      });
    for (const c of t.checks) {
      const clause = x.checkClause(c);
      if (clause !== undefined)
        constraints.push({
          id: c.id,
          kind: "check",
          name: names.constraints.get(c.id) ?? "",
          signature: `ck:${x.checkOf(c) ?? ""}`,
          text: clause,
        });
    }
    for (const i of t.indexes)
      constraints.push({
        id: i.id,
        kind: "index",
        name: names.constraints.get(i.id) ?? "",
        signature: `ix:${i.columns.map((c) => c.join(".")).join(",")}`,
        text: x.list(i.columns),
      });
    let clause: string | undefined;
    for (const k of options.tableClauses ?? []) {
      const r = k(context, t);
      if (r.kind === "err") errors.push(...r.error);
      else if (r.value !== undefined) clause = clause === undefined ? r.value : `${clause} ${r.value}`;
    }
    const old = carriedOf(t, lifecycle.renamedFrom)[0];
    return {
      id: t.id,
      words: t.name,
      name: tn,
      columns,
      primaryKey: t.primaryKey.map(written),
      constraints,
      rows: (t.rows ?? []).map((r) => ({ code: writeCode(naming, r.code), label: r.label, description: r.description })),
      ...(clause === undefined ? {} : { clause }),
      ...(old === undefined ? {} : { renamedFrom: words(old) }),
    };
  });
  if (errors.length > 0) return { kind: "err", error: errors };
  return {
    kind: "ok",
    value: {
      format: 1,
      dialect: dialect.name,
      naming: { names: naming.names.name, codes: naming.codes === "name" ? "name" : naming.codes.name },
      ...(names.qualifier === undefined ? {} : { qualifier: names.qualifier }),
      tables,
    },
  };
}

/**
 * A state with no table, which an empty database is in.
 *
 * @param dialect - the dialect's name
 * @param naming - the names of the case styles
 * @param qualifier - the schema, where the dialect has schemas and one was given
 * @returns the empty state
 */
export const emptyState = (dialect: string, naming: State["naming"], qualifier?: string): State => ({
  format: 1,
  dialect,
  naming,
  ...(qualifier === undefined ? {} : { qualifier }),
  tables: [],
});

const order = <T>(xs: readonly T[], key: (x: T) => string): T[] => [...xs].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

/** The key a constraint is ordered by: what it is, then what it is called. */
export const constraintKey = (c: StateConstraint): string => `${c.kind}|${c.signature}|${c.name}`;

/** A state in the order that makes its hash: tables and columns by their words, constraints by what they are, identities and hints left out. */
export function canonicalState(state: State): unknown {
  return {
    format: state.format,
    dialect: state.dialect,
    naming: state.naming,
    qualifier: state.qualifier,
    tables: order(state.tables, (t) => t.words.join(".")).map((t) => ({
      words: t.words,
      name: t.name,
      primaryKey: t.primaryKey,
      clause: t.clause,
      columns: order(t.columns, (c) => c.words.join(".")).map((c) => ({
        words: c.words,
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        default: c.default,
      })),
      constraints: order(t.constraints, constraintKey).map((c) => ({ kind: c.kind, name: c.name, signature: c.signature })),
      rows: order(t.rows, (r) => r.code),
    })),
  };
}

/**
 * The hash of a state: the SHA-256 of its canonical JSON.
 *
 * @param state - the state
 * @returns 64 hexadecimal digits
 */
export const stateHash = (state: State): string => hashOf(canonicalState(state));
