// Spec: 0001-dns-layers FR-001
/**
 * The manifest of the plugin that gives `archon` its verbs for convergence, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a plugin (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon`, which declares its noun `dns`, and reaches it and Headless only through their exports. A fleet gives it its dialect and says, for each asset,
 * what must be true of it and how to reach it.
 *
 * @module
 */
export const library = {
  name: "archon-dns",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the archon libraries together, when the first fleet runs on them" },
  exports: ["."],
  family: { host: "archon", role: "plugin" },
  summary:
    "The plugin of `archon` for DNS: `archon dns plan|apply` over the provider a fleet chose, which reads the records of a zone, plans what the profile wants (changing only the records it claims), shows the plan with its hash and applies exactly the plan that was approved, then shows that the next plan is empty.",
  kanon: {
    package: "@intellectual-frontiers/archon-dns",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
