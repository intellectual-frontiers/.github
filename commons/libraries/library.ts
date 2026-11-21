/**
 * The manifest of Libraries, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * Spec: 0001-libraries FR-010
 *
 * @module
 */
export const library = {
  name: "libraries",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.5.9",
  distribution: ["github", "npm"],
  exports: [
    ".",
    "./affected",
    "./changes",
    "./check",
    "./dev",
    "./family",
    "./generate-ontology",
    "./generate-workflows",
    "./libraries",
    "./license",
    "./link",
    "./metapackages",
    "./newer",
    "./oscal-register",
    "./pack",
    "./pack-metapackage",
    "./pins",
    "./releasing",
    "./plan",
    "./publish-ontology",
    "./readme",
    "./versions",
    "./workflows",
    "./workflows/definitions",
    "./workflows/model",
    "./workflows/render",
  ],
  summary:
    "The libraries of a repository of commons as code: the manifest of a library and the checks of it, which libraries a change affects, the typed GitHub Actions workflows and their generator, the pinned Bun, the packer of a library for npm with its declarations, and the commands that hold a repository to Mizan.",
};
