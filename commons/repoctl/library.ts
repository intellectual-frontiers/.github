// Spec: 0001-repoctl-layers FR-001
/**
 * The manifest of Repoctl, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon
 * FR-010), which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`. Registering a library is a folder with a manifest like this one; this repository's specification of the
 * libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "repoctl",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  versionConstants: [{ file: "src/governance/version.ts", name: "REPOCTL_VERSION" }],
  summary:
    "The operations program of this repository, `repoctl`: one command that makes the generated files in dependency order and checks them, merges without hand-resolving a generated file, runs every check in one calm report, tells the version of each library in the repository, on npm and in its tag, plans and publishes a release behind a typed confirmation, scaffolds a library, makes the commit with its identity and trailers, and says what is wrong with a checkout, in the layers of Kanon on Headless, with a tool server by audience tier.",
  kanon: {
    package: "@intellectual-frontiers/repoctl",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical"] }],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/headless", subpaths: "any" },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args", "commands"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/libraries", subpaths: ["libraries", "family", "license", "releasing", "link", "affected", "workflows/definitions"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/net", subpaths: ["serve"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "bin/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
