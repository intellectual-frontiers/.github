// Spec: 0001-githost FR-010
/**
 * The manifest of Githost, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "githost",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.7",
  distribution: ["github", "npm"],
  exports: [".", "./types", "./capabilities", "./remote", "./github", "./gitlab", "./git"],
  summary:
    "The Git hosts behind one typed interface: GitHub, GitLab (groups to any depth) and plain Git held to the same conformance tests, and the reading of a remote in any form a person writes it.",
};
