// Spec: 0002-integrations-governance FR-001
/**
 * Layer 1 of Integrations, governance (commons integrations 0002-integrations-governance): identities made by smart constructors, the governance of observation
 * (connector class, read-only contract, credential reference and least-privilege scope, cadence, entity kinds, the denylist of fields, labels, trust policy) and the
 * governance of exchange (standards with licences, the four levels, bindings, agreements, data protection, obligations). It knows no vendor, no syntax, no transport
 * and no file; it imports Core and nothing else.
 *
 * @module
 */
export * from "./exchange.ts";
export * from "./ids.ts";
export * from "./observe.ts";
