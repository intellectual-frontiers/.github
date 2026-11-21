// Spec: 0001-docs FR-001
/**
 * The manifest of Docs, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "docs",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.3.1",
  distribution: ["github", "npm"],
  exports: [".", "./lens/layered", "./lens/program", "./lens/guides", "./lens/releases"],
  summary:
    "The generator of a repository's documentation site, made from its TypeScript and its spec kit alone: a typed configuration, an API reference for every export, the specifications with the tests that prove each requirement, lenses for layered models, programs, guides and releases, Markdown and JSON beside every page, presentations other than the site (the AsciiDoc of the volumes of a book of erga), and one command, ifc-docs, that builds or checks them.",
};
