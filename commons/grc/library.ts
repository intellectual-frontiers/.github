// Spec: 0001-grc-engineering FR-001
/**
 * The manifest of GRC, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "grc",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.2",
  distribution: ["github", "npm"],
  exports: [".", "./grc", "./assess", "./evidence", "./oscal", "./ocsf", "./attest", "./host", "./host/grc", "./host/sign"],
  summary:
    "Governance, risk and compliance as code: typed catalogs, controls, verdicts, findings and waivers, the hash-chained evidence ledger, coverage, freshness, drift and the risk register, the findings, assessments and attestations written as OCSF, OSCAL, CycloneDX and in-toto, and a host that loads the settings of packs, runs them as signals and signs.",
};
