// Spec: 0001-kanon-checker FR-001
/**
 * Kanon, the pattern of a library built in three layers (commons 0033-kanon): Governance says what a thing is and what it may do, Logical is made from it, Physical carries it out; one rule,
 * projected down, nothing lost. This package holds the type of the table of a library's layers, the import check that holds the table, the check that no annotation of Governance is dropped,
 * and the types-only contract `LayeredModel` that a Kanon library gives to be documented and traced. It is a utility library of a single level and is not itself built in layers.
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
export { droppedFindings } from "./dropped.ts";
export {
  allowedExternal,
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
  SourceLocation,
  TraceEdge,
} from "./model.ts";
export { cliId, headlessId, mcpId, operandId, optionId, parseElementId, PROGRAM_KINDS, PROJECTION_KINDS, restId } from "./model.ts";
export {
  type Allowed,
  decodeTable,
  type FolderName,
  LAYERS,
  type Layer,
  type LayeredUnit,
  type OwnUnit,
  type PackageName,
  parseFolder,
  parsePackageName,
  RANK,
  type Table,
  type Unit,
} from "./table.ts";
