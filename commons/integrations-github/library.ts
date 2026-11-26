// Spec: 0001-integrations-github-connector FR-001
/**
 * The manifest of Integrations GitHub, a plugin library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs.
 *
 * @module
 */
export const library = {
  name: "integrations-github",
  family: { host: "integrations", role: "plugin" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.7",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: ["."],
  summary: "The reference connector of Integrations for the posture of one organization of a code host: read-only, with its governance as data, its posture policies in the vocabulary of GRC, its records and entities, proved by the conformance suite over made-up recorded answers.",
  kanon: {
    package: "@intellectual-frontiers/integrations-github",
    extends: "@intellectual-frontiers/integrations",
    units: [
      {
        folder: "src/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] },
        ],
      },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
