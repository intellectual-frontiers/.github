// Spec: 0001-desired-os-state-layers FR-003
/**
 * Desired OS State: what a server, a device, a workstation or a cloud account must be, said once (Governance), the order and the plan made from it (Logical) and the port that a package for each tool
 * implements (Physical). A fleet assembles it with the libraries it chooses; Desired OS State builds no convergence engine: the tools are the engines.
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
export * from "./physical/dialect/mod.ts";
