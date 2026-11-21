/**
 * The registry of dialects (commons lang-sql 0007-sql-emit FR-006 to FR-008): a library outside this one registers a dialect it made with {@link defineDialect} and the catalog of the functions the dialect has, and another library finds both
 * by name. A registry starts with the base dialect `ansi` and its catalog; a dialect's functions are its own and those of the dialects it extends, its own replacing a parent's of the same name. Nothing here throws: a name taken, a parent
 * that is not registered and a function that cannot be is an error value.
 *
 * @example
 * ```ts
 * const registry = createRegistry();
 * registry.register(mine);                                  // mine extends ansi
 * registry.registerFunctions("mine", [{ name: "path_of", minArgs: 1, maxArgs: 1, aggregate: false }]);
 * registry.lookupFunction("mine", "PATH_OF");               // the function; "count" is found in ansi
 * ```
 *
 * Spec: 0007-sql-emit FR-006, FR-007, FR-008
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { ansi } from "./ansi.ts";
import type { Dialect } from "./dialect.ts";

/** A function of a dialect: its name, how many arguments it takes, and whether it aggregates. */
export interface FunctionSpec {
  readonly name: string;
  readonly minArgs: number;
  /** The most arguments it takes; `undefined` where there is no most. */
  readonly maxArgs: number | undefined;
  readonly aggregate: boolean;
  /** The type of what it gives, as the dialect writes a type. */
  readonly returns?: string;
  readonly summary?: string;
}

/** Why something was not registered. */
export type RegistryError =
  | { readonly kind: "name-taken"; readonly name: string }
  | { readonly kind: "unknown-parent"; readonly name: string; readonly parent: string }
  | { readonly kind: "unknown-dialect"; readonly name: string }
  | { readonly kind: "bad-function"; readonly name: string; readonly why: string };

/** One sentence for a registry error. */
export function describeRegistryError(e: RegistryError): string {
  switch (e.kind) {
    case "name-taken":
      return `a dialect named ${e.name} is registered already`;
    case "unknown-parent":
      return `${e.name} extends ${e.parent}, which is not registered`;
    case "unknown-dialect":
      return `${e.name} is not registered`;
    case "bad-function":
      return `function "${e.name}" is not valid: ${e.why}`;
    default:
      return absurd(e);
  }
}

/** A registry of dialects with the catalog of functions of each. */
export interface Registry {
  /** Adds a dialect; the same dialect value again changes nothing. */
  register(dialect: Dialect): Result<Dialect, RegistryError>;
  /** The dialect of a name, without regard to case. */
  get(name: string): Dialect | undefined;
  /** The names, in the order of registration. */
  names(): readonly string[];
  /** Adds functions to the catalog of a registered dialect; the number added. */
  registerFunctions(dialect: string, functions: readonly FunctionSpec[]): Result<number, RegistryError>;
  /** A function of a dialect, found in its catalog and then in those of the dialects it extends. */
  lookupFunction(dialect: string, name: string): FunctionSpec | undefined;
  /** Every function the dialect finds, each name once, its own replacing its parent's. */
  functionsOf(dialect: string): readonly FunctionSpec[];
}

const fn = (name: string, minArgs: number, maxArgs: number | undefined, aggregate = false, returns?: string): FunctionSpec =>
  returns === undefined ? { name, minArgs, maxArgs, aggregate } : { name, minArgs, maxArgs, aggregate, returns };

/** The functions of the common ground. */
export const ANSI_FUNCTIONS: readonly FunctionSpec[] = [
  fn("count", 0, 1, true, "BIGINT"),
  fn("sum", 1, 1, true),
  fn("avg", 1, 1, true),
  fn("min", 1, 1, true),
  fn("max", 1, 1, true),
  fn("coalesce", 1, undefined),
  fn("nullif", 2, 2),
  fn("abs", 1, 1),
  fn("ceil", 1, 1),
  fn("floor", 1, 1),
  fn("round", 1, 2),
  fn("mod", 2, 2),
  fn("power", 2, 2),
  fn("sqrt", 1, 1),
  fn("upper", 1, 1, false, "VARCHAR"),
  fn("lower", 1, 1, false, "VARCHAR"),
  fn("length", 1, 1, false, "INTEGER"),
  fn("substring", 2, 3, false, "VARCHAR"),
  fn("trim", 1, 2, false, "VARCHAR"),
  fn("position", 2, 2, false, "INTEGER"),
  fn("concat", 1, undefined, false, "VARCHAR"),
  fn("current_date", 0, 0, false, "DATE"),
  fn("current_timestamp", 0, 1, false, "TIMESTAMP"),
  fn("row_number", 0, 0, false, "BIGINT"),
  fn("rank", 0, 0, false, "BIGINT"),
];

const key = (s: string): string => s.toLowerCase();

/** A registry with the base dialect `ansi` and its functions. */
export function createRegistry(): Registry {
  const dialects = new Map<string, Dialect>();
  const catalogs = new Map<string, Map<string, FunctionSpec>>();
  const order: string[] = [];
  const add = (d: Dialect): void => {
    dialects.set(key(d.name), d);
    catalogs.set(key(d.name), new Map());
    order.push(d.name);
  };
  add(ansi);
  const base = catalogs.get(key(ansi.name));
  for (const f of ANSI_FUNCTIONS) base?.set(key(f.name), f);

  const chain = (name: string): readonly string[] => {
    const out: string[] = [];
    for (let d: Dialect | undefined = dialects.get(key(name)); d !== undefined; d = d.parent) out.push(key(d.name));
    return out;
  };

  return {
    register(dialect) {
      const taken = dialects.get(key(dialect.name));
      if (taken === dialect) return ok(dialect);
      if (taken !== undefined) return err({ kind: "name-taken", name: dialect.name });
      if (dialect.parent !== undefined && dialects.get(key(dialect.parent.name)) !== dialect.parent)
        return err({ kind: "unknown-parent", name: dialect.name, parent: dialect.parent.name });
      add(dialect);
      return ok(dialect);
    },
    get: (name) => dialects.get(key(name)),
    names: () => [...order],
    registerFunctions(dialect, functions) {
      const catalog = catalogs.get(key(dialect));
      if (catalog === undefined) return err({ kind: "unknown-dialect", name: dialect });
      for (const f of functions) {
        if (f.name.trim() === "") return err({ kind: "bad-function", name: f.name, why: "its name is empty" });
        if (f.maxArgs !== undefined && f.minArgs > f.maxArgs) return err({ kind: "bad-function", name: f.name, why: "its smallest number of arguments is more than its largest" });
        if (f.minArgs < 0) return err({ kind: "bad-function", name: f.name, why: "its smallest number of arguments is below 0" });
      }
      for (const f of functions) catalog.set(key(f.name), f);
      return ok(functions.length);
    },
    lookupFunction(dialect, name) {
      for (const d of chain(dialect)) {
        const f = catalogs.get(d)?.get(key(name));
        if (f !== undefined) return f;
      }
      return undefined;
    },
    functionsOf(dialect) {
      const seen = new Map<string, FunctionSpec>();
      for (const d of chain(dialect)) for (const [k, f] of catalogs.get(d) ?? []) if (!seen.has(k)) seen.set(k, f);
      return [...seen.values()];
    },
  };
}
