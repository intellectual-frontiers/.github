// Spec: 0001-toolchain-layers FR-001
/**
 * The manifest of Toolchain, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon
 * FR-010), which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`. The dialects that obtain tools are packages of their own on the port of Archon.
 *
 * @module
 */
export const library = {
  name: "toolchain",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.1",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./ontology"],
  family: { host: "toolchain", role: "host" },
  summary:
    "Toolchain in the layers of Kanon: which programs a computer needs to do its work, declared once (a pinned version, a pin policy, a scope, the phase that needs it, and the bindings by which each dialect obtains it), resolved to the dialect that carries each out and planned; dialects are packages on the port of Archon.",
  kanon: {
    package: "@intellectual-frontiers/toolchain",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/archon", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/archon", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/physical/ontology/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/ontology", subpaths: ["supply-chain/downloads"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
