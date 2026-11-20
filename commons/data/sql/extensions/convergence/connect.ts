// Spec: 0019-sql-convergence FR-007, FR-008, FR-009, FR-010
/**
 * Autonomous convergence and the version gate (commons data 0019-sql-convergence FR-007 to FR-010): on first access the plan is computed and applied if the policy allows every step, held for a
 * person if it does not, and resumed at the next access if a step fails; and a database is checked against the state an application expects.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Applied,
  type Desired,
  type Driver,
  type Plan,
  type PlanOptions,
  type RunError,
  type RunOptions,
  type State,
  stateHash,
  type Step,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { applyPlan, planFor, type Held } from "./plan.ts";
import { readState } from "./read.ts";
import type { Convergence } from "./settings.ts";

/** What a first access came to. */
export type ConnectResult =
  | { readonly kind: "current"; readonly applied: Applied }
  | { readonly kind: "applied"; readonly applied: Applied }
  | { readonly kind: "held"; readonly why: readonly Held[]; readonly plan?: Plan }
  | { readonly kind: "failed"; readonly error: RunError };

/** What a first access is given besides the settings. */
export interface ConnectOptions extends PlanOptions {
  /** Said by a rehearsal of the plan on a copy: where it says no, the plan is held. */
  readonly rehearse?: (plan: Plan) => Promise<boolean>;
  readonly run?: Omit<RunOptions, "empty">;
}

const LOCK = 2_026_042_001;

/**
 * The first access of an application to a database.
 *
 * @param driver - the database
 * @param dialect - its dialect
 * @param schema - the logical schema wanted
 * @param desired - the dialect, naming, schema and what extensions add
 * @param settings - the settings, with every default filled
 * @param options - what `plan` is given, a rehearsal and what the run is given
 * @returns what it came to
 */
export async function connect(
  driver: Driver,
  dialect: Dialect,
  schema: LogicalSchema,
  desired: Desired,
  settings: Convergence,
  options: ConnectOptions = {},
): Promise<ConnectResult> {
  if (!settings.policy.enabled) return { kind: "held", why: [{ step: "(all)", because: "autonomous convergence is off" }] };
  const lock = dialect.advisory;
  if (lock !== undefined) await driver.exec(lock.acquire(LOCK));
  try {
    const { run: runOptions, rehearse, ...planOptions } = options;
    const made = await planFor(driver, schema, desired, { ...planOptions, ignore: settings.ignore, ledgerTable: settings.ledgerTable });
    if (made.kind === "err") return { kind: "held", why: made.error.map((e) => ({ step: "(plan)", because: e })) };
    const { plan, wanted } = made.value;
    const held: Held[] = plan.steps.flatMap((s: Step) => {
      const why: string[] = [];
      if (!settings.policy.classes.includes(s.class)) why.push(`its class is ${s.class}`);
      if (!settings.policy.reversibilities.includes(s.reversibility)) why.push(`it is ${s.reversibility}`);
      if (!settings.policy.kinds.includes(s.kind)) why.push(`${s.kind} is not a kind the policy allows`);
      return why.length === 0 ? [] : [{ step: s.name, because: why.join("; ") }];
    });
    if (held.length > 0) return { kind: "held", why: held, plan };
    if (rehearse !== undefined && plan.steps.length > 0 && !(await rehearse(plan)))
      return { kind: "held", why: [{ step: "(rehearsal)", because: "the rehearsal said no" }], plan };
    const applied = await applyPlan(plan, driver, dialect, wanted, { ...runOptions, ledgerTable: settings.ledgerTable });
    if (applied.kind === "err") return { kind: "failed", error: applied.error[0] as RunError };
    return applied.value.steps.length === 0 && applied.value.repeatable.length === 0
      ? { kind: "current", applied: applied.value }
      : { kind: "applied", applied: applied.value };
  } finally {
    if (lock !== undefined) await driver.exec(lock.release(LOCK));
  }
}

/** Why a database is not where an application expects. */
export type GateError =
  { readonly kind: "state"; readonly expected: string; readonly found: string } | { readonly kind: "unsupported"; readonly why: string };

/**
 * Whether a database is in the state an application expects.
 *
 * @param driver - the database
 * @param dialect - its dialect
 * @param expected - the state the application expects
 * @param ignore - the names of tables the reader leaves out
 * @returns the hash, or why the application should not start
 */
export async function versionGate(
  driver: Driver,
  dialect: Dialect,
  expected: State,
  ignore: readonly string[] = [],
): Promise<Result<string, GateError>> {
  const live = await readState(driver, dialect, expected, { ignore });
  if (live.kind === "err") return err({ kind: "unsupported", why: live.error[0]?.why ?? "" });
  const found = stateHash(live.value);
  const want = stateHash(expected);
  return found === want ? ok(found) : err({ kind: "state", expected: want, found });
}
