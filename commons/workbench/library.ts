// Spec: 0001-workbench-layers FR-001
/**
 * The manifest of Workbench, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "workbench",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: [".", "./governance", "./logical", "./physical", "./dialects/claude-code", "./dialects/codex", "./dialects/human"],
  family: { host: "workbench", role: "host" },
  summary: "The workbench: what a human or an agent needs to do their job with a repository, declared as a contract made of contributions from the units that need things, checked by one command and projected for each harness and for a human, so that a task installs only what it runs.",
  kanon: {
    package: "@intellectual-frontiers/workbench",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/workbench", subpaths: ["governance"] }] },
      {
        folder: "src/physical/dialects/",
        layer: "physical",
        instances: true,
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/physical/dialects/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance", "logical", "dialects/claude-code", "dialects/codex", "dialects/human"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
