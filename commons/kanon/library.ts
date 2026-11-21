// Spec: 0001-kanon-checker FR-008
/**
 * The manifest of Kanon, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "kanon",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.3.4",
  distribution: ["github", "npm"],
  exports: [".", "./check", "./host"],
  summary:
    "Kanon, the pattern of a library built in three layers (governance, logical, physical): the type of a library's table of layers, the import check that holds it, the check that no annotation of governance is dropped (for each instance), the instances, plugins and family of a host and the check of the packages that extend it, the matrix of requirement by instance, and the types-only LayeredModel contract; one rule, projected down, nothing lost.",
};
