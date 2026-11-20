// Spec: 0001-grc-layers FR-004
/**
 * Governance, layer 1 of GRC (0002-grc-governance): the documents that say what must be true and how it is to be shown (frameworks, crosswalks, policies, checks, requirements, evidence policies,
 * exceptions), the envelope they share, the registry every extension point takes, and the durations and globs they use. It imports Core only and names no framework, runner or store.
 *
 * @module
 */
export * from "./document.ts";
export * from "./glob.ts";
export * from "./kinds.ts";
export * from "./registry.ts";
export * from "./rules.ts";
export * from "./time.ts";
