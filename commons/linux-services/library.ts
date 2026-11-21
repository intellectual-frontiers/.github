// Spec: 0001-linux-services-layers FR-001
/**
 * The manifest of Linux Services, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "linux-services",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The services a Linux machine runs, said as data: a PostgreSQL instance, a send-only mail relay, a certificate and a set of DNS records, each a profile that becomes the requirements of Archon (packages, files, directories and services), with the secret never in the model.",
  kanon: {
    package: "@intellectual-frontiers/linux-services",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/archon", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/linux-services", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/linux-services", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
