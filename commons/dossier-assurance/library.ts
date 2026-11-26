// Spec: 0001-dossier-assurance-layers FR-001
/**
 * The manifest of Dossier Assurance, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "dossier-assurance",
  family: { host: "dossier", role: "plugin" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: [".", "./governance", "./logical"],
  summary: "The lenses of an assurance dossier, as a plugin of the dossier family: the acceptance of a case with each step's result and who attested it, the findings with a plan of action and milestones, how each requirement stands with counts and never a percentage, and the negative space (what has no evidence, has gone stale, is not met or is only partly met), each plate citing its sources and saying how old they are.",
  kanon: {
    package: "@intellectual-frontiers/dossier-assurance",
    extends: "@intellectual-frontiers/dossier",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/dossier", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/dossier", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/dossier-assurance", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
