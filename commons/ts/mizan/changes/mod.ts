/**
 * The `changes` check of IFCCM (commons 0020-ifccm): the pure core (the lines of a commit message, the sections of a capability's issue, the declaration and its phase, the findings, the chain from
 * an issue to a run, the view of capabilities by rung) and the host layer that reads Git and, with a client it is given, asks a Git host. The command is `../changes.ts`.
 *
 * @module
 */
export { namedIssues, parseMessage, type IssueRef, type ParsedMessage, type ReferenceKind, type WrongWord } from "./commit-message.ts";
export {
  doneWhenItems,
  doneWhenRequirements,
  parseIssueBody,
  requirementsIn,
  SECTIONS,
  sectionOf,
  sectionProblems,
  unticked,
  type CheckItem,
  type IssueBody,
  type Section,
  type SectionName,
  type SectionProblem,
} from "./issue-body.ts";
export {
  covers,
  dayOf,
  decodeDecisions,
  decodeDeclaration,
  decodeHarnessRecord,
  declarationProblem,
  formatRecordError,
  isRegulated,
  phaseOf,
  REGULATED_DOMAINS,
  relaxations,
  rungsRequired,
  type Day,
  type DecisionRecord,
  type Declaration,
  type DeclarationVersion,
  type HarnessRecord,
  type Phase,
  type RecordError,
  type RegulatedDomainName,
  type Relaxation,
} from "./declaration.ts";
export {
  CAPABILITY_LABEL,
  CHANGES_RULES,
  commitFindings,
  declarationFindings,
  relaxationFindings,
  ruleCases,
  STRICT_RULES,
  strictFindings,
  type ChangesFinding,
  type ChangesRule,
  type CommitFacts,
  type Context,
  type IssueAnswer,
  type RuleCase,
} from "./rules.ts";
export { declarationPlugin } from "./plugin.ts";
export {
  firstBreak,
  STAGES,
  traceLines,
  traceOf,
  type RunCase,
  type SpecSource,
  type Stage,
  type StageResult,
  type Trace,
  type TraceInput,
} from "./trace.ts";
export {
  BEGIN,
  decodeViewRecord,
  END,
  formatViewError,
  isProved,
  spliceView,
  viewIsCurrent,
  viewOf,
  type CapabilityRecord,
  type CommandRun,
  type RungRecord,
  type ViewError,
  type ViewRecord,
} from "./capability-view.ts";
export { declarationHistory, readRange } from "./git-log.ts";
export { askHost, NO_CLIENT, NO_HOST_API, type StrictOutcome } from "./strict.ts";
