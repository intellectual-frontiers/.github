// Spec: 0001-boot-layers FR-001
/**
 * The manifest of the plugin that gives `archon` its verbs for the network install of a blank machine, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a plugin (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon`, which declares its noun `boot`, and reaches it, Headless and `netboot` through their exports. A fleet gives it its dialects and says, for each asset, what to render and where.
 *
 * @module
 */
export const library = {
  name: "archon-boot",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them",
  exports: ["."],
  family: { host: "archon", role: "plugin" },
  summary:
    "The plugin of `archon` for the network install of a blank machine: `archon boot prepare|arm|disarm|status|serve`, which renders the machine's install and playbook (given the fleet's dialects) without a secret in them, says which asset a network boot may install and serves the boot over TFTP and HTTP from pinned files.",
  kanon: {
    package: "@intellectual-frontiers/archon-boot",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
