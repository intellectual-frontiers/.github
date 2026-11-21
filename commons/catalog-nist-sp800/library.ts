// Spec: 0001-catalog-nist-sp800-layers FR-001
/**
 * The manifest of Catalog Nist Sp800, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "catalog-nist-sp800",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the libraries of the fleet work together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "NIST SP 800-53 Rev 5.2.0 and SP 800-171 Rev 3 as grc catalog packages, with the controls, the assessment objectives of SP 800-53A and SP 800-171A as controls of their own, and where they came from, their licence and the digest of each source.",
  kanon: {
    package: "@intellectual-frontiers/catalog-nist-sp800",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/catalog-nist-sp800", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: "any" }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
