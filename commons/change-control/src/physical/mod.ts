// Spec: 0001-change-control-layers FR-001
/**
 * The Physical layer of Change Control: the commits of a range, read from Git with its own verification of signatures.
 *
 * @module
 */
export { readCommits, resolve } from "./git.ts";
export { HOOK_MARKER, commitSigned, configureGit, installHook, makeKey, readFacts, testSign } from "./keys.ts";
export type { FactsInput } from "./keys.ts";
