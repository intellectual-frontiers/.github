// Spec: 0001-dialect-mise-layers FR-001
/**
 * The manifest of the dialect of tools that installs them with mise, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a dialect (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon` and reaches it, and Toolchain, only through their exports, and holds only the data of the manager; the code it shares with the other
 * manager dialects is in `@intellectual-frontiers/package-managers`.
 *
 * @module
 */
export const library = {
  name: "archon-dialect-mise",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.4",
  distribution: ["github", "npm"],
  exports: ["."],
  family: { host: "archon", role: "dialect" },
  summary:
    "The dialect of tools for Archon that installs them with mise (mise, which installs the tools of an account in the account's own folder at the versions it is told); it holds the data of the manager (what it guarantees, how it writes an exact version, what its check answers) and gets everything else from the kit of the manager dialects.",
  kanon: {
    package: "@intellectual-frontiers/archon-dialect-mise",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
