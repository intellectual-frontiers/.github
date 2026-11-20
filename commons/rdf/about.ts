// Spec: 0001-rdf FR-008
/**
 * The typed facts of RDF, an independent library of commons (commons 0027-commons-libraries): RDF as typed values and its writers, with no host. Its specification is in its own spec kit (`spec-kit/`,
 * `0001-rdf`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** RDF. */
export const about: About = {
  title: "RDF",
  summary:
    "RDF as algebraically typed values: IRIs branded once checked, namespaces, typed vocabularies (RDF, RDFS, OWL, XSD, SKOS, Dublin Core terms, PROV-O, SHACL), class schemas whose individuals' types are derived, " +
    "code lists, the checks a type cannot state, and the writers of N-Triples, N-Quads, canonical Turtle and expanded JSON-LD. It reads no syntax, names no host global and runs wherever ECMAScript does. " +
    "Published to npm as compiled modules with their declarations; it depends on Core alone.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "The modules, and `mod.ts`, the one entry of the package.", mayImport: ["src/", "core, by package name"] },
    {
      path: "suite/",
      what: "The tests: examples, fast-check properties for the writers, and the type-level tests of individuals.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
