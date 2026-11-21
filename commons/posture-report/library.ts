// Spec: 0001-posture-report-layers FR-001
/**
 * The manifest of Posture Report, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "posture-report",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "A read-only static report site for a compliance posture: an index of how each requirement stands, a page for each requirement with its objectives, the evidence and its grade, and who answers for it, as plain HTML and one stylesheet with no script and no request to anywhere, the same bytes for the same posture.",
  kanon: {
    package: "@intellectual-frontiers/posture-report",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/assessment", subpaths: ["logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/tenancy", subpaths: ["logical"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/assessment", subpaths: ["logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/posture-report", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/posture-report", subpaths: ["governance"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
