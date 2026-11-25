// Spec: 0002-objective-evidence FR-005
/**
 * Evidence from what a tool checked (0002-objective-evidence FR-005): the results of a machine's policies, each bound to the objectives it gives evidence for, become records of the method `test` by a tool, one per bound objective. A policy that is waiting (the machine was not observed)
 * gives no evidence; one that warns gives none either, because a warning is not a pass; an accepted risk is a person's decision and gives none from a tool. A passing or failing result gives a record, and no record of a tool determines an objective.
 *
 * @example
 * ```ts
 * import { evidenceFromPolicies } from "./bind.ts";
 * evidenceFromPolicies([], {}, { framework: "f", at: "2026-11-21T00:00:00Z", tool: "probe", asset: "synthetic-server-02" }); // []
 * ```
 *
 * @module
 */
import type { Evidence } from "@intellectual-frontiers/assessment/governance";

/** A policy's result as a check of an asset gives it. */
export type PolicyResult = { readonly id: string; readonly status: "pass" | "fail" | "warn" | "accepted" | "waiting" };
/** Which objectives each policy gives evidence for, by policy id. */
export type Bindings = Readonly<Record<string, readonly string[]>>;
/** The context of one run of the checks. */
export type Run = { readonly framework: string; readonly at: string; readonly tool: string; readonly asset: string; readonly validUntil?: string };

/** The evidence a run of the policies gives, in a stable order. */
export function evidenceFromPolicies(results: readonly PolicyResult[], bindings: Bindings, run: Run): readonly Evidence[] {
  const out: Evidence[] = [];
  for (const r of results) {
    if (r.status !== "pass" && r.status !== "fail") continue;
    for (const objective of bindings[r.id] ?? []) {
      out.push({
        id: `ev-${run.asset}-${r.id}-${objective}-${run.at}`,
        framework: run.framework,
        objective,
        method: "test",
        result: r.status,
        by: { kind: "tool", name: run.tool },
        at: run.at,
        ...(run.validUntil === undefined ? {} : { validUntil: run.validUntil }),
        source: `policy:${run.asset}:${r.id}`,
        determines: false,
      });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
