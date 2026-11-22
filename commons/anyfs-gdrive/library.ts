// Spec: 0001-anyfs-gdrive-layers FR-001
/**
 * The manifest of the Google Drive backend of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of AnyFS (commons 0033-kanon FR-019 to FR-024): it extends
 * `@intellectual-frontiers/anyfs` and reaches it only through its exports.
 *
 * @module
 */
export const library = {
  name: "anyfs-gdrive",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified against an in-process fake of the Drive API and the documented response shapes, and not yet run against a live account, which needs a test account from the owner", missing: ["a run against a live Google Drive account"], liftedWhen: "the suite has run against a test account and its findings are in the issue" },
  exports: ["."],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The Google Drive backend of AnyFS: a store over a folder of Google Drive, with a revision on every read and a stated expectation on every write, held to the same conformance suite as every backend.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-gdrive",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
