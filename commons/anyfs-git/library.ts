// Spec: 0001-git-layers FR-001
/**
 * The manifest of the Git stores of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of `anyfs` (commons 0033-kanon FR-019 to FR-024): a branch of a repository and a
 * working tree, each kept as a store. It extends `@intellectual-frontiers/anyfs` and reaches it only through its exports; every change it makes goes through Git's own commands, run by the system library.
 *
 * @module
 */
export const library = {
  name: "anyfs-git",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "new: built and verified but not released until the fleet store runs on it",
  exports: [".", "./governance", "./physical"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The Git stores of AnyFS: a branch of a repository kept as a store, written with Git's plumbing so that the working tree, the index and the branch a person has checked out are never touched, and a working tree kept as a store that can commit what it holds. A revision is the digest of the bytes; a batch is one commit; a write is guarded by the revision it saw and by the tip it was made on; the branch, and only it, is pushed and never forced.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-git",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/system", subpaths: ["fs", "path", "proc", "errors"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "local"] },
          { name: "@intellectual-frontiers/anyfs-git", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
