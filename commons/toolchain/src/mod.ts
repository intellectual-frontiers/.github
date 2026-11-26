// Spec: 0001-toolchain-layers FR-003
/**
 * Toolchain: which programs a computer needs, declared once (Governance), resolved to the dialect that carries each out and planned (Logical). The dialects, which obtain the tools, are packages of
 * their own on the port of Desired OS State.
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
