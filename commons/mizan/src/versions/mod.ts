/**
 * The `versions` tool (commons 0026-works-versioning): the pure core (the typed record of a work, the schemes of version, the version check, the ledger of releases, the release notes, the citation
 * file, the release gate and the rule plugin) and the host layer that reads and writes Git. The command is `../versions.ts`.
 *
 * @module
 */
export { citationOf, CITATION_MESSAGE, identifierOf } from "./cite.ts";
export { isReleaseTier, releaseGate, tierAtLeast, type GateOutcome } from "./gate.ts";
export {
  editionsNeeded,
  isAncestorIn,
  judgeWorks,
  recordFindings,
  versionProblems,
  workFiles,
  type CheckInput,
  type EditionFacts,
  type ReadRecord,
  type TreeFacts,
} from "./judge.ts";
export {
  addDuration,
  lastRelease,
  ledgerJson,
  ledgerText,
  readEarlier,
  readLedger,
  splitTag,
  tagNameOf,
  type EarlierEntry,
  type LedgerEntry,
  type LedgerInput,
  type TagFact,
} from "./ledger.ts";
export { impactOf, impactOfCommits, notesOf, type CommitFact, type NotesInput } from "./notes.ts";
export { versionsPlugin, type WorkFile } from "./plugin.ts";
export {
  CITATION_FILE,
  decodeRelease,
  decodeReleaseSource,
  kindProblem,
  RECORD_FIELDS,
  RECORD_FILE,
  releaseSource,
  slugOf,
  type Approval,
  type Author,
  type Migration,
  type Release,
  type Retired,
  type Slug,
  type Snapshot,
} from "./record.ts";
export { formatFinding, sortFindings, VERSIONS_RULES, type VersionsFinding, type VersionsRule } from "./rules.ts";
export { readWorks } from "./scan.ts";
export {
  commit8Of,
  companionOf,
  compareVersions,
  editionAt,
  formatVersion,
  greaterImpact,
  IMPACTS,
  isScheme,
  isWorkKind,
  nextSemVer,
  parseVersion,
  SCHEMES,
  schemeOf,
  utcDay,
  WORK_KINDS,
  type EditionOrder,
  type Impact,
  type ParsedVersion,
  type Scheme,
  type WorkKind,
} from "./scheme.ts";
export { filesOf, folderOf, isUnder, recordPathOf, scopeOf, workFolders } from "./works.ts";
