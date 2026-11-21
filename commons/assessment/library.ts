// Spec: 0001-assessment-layers FR-001
/**
 * The manifest of Assessment, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "assessment",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Assessment-objective evidence: what a framework's objectives (SP 800-171A, SP 800-53A) ask, the evidence recorded against each (examine, interview, test; by a tool or a person; with a validity), how each objective and requirement stands from it, and why a tool alone never determines an objective a person must.",
  kanon: {
    package: "@intellectual-frontiers/assessment",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/assessment", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/formats", subpaths: ["json5"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/assessment", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
