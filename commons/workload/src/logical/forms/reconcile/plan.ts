// Spec: 0009-form-reconcile FR-012
/**
 * The dry run of a reconcile: what a pass would do, said with no effect and no event. It refuses a loop with a finding, gives the nodes in order with the autonomy derived for each and what stops for a person, and evaluates
 * the preconditions with the workbench only: the requirements the loop is given and the needs of the nodes that read (the observations and the verifications). A dry run does not demand what an apply needs, and it does not
 * observe: the changes are not known until a pass is run, and what stops for a person is the approval of the plan once it is.
 *
 * @example
 * ```ts
 * import { plan } from "./plan.ts";
 * // plan(loop, { contract, facts, today })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Contract } from "@intellectual-frontiers/workbench/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import { type Finding, type Plan, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { buildPlan, workloadContribution } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import type { Reconcile } from "./node.ts";

/** What a dry run is given. */
export type PlanInput = { readonly contract: Contract; readonly facts: Facts; readonly today: string; readonly registry?: VerbRegistry };

/** The plan of a loop, or the findings that refuse it. */
export function plan(loop: Reconcile, input: PlanInput): Result<Plan, readonly Finding[]> {
  const found = check(loop, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const kinds = new Map(loop.nodes.map((n) => [String(n.id), n.kind]));
  const reading = loop.nodes.filter((n) => n.kind === "observe" || n.kind === "verify" || n.kind === "diff" || n.kind === "plan").map((n) => n.id);
  return ok(
    buildPlan({
      head: loop,
      form: "reconcile",
      nodes: levelsOf(loop).map((l) => ({ id: l.id, kind: l.kind, autonomy: l.autonomy, stopsForPerson: kinds.get(l.id) === "approve" || l.autonomy === "human-only" })),
      reading: workloadContribution(loop, loop.nodes, reading),
      contract: input.contract,
      facts: input.facts,
      today: input.today,
    }),
  );
}
