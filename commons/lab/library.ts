// Spec: 0001-lab-layers FR-001
/**
 * The manifest of Lab, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "lab",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "tests-only", reason: "a library of disposable machines that no program of ours depends on at run time" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Disposable machines for tests: a systemd and sshd container rendered from a typed description, started and removed per test with a throwaway key, and what a container can and cannot stand in for.",
  kanon: {
    package: "@intellectual-frontiers/lab",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/headless", subpaths: ["logical", "ssh-inbound", "targets/container"] }, { name: "@intellectual-frontiers/net", subpaths: ["tcp"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
