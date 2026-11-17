/**
 * Mizan, the IF Spec Profile, in TypeScript (commons 0003-mizan): the capabilities of Mizan that are code. Today they are the rules it adds to the format of a
 * specification, as plugins (`rules.ts`), the standards rules about terms (the 90 days of a decision), the command that holds their findings against a baseline (`check.ts`), and the generator of its ontology's Turtle
 * (`generate-ontology.ts`), the proof register as OSCAL (`oscal-register.ts`) and the opt-in report of a standard newer than its pin (`newer.ts`). `integrations/` (commons 0019-mizan-integrations) brings outside vocabularies in (the first importer is built) and puts ours out (SHACL, JSON Schema, SKOS and SQL are built).
 *
 * @module
 */
export { BASELINE_COMMENTS, readSpecTexts } from "./check.ts";
export * as integrations from "./integrations/mod.ts";
export { digestOf, findingsOf, RUN, TURTLE_PATH, turtleOf } from "./generate-ontology.ts";
export { COMPONENT_FILE, registerDocuments, registerRows, RESULTS_FILE, type RegisterInput, type RegisterRow } from "./oscal-register.ts";
export { staleFindings, type Fetched, type LatestManifest } from "./newer.ts";
export { daysBetween, GRACE_DAYS, termFindings, type BasisKind, type TermRecord } from "./standards.ts";
export {
  authorityCitation,
  type AuthorityRecord,
  commonsAuthorities,
  earsPatternOf,
  type EarsPattern,
  type MizanFinding,
  type MizanRule,
  mizanFindings,
  requirementEars,
  requirementKeyword,
  type RulePlugin,
  rulePlugins,
  scenarioForm,
  type SpecText,
  standardsConsidered,
} from "./rules.ts";
