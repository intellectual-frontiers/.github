// Spec: 0001-anyfs-layers FR-001
/**
 * The manifest of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) in the layers of Kanon (commons 0033-kanon FR-010): one typed interface to the places bytes live (a folder, a
 * Git repository, a host reached by SSH, a bucket, a drive, a database), with revisions on every read and write, capabilities in the type of a store, and layers that compose. Its name is reserved
 * for the family of the library, whose backends are plugins named `anyfs-<noun>`.
 *
 * @module
 */
export const library = {
  name: "anyfs",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "new: built and verified but not released until the first consumer, the fleet store, runs on it",
  exports: [".", "./governance", "./logical", "./physical", "./layers", "./conformance", "./memory", "./local", "./docs", "./docs/formats"],
  family: { host: "anyfs", role: "host" },
  summary:
    "One typed interface to every place bytes live: paths and places as types, a revision on every read and a stated expectation on every write, the capabilities of a store in its type so that code needing one cannot be given a store without it, attenuation, mounts, composable layers and one conformance suite that every backend passes.",
  kanon: {
    package: "@intellectual-frontiers/anyfs",
    family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}" },
    instances: [],
    plugins: [{ noun: "bridge" }, { noun: "ssh" }],
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }],
      },
      {
        folder: "src/docs/formats/",
        layer: "logical",
        mayImport: ["src/docs/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/formats", subpaths: ["json5", "yaml"] },
        ],
      },
      {
        folder: "src/docs/",
        layer: "logical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }],
      },
      {
        folder: "src/physical/memory/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
        ],
      },
      {
        folder: "src/physical/local/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/system", subpaths: ["fs", "path", "lock", "errors"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/physical/memory/", "src/physical/local/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/telemetry", subpaths: [] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
