// Spec: 0001-ergonex FR-001
/**
 * The manifest of Ergonex, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "ergonex",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.5.0",
  distribution: ["github", "npm"],
  exports: ["."],
  versionConstants: [{ file: "src/state-record.ts", name: "ERGONEX_VERSION" }],
  summary:
    "The workspaces management of Intellectual Frontiers: one command, `ergonex`, that sets up and operates a team's repositories, tools and shell on Windows, macOS and Linux, with its own specifications.",
};
