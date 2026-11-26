// Spec: 0001-telemetry FR-026
/**
 * The manifest of Telemetry, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "telemetry",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.7",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: [".", "./otel", "./otlp", "./signals", "./semconv", "./queue", "./envelope", "./exporter", "./render", "./query", "./host/query", "./host", "./host/otel", "./host/console", "./limits", "./retention", "./syslog", "./host/relay"],
  summary:
    "OpenTelemetry-native signals written from the specification itself: the data model, W3C Trace Context, OTLP/HTTP JSON, typed signals, a pure renderer of the console, and a host that exports, journals and shows them.",
  kanon: {
    package: "@intellectual-frontiers/telemetry",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: "any" },
          { name: "@intellectual-frontiers/crypto", subpaths: "any" },
          { name: "@intellectual-frontiers/formats", subpaths: "any" },
          { name: "@intellectual-frontiers/lang-sql", subpaths: "any" },
          { name: "@intellectual-frontiers/terminal", subpaths: "any" },
          { name: "@intellectual-frontiers/telemetry", subpaths: "any" },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: "any" },
          { name: "@intellectual-frontiers/formats", subpaths: "any" },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/telemetry", subpaths: "any" },
          { name: "node:async_hooks", subpaths: [] },
          { name: "node:net", subpaths: [] },
          { name: "node:fs", subpaths: [] },
          { name: "node:path", subpaths: [] },
          { name: "node:process", subpaths: [] },
          { name: "node:timers", subpaths: [] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
