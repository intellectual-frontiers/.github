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
  version: "0.2.8",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  versionConstants: [{ file: "src/governance/version.ts", name: "REPOCTL_VERSION" }],
  summary:
    "The operations program, `repoctl`, of any repository: a generic host driven by the typed `repoctl.config.ts` at the repository's root. It makes the generated files in dependency order and checks them, merges without hand-resolving a generated file, runs every named check in one calm report, makes the commit with the repository's identity and trailers, and says what is wrong with a checkout; where the configuration turns them on it also tells the version of each library in the repository, on npm and in its tag, plans and publishes a release behind a typed confirmation, scaffolds a library, proves a change by its blast radius and builds, checks and serves the documentation site, in the layers of Kanon on Headless, with a tool server by audience tier.",
  kanon: {
    package: "@intellectual-frontiers/repoctl",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/catalog", "aide/guard", "aide/relational", "aide/text"] }],
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
          { name: "@intellectual-frontiers/libraries", subpaths: ["libraries", "family", "license", "releasing", "link", "affected", "workflows/definitions", "ci/step", "ci/policy"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/net", subpaths: ["serve"] },
        ],
      },
      { folder: "src/", own: true, files: ["mod.ts", "repoctl.ts"] },
      { folder: "bin/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
