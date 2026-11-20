// Spec: 0001-quality-evidence FR-001
/**
 * The manifest of Quality, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "quality",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.3.0",
  distribution: ["github", "npm"],
  exports: [".", "./assessor/host", "./assessor/pack", "./assessor/verify", "./assessor/verify-pack", "./attestation/agents", "./attestation/host", "./attestation/mutation", "./attestation/plan", "./attestation/rules", "./attestation/sample", "./commands", "./host/archive", "./host/branch", "./host/declaration", "./host/gather", "./host/git", "./host/ledger-branch", "./host/report", "./host/test-run", "./pure/chain", "./pure/chain-files", "./pure/freshness", "./pure/index-file", "./pure/ladder", "./pure/ledger", "./pure/names", "./pure/objectives", "./pure/record", "./pure/render", "./pure/retention", "./pure/tier", "./pure/tier2-events", "./pure/time", "./quality", "./test-cli", "./test-report", "./tier2-commands", "./trust/audience", "./trust/host", "./trust/html", "./trust/requirement-text", "./trust/view"],
  summary:
    "The quality system of Intellectual Frontiers: the run of a suite of tests as evidence, the canonical record of a run and its renderings, the append-only quality branch, the evidence ladder, freshness, nonconformances and CAPA, objectives, the tiers, and the Trust page and the signed assessor pack.",
};
