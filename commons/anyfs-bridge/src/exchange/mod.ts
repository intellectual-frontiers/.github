// Spec: 0007-bridge-exchange FR-001
/**
 * The exchange of replicas through a medium, and the merge of two replicas that are both in hand: the files a medium holds, the cursor a replica keeps, the synchronization, the vectors and the pruning, and the plan and
 * apply of a merge between two stores that merge.
 *
 * @module
 */
export * from "./names.ts";
export * from "./cursor.ts";
export * from "./exchange.ts";
export * from "./merge.ts";
