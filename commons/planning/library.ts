// Spec: 0001-planning-layers FR-001
/**
 * The manifest of Planning, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "planning",
  group: "planning",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./records", "./physical"],
  summary: "Planning content from many places as one item each with one stable id, its history as append-only events and its state a fold of them, with every act of an agent made on behalf of a person; sources are lenses over the places, and a write goes back in the place's own form.",
  kanon: {
    package: "@intellectual-frontiers/planning",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/records/",
        layer: "logical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/formats", subpaths: ["json5"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "merge"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/logical/records/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "local"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/formats", subpaths: ["json5"] },
          { name: "@intellectual-frontiers/githost", subpaths: "any" },
          { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical", "cli", "mcp"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance", "logical", "records"] },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      { folder: "src/", own: true, files: ["mod.ts", "planctl.ts"] },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
