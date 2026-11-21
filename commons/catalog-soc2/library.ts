// Spec: 0001-catalog-soc2-layers FR-001
/**
 * The manifest of Catalog Soc2, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "catalog-soc2",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the libraries of the fleet work together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "SOC 2 Trust Services Criteria as a grc catalog package, in our own words: the criteria of security, availability, processing integrity, confidentiality and privacy, with where they came from and why the AICPA text is not carried.",
  kanon: {
    package: "@intellectual-frontiers/catalog-soc2",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/catalog-soc2", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/catalog-soc2", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: "any" }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
