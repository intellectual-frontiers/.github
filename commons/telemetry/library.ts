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
  distribution: ["github", "npm"],
  exports: [".", "./otel", "./otlp", "./signals", "./semconv", "./queue", "./envelope", "./render", "./query", "./host/query", "./host", "./host/otel", "./host/console"],
  summary:
    "OpenTelemetry-native signals written from the specification itself: the data model, W3C Trace Context, OTLP/HTTP JSON, typed signals, a pure renderer of the console, and a host that exports, journals and shows them.",
};
