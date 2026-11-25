// Spec: 0001-runbooks-layers FR-001
/**
 * The manifest of Runbooks, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "runbooks",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Runbooks: typed procedures in which a person or an agent orchestrates and every effect is a deterministic verb of the pinned packages, with effects, derived autonomy, static checks and projections for each harness and for auditors.",
  kanon: {
    package: "@intellectual-frontiers/runbooks",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/runbooks", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance", "logical"] },
        ],
      },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/runbooks", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
