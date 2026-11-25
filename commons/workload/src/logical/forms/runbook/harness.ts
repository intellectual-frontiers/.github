// Spec: 0007-workload-harness FR-004
/**
 * What a runbook asks of its dialect: its needs, those of its steps, and an authority for each step that stops for a person. The choice of a dialect and the matrix of the workbench are the core's (`suitable`,
 * `chooseDialect`); the runbook form says only which requirements it has.
 *
 * @example
 * ```ts
 * import { requirementsOf } from "./harness.ts";
 * // requirementsOf(runbook): the needs and an authority for each gate and ask
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import { type DialectId, type DialectInfo, type DialectRegistry, DIALECTS, type Finding, type HarnessPolicy } from "@intellectual-frontiers/workload/governance";
import { type ChoiceSource, chooseDialect as choose, type DialectRequest, suitable as suitableFor } from "@intellectual-frontiers/workload/logical";
import { flatten, type Runbook } from "./step.ts";

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

/** Whether a dialect may carry a runbook, or the finding that says what it lacks. */
export const suitable = (runbook: Runbook, dialect: DialectId, registry: DialectRegistry = DIALECTS): Result<DialectInfo, Finding> => suitableFor(runbook.id, requirementsOf(runbook), dialect, registry);

/** The dialect a request gets for a runbook: the one the policy resolves, if it may carry it, and otherwise the finding. */
export function chooseDialect(policy: HarnessPolicy, request: Omit<DialectRequest, "workload" | "form">, runbook: Runbook, registry: DialectRegistry = DIALECTS): Result<{ readonly dialect: DialectId; readonly from: ChoiceSource }, Finding> {
  const r = choose(policy, { ...request, workload: runbook.id, form: "runbook" }, requirementsOf(runbook), registry);
  return r.kind === "ok" ? ok(r.value) : err(r.error);
}
