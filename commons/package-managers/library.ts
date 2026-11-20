// Spec: 0001-package-managers-layers FR-001
/**
 * The manifest of the shared kit of the dialects that drive a package manager, a library of commons (commons 0027-commons-libraries FR-012). Its `kanon` field is the table of its layers (commons 0033-kanon
 * FR-010), which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`. It is no dialect: the dialects of Homebrew, apt, WinGet and mise are packages of their own that use it.
 *
 * @module
 */
export const library = {
  name: "package-managers",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  summary:
    "The shared kit of the dialects that drive a package manager for Archon and Toolchain: the commands of the packaging ontology as argument vectors (no shell), the exact version written as each manager writes it, the jobs a tool asks of a manager, the plan file, the observation of what is installed, and the dialect made from a manager's data.",
  kanon: {
    package: "@intellectual-frontiers/package-managers",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/archon", subpaths: ["governance", "dialect"] },
          { name: "@intellectual-frontiers/toolchain", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: ["proc", "fs", "path"] },
          { name: "@intellectual-frontiers/archon", subpaths: ["governance", "logical", "dialect"] },
          { name: "@intellectual-frontiers/toolchain", subpaths: ["logical"] },
          { name: "@intellectual-frontiers/ontology", subpaths: ["supply-chain/commands"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
