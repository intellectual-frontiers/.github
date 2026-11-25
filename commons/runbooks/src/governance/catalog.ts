// Spec: 0006-runbooks-split FR-002, FR-003, FR-004, FR-009
/**
 * The closed catalog of what can go wrong with a runbook. Each problem has one code, `E-RB-<CONCEPT>-<KIND>`, with the concept it belongs to, who may fix it (the agent, a person, the environment's owner or CI),
 * the one fix and whether it is a safety rule. A failure in no entry is `E-RB-UNKNOWN`, and meeting one is itself a finding: it is classified, given a check and a test and documented in one change. Every finding is an error.
 *
 * @example
 * ```ts
 * import { explain } from "./catalog.ts";
 * explain("E-RB-JUDGE-EFFECT").fixer; // "agent"
 * explain("E-RB-NOPE").code; // "E-RB-UNKNOWN"
 * ```
 *
 * @module
 */
import { FIXERS, type Fixer } from "@intellectual-frontiers/workbench/governance";

/** Who may fix a problem: the closed list of the workbench. */
export { FIXERS, type Fixer };

/** The concepts a problem belongs to: a closed list. */
export const PROBLEM_CONCEPTS = ["runbook", "step", "store", "judge", "workshop", "citation", "verb", "effect", "external", "gate", "check", "need", "harness"] as const;
/** One concept of a problem. */
export type ProblemConcept = (typeof PROBLEM_CONCEPTS)[number];

/** The codes of the catalog. */
export type CatalogCode =
  | "E-RB-RUNBOOK-MALFORMED"
  | "E-RB-STEP-IRREVERSIBLE-UNGUARDED"
  | "E-RB-STORE-NO-CHECKPOINT"
  | "E-RB-STORE-NOT-DETACHED"
  | "E-RB-JUDGE-EFFECT"
  | "E-RB-JUDGE-APPLIED"
  | "E-RB-WORKSHOP-NOT-DISPOSABLE"
  | "E-RB-CITATION-MISSING"
  | "E-RB-VERB-UNKNOWN"
  | "E-RB-VERB-INPUTS-INVALID"
  | "E-RB-EFFECT-EXCEEDS-VERB"
  | "E-RB-EXTERNAL-NO-KEY"
  | "E-RB-GATE-GUARDS-NOTHING"
  | "E-RB-CHECK-NOT-READ"
  | "E-RB-NEED-MISSING"
  | "E-RB-NEED-INSTALLER"
  | "E-RB-HARNESS-UNSUITABLE"
  | "E-RB-UNKNOWN";

/** One entry. `fix` may hold `{step}`, `{verb}`, `{store}`, `{dialect}` and `{lacks}`, filled by the finding. */
export type CatalogEntry = {
  readonly code: CatalogCode;
  readonly concept: ProblemConcept;
  readonly kind: string;
  readonly title: string;
  readonly what: string;
  readonly fixer: Fixer;
  readonly fix: string;
  /** A safety rule: a failure that could let an effect happen with no person where one is needed. */
  readonly safety: boolean;
};

const e = (code: CatalogCode, concept: ProblemConcept, kind: string, title: string, what: string, fixer: Fixer, fix: string, safety = false): CatalogEntry => ({ code, concept, kind, title, what, fixer, fix, safety });

