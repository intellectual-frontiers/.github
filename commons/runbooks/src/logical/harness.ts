// Spec: 0007-runbooks-harness FR-003, FR-004
/**
 * Which dialect a run uses and whether it may. The choice resolves in one order: the explicit choice made at run time, the operator's preference, the skill's choice, the workload's, the fleet's default; the first that names a
 * dialect decides. It is held to the dialects that can carry the runbook, by the matrix of the workbench (the needs of the runbook by dialect): a dialect that drops a requirement, or an agent dialect that needs a person
 * no dialect of a person expresses, is refused with `E-RB-HARNESS-UNSUITABLE`, naming what it lacks, and the run is never moved to another dialect by itself.
 *
 * @example
 * ```ts
 * import { resolveDialect } from "./harness.ts";
 * // resolveDialect(policy, { skill: "restore-drill" }).dialect: the default of the fleet
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";
import { type Dialect as WorkbenchDialect, matrixFindings, matrixOf } from "@intellectual-frontiers/workbench/logical";
import { type DialectId, type DialectInfo, type DialectRegistry, DIALECTS, type Finding, finding, flatten, type HarnessPolicy, type Runbook } from "@intellectual-frontiers/runbooks/governance";

/** What a run asks for: an explicit choice, the operator, the skill and the workload. */
export type DialectRequest = { readonly explicit?: DialectId; readonly operator?: string; readonly skill: string; readonly workload?: string };

/** Where the choice came from. */
export type ChoiceSource = "explicit" | "operator" | "skill" | "workload" | "default";

/** The dialect a policy gives a request and the place it came from. */
export function resolveDialect(policy: HarnessPolicy, request: DialectRequest): { readonly dialect: DialectId; readonly from: ChoiceSource } {
  if (request.explicit !== undefined) return { dialect: request.explicit, from: "explicit" };
  const byOperator = request.operator === undefined ? undefined : policy.perOperator[request.operator];
  if (byOperator !== undefined) return { dialect: byOperator, from: "operator" };
  const bySkill = policy.perSkill[request.skill];
  if (bySkill !== undefined) return { dialect: bySkill, from: "skill" };
  const byWorkload = request.workload === undefined ? undefined : policy.perWorkload[request.workload];
  if (byWorkload !== undefined) return { dialect: byWorkload, from: "workload" };
  return { dialect: policy.default, from: "default" };
}

const CONTRACT: Contract = { name: "runbook", enforceFrom: "2027-01-01", roles: [], gates: [], stages: [], base: [], contributions: [] };

/** Every requirement a runbook has of its dialect: its needs, those of its steps, and an authority for each step that stops for a person. */
export function requirementsOf(runbook: Runbook): readonly Requirement[] {
  const out = new Map<string, Requirement>();
  for (const n of runbook.needs) out.set(n.id, n);
  for (const s of flatten(runbook.steps)) {
    for (const n of s.needs ?? []) out.set(n.id, n);
    if (s.kind === "gate" || s.kind === "ask") out.set(`person-${s.id}`, { id: `person-${s.id}`, kind: "authority", concept: "workstation", task: "run", safety: false, summary: `${s.kind === "gate" ? "A gate" : "An ask"} stops for a person: ${s.title}`, gate: s.id });
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

const asWorkbench = (d: DialectInfo): WorkbenchDialect => ({
  name: d.id,
  holder: d.holder,
  express: (r) => (!d.expresses.includes(r.kind) ? undefined : r.kind === "authority" && d.holder === "agent" ? { kind: "unexpressed", reason: "a person is needed", needsPerson: true } : { kind: "expressed", how: `carried by ${d.title}` }),
});

/** Whether a dialect may carry a runbook, or the finding that says what it lacks. */
export function suitable(runbook: Runbook, dialect: DialectId, registry: DialectRegistry = DIALECTS): Result<DialectInfo, Finding> {
  const info = registry.get(dialect);
  if (info === undefined) return err(finding("E-RB-HARNESS-UNSUITABLE", runbook.id, `the dialect ${dialect} is not registered`, { dialect, lacks: "it is not registered" }));
  const dialects = [info, ...registry.list().filter((d) => d.holder === "human" && d.id !== info.id)].map(asWorkbench);
  const reqs = requirementsOf(runbook);
  const found = matrixFindings(matrixOf(reqs, CONTRACT, dialects), dialects).filter((f) => f.dialect === info.id);
  if (found.length === 0) return ok(info);
  const lacks = found.map((f) => `${f.requirement} (${f.kind === "dropped" ? "not expressed" : "needs a person no dialect of a person carries"})`).join(", ");
  return err(finding("E-RB-HARNESS-UNSUITABLE", runbook.id, `the dialect ${dialect} cannot carry ${runbook.id}: ${lacks}`, { dialect, lacks }));
}

/** The dialect a request gets for a runbook: the one the policy resolves, if it may carry it, and otherwise the finding. */
export function chooseDialect(policy: HarnessPolicy, request: DialectRequest, runbook: Runbook, registry: DialectRegistry = DIALECTS): Result<{ readonly dialect: DialectId; readonly from: ChoiceSource }, Finding> {
  const choice = resolveDialect(policy, request);
  const fit = suitable(runbook, choice.dialect, registry);
  return fit.kind === "ok" ? ok(choice) : err(fit.error);
}
