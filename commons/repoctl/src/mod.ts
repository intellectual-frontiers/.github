// Spec: 0001-repoctl-layers FR-003
/**
 * Repoctl, the operations program of this repository (commons repoctl 0001-repoctl-layers): the three layers of Kanon as namespaces, and the entries of the program, `repoctlProgram` for a host that describes it and `main` for the command line.
 *
 * @example
 * ```ts
 * import { governance, repoctlProgram } from "@intellectual-frontiers/repoctl";
 * governance.VERBS.sync.tier; // "contributor"
 * typeof repoctlProgram; // "function"
 * ```
 *
 * @module
 */
export * as governance from "./governance/mod.ts";
export * as logical from "./logical/mod.ts";
export * as physical from "./physical/mod.ts";
export { INERT_HOST, repoctlProgram } from "./physical/mod.ts";
export { main, type MainDeps } from "./repoctl.ts";
