// Spec: 0001-layers FR-001, FR-009, FR-012; 0003-governance FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009; 0005-naming FR-001, FR-002; 0044-issues FR-001
/**
 * The public surface of governance (`@intellectual-frontiers/data/governance`), the first layer: a business domain (concepts, attributes, relationships, code lists), what must be true
 * of its data (annotations of the kinds a vocabulary defines), the identity of every element, the graph they make, and lint. It names no database; the logical schema is made from it.
 * Annotation kinds of each vocabulary are under their own names (`privacy`, `security`, ...), so that two vocabularies never share one.
 *
 * @module
 */
export {
  type Annotated,
  type Annotation,
  type AnnotationKind,
  type AnnotationName,
  annotate,
  annotationKind,
  annotationsOf,
} from "./annotation.ts";
export { type AnyCodeList, type CodeList, type CodeListSpec, type CodeSpec, codeList } from "./codelist.ts";
export {
  type AppliesTo,
  canMove,
  checkIssueMoves,
  checkIssueSet,
  type Evidence,
  type IssueGoal,
  isLive,
  type Issue,
  issue,
  type IssueFinding,
  type IssueRule,
  type IssueSet,
  issueSet,
  type IssueSpec,
  type Link,
  liveIssues,
  MOVES,
  type IssuePriority,
  type IssueSeverity,
  type IssueSize,
  STATUS_KINDS,
  type Status,
  type StatusKind,
} from "./issue.ts";
export { type ComposeError, composeModules, defineModule, type Module, moduleOf, type ModuleSpec, withRequired } from "./module.ts";
export {
  binary,
  type BinaryType,
  boolean,
  type BooleanType,
  codeOf,
  type CodeType,
  type Datatype,
  date,
  type DateType,
  decimal,
  type DecimalType,
  describeDatatype,
  identifier,
  type IdentifierType,
  instant,
  type InstantType,
  integer,
  type IntegerType,
  structured,
  vector,
  type VectorType,
  type StructuredType,
  text,
  type TextType,
} from "./datatype.ts";
export { type Words } from "./names.ts";
export { type Edge, type EdgeKind, type Element, elementsOf, type TraceGraph, traceGraph } from "./elements.ts";
export { attributeId, codeId, codeListId, conceptId, domainId, type ElementId, type ElementKind, relationshipId } from "./id.ts";
export { coreRules, lint } from "./lint.ts";
export { type Input, type InputType, lintOperations, operation, type Operation, type OperationRule, type OperationSpec } from "./operation.ts";
export { NAME, words } from "./names.ts";
export {
  type Attribute,
  type AttributeOptions,
  type Attrs,
  type AnyConcept,
  attribute,
  type Cardinality,
  type Concept,
  type ConceptSpec,
  concept,
  domain,
  type Domain,
  type DomainError,
  type DomainSpec,
  type Multiplicity,
  membersOf,
  type Relationship,
  type RelationshipOptions,
  relationship,
  resolve,
  type Rels,
  type Target,
} from "./model.ts";
export {
  type Finding,
  finding,
  type LintRule,
  type Severity,
  type Vocabulary,
  vocabulariesFrom,
  vocabularyExtension,
  vocabularyPoint,
} from "./vocabulary.ts";
export * as vocabularies from "./vocabularies/mod.ts";
export { defaultVocabularies } from "./vocabularies/mod.ts";
