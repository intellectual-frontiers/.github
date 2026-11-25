// Spec: 0009-form-reconcile FR-004
/**
 * The static check of a reconcile: the catalogs applied to its nodes. It finds an apply whose effect is not autonomous and that no approval of its plan guards, a loop that applies and never verifies and a loop that is not well
 * formed, and, with the checks every form shares, a node that cites nothing, a verb the registry does not hold, inputs that do not fit, an effect above its verb's, a system of record changed with no idempotency key, a need
 * nobody declares, an observation or a verification that does more than read and an approval that guards nothing. Every finding is an error, and a loop with a finding is not planned or run. Pure.
 *
 * @example
 * ```ts
 * import { check } from "./check.ts";
 * // check(loop): [] where the loop keeps every rule
 * ```
 *
 * @module
 */
import { type Finding, finding, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { citationFinding, effectAutonomy, externalKeyFinding, verbFindings } from "@intellectual-frontiers/workload/logical";
import { reconcileFinding } from "./catalog.ts";
import { decodeReconcile } from "./decode.ts";
import { defineReconcile } from "./define.ts";
import type { Reconcile } from "./node.ts";

/** Every finding of a loop, in the order of its nodes. `registry` is the registry of verbs the loop is held to. */
export function check(loop: Reconcile, registry: VerbRegistry = VERBS): readonly Finding[] {
  const out: Finding[] = [];
  const defined = defineReconcile(loop);
  if (defined.kind === "err") out.push(...defined.error);
  const declared = new Set<string>(loop.needs.map((n) => n.id));
  for (const [i, n] of loop.nodes.entries()) {
    const cited = citationFinding(n);
    if (cited !== undefined) out.push(cited);
    switch (n.kind) {
      case "observe":
      case "verify":
        out.push(...verbFindings({ head: n, verb: n.using, inputs: n.inputs, declared, reads: true }, registry).findings);
        break;
      case "diff":
      case "plan":
        break;
      case "approve":
        if (n.guards.length === 0) out.push(finding("E-WL-GATE-GUARDS-NOTHING", n.id, `the approval ${n.id} guards no node`));
        break;
      case "apply": {
        out.push(...verbFindings({ head: n, verb: n.verb, inputs: n.inputs, declared, reads: false, effect: n.effect }, registry).findings);
        const key = externalKeyFinding(n, n.effect, n.inputs);
        if (key !== undefined) out.push(key);
        if (effectAutonomy(n.effect) !== "agent-autonomous") {
          const approved = loop.nodes.slice(0, i).some((p) => p.kind === "approve" && p.plan === n.plan && p.guards.includes(n.id));
          if (!approved) out.push(reconcileFinding("E-RC-APPLY-UNAPPROVED", n.id, `${n.id} changes ${n.effect.store} (${effectAutonomy(n.effect)}) and no approval of its plan before it guards it`));
        }
        if (!loop.nodes.slice(i + 1).some((p) => p.kind === "verify")) out.push(reconcileFinding("E-RC-VERIFY-MISSING", n.id, `${n.id} applies a plan and no verify comes after it`));
        break;
      }
      default:
        return n satisfies never;
    }
  }
  return out;
}

/** The findings of a value that came from outside: the reasons it is not a loop, or the findings of the loop it is. */
export function checkValue(input: unknown, registry: VerbRegistry = VERBS): readonly Finding[] {
  const r = decodeReconcile(input);
  return r.kind === "err" ? r.error : check(r.value, registry);
}
