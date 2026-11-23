// Spec: 0001-content-collector FR-001
/** The manifest of the Content library. @module */
export const library = {
  name: "content",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./rendition"],
  summary: "Collects governed claims and their evidence into a checked model for publication.",
  family: { host: "content", role: "host" },
  kanon: {
    package: "@intellectual-frontiers/content",
    family: { dialect: "{host}-rendition-{name}", plugin: "{host}-{name}", scope: "any" },
    units: [
      { folder: "src/governance/", layer: "governance", packages: [] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/kanon", subpaths: [] }] },
      { folder: "src/physical/rendition/", layer: "physical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/kanon", subpaths: [] }] },
      { folder: "src/", own: true, files: ["mod.ts"] },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
