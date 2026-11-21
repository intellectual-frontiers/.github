// Spec: 0001-findings-layers FR-001
/**
 * The manifest of Findings, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "findings",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Test results from other tools (SARIF, OWASP ZAP, Burp Suite and Nessus reports) read into findings that keep where they came from, with a lifecycle (open, triaged, accepted for a time, fixed, verified or reopened by a retest) worked out from a log of events, and the NIST SP 800-53 controls each finding is evidence against. It reads reports and runs no tool.",
  kanon: {
    package: "@intellectual-frontiers/findings",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/findings", subpaths: ["governance"] }, { name: "@intellectual-frontiers/formats", subpaths: ["xml"] }, { name: "@intellectual-frontiers/planning", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/findings", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
