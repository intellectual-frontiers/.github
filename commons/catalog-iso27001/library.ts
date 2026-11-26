// Spec: 0001-catalog-iso27001-layers FR-001
/**
 * The manifest of Catalog Iso27001, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "catalog-iso27001",
  group: "catalogs",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "ISO/IEC 27001:2022 as a grc catalog package, in our own words: the clauses of the management system and the controls of Annex A, with the themes and attributes of ISO/IEC 27002.",
  kanon: {
    package: "@intellectual-frontiers/catalog-iso27001",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/catalog-iso27001", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: "any" }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
