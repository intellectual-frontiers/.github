// Spec: 0005-workload-runs FR-005
/**
 * The dry run of a runbook: what would happen, said with no effect and no event. It refuses a runbook with a finding, gives the steps in order with the autonomy derived for each and what stops for a person, and evaluates the
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
import type { Contract } from "@intellectual-frontiers/workbench/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import { type Finding, type Plan, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { buildPlan } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import { readingSteps, runbookContribution } from "./contribution.ts";
import { flatten, type Runbook } from "./step.ts";

/** What a dry run is given. */
export type PlanInput = { readonly contract: Contract; readonly facts: Facts; readonly today: string; readonly registry?: VerbRegistry };

/** The plan of a runbook, or the findings that refuse it. */
export function plan(runbook: Runbook, input: PlanInput): Result<Plan, readonly Finding[]> {
  const found = check(runbook, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const kinds = new Map(flatten(runbook.steps).map((s) => [String(s.id), s.kind]));
  return ok(
    buildPlan({
      head: runbook,
      form: "runbook",
      nodes: levelsOf(runbook).map((l) => ({ id: l.id, kind: l.kind, autonomy: l.autonomy, stopsForPerson: kinds.get(l.id) === "ask" || kinds.get(l.id) === "gate" || l.autonomy === "human-only" })),
      reading: runbookContribution(runbook, readingSteps(runbook)),
      contract: input.contract,
      facts: input.facts,
      today: input.today,
    }),
  );
}
