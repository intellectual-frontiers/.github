// Spec: 0001-desired-os-state-layers FR-001
/**
 * The manifest of Desired OS State, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon
 * FR-010) and the family it hosts (FR-019 to FR-024): the dialects, one package each, and the plugins of the command `desired-os-state`. The shared checker of `@intellectual-frontiers/kanon` holds
 * the table in `verify`.
 *
 * @module
 */
export const library = {
  name: "desired-os-state",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.6",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./dialect", "./cli"],
  family: { host: "desired-os-state", role: "host" },
  summary:
    "Desired OS State in the layers of Kanon: what a server, a device, a workstation or a cloud account must be, said once as requirements, the order and the plan made from them, and the port that a package for each tool (Ansible, OpenTofu, Microsoft DSC) implements; assurance profiles match the approval of a change to the fleet.",
  kanon: {
    package: "@intellectual-frontiers/desired-os-state",
    family: { dialect: "{host}-{name}", plugin: "{host}-{name}" },
    instances: [
      { name: "pinned-downloads", instanceOf: "src/physical/dialect/", placement: "package" },
      { name: "ansible", instanceOf: "src/physical/dialect/", placement: "package" },
      { name: "opentofu", instanceOf: "src/physical/dialect/", placement: "package" },
    ],
    plugins: [{ noun: "tool" }, { noun: "dns" }],
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance", "forms/reconcile"] },
        ],
      },
      {
        folder: "src/physical/dialect/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/headless", subpaths: ["logical"] },
        ],
      },
      {
        folder: "src/physical/cli/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical", "cli"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
