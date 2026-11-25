// Spec: 0004-workload-projections FR-010
/**
 * A reconcile as a reader sees it: the view the shared projections are made from, the same shape as the view of a runbook. Each node with its kind, the autonomy derived for it, who acts, what to keep, the verb it calls and the
 * evidence it yields (the digest of the plan, on an approval), so that every dialect says the same autonomy for each node of a loop as for a step of a runbook.
 *
 * @example
 * ```ts
 * import { viewOf } from "./view.ts";
 * // viewOf(loop).nodes[0]?.autonomy
 * ```
 *
 * @module
 */
import type { ViewNode, WorkloadView } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import type { Reconcile } from "./node.ts";

/** The view of a loop. */
export function viewOf(loop: Reconcile): WorkloadView {
  const byId = new Map(loop.nodes.map((n) => [String(n.id), n]));
  const nodes = levelsOf(loop).map((l): ViewNode => {
    const n = byId.get(l.id);
    const who = n === undefined ? "" : n.kind === "approve" || l.autonomy === "human-only" ? "a person acts" : l.autonomy === "agent-proposes" ? "the agent proposes and a person applies" : "the agent acts";
    const keep = n === undefined ? "" : n.kind === "approve" ? `; approver ${n.approver}, approves the plan by its hash and is never the author` : n.kind === "verify" || n.kind === "observe" ? `; keep the ${n.evidence} as evidence` : "";
    const verb = n === undefined ? undefined : n.kind === "apply" ? n.verb : n.kind === "observe" || n.kind === "verify" ? n.using : undefined;
    const evidence = n === undefined ? undefined : n.kind === "verify" ? `${n.evidence}: ${n.asserts}` : n.kind === "approve" ? "the digest of the plan approved, recorded on the approval" : undefined;
    return {
      id: l.id,
      kind: l.kind,
      title: n?.title ?? "",
      derived: l.derived,
      autonomy: l.autonomy,
      ...(l.raisedBy === undefined ? {} : { raisedBy: l.raisedBy }),
      who,
      keep,
      ...(verb === undefined ? {} : { verb }),
      controls: n?.controls ?? [],
      spec: n?.spec ?? [],
      ...(evidence === undefined ? {} : { evidence }),
      scenario: n === undefined ? "none" : n.kind === "verify" ? "then" : "when",
      says: n === undefined ? "" : n.kind === "verify" ? n.asserts : n.title,
    };
  });
  return {
    id: loop.id,
    form: "reconcile",
    title: loop.title,
    version: loop.version,
    summary: loop.summary,
    trigger: loop.trigger,
    ...(loop.expect === undefined ? {} : { expect: loop.expect }),
    inputs: loop.inputs,
    given: loop.given,
    nodes,
    needsPerson: loop.nodes.some((n) => n.kind === "approve"),
    howToRun: "A reconcile is a loop toward a desired state and is level-triggered: each pass starts from what is observed now. The plan is approved by its hash; if the plan changed since a person approved it, it is not approved and you stop and hand back.",
  };
}
