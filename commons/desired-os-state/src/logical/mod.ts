// Spec: 0001-desired-os-state-layers FR-003
/**
 * The Logical layer of Desired OS State: the order of a subject, the plan between what is observed and the order (made on workload's diff and hash), the reconcile workload of an order and the approvals that are Desired OS State's
 * and not workload's. Pure: values in, values out.
 *
 * @module
 */
export * from "./gate.ts";
export * from "./order.ts";
export * from "./osquery.ts";
export * from "./reconcile.ts";
export * from "./state.ts";
