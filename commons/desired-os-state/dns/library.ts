// Spec: 0001-dns-layers FR-001
/**
 * The manifest of the plugin that gives `desired-os-state` its verbs for convergence, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Desired OS State as a plugin (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/desired-os-state`, which declares its noun `dns`, and reaches it and Headless only through their exports. A fleet gives it its dialect and says, for each asset,
 * what must be true of it and how to reach it.
 *
 * @module
 */
export const library = {
  name: "desired-os-state-dns",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: ["."],
  family: { host: "desired-os-state", role: "plugin" },
  summary:
    "The plugin of `desired-os-state` for DNS: `desired-os-state dns plan|apply` over the provider a fleet chose, which reads the records of a zone, plans what the profile wants (changing only the records it claims), shows the plan with its hash and applies exactly the plan that was approved, then shows that the next plan is empty.",
  kanon: {
    package: "@intellectual-frontiers/desired-os-state-dns",
    extends: "@intellectual-frontiers/desired-os-state",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
