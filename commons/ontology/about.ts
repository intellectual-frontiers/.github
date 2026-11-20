// Spec: 0001-ontologies FR-001
/**
 * The typed facts of Ontology, an independent library of commons (commons 0027-commons-libraries): The ontologies of Intellectual Frontiers Commons, stated once as strongly typed TypeScript (commons 0012-ontology): Mizan (mz), IFCCM, IFQS, IFR, the audit of p Its specification is in its own spec kit (`spec-kit/`, `0001-ontologies`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Ontology. */
export const about: About = {
  title: "Ontology",
  summary:
    "The ontologies of Intellectual Frontiers Commons, stated once as strongly typed TypeScript (commons 0012-ontology): Mizan (mz), IFCCM, IFQS, IFR, the audit of packaging and the software supply chain, with the data of the standards they cite. Every other library reads them by package name; the generators of Turtle, RDF/XML, SHACL and JSON Schema are the repository's. It depends on core and rdf. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The ontologies of Intellectual Frontiers Commons as typed values: Mizan, IFCCM, IFQS, IFR, the audit of packaging and the software supply chain, each a folder with a `mod.ts`, and the data of the standards they cite.",
      mayImport: ["src/", "core and rdf, by package name"],
    },
    {
      path: "suite/",
      what: "The tests.",
      mayImport: ["src/", "the libraries it depends on and the library `test`, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