/** The catalog: one entry for each code, held by the compiler. */
export const CATALOG: Readonly<Record<CatalogCode, CatalogEntry>> = {
  "E-RB-RUNBOOK-MALFORMED": e("E-RB-RUNBOOK-MALFORMED", "runbook", "malformed", "The runbook is not well formed", "A value is not of the type the runbook declares, an id is used twice, or a step names a step that is not where it must be.", "agent", "correct the runbook where the message says: {step}"),
  "E-RB-STEP-IRREVERSIBLE-UNGUARDED": e("E-RB-STEP-IRREVERSIBLE-UNGUARDED", "step", "irreversible-unguarded", "A step that cannot be taken back has no gate and no undo", "The effect of the step is not reversible and no gate guards it and no undo compensates it.", "person", "decide who may do {step}: add a gate that guards it, or an undo that compensates it", true),
  "E-RB-STORE-NO-CHECKPOINT": e("E-RB-STORE-NO-CHECKPOINT", "store", "no-checkpoint", "A transactional store is changed with no checkpoint before", "A step mutates a transactional store and no checkpoint step of that store comes before it.", "agent", "add a store.checkpoint step of {store} before {step}", true),
  "E-RB-STORE-NOT-DETACHED": e("E-RB-STORE-NOT-DETACHED", "store", "not-detached", "A store is attached and never detached", "A store is attached to the workshop and no later step detaches it or disposes of the workshop.", "agent", "add a workshop.detach step of {store} after {step}"),
  "E-RB-JUDGE-EFFECT": e("E-RB-JUDGE-EFFECT", "judge", "effect", "A judge has an effect", "A judge step carries an effect. A judge only proposes: its output is typed and it applies nothing.", "agent", "remove the effect from {step} and apply the proposal with a verb step behind a gate", true),
  "E-RB-JUDGE-APPLIED": e("E-RB-JUDGE-APPLIED", "judge", "applied", "The proposal of a judge is applied with no person between", "A verb step above the level agent-proposes uses the output of a judge, and no gate or ask stands between them.", "person", "put a gate or an ask between the judge and {step}", true),
  "E-RB-WORKSHOP-NOT-DISPOSABLE": e("E-RB-WORKSHOP-NOT-DISPOSABLE", "workshop", "not-disposable", "The workshop is disposed of while a store that is not ephemeral is attached", "Whether a workshop is disposable is computed from what is attached; a store that is not ephemeral is still attached at the disposal.", "agent", "detach {store} before {step}"),
  "E-RB-CITATION-MISSING": e("E-RB-CITATION-MISSING", "citation", "missing", "A step cites no requirement and no control", "The step answers to nothing: it has no requirement of a spec and no control of a catalog.", "agent", "cite the requirement or the control that {step} answers to"),
  "E-RB-VERB-UNKNOWN": e("E-RB-VERB-UNKNOWN", "verb", "unknown", "The verb is not registered", "The id names no verb of the registry of the pinned packages.", "environment", "register the verb {verb} in the pinned package that has it, or use a registered verb"),
  "E-RB-VERB-INPUTS-INVALID": e("E-RB-VERB-INPUTS-INVALID", "verb", "inputs-invalid", "The inputs do not fit the verb", "An input is missing, is not one the verb takes, or is not of the type the verb declares.", "agent", "give {verb} the inputs it declares, each of its type"),
  "E-RB-EFFECT-EXCEEDS-VERB": e("E-RB-EFFECT-EXCEEDS-VERB", "effect", "exceeds-verb", "The effect is more than the verb is registered with", "The step declares a mode above the verb's greatest or a class the verb does not act on.", "agent", "declare an effect of {step} within what {verb} is registered with", true),
  "E-RB-EXTERNAL-NO-KEY": e("E-RB-EXTERNAL-NO-KEY", "external", "no-key", "A system of record is changed with no idempotency key", "The effect is on an external store with a mode that is not read, and names no input as its idempotency key.", "agent", "name the input of {step} that is the idempotency key"),
  "E-RB-GATE-GUARDS-NOTHING": e("E-RB-GATE-GUARDS-NOTHING", "gate", "guards-nothing", "A gate guards no step", "The gate names no step it guards, so it raises the control over nothing.", "agent", "name the steps {step} guards"),
  "E-RB-CHECK-NOT-READ": e("E-RB-CHECK-NOT-READ", "check", "not-read", "A check uses a verb that does more than read", "A check yields evidence by reading; the verb it uses can change a store.", "agent", "use a verb that only reads in {step}"),
  "E-RB-NEED-MISSING": e("E-RB-NEED-MISSING", "need", "missing", "A need of a verb is not declared", "The verb a step calls needs a program or a credential that neither the step nor the runbook declares.", "agent", "declare the needs of {verb} in {step} or in the runbook"),
  "E-RB-NEED-INSTALLER": e("E-RB-NEED-INSTALLER", "need", "installer", "A need names an installer", "A need carries an install command. A runbook says what it needs; obtaining it is the workbench's.", "agent", "remove the installer from the need of {step}"),
  "E-RB-HARNESS-UNSUITABLE": e("E-RB-HARNESS-UNSUITABLE", "harness", "unsuitable", "The dialect cannot carry the runbook", "The dialect chosen lacks something the runbook needs, and the run is not moved to another dialect by itself.", "person", "choose another dialect for the run, or give {dialect} what it lacks: {lacks}"),
  "E-RB-UNKNOWN": e("E-RB-UNKNOWN", "runbook", "unknown", "A failure no entry names", "The failure matches no entry of the catalog.", "person", "classify it: add an entry, a check and a test, and document it, in one change"),
};

/** Whether a text is a code of the catalog. */
export function isCatalogCode(text: string): text is CatalogCode {
  return Object.hasOwn(CATALOG, text);
}

/** The entry of a code, or the entry for what is unknown: asking about a code that is none is the first step of classifying it. */
export function explain(code: string): CatalogEntry {
  return isCatalogCode(code) ? CATALOG[code] : CATALOG["E-RB-UNKNOWN"];
}

/** One problem found: its code, where, what is wrong, who fixes it and the fix. */
export type Finding = {
  readonly code: CatalogCode;
  /** The step it is of, or empty for the runbook. */
  readonly step: string;
  readonly message: string;
  readonly fixer: Fixer;
  readonly fix: string;
  readonly safety: boolean;
};

/** A finding made from an entry and the words that fill its fix. */
export function finding(code: CatalogCode, step: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding {
  const entry = CATALOG[code];
  const fix = entry.fix.replace(/\{(\w+)\}/gu, (_m, k: string) => (k === "step" ? vars["step"] ?? step : vars[k] ?? `{${k}}`));
  return { code, step, message, fixer: entry.fixer, fix, safety: entry.safety };
}

/** A finding as one line. */
export const describeFinding = (f: Finding): string => `error ${f.code}${f.step === "" ? "" : ` ${f.step}`}: ${f.message}; fix (${f.fixer}): ${f.fix}`;
