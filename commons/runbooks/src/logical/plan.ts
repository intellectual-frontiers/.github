// Spec: 0008-runbooks-runs FR-005, FR-006
/**
 * The dry run: what would happen, said with no effect and no event. It refuses a runbook with a finding, gives the steps in order with the autonomy derived for each and what stops for a person, and evaluates the
 * preconditions with the workbench only: the requirements the runbook is given and the needs of the steps that read, against facts a probe made. A dry run does not demand what a step that applies something needs.
 *
 * @example
 * ```ts
 * import { plan } from "./plan.ts";
 * // plan(runbook, { contract, facts, today })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Autonomy, type Contract, type Requirement } from "@intellectual-frontiers/workbench/governance";
import { evaluate, type Facts } from "@intellectual-frontiers/workbench/logical";
import type { Finding as WorkbenchFinding } from "@intellectual-frontiers/workbench/governance";
import { type Finding, flatten, type Runbook, type StepId, type VerbRegistry, VERBS } from "@intellectual-frontiers/runbooks/governance";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import { readingSteps, runbookContribution } from "./contribution.ts";

/** One step of a plan. */
export type PlannedStep = { readonly id: StepId; readonly kind: string; readonly autonomy: Autonomy; readonly stopsForPerson: boolean };

/** What a dry run says. */
export type Plan = {
  readonly runbook: string;
  readonly steps: readonly PlannedStep[];
  /** The requirements the workbench would evaluate: the given ones that the contract holds, and the needs of the steps that read. */
  readonly requirements: readonly Requirement[];
  /** The requirements the runbook is given that the contract does not hold. */
  readonly unknownGiven: readonly string[];
  readonly preconditions: readonly WorkbenchFinding[];
};

/** What a dry run is given. */
export type PlanInput = { readonly contract: Contract; readonly facts: Facts; readonly today: string; readonly registry?: VerbRegistry };

/** The plan of a runbook, or the findings that refuse it. */
export function plan(runbook: Runbook, input: PlanInput): Result<Plan, readonly Finding[]> {
  const found = check(runbook, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const all = [...input.contract.base, ...input.contract.contributions.flatMap((c) => c.requirements)];
  const given = runbook.given.map((id) => all.find((r) => r.id === id));
  const requirements = new Map<string, Requirement>();
  for (const r of given) if (r !== undefined) requirements.set(r.id, r);
  for (const r of runbookContribution(runbook, readingSteps(runbook)).requirements) requirements.set(r.id, r);
  const list = [...requirements.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const levels = levelsOf(runbook);
  const kinds = new Map(flatten(runbook.steps).map((s) => [String(s.id), s.kind]));
  return ok({
    runbook: runbook.id,
    steps: levels.map((l) => ({ id: l.id, kind: l.kind, autonomy: l.autonomy, stopsForPerson: kinds.get(l.id) === "ask" || kinds.get(l.id) === "gate" || l.autonomy === "human-only" })),
    requirements: list,
    unknownGiven: runbook.given.filter((_, i) => given[i] === undefined),
    preconditions: evaluate(list, input.facts, input.today, input.contract.enforceFrom),
  });
}
