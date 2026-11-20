// Spec: 0001-core FR-007
/**
 * The manifest of Core, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "core",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.0",
  distribution: ["github", "npm"],
  exports: [".", "./about"],
  summary:
    "The foundation of commons: errors as values, exhaustive matching, branded types, decoders from unknown, pure text helpers, type-level tests, graphs of work and exact optional objects, with no dependency and no host.",
};
