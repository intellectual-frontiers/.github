// Spec: 0001-ontologies FR-001
/**
 * The manifest of Ontology, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun ts/mizan/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "ontology",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.3",
  distribution: ["github", "npm"],
  exports: [
    ".",
    "./audit",
    "./audit/packaging",
    "./ifccm",
    "./ifccm/ifccm",
    "./ifqs",
    "./ifqs/ifqs",
    "./ifr",
    "./ifr/audit",
    "./ifr/ifr",
    "./mizan",
    "./mizan/mizan",
    "./standards/nist-sp-800-53/controls.auto",
    "./supply-chain/packaging",
    "./supply-chain/packaging/families",
    "./supply-chain/packaging/managers",
    "./supply-chain/packaging/packaging",
    "./supply-chain/packaging/pins",
    "./supply-chain/packaging/programs",
    "./supply-chain/packaging/record",
    "./supply-chain/packaging/rules",
    "./supply-chain/packaging/schema.auto",
  ],
  summary:
    "The ontologies of Intellectual Frontiers Commons as typed TypeScript values over the RDF of the library `rdf`: Mizan, IFCCM, IFQS, IFR, the audit of packaging and the software supply chain, each with its classes, properties, code lists and decisions.",
};
