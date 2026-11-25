// Spec: 0004-workload-projections FR-001, FR-009
/**
 * A runbook as a reader sees it: the view the shared projections are made from. Each step with its kind, the autonomy derived for it, who acts, what to keep, the verb it calls, the controls and the evidence it yields, and the
 * place it has in the scenario (a step that is done, a check that asserts). The words are the runbook form's; the projections are the core's.
 *
 * @example
 * ```ts
 * import { viewOf } from "./view.ts";
 * // viewOf(runbook).nodes[0]?.autonomy
 * ```
 *
 * @module
 */
import type { ViewNode, WorkloadView } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { flatten, type Runbook } from "./step.ts";

/** The view of a runbook. */
export function viewOf(runbook: Runbook): WorkloadView {
  const flat = new Map(flatten(runbook.steps).map((s) => [String(s.id), s]));
  const nodes = levelsOf(runbook).map((l): ViewNode => {
    const s = flat.get(l.id);
    const who = s === undefined ? "" : s.kind === "gate" || s.kind === "ask" ? "a person acts" : s.kind === "judge" ? "the agent proposes, a person decides" : l.autonomy === "human-only" ? "a person acts" : l.autonomy === "agent-proposes" ? "the agent proposes and a person applies" : "the agent acts";
    const keep = s === undefined ? "" : s.kind === "check" ? `; keep the ${s.evidence} as evidence` : s.kind === "gate" ? `; approver ${s.approver}, never the author` : s.kind === "ask" ? `; approver ${s.approver}, within ${s.deadlineHours} hours` : "";
    const verb = s === undefined ? undefined : s.kind === "verb" || s.kind === "undo" ? s.verb : s.kind === "check" ? s.using : undefined;
    const evidence = s === undefined ? undefined : s.kind === "check" ? `${s.evidence}: ${s.asserts}` : s.kind === "verb" && s.verb === "work.record" ? "a record on the work order" : undefined;
    return {
      id: l.id,
      kind: l.kind,
      title: s?.title ?? "",
      derived: l.derived,
      autonomy: l.autonomy,
      ...(l.raisedBy === undefined ? {} : { raisedBy: l.raisedBy }),
      who,
      keep,
      ...(verb === undefined ? {} : { verb }),
      controls: s?.controls ?? [],
      spec: s?.spec ?? [],
      ...(evidence === undefined ? {} : { evidence }),
      scenario: s === undefined ? "none" : s.kind === "check" ? "then" : s.kind === "undo" ? "none" : "when",
      says: s === undefined ? "" : s.kind === "check" ? s.asserts : s.title,
    };
  });
  return {
    id: runbook.id,
    form: "runbook",
    title: runbook.title,
    version: runbook.version,
    summary: runbook.summary,
    trigger: runbook.trigger,
    ...(runbook.expect === undefined ? {} : { expect: runbook.expect }),
    inputs: runbook.inputs,
    given: runbook.given,
    nodes,
    needsPerson: flatten(runbook.steps).some((s) => s.kind === "gate" || s.kind === "ask"),
    howToRun: "A runbook is an ordered procedure: run its steps in order.",
  };
}
