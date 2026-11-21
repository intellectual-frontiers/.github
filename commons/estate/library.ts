// Spec: 0001-estate-layers FR-001
/**
 * The manifest of Estate, a library of commons (commons 0027-commons-libraries FR-012) in the layers of Kanon (commons 0033-kanon FR-010): the assets of an organization, what each state of an asset
 * offers, what each is declared to be against what is observed of it, and which system owns each capability. Its name is reserved for the family of the library, which it hosts.
 *
 * @module
 */
export const library = {
  name: "estate",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the libraries of the fleet work together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  family: { host: "estate", role: "host" },
  summary:
    "Estate in the layers of Kanon: the assets of an organization (machines, services, accounts) as discovered, adopted or managed, the capabilities each state offers with the reason for each it does not, what each is declared to be against what is observed of it, and which system owns each capability, and the fleet store that keeps all of it as typed documents in a store of AnyFS: a host reached by SSH is the system of record, with a Git branch, a bucket or a folder as mirrors.",
  kanon: {
    package: "@intellectual-frontiers/estate",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "docs", "memory", "local"] },
          { name: "@intellectual-frontiers/anyfs-bridge", subpaths: ["governance", "mirror"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
