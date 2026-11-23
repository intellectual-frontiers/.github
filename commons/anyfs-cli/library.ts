// Spec: 0001-anyfs-cli-layers FR-001
/**
 * The manifest of the AnyFS command line, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs, and a member of the family of AnyFS as a plugin (commons 0033-kanon FR-019
 * to FR-024): it extends `@intellectual-frontiers/anyfs` and reaches it, and its sibling plugins, only through their exports. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared
 * checker of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "anyfs-cli",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified but not released until the first consumers, the fleet store and the servers, run on it", missing: ["its first consumers, the fleet store and the servers"], liftedWhen: "the first consumers, the fleet store and the servers, run on it" },
  exports: [".", "./governance", "./logical", "./physical"],
  family: { host: "anyfs", role: "plugin" },
  versionConstants: [{ file: "src/governance/version.ts", name: "ANYFS_CLI_VERSION" }],
  summary:
    "The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check, merge, sync-medium), `serve` (WebDAV) and the keys of signed merges (keygen, roster) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-cli",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/headless", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        mayImport: ["src/governance/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "merge"] },
          { name: "@intellectual-frontiers/anyfs-bridge", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-posix", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs-bridge", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs-posix", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs-ssh", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs-serve", subpaths: ["governance", "physical"] },
          { name: "@intellectual-frontiers/headless", subpaths: "any" },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args", "commands"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      { folder: "src/", own: true, files: ["mod.ts", "anyfs.ts"] },
      { folder: "bin/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
