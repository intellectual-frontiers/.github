// Spec: 0014-rest-surface FR-001
/**
 * The REST surface, as a skeleton (commons headless 0014-rest-surface): the OpenAPI 3.1 document of a program for the caller's tier, generated from governance.
 *
 * @example
 * ```ts
 * import { pathOf } from "@intellectual-frontiers/headless/rest";
 * pathOf(["server", "list"]); // "/v1/server/list"
 * ```
 *
 * @module
 */
export * from "./openapi.ts";
