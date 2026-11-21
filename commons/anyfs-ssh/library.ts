// Spec: 0001-anyfs-ssh-layers FR-001
/**
 * The manifest of the SSH backend of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of AnyFS (commons 0033-kanon FR-019 to FR-024): it extends
 * `@intellectual-frontiers/anyfs` and reaches it, and the executor of Headless, only through their exports.
 *
 * @module
 */
export const library = {
  name: "anyfs-ssh",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "new: built and verified but not released until the first consumer, the fleet store, runs on it",
  exports: [".", "./helper"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The SSH backend of AnyFS: a store over a folder on a host reached by SSH, the fleet's system of record, with a revision on every read and a stated expectation on every write, reached only through the safe executor of Headless and a small POSIX helper whose SHA-256 is pinned.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-ssh",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
