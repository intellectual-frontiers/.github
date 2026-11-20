// Spec: 0001-grc-layers FR-001
/**
 * GRC as one typed library of three layers (0001-grc-layers): `governance` (frameworks, crosswalks, policies, checks, requirements, evidence policy and exceptions as data), `logical` (results,
 * findings, evidence, attestations, assessments and the pure computations over them, as self-describing versioned documents) and `physical` (the ports of runners, evidence stores and signers).
 * The extensions are units of their own, by their own entries (`@intellectual-frontiers/grc/runners/sql`, `.../serializers/oscal`, `.../stores/files`, `.../signers/dsse`), and `standard`
 * registers the ones this library ships; the headless verbs are `@intellectual-frontiers/grc/surfaces/headless` and the conformance suites `@intellectual-frontiers/grc/conformance`.
 *
 * @example
 * ```ts
 * import { logical } from "@intellectual-frontiers/grc";
 * logical.join("fail", "pass"); // "fail"
 * ```
 *
 * @module
 */
export * as governance from "./governance/mod.ts";
export * as logical from "./logical/mod.ts";
export * as physical from "./physical/mod.ts";
