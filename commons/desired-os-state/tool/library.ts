// Spec: 0001-tool-layers FR-001
/**
 * The manifest of the plugin that gives `desired-os-state` its verbs for tools, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Desired OS State as a plugin (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/desired-os-state`, which declares its noun `tool`, and reaches it, Toolchain and Headless only through their exports. A fleet gives it its catalog of tools and
 * the dialects it prefers, because which tools a fleet needs and how it obtains them are the fleet's.
 *
 * @module
 */
export const library = {
  name: "desired-os-state-tool",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: ["."],
  family: { host: "desired-os-state", role: "plugin" },
  summary:
    "The plugin of `desired-os-state` for tools: `desired-os-state tool list|show|ensure|doctor|clean` over a catalog of tools and the dialects a fleet chose, with the plan of what would change before anything is installed and the same approval as any other change.",
  kanon: {
    package: "@intellectual-frontiers/desired-os-state-tool",
    extends: "@intellectual-frontiers/desired-os-state",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
