// Spec: 0001-integrations-layers FR-008
/**
 * The manifest of Integrations, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table
 * of its layers (commons 0033-kanon FR-010), which the shared checker of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "integrations",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.1",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./http", "./transport", "./headless"],
  summary:
    "Integrations on one skeleton of Kanon layers (governance, logical, physical): connectors that observe the outside world read-only into observations and entities, and exchanges of messages and documents under standards and partner agreements, each standard a plugin package behind a typed codec port and a conformance suite.",
  kanon: {
    package: "@intellectual-frontiers/integrations",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/http/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/net", subpaths: ["http-client"] },
        ],
      },
      {
        folder: "src/physical/transport/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/net", subpaths: ["http-client"] },
        ],
      },
      {
        folder: "src/surfaces/headless/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/physical/transport/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/headless", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
