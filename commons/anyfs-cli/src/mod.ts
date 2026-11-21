// Spec: 0001-anyfs-cli-layers FR-001
/**
 * The `anyfs` program as a library: its governance (verbs, tiers, problem codes, the grammar of a place), its logical layer (the configuration, the world and the pure functions of the verbs) and its physical layer (the
 * openers, the verbs and the program on Headless).
 *
 * @example
 * ```ts
 * import { defineConfig } from "@intellectual-frontiers/anyfs-cli";
 * defineConfig({ mounts: [{ name: "scratch", place: "memory:scratch" }] }).mounts?.length; // 1
 * ```
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
export * from "./physical/mod.ts";
export { main, takeConfigOption, type MainDeps } from "./anyfs.ts";
