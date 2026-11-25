// Spec: 0001-workload-layers FR-001, FR-004
/**
 * Layer 2 of Workload, the shared part: pure functions every form uses (autonomy, the checks of a node's use of a verb, the contribution to the workbench, the dry run, the choice of a dialect and of a runner, the proposal of a judge, the
 * fold of run events, the projections from views). It imports nothing from any form; the forms are entries of their own (`forms/runbook`, `forms/reconcile`). No input or output.
 *
 * @module
 */
export * from "./autonomy.ts";
export * from "./checks.ts";
export * from "./contribution.ts";
export * from "./plan.ts";
export * from "./fold.ts";
export * from "./outcome.ts";
export * from "./harness.ts";
export * from "./runner.ts";
export * from "./handoff.ts";
export * from "./emit.ts";
export * from "./schedule.ts";
export * from "./proposal.ts";
export * from "./projection.ts";
