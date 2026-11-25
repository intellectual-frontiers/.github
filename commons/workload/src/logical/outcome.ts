// Spec: 0008-form-runbook FR-022
/**
 * What a run was expected to have. A workload may say the outcome it is expected to have (a drill expects to complete, a game day may expect to park or to fail safely); each form maps what its run finished with to one of
 * the three words every form shares, and this says whether the run met what was expected. Pure.
 *
 * @example
 * ```ts
 * import { meets } from "./outcome.ts";
 * meets({ outcome: "completes" }, "completes"); // true
 * meets(undefined, "fails"); // true
 * ```
 *
 * @module
 */
import type { Expectation, Outcome } from "@intellectual-frontiers/workload/governance";

/** Whether a run with this outcome met the expectation; a workload with no expectation is met by any outcome. */
export const meets = (expected: Expectation | undefined, got: Outcome): boolean => expected === undefined || expected.outcome === got;
