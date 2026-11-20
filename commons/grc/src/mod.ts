// Spec: 0001-grc-engineering FR-001
/**
 * GRC engineering as one typed library (commons 0007-grc, 0032-lifting-libraries): the pure modules as namespaces. `grc` gives catalogs, controls, verdicts, findings and waivers; `evidence` gives the canonical form of
 * JSON, the hash-chained ledger and the manifests and bundles; `assess` gives coverage, freshness, drift, the change-impact gate and the risk register; `ocsf`, `oscal` and `attest` write the findings, the assessments and
 * the attestations as the standards define them. The host (`@intellectual-frontiers/grc/host`) loads the settings of packs and runs them as signals, and signs.
 *
 * @example
 * ```ts
 * import { grc } from "@intellectual-frontiers/grc";
 * grc.join("fail", "pass"); // "fail"
 * ```
 *
 * @module
 */
export * as assess from "./assess.ts";
export * as attest from "./attest.ts";
export * as evidence from "./evidence.ts";
export * as grc from "./grc.ts";
export * as ocsf from "./ocsf.ts";
export * as oscal from "./oscal.ts";
