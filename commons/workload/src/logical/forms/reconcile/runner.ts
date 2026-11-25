// Spec: 0009-form-reconcile FR-015
/**
 * What a reconcile asks of a runner. Its observe and verify are calls; its diff and its plan are computations of typed TypeScript (`logic`); its approve is a person's authority given by the hash of the plan (`approval` and
 * `interactive`); its apply is a call, and a destroy of a durable, git or external store needs `destroy` unless an approve guards it. A reconcile has `logic` and an approval, so the native runner carries it and no
 * integration runner does, and it has no plan of calls. Pure.
 *
 * @example
 * ```ts
 * import { runnerNeedsOf } from "./runner.ts";
 * // runnerNeedsOf(loop).map((n) => n.capability)
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { RunnerNeed } from "@intellectual-frontiers/workload/governance";
import { destroyNeed, distinctNeeds, personNeed } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import type { Reconcile } from "./node.ts";

/** What a reconcile needs of a runner, from its nodes, in the order of the nodes, once each. */
export function runnerNeedsOf(loop: Reconcile): readonly RunnerNeed[] {
  const level = new Map(levelsOf(loop).map((l) => [String(l.id), l.autonomy]));
  const guarded = new Set(loop.nodes.flatMap((n) => (n.kind === "approve" ? n.guards.map(String) : [])));
  const out: RunnerNeed[] = [];
  const need = (capability: RunnerNeed["capability"], node: string, why: string): void => void out.push({ capability, node, why });
  for (const n of loop.nodes) {
    const id = String(n.id);
    switch (n.kind) {
      case "observe":
      case "verify":
        need("calls", id, `${id} calls ${n.using}`);
        break;
      case "diff":
      case "plan":
        need("logic", id, `${id} is a computation of typed logic`);
        break;
      case "approve":
        need("approval", id, `${id} is the approval of ${n.approver} by the hash of the plan`);
        need("interactive", id, `${id} stops for a person`);
        break;
      case "apply": {
        need("calls", id, `${id} calls ${n.verb}`);
        const d = destroyNeed(id, n.effect, guarded.has(id));
        if (d !== undefined) out.push(d);
        const p = d === undefined && !guarded.has(id) ? personNeed(id, level.get(id) ?? "human-only") : undefined;
        if (p !== undefined) out.push(p);
        break;
      }
      default:
        return absurd(n);
    }
  }
  return distinctNeeds(out);
}
