// Spec: 0024-sql-queries FR-001, FR-002, FR-003, FR-006
/**
 * A catalog of queries (commons data 0024-sql-queries): SQL a person writes over the names of a schema, with typed parameters that enter only as literals, read-only by construction, and compared
 * between versions of a schema.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Naming, naming as defaultNaming, type RefError, type Refs, refsOf } from "@intellectual-frontiers/data/sql/physical";

/** The type of a parameter. */
export type ParamType = "text" | "integer" | "number" | "boolean";

/** A parameter: its type, and whether it may be null. */
export interface ParamSpec {
  readonly type: ParamType;
  readonly nullable?: boolean;
}

/** What a project says of a query. */
export interface QuerySpec {
  readonly name: string;
  readonly params?: Readonly<Record<string, ParamType | ParamSpec>>;
  /** The SQL, given the references of the schema and a function that gives the place of a parameter. */
  readonly sql: (refs: Refs, param: (name: string) => string) => string;
}

/** A query, resolved. */
export interface Query {
  readonly name: string;
  readonly params: Readonly<Record<string, ParamSpec>>;
  /** What it reads: the tables, by the words of their names, in the order first asked. */
  readonly reads: readonly string[];
  /** Its SQL with the places of its parameters. */
  readonly text: string;
  /** Its SQL with the values written in, or why it cannot be had. */
  render(values?: Readonly<Record<string, unknown>>): Result<string, readonly ParamError[]>;
}

export type ParamError =
  | { readonly kind: "missing"; readonly param: string }
  | { readonly kind: "unknown"; readonly param: string }
  | { readonly kind: "type"; readonly param: string; readonly expected: ParamType }
  | { readonly kind: "null"; readonly param: string };

export type QueryError =
  | RefError
  | { readonly kind: "duplicate"; readonly name: string }
  | { readonly kind: "not-read-only"; readonly query: string; readonly why: string }
  | { readonly kind: "unknown-param"; readonly query: string; readonly param: string };

/** The queries of an application. */
export interface Catalog {
  readonly queries: readonly Query[];
  readonly dialect: Dialect;
  get(name: string): Query | undefined;
}

/** What a catalog is made with. */
export interface CatalogOptions {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in, as `bind` was given it. */
  readonly schema?: string;
}

const MARK = "\u0001";
const FORBIDDEN = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "GRANT", "ATTACH", "COPY", "PRAGMA"];

/** The text of a query with its string literals, quoted names and comments left out. */
const bare = (sql: string): string =>
  sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');

/** Why a query is not read-only, or nothing. */
export function readOnly(sql: string): string | undefined {
  const s = bare(sql).replace(new RegExp(`${MARK}[^${MARK}]*${MARK}`, "g"), "?").trim();
  if (!/^(SELECT|WITH)\b/i.test(s)) return "it is not a SELECT or WITH";
  if (s.includes(";")) return "it holds more than one statement";
  const word = FORBIDDEN.find((w) => new RegExp(`\\b${w}\\b`, "i").test(s));
  return word === undefined ? undefined : `it holds ${word}`;
}

const specOf = (p: ParamType | ParamSpec): ParamSpec => (typeof p === "string" ? { type: p } : p);

/**
 * A catalog of queries.
 *
 * @param schema - the logical schema
 * @param specs - the queries
 * @param options - the dialect, naming and the tables' schema
 * @returns the catalog, or why not
 */
export function queries(schema: LogicalSchema, specs: readonly QuerySpec[], options: CatalogOptions): Result<Catalog, readonly QueryError[]> {
  const { dialect } = options;
  const nm = options.naming ?? defaultNaming();
  const errors: QueryError[] = [];
  const made: Query[] = [];
  const seen = new Set<string>();
  for (const s of specs) {
    if (seen.has(s.name)) errors.push({ kind: "duplicate", name: s.name });
    seen.add(s.name);
    const params = Object.fromEntries(Object.entries(s.params ?? {}).map(([k, v]) => [k, specOf(v)]));
    const kit = refsOf(schema, dialect, nm, options.schema);
    const text = s
      .sql(kit.refs, (name) => {
        if (!(name in params)) errors.push({ kind: "unknown-param", query: s.name, param: name });
        return `${MARK}${name}${MARK}`;
      })
      .trim()
      .replace(/;+\s*$/, "");
    errors.push(...kit.errors());
    const why = readOnly(text);
    if (why !== undefined) errors.push({ kind: "not-read-only", query: s.name, why });
    const render = (values: Readonly<Record<string, unknown>> = {}): Result<string, readonly ParamError[]> => {
      const problems: ParamError[] = [];
      for (const k of Object.keys(values)) if (!(k in params)) problems.push({ kind: "unknown", param: k });
      const literal = new Map<string, string>();
      for (const [k, p] of Object.entries(params)) {
        const v = values[k];
        if (v === undefined) {
          problems.push({ kind: "missing", param: k });
        } else if (v === null) {
          if (p.nullable === true) literal.set(k, "NULL");
          else problems.push({ kind: "null", param: k });
        } else if (p.type === "text" && typeof v === "string") literal.set(k, dialect.literal(v));
        else if (p.type === "integer" && ((typeof v === "number" && Number.isSafeInteger(v)) || typeof v === "bigint")) literal.set(k, String(v));
        else if (p.type === "number" && typeof v === "number" && Number.isFinite(v)) literal.set(k, dialect.literal(v));
        else if (p.type === "boolean" && typeof v === "boolean") literal.set(k, dialect.literal(v));
        else problems.push({ kind: "type", param: k, expected: p.type });
      }
      if (problems.length > 0) return err(problems);
      return ok(text.replace(new RegExp(`${MARK}([^${MARK}]*)${MARK}`, "g"), (_, name: string) => literal.get(name) ?? "NULL"));
    };
    made.push({ name: s.name, params, reads: kit.used().map((u) => u.name), text, render });
  }
  if (errors.length > 0) return err(errors);
  return ok({ queries: made, dialect, get: (name) => made.find((q) => q.name === name) });
}

/** What a change does to a query. */
export interface Impact {
  readonly query: string;
  readonly status: "fine" | "breaks" | "broken" | "fixed";
  /** Why it is broken in the second version. */
  readonly errors: readonly QueryError[];
}

/**
 * What a change to a schema does to each query.
 *
 * @param specs - the queries
 * @param from - the schema before
 * @param to - the schema after
 * @param options - the dialect, naming and the tables' schema
 * @returns for each query: `fine` in both, `breaks` (fine before, broken after), `broken` in both, or `fixed` (broken before, fine after)
 */
export function impact(specs: readonly QuerySpec[], from: LogicalSchema, to: LogicalSchema, options: CatalogOptions): readonly Impact[] {
  return specs.map((s) => {
    const one = (schema: LogicalSchema): readonly QueryError[] => {
      const r = queries(schema, [s], options);
      return r.kind === "err" ? r.error : [];
    };
    const before = one(from);
    const after = one(to);
    const status = before.length === 0 ? (after.length === 0 ? "fine" : "breaks") : after.length === 0 ? "fixed" : "broken";
    return { query: s.name, status, errors: after };
  });
}
