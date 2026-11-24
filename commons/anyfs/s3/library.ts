// Spec: 0001-anyfs-s3-layers FR-001
/**
 * The manifest of the S3 backend of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of AnyFS (commons 0033-kanon FR-019 to FR-024): it extends
 * `@intellectual-frontiers/anyfs` and reaches it only through its exports.
 *
 * @module
 */
export const library = {
  name: "anyfs-s3",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified but not released until the first consumer runs on it", missing: ["its first consumer"], liftedWhen: "the first consumer runs on it" },
  exports: ["."],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The S3 backend of AnyFS: a store over a bucket and a prefix of any S3-compatible service, with a revision on every read and a stated expectation on every write, signed by Signature Version 4 and held to the same conformance suite as every backend.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-s3",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
