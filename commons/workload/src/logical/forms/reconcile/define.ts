// Spec: 0009-form-reconcile FR-003
/**
 * The validators of a reconcile that are about the data and not about the world: an id used twice, a node that names a node that is not where it must be or is not of the kind it must be, a store that is not declared, and a
 * loop with no observation of the actual state or of the desired state. `defineReconcile` gives the loop back or every finding. Pure.
 *
 * @example
 * ```ts
 * import { defineReconcile } from "./define.ts";
 * // defineReconcile(loop): a Result of the same loop, or the findings
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Finding } from "@intellectual-frontiers/workload/governance";
import { installerFindings } from "@intellectual-frontiers/workload/logical";
import { reconcileFinding } from "./catalog.ts";
import type { Reconcile, ReconcileNode } from "./node.ts";

/** The loop, or every reason it is not well formed. */
export function defineReconcile(input: Reconcile): Result<Reconcile, readonly Finding[]> {
  const out: Finding[] = [];
  const bad = (node: string, message: string): void => void out.push(reconcileFinding("E-RC-LOOP-MALFORMED", node, message, { node: message }));
  if (input.nodes.length === 0) bad("", "a loop has at least one node");
  const index = new Map<string, number>();
  const byId = new Map<string, ReconcileNode>();
  for (const [i, n] of input.nodes.entries()) {
    if (index.has(n.id)) bad(n.id, `the node id ${n.id} is used twice`);
    index.set(n.id, i);
    byId.set(n.id, n);
  }
  const stores = new Set(input.stores.map((s) => String(s.ref)));
  if (stores.size !== input.stores.length) bad("", "a store is declared twice");
  const before = (n: ReconcileNode, id: string, kind: ReconcileNode["kind"], of?: "actual" | "desired"): void => {
    const target = byId.get(id);
    const at = index.get(id);
    if (target === undefined || at === undefined || at >= (index.get(n.id) ?? -1)) bad(n.id, `${n.id}: it names ${id}, which is not a node before it`);
    else if (target.kind !== kind) bad(n.id, `${n.id}: ${id} is a ${target.kind} and must be a ${kind}`);
    else if (of !== undefined && target.kind === "observe" && target.of !== of) bad(n.id, `${n.id}: ${id} observes the ${target.of} state and must observe the ${of} state`);
  };
  const store = (n: ReconcileNode, ref: string): void => {
    if (!stores.has(ref)) bad(n.id, `${n.id}: it names the store ${ref}, which the loop does not declare`);
  };
  if (!input.nodes.some((n) => n.kind === "observe" && n.of === "actual")) bad("", "a loop observes the actual state");
  if (!input.nodes.some((n) => n.kind === "observe" && n.of === "desired")) bad("", "a loop observes the desired state");
  for (const n of input.nodes) {
    out.push(...installerFindings(n));
    switch (n.kind) {
      case "observe":
      case "verify":
        for (const v of Object.values(n.inputs)) {
          if (v.kind === "store") store(n, v.store);
          if (v.kind === "output") before(n, v.step, "plan");
        }
        break;
      case "diff":
        before(n, n.actual, "observe", "actual");
        before(n, n.desired, "observe", "desired");
        break;
      case "plan":
        before(n, n.from, "diff");
        break;
      case "approve":
        before(n, n.plan, "plan");
        for (const g of n.guards) {
          const target = byId.get(g);
          if (target === undefined || (index.get(g) ?? -1) <= (index.get(n.id) ?? 0)) bad(n.id, `${n.id}: it guards ${g}, which is not a node after it`);
          else if (target.kind !== "apply") bad(n.id, `${n.id}: it guards ${g}, which is a ${target.kind} and not an apply`);
        }
        break;
      case "apply":
        before(n, n.plan, "plan");
        store(n, n.effect.store);
        if (stores.has(n.effect.store) && input.stores.find((s) => s.ref === n.effect.store)?.class !== n.effect.class) bad(n.id, `${n.id}: its effect says ${n.effect.store} is ${n.effect.class}, and the loop declares it otherwise`);
        for (const v of Object.values(n.inputs)) {
          if (v.kind === "store") store(n, v.store);
          if (v.kind === "output") before(n, v.step, "plan");
        }
        break;
      default:
        return n satisfies never;
    }
  }
  return out.length === 0 ? ok(input) : err(out);
}
