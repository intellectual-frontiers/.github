// Spec: 0001-system FR-006
/**
 * The manifest of System, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "system",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.5",
  distribution: ["github", "npm"],
  exports: [
    ".",
    "./errors",
    "./fs",
    "./path",
    "./dirs",
    "./lock",
    "./watch",
    "./discover",
    "./proc",
    "./git",
    "./compile",
    "./schedule",
    "./job-plan",
    "./tty",
    "./stdio",
  ],
  summary:
    "The host system as one typed library: files, paths and the folders of a program, one run at a time, file watching, programs found by prefix, processes and their streams, Git, a program built into one binary, the operating system's scheduled jobs and the standard streams; dependencies: core, formats and crypto.",
};
