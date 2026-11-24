// Spec: 0006-bridge-mirrored FR-001
/**
 * The mirror of AnyFS: a store with a primary that is the authority and replicas that converge on it, by the plans of the bridge, with a ledger on the primary and events for whatever watches.
 *
 * @module
 */
export * from "./events.ts";
export * from "./ledger.ts";
export * from "./mirror.ts";
