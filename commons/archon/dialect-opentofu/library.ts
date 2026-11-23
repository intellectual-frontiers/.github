// Spec: 0001-opentofu-layers FR-001
/**
 * The manifest of the dialect of Archon for cloud resources with OpenTofu, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a dialect (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon` and reaches it only through its exports, renders an order of cloud resources to a configuration, gives the steps that init, plan and apply the saved plan, and runs nothing.
 *
 * @module
 */
export const library = {
  name: "archon-dialect-opentofu",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them" },
  exports: ["."],
  family: { host: "archon", role: "dialect" },
  summary: "The dialect of Archon for cloud resources with OpenTofu: it renders an order of cloud-resource requirements to a JSON configuration with pinned providers and no credential, the state kept outside the repository, and the steps that init, plan to a saved plan and apply exactly that plan. It renders and says what to run; it runs nothing.",
  kanon: {
    package: "@intellectual-frontiers/archon-dialect-opentofu",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
