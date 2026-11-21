// Spec: 0001-anyfs-serve-layers FR-001
/**
 * The manifest of AnyFS Serve, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs, and a member of the family of AnyFS as a plugin (commons 0033-kanon FR-010). Its
 * `kanon` field is the table of its layers, which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "anyfs-serve",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified but not released until the command line runs a server on it", missing: ["its first consumer, the command line"], liftedWhen: "the command line runs a server on it" },
  exports: [".", "./governance", "./logical", "./physical"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "AnyFS over HTTP: any AnyFS store served as WebDAV, class 1 and 2, on the POSIX view, so an operating system mounts it with no kernel module, and every response says whether it was native, emulated or refused.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-serve",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/anyfs-posix", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        mayImport: ["src/governance/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-posix", subpaths: ["governance", "physical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-posix", subpaths: ["physical"] },
          { name: "@intellectual-frontiers/net", subpaths: ["serve"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
