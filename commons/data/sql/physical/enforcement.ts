// Spec: 0043-sql-invariants FR-006
/**
 * What a dialect can enforce in the database (commons data 0043-sql-invariants FR-006). Engines differ in what they let a database refuse by itself: PostgreSQL has triggers, stored routines, row
 * security, grants, event triggers and advisory locks; SQLite has checks, keys and triggers and no roles; DuckDB has checks, keys and uniqueness and no triggers. A guarantee that an engine cannot
 * enforce in the database is not a defect of the engine or of the library: it is enforced by the application's runtime, and the library says which. A guarantee that an engine can enforce in the database
 * and is enforced only by the application is a defect of the library.
 *
 * @module
 */
import type { Dialect } from "./dialect.ts";

/** A way a database refuses what is wrong. */
export type Mechanism = "check" | "foreign-key" | "unique" | "trigger" | "routine" | "row-security" | "grant" | "event-trigger" | "transactional-ddl" | "advisory-lock";

/** How much a dialect lets the database do: everything below, plus roles and routines (full); checks, keys and triggers (standard); checks and keys alone (basic). */
export type Tier = "full" | "standard" | "basic";

/** What a dialect can and cannot make the database do. */
export interface Enforcement {
  readonly tier: Tier;
  readonly can: readonly Mechanism[];
  readonly cannot: readonly { readonly mechanism: Mechanism; readonly because: string }[];
}

const ALL: readonly Mechanism[] = ["check", "foreign-key", "unique", "trigger", "routine", "row-security", "grant", "event-trigger", "transactional-ddl", "advisory-lock"];

/**
 * What a dialect can enforce in the database.
 *
 * @param dialect - the dialect
 * @returns its tier, what it can do and what it cannot, and why
 */
export function enforcementOf(dialect: Dialect): Enforcement {
  const has = (m: Mechanism): boolean => {
    switch (m) {
      case "check":
      case "foreign-key":
      case "unique":
      case "transactional-ddl":
        return true;
      case "trigger":
        return dialect.features.includes("triggers");
      case "routine":
        return dialect.features.includes("routines");
      case "row-security":
        return dialect.features.includes("row-security");
      case "grant":
        return dialect.features.includes("grants");
      case "event-trigger":
        return dialect.features.includes("event-triggers");
      case "advisory-lock":
        return dialect.advisory !== undefined;
    }
  };
  const can = ALL.filter(has);
  const tier: Tier = has("trigger") && has("routine") && has("row-security") && has("grant") ? "full" : has("trigger") ? "standard" : "basic";
  return {
    tier,
    can,
    cannot: ALL.filter((m) => !has(m)).map((mechanism) => ({ mechanism, because: `${dialect.name} has no ${mechanism.replace("-", " ")} that the library can use` })),
  };
}

/** A guarantee a model may ask of the database. */
export type Need = "append-only" | "status-moves" | "column-cap" | "hash-chain" | "row-isolation" | "least-privilege" | "no-weakening" | "single-runner";

/**
 * Where a guarantee can be enforced for a dialect.
 *
 * @param dialect - the dialect
 * @param need - the guarantee
 * @returns `database` where the database itself can refuse what breaks it, `application` where only the application's runtime can, and how
 */
export function where(dialect: Dialect, need: Need): { readonly by: "database" | "application"; readonly via: string } {
  const e = enforcementOf(dialect);
  const can = (m: Mechanism): boolean => e.can.includes(m);
  switch (need) {
    case "append-only":
    case "status-moves":
    case "column-cap":
    case "hash-chain":
      return can("trigger") ? { by: "database", via: "a trigger" } : { by: "application", via: `${dialect.name} has no triggers: the operations runtime refuses it` };
    case "row-isolation":
      return can("row-security") ? { by: "database", via: "row-level security" } : { by: "application", via: `${dialect.name} has no row-level security: the application filters by scope` };
    case "least-privilege":
      return can("grant") ? { by: "database", via: "roles and grants" } : { by: "application", via: `${dialect.name} has no roles: access is the application's` };
    case "no-weakening":
      return can("event-trigger") ? { by: "database", via: "an event trigger" } : { by: "application", via: `${dialect.name} has no event triggers: a change is guarded by the lifecycle's runner` };
    case "single-runner":
      return can("advisory-lock") ? { by: "database", via: "an advisory lock" } : { by: "application", via: `${dialect.name} has one writer at a time` };
  }
}
