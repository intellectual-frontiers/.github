// Spec: 0001-test FR-007
/**
 * The manifest of Test, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun ts/mizan/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "test",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.2",
  distribution: ["github", "npm"],
  exports: [".", "./record"],
  summary:
    "Tests that run unchanged under bun test and node --test and are recorded as evidence by their own code: the assertions under short plain names, proves (which names the requirements a test proves), only, steps, and the record of every test as an OpenTelemetry span and log record on the installation record.",
};
