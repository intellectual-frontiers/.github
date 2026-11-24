// Spec: 0001-netboot-layers FR-001
/**
 * The manifest of Netboot, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "netboot",
  group: "lab",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The network boot of a blank machine: the TFTP and HTTP servers that PXE firmware and Ubuntu's installer speak, the GRUB menus, the pinned boot files, the arming of a host for one install, the blank-disk guard's decision, and the install's progress.",
  kanon: {
    package: "@intellectual-frontiers/netboot",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/netboot", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/netboot", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }, { name: "node:crypto", subpaths: [] }, { name: "node:dgram", subpaths: [] }, { name: "node:fs", subpaths: [] }, { name: "node:http", subpaths: [] }, { name: "node:net", subpaths: [] }, { name: "node:stream", subpaths: [] }, { name: "node:stream/promises", subpaths: [] }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
