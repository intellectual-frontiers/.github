// Spec: 0019-sql-convergence FR-004, FR-007
/**
 * What the strategies share (commons data 0019-sql-convergence): the plan from a database's state to the state wanted, and running it with the ledger of this strategy.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import {
  type Applied,
  type Desired,
  type Driver,
  execute,
  type Plan,
  type PlanError,
  type PlanOptions,
  type RunError,
  type RunOptions,
  type State,
  stateHash,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { type ProposeError, propose } from "./propose.ts";

/** A step the policy did not allow, and why. */
export interface Held {
  readonly step: string;
  readonly because: unknown;
}

/** The plan for a database, with the state it is wanted in. */
export async function planFor(
  driver: Driver,
  schema: LogicalSchema,
  desired: Desired,
  options: PlanOptions & { readonly ignore?: readonly string[]; readonly ledgerTable?: string },
): Promise<Result<{ readonly plan: Plan; readonly wanted: State }, readonly (ProposeError | PlanError)[]>> {
  const r = await propose(driver, schema, desired, options);
  if (r.kind === "err") return r;
  return { kind: "ok", value: { plan: r.value.plan, wanted: r.value.wanted } };
}

/** Runs a plan on the database it was computed from. */
export async function applyPlan(
  plan: Plan,
  driver: Driver,
  dialect: Dialect,
  _wanted: State,
  options: Omit<RunOptions, "empty">,
): Promise<Result<Applied, readonly RunError[]>> {
  return execute(plan, driver, dialect, { ...options, empty: plan.from });
}

/** The hash of a state. */
export const hashOf = (s: State): string => stateHash(s);
