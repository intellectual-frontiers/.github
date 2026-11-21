// Spec: 0001-estate-query-layers FR-001
/**
 * The Physical layer of Estate Query: the estate as the connection of the `sql` runner of `grc`, so that a policy is a question in SQL.
 *
 * @module
 */
export { checkOf, estateConnection, estateRunners, runEstateChecks } from "./checks.ts";
export type { SavedCheck } from "./checks.ts";
export { gatherLive } from "./live.ts";
export type { Fetch, GatherOptions, Gathered } from "./live.ts";
