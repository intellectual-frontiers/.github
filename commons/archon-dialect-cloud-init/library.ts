// Spec: 0001-cloud-init-layers FR-001
/**
 * The manifest of the dialect of Archon for the unattended install of a machine, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a dialect (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon` and reaches it only through its exports, renders an order to the autoinstall data of one machine, and gives no step.
 *
 * @module
 */
export const library = {
  name: "archon-dialect-cloud-init",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them",
  exports: ["."],
  family: { host: "archon", role: "dialect" },
  summary: "The dialects of Archon for the unattended install of a machine from nothing: they render an order to Ubuntu's autoinstall user-data and meta-data (no secret in it, a blank-disk guard first, key-only sign-in) or to a Debian preseed from the same facts, and the script that converges the machine from its signed repository.",
  kanon: {
    package: "@intellectual-frontiers/archon-dialect-cloud-init",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
