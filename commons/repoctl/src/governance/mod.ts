// Spec: 0001-repoctl-layers FR-002
/**
 * The Governance layer of Repoctl (commons repoctl 0002-repoctl-governance): what the program is, as data and as types that cannot be made wrong, before any surface draws it: the identities (a library, a version, an issue,
 * a session, a subject), the audience tiers, the verbs with their facts and reach, the problem codes with their explanations, the configuration of a repository (its generators, checks, commit rules and optional verbs). It imports Core and the governance of Headless alone and
 * does no input or output.
 *
 * @example
 * ```ts
 * import { VERBS, defineConfig, parseLibraryName } from "@intellectual-frontiers/repoctl/governance";
 * VERBS.sync.tier; // "contributor"
 * typeof defineConfig; // "function"
 * parseLibraryName("repoctl").kind; // "ok"
 * ```
 *
 * @module
 */
export * from "./checks.ts";
export * from "./config.ts";
export * from "./generators.ts";
export * from "./identity.ts";
export * from "./ids.ts";
export * from "./problems.ts";
export * from "./proof.ts";
export * from "./tiers.ts";
export * from "./verbs.ts";
export * from "./version.ts";
