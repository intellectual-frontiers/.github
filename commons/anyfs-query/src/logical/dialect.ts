// Spec: 0002-query-language FR-001, FR-002, FR-004, FR-005
/**
 * The language (commons anyfs-query 0002-query-language FR-001, FR-002, FR-004, FR-005): the dialect `anyfs`, an instance of the SQL language library that extends its common ground with the like-words `GLOB` and
 * `ILIKE` and the units of sizes and times; the catalog of its tables and scalar functions; and the profile that holds a query to one `SELECT` of one source. Registering the dialect in a registry is the one
 * way the language library comes to know it, and it names nothing of AnyFS.
 *
 * @module
 */
import { ansi, createRegistry, declareDialect, type Dialect, type FunctionSpec, type Registry } from "@intellectual-frontiers/lang-sql";
import type { Catalog, FunctionSig, TableSpec, Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { defineProfile, type Profile } from "@intellectual-frontiers/lang-sql/aide/profile";
import { TABLE_COLUMNS, TABLE_NAMES, type ColumnType } from "@intellectual-frontiers/anyfs-query/governance";

/** The units that follow a number: sizes in powers of 1024 and times in seconds. */
export const UNITS = [
  { unit: "B", factor: 1 },
  { unit: "KB", factor: 1024 },
  { unit: "MB", factor: 1024 * 1024 },
  { unit: "GB", factor: 1024 * 1024 * 1024 },
  { unit: "S", factor: 1 },
  { unit: "M", factor: 60 },
  { unit: "H", factor: 3600 },
  { unit: "D", factor: 86400 },
  { unit: "W", factor: 604800 },
] as const;

/** The dialect of the language: the common ground, `GLOB` and `ILIKE`, and units after numbers. */
export const anyfsDialect: Dialect = declareDialect({
  name: "anyfs",
  extends: ansi,
  lexical: (l) => ({ ...l, keywords: [...l.keywords, "GLOB", "ILIKE"] }),
  grammar: (g) => ({ ...g, likeWords: ["GLOB", "ILIKE"], units: UNITS }),
});

const sig = (name: string, params: readonly Type[] | undefined, minArgs: number, maxArgs: number | undefined, result: Type): FunctionSig => ({ name, params, minArgs, maxArgs, result });

/** The scalar functions of the language, as the catalog types them. */
export const FUNCTIONS: readonly FunctionSig[] = [
  sig("now", [], 0, 0, "timestamp"),
  sig("lower", ["text"], 1, 1, "text"),
  sig("upper", ["text"], 1, 1, "text"),
  sig("length", ["text"], 1, 1, "int"),
  sig("substr", ["text", "int", "int"], 2, 3, "text"),
  sig("instr", ["text", "text"], 2, 2, "int"),
  sig("replace", ["text", "text", "text"], 3, 3, "text"),
  sig("coalesce", undefined, 1, undefined, "unknown"),
  sig("nullif", undefined, 2, 2, "unknown"),
  sig("abs", ["int"], 1, 1, "int"),
  sig("basename", ["text"], 1, 1, "text"),
  sig("dirname", ["text"], 1, 1, "text"),
  sig("glob", ["text", "text"], 2, 2, "bool"),
  sig("under", ["text", "text"], 2, 2, "bool"),
  sig("contains", ["text", "text"], 2, 2, "bool"),
  sig("json_get", ["text", "text"], 2, 2, "unknown"),
];

const typeOf = (c: ColumnType): Type => c;

/** The tables of the language as the catalog types them. */
export const CATALOG: Catalog = {
  tables: Object.fromEntries(TABLE_NAMES.map((t): [string, TableSpec] => [t, { columns: Object.fromEntries(Object.entries(TABLE_COLUMNS[t]).map(([n, c]) => [n, typeOf(c)])) }])),
  functions: FUNCTIONS,
};

/** The profile: one `SELECT` of one source, with no join, subquery, set operation, `WITH`, window or aggregate; the table functions are the tables. */
export const PROFILE: Profile = defineProfile({
  name: "anyfs",
  statements: ["select"],
  forbidNodes: ["join", "subquery", "scalar-query", "exists", "in-query", "with", "set-op", "values", "table-op", "window-spec"],
  functions: [...FUNCTIONS.map((f) => f.name), ...TABLE_NAMES],
  tables: [...TABLE_NAMES],
  maxDepth: 60,
  maxNodes: 2000,
});

/** The functions of the dialect as a registry holds them. */
export const FUNCTION_SPECS: readonly FunctionSpec[] = FUNCTIONS.map((f) => ({ name: f.name, minArgs: f.minArgs, maxArgs: f.maxArgs, aggregate: false, returns: f.result }));

/** A registry that holds the dialect and its functions, as a library outside the language library registers one. */
export function registry(): Registry {
  const r = createRegistry();
  r.register(anyfsDialect);
  r.registerFunctions("anyfs", FUNCTION_SPECS);
  return r;
}
