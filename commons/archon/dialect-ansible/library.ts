// Spec: 0001-ansible-layers FR-001
/**
 * The manifest of the dialect of Archon that converges a Linux host with Ansible, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a dialect (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon` and reaches it only through its exports, renders an order and its plan to an inventory and a playbook of the modules of ansible-core, and gives the steps that check and apply.
 *
 * @module
 */
export const library = {
  name: "archon-dialect-ansible",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them" },
  exports: ["."],
  family: { host: "archon", role: "dialect" },
  summary: "The dialect of Archon that converges a Linux host with Ansible: it renders an order and its plan to an inventory and a playbook of the modules of ansible-core, gives the steps that check (with the difference) and apply, and says what it guarantees as data.",
  kanon: {
    package: "@intellectual-frontiers/archon-dialect-ansible",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
