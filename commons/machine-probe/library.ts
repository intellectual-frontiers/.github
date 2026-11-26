// Spec: 0001-machine-probe-layers FR-001
/**
 * The manifest of Machine Probe, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "machine-probe",
  group: "lab",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The probe a machine runs for its fleet: the three read-only requests it answers (facts, version, one osquery SELECT), the key line that restricts a key to them, the facts as a typed observation, and the policy pack that judges an observation with the NIST SP 800-53 controls each gives evidence for.",
  kanon: {
    package: "@intellectual-frontiers/machine-probe",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/guard", "dialects/sqlite"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["logical"] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/telemetry", subpaths: ["otel", "otlp", "semconv"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["logical", "ssh-inbound", "targets/ssh"] }, { name: "@intellectual-frontiers/machine-probe", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }, { name: "node:fs/promises", subpaths: [] }, { name: "node:os", subpaths: [] }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
