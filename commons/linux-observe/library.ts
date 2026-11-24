// Spec: 0001-linux-observe-layers FR-001
/**
 * The manifest of Linux Observe, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "linux-observe",
  group: "linux",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "What a Linux machine is, read with no change: the resources that an Archon requirement declares (a package, a user, a group, a file, a directory, a service, an authorized key, a system setting) observed in the shape the requirement declares them, through any way of running a program.",
  kanon: {
    package: "@intellectual-frontiers/linux-observe",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/archon", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/linux-observe", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/archon", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["logical"] }, { name: "@intellectual-frontiers/linux-observe", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
