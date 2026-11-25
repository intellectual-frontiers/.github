// Spec: 0007-workload-harness FR-003, FR-004
/**
 * Which dialect a run uses and whether it may, for every form. The choice resolves in one order: the explicit choice made at run time, the operator's preference, the choice for the workload, the choice for its form, the
 * fleet's default; the first that names a dialect decides. It is held to the dialects that can carry the workload, by the matrix of the workbench (the requirements of the workload by dialect): a dialect that drops a
 * requirement, or an agent dialect that needs a person no dialect of a person expresses, is refused with `E-WL-HARNESS-UNSUITABLE`, naming what it lacks, and the run is never moved to another dialect by itself. A form says
 * which requirements its workload has of its dialect; the rest is here.
 *
 * @example
 * ```ts
 * import { resolveDialect } from "./harness.ts";
 * // resolveDialect(policy, { workload: "restore-drill", form: "runbook" }).dialect: the default of the fleet
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";
import { type Dialect as WorkbenchDialect, matrixFindings, matrixOf } from "@intellectual-frontiers/workbench/logical";
import { type BuiltFormId, type DialectId, type DialectInfo, type DialectRegistry, DIALECTS, type Finding, finding, type HarnessPolicy } from "@intellectual-frontiers/workload/governance";

/** What a run asks for: an explicit choice, the operator, the workload and its form. */
export type DialectRequest = { readonly explicit?: DialectId; readonly operator?: string; readonly workload: string; readonly form?: BuiltFormId };

/** Where the choice came from. */
export type ChoiceSource = "explicit" | "operator" | "workload" | "form" | "default";

/** The dialect a policy gives a request and the place it came from. */
export function resolveDialect(policy: HarnessPolicy, request: DialectRequest): { readonly dialect: DialectId; readonly from: ChoiceSource } {
  if (request.explicit !== undefined) return { dialect: request.explicit, from: "explicit" };
  const byOperator = request.operator === undefined ? undefined : policy.perOperator[request.operator];
  if (byOperator !== undefined) return { dialect: byOperator, from: "operator" };
  const byWorkload = policy.perWorkload[request.workload];
  if (byWorkload !== undefined) return { dialect: byWorkload, from: "workload" };
  const byForm = request.form === undefined ? undefined : policy.perForm[request.form];
  if (byForm !== undefined) return { dialect: byForm, from: "form" };
  return { dialect: policy.default, from: "default" };
}

const CONTRACT: Contract = { name: "workload", enforceFrom: "2027-01-01", roles: [], gates: [], stages: [], base: [], contributions: [] };

const asWorkbench = (d: DialectInfo): WorkbenchDialect => ({
  name: d.id,
  holder: d.holder,
  express: (r) => (!d.expresses.includes(r.kind) ? undefined : r.kind === "authority" && d.holder === "agent" ? { kind: "unexpressed", reason: "a person is needed", needsPerson: true } : { kind: "expressed", how: `carried by ${d.title}` }),
});

/** Whether a dialect may carry a workload that has these requirements of its dialect, or the finding that says what it lacks. */
export function suitable(workload: string, requirements: readonly Requirement[], dialect: DialectId, registry: DialectRegistry = DIALECTS): Result<DialectInfo, Finding> {
  const info = registry.get(dialect);
  if (info === undefined) return err(finding("E-WL-HARNESS-UNSUITABLE", workload, `the dialect ${dialect} is not registered`, { dialect, lacks: "it is not registered" }));
  const dialects = [info, ...registry.list().filter((d) => d.holder === "human" && d.id !== info.id)].map(asWorkbench);
  const found = matrixFindings(matrixOf(requirements, CONTRACT, dialects), dialects).filter((f) => f.dialect === info.id);
  if (found.length === 0) return ok(info);
  const lacks = found.map((f) => `${f.requirement} (${f.kind === "dropped" ? "not expressed" : "needs a person no dialect of a person carries"})`).join(", ");
  return err(finding("E-WL-HARNESS-UNSUITABLE", workload, `the dialect ${dialect} cannot carry ${workload}: ${lacks}`, { dialect, lacks }));
}

/** The dialect a request gets for a workload: the one the policy resolves, if it may carry it, and otherwise the finding. */
export function chooseDialect(policy: HarnessPolicy, request: DialectRequest, requirements: readonly Requirement[], registry: DialectRegistry = DIALECTS): Result<{ readonly dialect: DialectId; readonly from: ChoiceSource }, Finding> {
  const choice = resolveDialect(policy, request);
  const fit = suitable(request.workload, requirements, choice.dialect, registry);
  return fit.kind === "ok" ? ok(choice) : err(fit.error);
}
