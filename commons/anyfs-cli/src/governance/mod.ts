// Spec: 0001-anyfs-cli-layers FR-001
/**
 * Layer 1 of the `anyfs` program: the facts of its verbs, its tiers and its problem codes, and its version. Nothing here reads or runs anything.
 *
 * @module
 */
export * from "./version.ts";
export * from "./tiers.ts";
export * from "./verbs.ts";
export * from "./problems.ts";
export * from "./location.ts";
