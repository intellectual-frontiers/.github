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
  version: "0.2.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./cli", "./targets/local", "./targets/ssh", "./ssh-inbound", "./otel"],
  summary:
    "Headless programs as one contract in layers: the governance of an action (kind, effect, audience, confirmation, problems, exit statuses, redaction), the logical layer (the command model, the typed outcome, the closing block, JSON and SARIF, explain, hints, nested runs) and the command-line surface (calm output, prompts, the run log, signals, help, completions, man pages), with an OpenTelemetry adapter of its own.",
};
