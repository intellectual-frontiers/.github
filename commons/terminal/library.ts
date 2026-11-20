// Spec: 0001-terminal FR-006
/**
 * The manifest of Terminal, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "terminal",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.0",
  distribution: ["github", "npm"],
  exports: [".", "./args", "./commands", "./palette", "./vt", "./width"],
  summary:
    "The terminal as pure code: a typed command-line parser and command trees, the one palette of colour roles and marks, display width and cutting by columns, and a terminal emulator for snapshot tests, with no host.",
};
