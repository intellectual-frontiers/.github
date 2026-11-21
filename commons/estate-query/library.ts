// Spec: 0001-estate-query-layers FR-001
/**
 * The manifest of Estate Query, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "estate-query",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "SQL over the estate: what an estate holds (its assets, the capabilities of each and who owns them, what is declared and observed, the policies judged, the risks accepted, the operational truth and the invariants broken) as relations with a catalog that is data, asked with one read-only statement through the guard and the engine of lang-sql, with no secret in a relation.",
  kanon: {
    package: "@intellectual-frontiers/estate-query",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/archon", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate-query", subpaths: ["governance"] }, { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/catalog", "aide/guard", "aide/relational"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/archon", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate-query", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical", "physical", "runners/sql"] }, { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/relational"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
