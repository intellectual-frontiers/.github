// Spec: 0001-tool-layers FR-001
/**
 * The manifest of the plugin that gives `archon` its verbs for tools, a library of commons (commons 0027-commons-libraries FR-012) and a member of the family of Archon as a plugin (commons 0033-kanon
 * FR-019 to FR-024): it extends `@intellectual-frontiers/archon`, which declares its noun `tool`, and reaches it, Toolchain and Headless only through their exports. A fleet gives it its catalog of tools and
 * the dialects it prefers, because which tools a fleet needs and how it obtains them are the fleet's.
 *
 * @module
 */
export const library = {
  name: "archon-tool",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: ["."],
  family: { host: "archon", role: "plugin" },
  summary:
    "The plugin of `archon` for tools: `archon tool list|show|ensure|doctor|clean` over a catalog of tools and the dialects a fleet chose, with the plan of what would change before anything is installed and the same approval as any other change.",
  kanon: {
    package: "@intellectual-frontiers/archon-tool",
    extends: "@intellectual-frontiers/archon",
    units: [
      { folder: "src/", layer: "physical" },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
