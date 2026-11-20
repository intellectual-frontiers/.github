// Spec: 0001-headless-layers FR-001
/**
 * Headless, the contract of a program that has no window: its governance (what an action is and what it may do), its logical layer (what a command
 * returns and how that is told) and, by their own entries, the surfaces that draw it (`@intellectual-frontiers/headless/cli`) and the adapter
 * that reports it in OpenTelemetry (`@intellectual-frontiers/headless/otel`). This entry names the two pure layers as namespaces; it names no host
 * global, so it runs wherever ECMAScript does.
 *
 * @example
 * ```ts
 * import { governance, logical } from "@intellectual-frontiers/headless";
 * governance.exitCodeOf("usage"); // 2
 * logical.verbosityOf({ json: false, quiet: false, verbose: false }); // ok("calm")
 * ```
 *
 * @module
 */
export * as governance from "./governance/mod.ts";
export * as logical from "./logical/mod.ts";
