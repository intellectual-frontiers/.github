// Spec: 0001-repoctl-layers FR-002
/**
 * The Physical layer of Repoctl (commons repoctl 0006-repoctl-surfaces): what touches the world. The adapters fill the ports of the Logical layer (programs run, files read and written, the registry of npm asked, the credential read),
 * and the program is the tree of verbs on Headless, with the tool server that serves them by audience tier. It imports Governance, Logical, Headless, the parser of the terminal, the system and the libraries of commons whose functions it
 * calls instead of making them again.
 *
 * @example
 * ```ts
 * import { INERT_HOST, repoctlProgram } from "@intellectual-frontiers/repoctl/physical";
 * repoctlProgram(INERT_HOST).children.length > 0; // true
 * ```
 *
 * @module
 */
export * from "./adapters.ts";
export * from "./define.ts";
export * from "./program.ts";
export * from "./verbs/check.ts";
export * from "./verbs/library.ts";
export * from "./verbs/releasing.ts";
export * from "./verbs/sync.ts";
