// Spec: 0001-pinned-downloads-layers FR-001
/**
 * The manifest of the default dialect of tools, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Desired OS State as a dialect (commons 0033-kanon FR-019 to
 * FR-024): it extends `@intellectual-frontiers/desired-os-state` and reaches it, and Toolchain, only through their exports.
 *
 * @module
 */
export const library = {
  name: "desired-os-state-pinned-downloads",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.6",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: [".", "./install", "./pin"],
  family: { host: "desired-os-state", role: "dialect" },
  summary:
    "The default dialect of tools for Desired OS State: the programs a computer needs, as their publishers released them, pinned by the SHA-256 of the artifact, in a folder of the user's own, with no administrator rights and no package manager; never built from source.",
  kanon: {
    package: "@intellectual-frontiers/desired-os-state-pinned-downloads",
    extends: "@intellectual-frontiers/desired-os-state",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
