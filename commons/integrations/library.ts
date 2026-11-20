// Spec: 0001-layers FR-008
/**
 * The manifest of Integrations, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs.
 *
 * @module
 */
export const library = {
  name: "integrations",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./http", "./transport", "./headless"],
  summary:
    "Integrations on one skeleton of Kanon layers (governance, logical, physical): connectors that observe the outside world read-only into observations and entities, and exchanges of messages and documents under standards and partner agreements, each standard a plugin package behind a typed codec port and a conformance suite.",
};
