// Spec: 0001-anyfs-posix-layers FR-001
/**
 * The manifest of AnyFS POSIX, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs, and a member of the family of AnyFS as a plugin (commons 0033-kanon FR-019 to FR-024): it extends `@intellectual-frontiers/anyfs`
 * and reaches it only through its exports. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "anyfs-posix",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "experimental",
  limits: ["no program runs on it yet; the command line and the servers are its first consumers"],
  exports: [".", "./governance", "./logical", "./physical", "./conformance"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The POSIX view of any AnyFS store: directories derived from prefixes, handles with write-back, and every operation labelled native, emulated or refused, so a command line, a WebDAV or NFS server or a mount can treat any store as a file system without pretending.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-posix",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        mayImport: ["src/governance/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
