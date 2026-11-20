// Spec: 0001-integrations-layers FR-001
/**
 * Integrations (commons integrations 0001-integrations-layers): the governance and logical layers, whole, for a program that wants both families (observe and
 * exchange) through one entry. The physical adapters (`./http`, `./transport`) and the headless verbs (`./headless`) have entries of their own, because each
 * reaches something (a network, Headless) that a pure consumer does not want.
 *
 * @example
 * ```ts
 * import { cadence } from "@intellectual-frontiers/integrations";
 * cadence("15m").kind; // "ok": stale after 30 minutes
 * ```
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
