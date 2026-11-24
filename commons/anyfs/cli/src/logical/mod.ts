// Spec: 0001-anyfs-cli-layers FR-001
/**
 * Layer 2 of the `anyfs` program: the pure functions of its verbs (how a word is a place, how results are drawn, a line diff, a text search, the trail of fidelity, the text of a plan) and the types of the world they
 * run in. It reads and runs nothing; the world is a port.
 *
 * @module
 */
export * from "./config.ts";
export * from "./world.ts";
export * from "./stores.ts";
export * from "./format.ts";
export * from "./diff.ts";
export * from "./grep.ts";
export * from "./trail.ts";
export * from "./outcomes.ts";
export * from "./plans.ts";
export * from "./roster.ts";
