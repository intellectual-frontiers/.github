/**
 * IFC Mizan Integrations (commons 0019-mizan-integrations): the module that brings outside ontologies and schemas into Intellectual Frontiers' typed TypeScript form, and
 * turns ours into well-known forms. Built today: the typed integration record and its registry, the reader of Turtle and N-Triples, the importers of a slice of a
 * vocabulary and of an OSCAL control catalog, the command that runs them from a manifest (a file or a pinned URL, with PROV-O provenance), and the exporters of SHACL, JSON
 * Schema, SKOS and SQL. The other importers and exporters are specified and not yet built.
 *
 * @module
 */
export {
  GENERATOR,
  importVocabulary,
  type ImportInput,
  type ImportOutput,
  type ImportRecordData,
  type TermKind,
} from "./pure/import-vocabulary.ts";
export { readNTriples, readTurtle, type Read, type RdfTerm, type RdfTriple, tripleKey, TYPE } from "./pure/read-rdf.ts";
export {
  type AnySchema,
  type CodeMember,
  exportJsonSchema,
  exportJsonSchemaDefs,
  exportShacl,
  exportSkos,
  exportSqlCodeList,
} from "./pure/export.ts";
export {
  type Catalog,
  type Control,
  decodeCatalog,
  importOscalCatalog,
  OSCAL_GENERATOR,
  type OscalImportInput,
} from "./pure/import-oscal-catalog.ts";
export { provenanceTurtle } from "./pure/provenance.ts";
export { emptyRegistry, lookup, register, type Registry, type RegistryError } from "./pure/registry.ts";
export {
  type AnyIntegration,
  describeFinding,
  type Direction,
  type Format,
  type Integration,
  type IntegrationFinding,
  type StandardRecord,
} from "./pure/types.ts";
export { decodeManifest, type ImportManifest, isUrl, readModuleHeader, readSource } from "./host/import.ts";
