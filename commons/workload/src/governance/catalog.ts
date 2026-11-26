// Spec: 0006-workload-split FR-002
/**
 * The closed catalogs of what can go wrong with a workload. The core has its own, `E-WL-<CONCEPT>-<KIND>`, for what is true of every form (a verb that is not registered, an effect above its verb's, a node that cites nothing,
 * a need that names an installer, a dialect that cannot carry the workload, a judge that has an effect); each form has its own with its own prefix (the runbook form `E-RB-...`, the reconcile form `E-RC-...`), built with
 * the same helpers. A problem has one code, the concept it belongs to, who may fix it (the agent, a person, the environment's owner or CI), the one fix and whether it is a safety rule. A failure in no entry is
 * `E-WL-UNKNOWN`, and meeting one is itself a finding: it is classified, given a check and a test and documented in one change. Every finding is an error.
 *
 * @example
 * ```ts
 * import { explainIn, CATALOG } from "./catalog.ts";
 * explainIn([CATALOG], "E-WL-JUDGE-EFFECT").fixer; // "agent"
 * explainIn([CATALOG], "E-WL-NOPE").code; // "E-WL-UNKNOWN"
 * ```
 *
 * @module
 */
import { FIXERS, type Fixer } from "@intellectual-frontiers/workbench/governance";

/** Who may fix a problem: the closed list of the workbench. */
export { FIXERS, type Fixer };

/** One entry of a catalog. `fix` may hold `{node}`, `{verb}`, `{store}`, `{dialect}` and `{lacks}`, filled by the finding. */
export type CatalogEntry<C extends string = string> = {
  readonly code: C;
  readonly concept: string;
  readonly kind: string;
  readonly title: string;
  readonly what: string;
  readonly fixer: Fixer;
  readonly fix: string;
  /** A safety rule: a failure that could let an effect happen with no person where one is needed. */
  readonly safety: boolean;
};

/** A catalog of one owner: its prefix, its concepts and one entry for each code, held by the compiler. */
export type Catalog<C extends string = string> = {
  readonly owner: string;
  readonly prefix: string;
  readonly concepts: readonly string[];
  readonly entries: Readonly<Record<C, CatalogEntry<C>>>;
};

/** An entry made from its parts. */
export const entry = <C extends string>(code: C, concept: string, kind: string, title: string, what: string, fixer: Fixer, fix: string, safety = false): CatalogEntry<C> => ({ code, concept, kind, title, what, fixer, fix, safety });

/** One problem found: its code, where, what is wrong, who fixes it and the fix. */
export type Finding = {
  readonly code: string;
  /** The node it is of, or empty for the workload. */
  readonly node: string;
  readonly message: string;
  readonly fixer: Fixer;
  readonly fix: string;
  readonly safety: boolean;
};

