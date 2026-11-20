/**
 * Mizan, the IF Spec Profile, as code (commons 0003-mizan): the rules a specification is held to as plugins of one harness (`rules.ts`, `harness.ts`), the levels of conformance (`levels.ts`), the standards rules about
 * terms (`standards.ts`, `spec-terms.ts`), the integrations of standards (`integrations/`, commons 0019-mizan-integrations), the change-control rules (`changes/`, commons 0020-ifccm) and the release rules (`versions/`,
 * commons 0026-works-versioning) as plugins of the same harness, the trace of requirements to code and tests and the layers of a ladder (`trace.ts`, `layers.ts`, commons 0015-trace), The commands that need the whole repository (`check`, `versions`, `changes`, `libraries`, the generators of ontologies and the register) are the repository's.
 *
 * @module
 */
export { BASELINE_COMMENTS, readSpecTexts } from "./spec-files.ts";
export { holdHarness, type HarnessInput } from "./harness.ts";
export { DEFAULT_LEVEL, entailedBy, LEVELS, type LevelKey, levelOf, ruleRunsAt } from "./levels.ts";
export { definitionsOf, type KnownTerms, specTermFindings, termDefinedByFindings, type TermDefinitions } from "./spec-terms.ts";
export * as integrations from "./integrations/mod.ts";
export * as changes from "./changes/mod.ts";
export * as versions from "./versions/mod.ts";
export { readWorks } from "./versions/scan.ts";
export type { WorkFile } from "./versions/plugin.ts";
export { basisMissing, daysBetween, GRACE_DAYS, termFindings, type BasisKind, type TermRecord } from "./standards.ts";
export {
  authorityCitation,
  type AuthorityRecord,
  commonsAudienceProfiles,
  commonsAuthorities,
  commonsSubjectProfiles,
  declaredIn,
  earsPatternOf,
  type EarsPattern,
  type MizanFinding,
  type MizanRule,
  MIZAN_RULES,
  mizanFindings,
  type ProfileRecord,
  profileKind,
  profileSections,
  requirementEars,
  requirementKeyword,
  type RulePlugin,
  rulePlugins,
  scenarioForm,
  type SpecText,
  standardsConsidered,
} from "./rules.ts";
export * as trace from "./trace.ts";
export * as layers from "./layers.ts";
