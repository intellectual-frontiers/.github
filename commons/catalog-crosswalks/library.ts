// Spec: 0001-catalog-crosswalks-layers FR-001
/**
 * The manifest of Catalog Crosswalks, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "catalog-crosswalks",
  group: "catalogs",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Crosswalks between frameworks as grc catalog packages, as proposals for a person to decide, and the pure view of the coverage of a framework through them.",
  kanon: {
    package: "@intellectual-frontiers/catalog-crosswalks",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: "any" }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/catalog-crosswalks", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: "any" }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