/** A finding made from an entry and the words that fill its fix. */
export function makeFinding(e: CatalogEntry, node: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding {
  const fix = e.fix.replace(/\{(\w+)\}/gu, (_m, k: string) => (k === "node" ? vars["node"] ?? node : vars[k] ?? `{${k}}`));
  return { code: e.code, node, message, fixer: e.fixer, fix, safety: e.safety };
}

/** The concepts a problem of the core belongs to: a closed list. */
export const PROBLEM_CONCEPTS = ["workload", "citation", "verb", "effect", "external", "gate", "check", "need", "harness", "judge", "runner", "schedule"] as const;

/** The codes of the core catalog. */
export type CatalogCode =
  | "E-WL-VERB-UNKNOWN"
  | "E-WL-VERB-INPUTS-INVALID"
  | "E-WL-EFFECT-EXCEEDS-VERB"
  | "E-WL-EXTERNAL-NO-KEY"
  | "E-WL-GATE-GUARDS-NOTHING"
  | "E-WL-CHECK-NOT-READ"
  | "E-WL-CITATION-MISSING"
  | "E-WL-NEED-MISSING"
  | "E-WL-NEED-INSTALLER"
  | "E-WL-HARNESS-UNSUITABLE"
  | "E-WL-RUNNER-UNSUITABLE"
  | "E-WL-RUNNER-EMIT-UNSUPPORTED"
  | "E-WL-RUNNER-VALUE-UNSAFE"
  | "E-WL-RUNNER-EACH-UNLISTED"
  | "E-WL-RUNNER-DRIFT"
  | "E-WL-RUNNER-RECEIPT-UNMATCHED"
  | "E-WL-RUNNER-APPROVAL-NOT-PERSON"
  | "E-WL-RUNNER-ACTION-UNPINNED"
  | "E-WL-RUNNER-SCHEDULE-NEEDS-INPUT"
  | "E-WL-RUNNER-RECEIPT-INVALID"
  | "E-WL-SCHEDULE-SLOT-INVALID"
  | "E-WL-HARNESS-COMMAND-INVALID"
  | "E-WL-JUDGE-EFFECT"
  | "E-WL-JUDGE-APPLIED"
  | "E-WL-WORKLOAD-UNKNOWN-FORM"
  | "E-WL-UNKNOWN";

/** The core catalog: one entry for each code, held by the compiler. */
export const CATALOG: Readonly<Record<CatalogCode, CatalogEntry<CatalogCode>>> = {
  "E-WL-VERB-UNKNOWN": entry("E-WL-VERB-UNKNOWN", "verb", "unknown", "The verb is not registered", "The id names no verb of the registry of the pinned packages.", "environment", "register the verb {verb} in the pinned package that has it, or use a registered verb"),
  "E-WL-VERB-INPUTS-INVALID": entry("E-WL-VERB-INPUTS-INVALID", "verb", "inputs-invalid", "The inputs do not fit the verb", "An input is missing, is not one the verb takes, or is not of the type the verb declares.", "agent", "give {verb} the inputs it declares, each of its type"),
  "E-WL-EFFECT-EXCEEDS-VERB": entry("E-WL-EFFECT-EXCEEDS-VERB", "effect", "exceeds-verb", "The effect is more than the verb is registered with", "The node declares a mode above the verb's greatest or a class the verb does not act on.", "agent", "declare an effect of {node} within what {verb} is registered with", true),
  "E-WL-EXTERNAL-NO-KEY": entry("E-WL-EXTERNAL-NO-KEY", "external", "no-key", "A system of record is changed with no idempotency key", "The effect is on an external store with a mode that is not read, and names no input as its idempotency key.", "agent", "name the input of {node} that is the idempotency key"),
  "E-WL-GATE-GUARDS-NOTHING": entry("E-WL-GATE-GUARDS-NOTHING", "gate", "guards-nothing", "A gate guards no node", "The gate names no node it guards, so it raises the control over nothing.", "agent", "name the nodes {node} guards"),
  "E-WL-CHECK-NOT-READ": entry("E-WL-CHECK-NOT-READ", "check", "not-read", "A node that reads uses a verb that does more than read", "A check, an observation or a verification yields evidence by reading; the verb it uses can change a store.", "agent", "use a verb that only reads in {node}"),
  "E-WL-CITATION-MISSING": entry("E-WL-CITATION-MISSING", "citation", "missing", "A node cites no requirement and no control", "The node answers to nothing: it has no requirement of a spec and no control of a catalog.", "agent", "cite the requirement or the control that {node} answers to"),
  "E-WL-NEED-MISSING": entry("E-WL-NEED-MISSING", "need", "missing", "A need of a verb is not declared", "The verb a node calls needs a program or a credential that neither the node nor the workload declares.", "agent", "declare the needs of {verb} in {node} or in the workload"),
  "E-WL-NEED-INSTALLER": entry("E-WL-NEED-INSTALLER", "need", "installer", "A need names an installer", "A need carries an install command. A workload says what it needs; obtaining it is the workbench's.", "agent", "remove the installer from the need of {node}"),
  "E-WL-HARNESS-UNSUITABLE": entry("E-WL-HARNESS-UNSUITABLE", "harness", "unsuitable", "The dialect cannot carry the workload", "The dialect chosen lacks something the workload needs, and the run is not moved to another dialect by itself.", "person", "choose another dialect for the run, or give {dialect} what it lacks: {lacks}"),
  "E-WL-RUNNER-UNSUITABLE": entry("E-WL-RUNNER-UNSUITABLE", "runner", "unsuitable", "The runner cannot carry the workload", "The runner chosen lacks a capability the workload needs (a judge, an ask, a gate, typed logic, an undo or a destroy of a durable store), and the run is not moved to another runner by itself.", "person", "choose the native runner for the run, or give {runner} what it lacks: {lacks}"),
  "E-WL-RUNNER-EMIT-UNSUPPORTED": entry("E-WL-RUNNER-EMIT-UNSUPPORTED", "runner", "emit-unsupported", "The plan is outside what an artifact may say", "A node, or an input, is outside the closed subset an artifact is made from: a call of a verb or a check, and an each over a fixed list.", "person", "run the workload with the native runner, or take {node} out of what is handed off"),
  "E-WL-RUNNER-VALUE-UNSAFE": entry("E-WL-RUNNER-VALUE-UNSAFE", "runner", "value-unsafe", "A value cannot be written into an artifact", "A value an artifact would hold is not printable ASCII with no control character, so no quoting could keep it from changing how the script is read.", "agent", "use printable ASCII for {node}"),
  "E-WL-RUNNER-EACH-UNLISTED": entry("E-WL-RUNNER-EACH-UNLISTED", "runner", "each-unlisted", "A fan out has no fixed list", "An each names a source that is no literal naming a list the caller gave, so the artifact would have to find its members at run time.", "agent", "give {node} a literal source and the fixed list it names"),
  "E-WL-RUNNER-DRIFT": entry("E-WL-RUNNER-DRIFT", "runner", "drift", "An artifact is not what the plan makes", "The artifact differs from the one regenerated from the plan: it was edited by hand, the plan changed, or it is the artifact of another runner.", "ci", "regenerate the artifact with the generator and commit it; never edit it by hand"),
  "E-WL-RUNNER-RECEIPT-UNMATCHED": entry("E-WL-RUNNER-RECEIPT-UNMATCHED", "runner", "receipt-unmatched", "A receipt names no hand-off", "The receipt carries a plan hash that no hand-off of the run has, so it is not the result of any plan that was handed off.", "person", "check the plan hash of the receipt against the hand-offs of the run"),
  "E-WL-RUNNER-APPROVAL-NOT-PERSON": entry("E-WL-RUNNER-APPROVAL-NOT-PERSON", "runner", "approval-not-person", "An approval was recorded by an agent", "A receipt carries an approval of a gate and the actor who recorded it is not a person; only a person approves.", "person", "have a person record the approval; an agent never approves", true),
  "E-WL-RUNNER-ACTION-UNPINNED": entry("E-WL-RUNNER-ACTION-UNPINNED", "runner", "action-unpinned", "An action is not pinned", "A step of a workflow uses an action that is no `./path` and no `owner/name@version` with the version a tag or a full commit, or a command of the pin table that is not a plain word.", "agent", "pin {node} to a tag or a full commit, or use a plain word for the command"),
  "E-WL-RUNNER-SCHEDULE-NEEDS-INPUT": entry("E-WL-RUNNER-SCHEDULE-NEEDS-INPUT", "runner", "schedule-needs-input", "A scheduled workload needs an input nobody can give", "A run that a schedule starts is given no input, and the workload has an input it requires, so every scheduled run would stop at its first read of it.", "agent", "make the input {node} optional, or start the workload by hand"),
  "E-WL-RUNNER-RECEIPT-INVALID": entry("E-WL-RUNNER-RECEIPT-INVALID", "runner", "receipt-invalid", "A run result is not a receipt", "The result of an external run is not finished, has no reference that is the address of a run, a digest that is not 64 lower case hexadecimal digits, a conclusion or a plan hash that is not one, or names a plan other than the one its workflow carries.", "person", "pull the result of the finished run again and check its reference, its conclusion and its plan hash"),
  "E-WL-SCHEDULE-SLOT-INVALID": entry("E-WL-SCHEDULE-SLOT-INVALID", "schedule", "slot-invalid", "The slot does not fit the cadence", "A field of the slot is out of its range (minute 0 to 59, hour 0 to 23, weekday 0 to 6, day 1 to 28, month 1 to 12, or 1 to 3 of a quarter) or is one that the cadence does not have.", "agent", "give the schedule of {node} a slot that its cadence has, each field in its range"),
  "E-WL-HARNESS-COMMAND-INVALID": entry("E-WL-HARNESS-COMMAND-INVALID", "harness", "command-invalid", "The command of a projection is not words and a path", "The command a harness is told to call a verb with has a character of shell syntax in it (a semicolon, a pipe, a quote, a dollar, a bracket), is empty, has a blank run or is longer than 200 characters, so a rule built from it could allow more than one program.", "agent", "give the verb command as words and a path only, such as `acme verb`"),
  "E-WL-JUDGE-EFFECT": entry("E-WL-JUDGE-EFFECT", "judge", "effect", "A judge has an effect", "A judge node carries an effect. A judge only proposes: its output is typed and it applies nothing.", "agent", "remove the effect from {node} and apply the proposal with a verb node behind a gate", true),
  "E-WL-JUDGE-APPLIED": entry("E-WL-JUDGE-APPLIED", "judge", "applied", "The proposal of a judge is applied with no person between", "A verb node above the level agent-proposes uses the output of a judge, and no gate or ask stands between them.", "person", "put a gate or an ask between the judge and {node}", true),
  "E-WL-WORKLOAD-UNKNOWN-FORM": entry("E-WL-WORKLOAD-UNKNOWN-FORM", "workload", "unknown-form", "The form is not a form that has code", "The workload names a form that is reserved or is none: a reserved form is a named slot and has no code.", "person", "use a form that is built (runbook, reconcile or graph), or build the reserved form where its criteria are met"),
  "E-WL-UNKNOWN": entry("E-WL-UNKNOWN", "workload", "unknown", "A failure no entry names", "The failure matches no entry of any catalog.", "person", "classify it: add an entry, a check and a test, and document it, in one change"),
};

/** The concepts of the core catalog, for a page that groups it. */
export const CONCEPTS: readonly string[] = [...PROBLEM_CONCEPTS];

/** The catalog of the core as a value of its own type. */
export const CORE_CATALOG: Catalog<CatalogCode> = { owner: "the core", prefix: "E-WL-", concepts: CONCEPTS, entries: CATALOG };

/** Whether a text is a code of the core catalog. */
export function isCatalogCode(text: string): text is CatalogCode {
  return Object.hasOwn(CATALOG, text);
}

/** The entry of a code in the catalogs given, or the entry for what is unknown: asking about a code that is none is the first step of classifying it. */
export function explainIn(catalogs: readonly Catalog[], code: string): CatalogEntry {
  for (const c of catalogs) {
    const found = Object.hasOwn(c.entries, code) ? c.entries[code] : undefined;
    if (found !== undefined) return found;
  }
  return CATALOG["E-WL-UNKNOWN"];
}

/** The entry of a code of the core catalog, or the entry for what is unknown. */
export const explain = (code: string): CatalogEntry => explainIn([CORE_CATALOG], code);

/** A finding of the core catalog. */
export function finding(code: CatalogCode, node: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding {
  return makeFinding(CATALOG[code], node, message, vars);
}

/** A finding as one line. */
export const describeFinding = (f: Finding): string => `error ${f.code}${f.node === "" ? "" : ` ${f.node}`}: ${f.message}; fix (${f.fixer}): ${f.fix}`;

/** What is wrong with a catalog as data: a code that is not `<prefix><CONCEPT>-<KIND>` of its own entry, a concept not in its list, a code twice or an entry without words. The catalogs are closed, and a test holds each to this. */
export function catalogProblems(c: Catalog): readonly string[] {
  const out: string[] = [];
  for (const [code, e] of Object.entries(c.entries)) {
    if (e.code !== code) out.push(`${code}: the entry names ${e.code}`);
    if (!code.startsWith(c.prefix)) out.push(`${code}: not of the prefix ${c.prefix}`);
    if (!c.concepts.includes(e.concept)) out.push(`${code}: the concept ${e.concept} is not in the list of the catalog`);
    if (!code.endsWith("-UNKNOWN") && code !== `${c.prefix}${e.concept.toUpperCase()}-${e.kind.toUpperCase()}`) out.push(`${code}: not made of its concept and kind`);
    if (!FIXERS.includes(e.fixer)) out.push(`${code}: the fixer ${e.fixer} is not one`);
    if (e.fix.length <= 10 || e.what.length <= 10 || e.title.length <= 5) out.push(`${code}: a word is missing`);
  }
  return out;
}
