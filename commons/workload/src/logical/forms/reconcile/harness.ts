// Spec: 0007-workload-harness FR-004
/**
 * What a reconcile asks of its dialect: its needs, those of its nodes, and an authority for each approval, which stops for a person. The choice of a dialect and the matrix of the workbench are the core's.
 *
 * @example
 * ```ts
 * import { requirementsOf } from "./harness.ts";
 * // requirementsOf(loop): the needs and an authority for each approval
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import { type DialectId, type DialectInfo, type DialectRegistry, DIALECTS, type Finding, type HarnessPolicy } from "@intellectual-frontiers/workload/governance";
import { type ChoiceSource, chooseDialect as choose, type DialectRequest, suitable as suitableFor } from "@intellectual-frontiers/workload/logical";
import type { Reconcile } from "./node.ts";

/** Every requirement a loop has of its dialect: its needs, those of its nodes, and an authority for each approval. */
export function requirementsOf(loop: Reconcile): readonly Requirement[] {
  const out = new Map<string, Requirement>();
  for (const n of loop.needs) out.set(n.id, n);
  for (const n of loop.nodes) {
    for (const need of n.needs ?? []) out.set(need.id, need);
    if (n.kind === "approve") out.set(`person-${n.id}`, { id: `person-${n.id}`, kind: "authority", concept: "workstation", task: "run", safety: false, summary: `An approval stops for a person: ${n.title}`, gate: n.id });
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Whether a dialect may carry a loop, or the finding that says what it lacks. */
export const suitable = (loop: Reconcile, dialect: DialectId, registry: DialectRegistry = DIALECTS): Result<DialectInfo, Finding> => suitableFor(loop.id, requirementsOf(loop), dialect, registry);

/** The dialect a request gets for a loop: the one the policy resolves, if it may carry it, and otherwise the finding. */
export function chooseDialect(policy: HarnessPolicy, request: Omit<DialectRequest, "workload" | "form">, loop: Reconcile, registry: DialectRegistry = DIALECTS): Result<{ readonly dialect: DialectId; readonly from: ChoiceSource }, Finding> {
  const r = choose(policy, { ...request, workload: loop.id, form: "reconcile" }, requirementsOf(loop), registry);
  return r.kind === "ok" ? ok(r.value) : err(r.error);
}
