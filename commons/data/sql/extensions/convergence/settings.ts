// Spec: 0019-sql-convergence FR-008, FR-011
/**
 * The settings of the convergence strategy (commons data 0019-sql-convergence FR-008, FR-011): how a plan is approved, what may be applied with no one's approval, the ledger's table and the
 * names the reader leaves out. Each has a default, and the default policy only adds.
 *
 * @module
 */
import type { Reversibility, StepClass } from "@intellectual-frontiers/data/sql/lifecycle";

/** What may be applied on first access with no one's approval. */
export interface Policy {
  /** Whether autonomous convergence is on at all; where it is off every plan is held. */
  readonly enabled: boolean;
  readonly classes: readonly StepClass[];
  readonly reversibilities: readonly Reversibility[];
  /** The kinds of change that may be applied: by default only those that add. */
  readonly kinds: readonly string[];
}

/** What a project says of convergence; what is not said is the default. */
export interface ConvergenceSettings {
  /** `reviewed` (the default) or `autonomous`. */
  readonly approval?: "reviewed" | "autonomous";
  readonly policy?: Partial<Policy>;
  /** The ledger's table; `lifecycle_ledger` by default. */
  readonly ledgerTable?: string;
  /** The names of tables the reader leaves out, besides the ledger's. */
  readonly ignore?: readonly string[];
}

/** The settings with every default filled. */
export interface Convergence {
  readonly approval: "reviewed" | "autonomous";
  readonly policy: Policy;
  readonly ledgerTable: string;
  readonly ignore: readonly string[];
}

/** The default policy: only what adds, and loses nothing. */
export const defaultPolicy: Policy = {
  enabled: true,
  classes: ["safe"],
  reversibilities: ["lossless"],
  kinds: ["createTable", "addColumn", "addConstraint", "upsertRows"],
};

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export function settingsOf(given: ConvergenceSettings = {}): Convergence {
  const ledgerTable = given.ledgerTable ?? "lifecycle_ledger";
  return {
    approval: given.approval ?? "reviewed",
    policy: { ...defaultPolicy, ...given.policy },
    ledgerTable,
    ignore: [ledgerTable, ...(given.ignore ?? [])],
  };
}
