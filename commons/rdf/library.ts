// Spec: 0001-rdf FR-008
/**
 * The manifest of RDF, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "rdf",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.5",
  distribution: ["github", "npm"],
  exports: ["."],
  summary:
    "RDF as algebraically typed values: branded IRIs, namespaces, typed vocabularies, class schemas, code lists, and the writers of N-Triples, N-Quads, canonical Turtle and JSON-LD, with no host.",
};
