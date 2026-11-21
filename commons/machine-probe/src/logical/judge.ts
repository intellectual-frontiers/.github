// Spec: 0007-machine-probe-enroll FR-004
/**
 * What the policy pack says of one machine: its observation judged by the policies, with the risks a person accepted for it. A machine never observed is waiting in every policy and never failing, because "not observed yet" is not a finding.
 *
 * @example
 * ```ts
 * import { judgeObserved } from "./judge.ts";
 * judgeObserved(undefined, [], "2026-11-21T00:00:00Z").observedAt; // null
 * ```
 *
 * @module
 */
import { judgePolicy, type AcceptedRisk, type JudgedPolicy } from "@intellectual-frontiers/estate/logical";
import type { Observed } from "./observed.ts";
import { evaluate } from "./policies.ts";

/** What the check of one machine found: when it was observed (nothing where it never was) and each policy's status. */
export type Checked = { readonly observedAt: string | null; readonly results: readonly JudgedPolicy[] };

/** The observation of a machine (or none) judged by the policy pack and the risks accepted for it, at an instant. */
export function judgeObserved(observed: Observed | undefined, accepted: readonly AcceptedRisk[], now: string): Checked {
  if (observed === undefined) return { observedAt: null, results: [{ id: "observed", status: "waiting", controls: ["CM-8", "SI-4"], detail: "not observed yet" }] };
  return { observedAt: observed.at, results: evaluate(observed, now).map((r) => judgePolicy({ result: r, observed: true, accepted, now })) };
}
