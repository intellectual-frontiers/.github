// Spec: 0001-mirror-layers FR-001
/**
 * The manifest of the mirrored store of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of `anyfs` (commons 0033-kanon FR-019 to FR-024): one store that keeps two or
 * more stores of any backend in step. It extends `@intellectual-frontiers/anyfs` and reaches every backend only through the store type, so that a backend that is added later works with it unchanged.
 *
 * @module
 */
export const library = {
  name: "anyfs-mirror",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The mirrored store of AnyFS: a primary store and one or more secondaries of any backend, kept in step. The primary answers every read and decides every write; each change it takes is followed, path by path, by every secondary, which may be another backend entirely (a Git branch and a SQLite file, a bucket and a folder). A secondary that cannot take a change is recorded as lagging and never stops the primary; a drift report says where a secondary differs, by the revision of each object, and a reconcile makes it the same again.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-mirror",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-mirror", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-mirror", subpaths: ["governance", "logical"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
