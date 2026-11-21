// Spec: 0001-anyfs-cli-layers FR-001
/**
 * Layer 3 of the `anyfs` program: the openers of stores, the world of the process, the loader of the configuration, the verbs and the program on Headless.
 *
 * @module
 */
export * from "./os.ts";
export * from "./openers.ts";
export * from "./world.ts";
export * from "./config-load.ts";
export * from "./bind.ts";
export { traitsOf, defineVerb, POSIX_OPTIONS } from "./verbs/common.ts";
export { readVerbs, displayOf } from "./verbs/read.ts";
export { writeVerbs, removalHash } from "./verbs/write.ts";
export { bridgeVerbs } from "./verbs/bridge.ts";
export { setupVerbs, kindStatus, mountTargets } from "./verbs/setup.ts";
export * from "./program.ts";
