// Spec: 0008-anyfs-merge-logical FR-001
/**
 * The pure algebra of a merge: the clock that makes ids, the version rows and their checksums, the state of a replica and the view of a path, the delta with its trust, the check of a replica's rows and the layout laws
 * a SQL database keeps. Nothing here reads or writes a file or the network: a store that merges is made of these functions and a place to keep what they make.
 *
 * @example
 * ```ts
 * import { newState, transact } from "@intellectual-frontiers/anyfs/merge";
 * ```
 *
 * @module
 */
export * from "./limits.ts";
export * from "./id.ts";
export * from "./rows.ts";
export * from "./state.ts";
export * from "./delta.ts";
export * from "./layout.ts";
