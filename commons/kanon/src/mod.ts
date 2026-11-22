// Spec: 0001-kanon-checker FR-001
/**
 * Kanon, the pattern of a library built in three layers (commons 0033-kanon): Governance says what a thing is and what it may do, Logical is made from it, Physical carries it out; one rule,
 * projected down, nothing lost. This package holds the type of the table of a library's layers, the import check that holds the table, the check that no annotation of Governance is dropped,
 * the relations and the vocabulary of a model with their findings (`modelFindings`), the members of a family that are of another scope, the bundle of a model and its pure verification (`makeBundle`,
 * `verifyBundle`), and the types-only contract `LayeredModel` that a Kanon library gives to be documented and traced. It is a utility library of a single level and is not itself built in layers.
 *
 * @example
 * ```ts
 * import { decodeTable, importFindings } from "@intellectual-frontiers/kanon";
 * const t = decodeTable({ package: "@intellectual-frontiers/x", units: [{ folder: "src/governance/", layer: "governance" }] });
 * if (t.kind === "ok") importFindings(t.value, [], {}); // []
 * ```
 *
 * @module
 */
export { accountOf, type Cell, OUTCOMES } from "./account.ts";
export { type Bundle, type BundleFault, FILES as BUNDLE_FILES, MANIFEST as BUNDLE_MANIFEST, makeBundle, type VerifiedBundle, verifyBundle } from "./bundle.ts";
export { droppedFindings } from "./dropped.ts";
export { extensionFindings, roleOf, roleOfForeign } from "./extensions.ts";
export {
  classify,
  type FamilyRule,
  type InstanceName,
  type Member,
  memberPackage,
  type NameTemplate,
  parseInstanceName,
  parseNameTemplate,
  parsePluginNoun,
  type PluginNoun,
  rootPackage,
  splitPackage,
} from "./family.ts";
export { buildMatrix, cellText, type Matrix, type MatrixCell, type MatrixRow, matrixJson, matrixMarkdown, matrixTotals } from "./matrix.ts";
export {
  allowedExternal,
  type ExportsMap,
  escapesRoot,
  type Finding,
  familyOf,
  finding,
  importFindings,
  type Placed,
  resolveImport,
  RULE_SUMMARY,
  RULES,
  type Rule,
  type SourceFile,
  type Specifier,
  specifiersOf,
  unitOf,
} from "./imports.ts";
export type {
  AgreedKind,
  Disposition,
  ElementId,
  LayeredModel,
  ModelElement,
  ModelFinding,
  ModelLayer,
  ModelVocabulary,
  Relation,
  SourceLocation,
  TraceEdge,
} from "./model.ts";
export { cliId, headlessId, mcpId, operandId, optionId, parseElementId, PROGRAM_KINDS, PROJECTION_KINDS, restId } from "./model.ts";
export { modelFindings } from "./vocabulary.ts";
export {
  type Allowed,
  decodeTable,
  type ExtensionRole,
  type FolderName,
  type Instance,
  LAYERS,
  type Layer,
  type LayeredUnit,
  type OwnUnit,
  type PackageName,
  type Plugin,
  parseFolder,
  parsePackageName,
  RANK,
  type Table,
  type Unit,
} from "./table.ts";
