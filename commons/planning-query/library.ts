// Spec: 0001-planning-query-layers FR-001
/**
 * The manifest of Planning Query, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "planning-query",
  group: "planning",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The items of Planning as read-only SQL relations: issues, events, links and traces, with a catalog that is data made from the same list of columns as the rows, asked with one read-only statement through the guard and the engine of lang-sql, a proposed item counted only where the question says so.",
  kanon: {
    package: "@intellectual-frontiers/planning-query",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/catalog", "aide/guard", "aide/relational"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning-query", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/relational"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["logical", "physical"] },
          { name: "@intellectual-frontiers/planning-query", subpaths: ["logical"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
