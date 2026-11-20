// Spec: 0001-headless-layers FR-001
/**
 * Layer 1 of Headless, governance: what a headless action is, whatever surface draws it (commons headless 0002-headless-governance). The facts of an
 * action (its kind, effect, audience, idempotency, preview and human-only options), the decision to proceed, preview, ask or refuse, the problems a
 * run finds with their levels and stable codes, the one table of exit statuses, and the redaction of secrets. It imports Core alone and names no
 * surface, no terminal and no host.
 *
 * @example
 * ```ts
 * import { defineAction, exitCodeOf } from "@intellectual-frontiers/headless/governance";
 * defineAction({ id: "status", summary: "Show the status.", kind: "report" }).effect; // "read"
 * exitCodeOf("findings"); // 1
 * ```
 *
 * @module
 */
export * from "./action.ts";
export * from "./exits.ts";
export * from "./problems.ts";
export * from "./reach.ts";
export * from "./redact.ts";
export * from "./tier.ts";
