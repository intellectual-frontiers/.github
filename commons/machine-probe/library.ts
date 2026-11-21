// Spec: 0001-machine-probe-layers FR-001
/**
 * The manifest of Machine Probe, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "machine-probe",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the libraries of the fleet work together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The probe a machine runs for its fleet: the three read-only requests it answers (facts, version, one osquery SELECT), the key line that restricts a key to them, the facts as a typed observation, and the policy pack that judges an observation with its Secure Controls Framework controls.",
  kanon: {
    package: "@intellectual-frontiers/machine-probe",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["logical"] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
