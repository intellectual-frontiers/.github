// Spec: 0001-headless-layers FR-008
/**
 * The manifest of Headless, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun ts/mizan/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "headless",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.4.2",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./cli", "./targets/local", "./targets/ssh", "./ssh-inbound", "./otel", "./askpass", "./mcp", "./rest", "./describe"],
  summary:
    "Headless programs as one contract in layers: the governance of an action (kind, effect, audience, confirmation, problems, exit statuses, redaction), the logical layer (the command model, the typed outcome, the closing block, JSON and SARIF, explain, hints, nested runs) and the command-line surface (calm output, prompts, the run log, signals, help, completions, man pages), with composition of a host and plugins into one program, audience tiers, a credential prompt port, plan-versus-apply execution with a signable plan hash, a tool server and a REST skeleton generated from governance, and an OpenTelemetry adapter of its own.",
  kanon: {
    package: "@intellectual-frontiers/headless",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args", "commands"] },
        ],
      },
      {
        folder: "src/surfaces/cli/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/terminal", subpaths: "any" },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      {
        folder: "src/surfaces/ssh-inbound/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }],
      },
      {
        folder: "src/surfaces/askpass/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      {
        folder: "src/surfaces/mcp/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      {
        folder: "src/surfaces/rest/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [],
      },
      {
        folder: "src/targets/local/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      {
        folder: "src/targets/ssh/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/terminal", subpaths: ["args"] },
        ],
      },
      {
        folder: "src/otel/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/surfaces/cli/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/telemetry", subpaths: "any" },
        ],
      },
      {
        folder: "src/describe/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/surfaces/mcp/", "src/surfaces/rest/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/kanon", subpaths: [] },
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
