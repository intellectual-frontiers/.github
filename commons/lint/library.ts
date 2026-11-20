/**
 * The manifest of Lint, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun ts/mizan/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * Spec: 0001-lint FR-010
 *
 * @module
 */
export const library = {
  name: "lint",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.1",
  distribution: ["github", "npm"],
  exports: [".", "./rule", "./test-rule"],
  summary:
    "The lint plugin of Intellectual Frontiers in the ESLint plugin format that bun lint --plugin loads: the rules every harness wants, the typed way to define a rule of its own and the way to run a rule against code in a test.",
};
