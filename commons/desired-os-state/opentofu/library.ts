// Spec: 0001-opentofu-layers FR-001
/**
 * The manifest of the dialect of Desired OS State for cloud resources with OpenTofu, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Desired OS State as a dialect (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/desired-os-state` and reaches it only through its exports, renders an order of cloud resources to a configuration, gives the steps that init, plan and apply the saved plan, and runs nothing.
 *
 * @module
 */
export const library = {
  name: "desired-os-state-opentofu",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the desired-os-state libraries together, when the first fleet runs on them" },
  exports: ["."],
  family: { host: "desired-os-state", role: "dialect" },
  summary: "The dialect of Desired OS State for cloud resources with OpenTofu: it renders an order of cloud-resource requirements to a JSON configuration with pinned providers and no credential, the state kept outside the repository, and the steps that init, plan to a saved plan and apply exactly that plan. It renders and says what to run; it runs nothing.",
  kanon: {
    package: "@intellectual-frontiers/desired-os-state-opentofu",
    extends: "@intellectual-frontiers/desired-os-state",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
