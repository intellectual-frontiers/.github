// Spec: 0003-workload-forms FR-001, FR-004
/**
 * The terms of Workload, each said once, and the closed lists the core is made of. A **workload** is a unit of operated work, not running software: typed data that a person or an agent orchestrates and whose every
 * effect is a deterministic verb of the pinned packages. A **form** says what kind of work it is and how it executes; a **trigger** says what starts it. The two axes are orthogonal to the **dialect**, which is a harness
 * projection and is never a form.
 *
 * @example
 * ```ts
 * import { FORMS, TERMS, TRIGGER_KINDS } from "./terms.ts";
 * TERMS.includes("workload"); // true
 * FORMS.runbook.status; // "built"
 * TRIGGER_KINDS; // ["manual", "schedule", "event", "alert"]
 * ```
 *
 * @module
 */

/** The terms of the library: a closed list. */
export const TERMS = ["workload", "form", "trigger", "node", "runbook", "reconcile", "graph", "verb", "effect", "store", "attachment", "workshop", "run", "work-order", "judge", "proposal", "evidence", "gate", "autonomy", "dialect", "harness-policy", "skill", "finding", "runner", "native-runner", "integration-runner", "runner-policy", "handoff", "receipt", "schedule"] as const;
/** One term. */
export type Term = (typeof TERMS)[number];

/** What each term is, in a sentence. */
export const DEFINITIONS: Readonly<Record<Term, string>> = {
  workload: "A unit of operated work, not running software: typed data of one form, with a trigger, whose every effect is a verb and whose autonomy is derived from its effects.",
  form: "What kind of work a workload is and how it executes: a closed sum of node kinds with its checks, its dry run, its fold of run events and a native runner behind a port. A form is never a dialect and never a runner.",
  trigger: "What starts a workload: manual, a schedule, an event or an alert. A field of a workload, never a form.",
  node: "One element of a workload: what a form calls a step or a phase. The kinds of node are the form's own closed list.",
  runbook: "The form of a procedure: an ordered algebra of steps that a person or an agent orchestrates.",
  reconcile: "The form of a loop toward a desired state: it observes, diffs, plans, has a person approve the plan by its hash, applies and verifies, and is level-triggered.",
  graph: "The form of a directed acyclic graph of nodes with edges that say which node comes after which: the same nodes and effects as the other forms, carried by an integration runner that a foreign system such as GitHub executes.",
  verb: "A deterministic operation of the pinned packages, named by an id such as store.checkpoint, with typed inputs and a registered effect.",
  effect: "The declared mark a verb node leaves on a store: the store, its class, the mode, whether it can be undone and how.",
  store: "Where something is kept: ephemeral, transactional, durable, git or external.",
  attachment: "A store given to a workshop by the capabilities it needs, for the length of a run, and detached when the workshop is disposed.",
  workshop: "Where the work happens (the term of the workbench): it owns nothing durable and is disposable when only ephemeral stores are attached.",
  run: "One execution of a workload, recorded as events on a work order.",
  "work-order": "The planning item of kind task that a run is of.",
  judge: "A bounded judgement of an agent whose output is typed and which has no effect: the probabilistic layer proposes and never applies.",
  proposal: "The typed output of a judge: recorded, and applied by no one without a person.",
  evidence: "What a check or an approval yields: a digest, a record or a measure that an auditor can look at.",
  gate: "A person's authority over the nodes it guards: approve, tag or pentest scope.",
  autonomy: "How far an agent may go alone on a node, derived from its effect and never declared.",
  dialect: "How one kind of operator, a harness or a person, receives a workload: a projection, never a form.",
  "harness-policy": "Data a fleet owns that chooses a dialect for a run.",
  skill: "A folder with SKILL.md that a harness loads, made from one workload.",
  finding: "One problem a static check made, with its code in a catalog.",
  runner: "How a plan is carried out: natively by our TypeScript, or by an integration runner that compiles the plan into an artifact a foreign system runs. Chosen by a policy, never named by a workload, and it changes no node, no effect and no autonomy.",
  "native-runner": "The runner that is our TypeScript: it interprets the plan on Bun or Node, is interactive, is the default and records the events of a run directly.",
  "integration-runner": "A runner that compiles the plan into an artifact (a script) that a foreign system runs and then hands off: the library keeps the plan, the policy and the evidence, and not the run.",
  "runner-policy": "Data a fleet owns that chooses a runner for a run, native unless it says another.",
  handoff: "The event that says a plan went to an integration runner: the plan hash and the runner.",
  receipt: "The event that says what the external run did: the plan hash, the reference of the run, its exit status and the digest of its log, pulled by ingest.",
  schedule: "A trigger of a workload that starts it at a cadence (hourly to yearly) in a slot in UTC, and its realization: a cron expression of the platform, a cron line or a systemd timer with its service.",
};

/** The five classes of store: how a store keeps what is written to it. */
export const STORE_CLASSES = ["ephemeral", "transactional", "durable", "git", "external"] as const;
/** One class of store. */
export type StoreClass = (typeof STORE_CLASSES)[number];

/** The four modes of an effect, from the least to the most it does to a store. */
export const MODES = ["read", "append", "mutate", "destroy"] as const;
/** One mode. */
export type Mode = (typeof MODES)[number];

/** The rank of a mode: a mode is within another where its rank is not greater. */
export const modeRank = (m: Mode): number => MODES.indexOf(m);

/** The authority a gate names: approve and tag are a person's at every level (the workbench); a pentest scope is a person's too. */
export const GATE_ACTIONS = ["approve", "tag", "pentest-scope"] as const;
/** One action of a gate. */
export type GateAction = (typeof GATE_ACTIONS)[number];

/** What a check or an approval yields. */
export const EVIDENCE_KINDS = ["digest", "record", "measure"] as const;
/** One kind of evidence. */
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** The roles of a verb in a workshop: the verbs the static checks know by what they do. */
export const VERB_ROLES = ["attach", "detach", "dispose", "checkpoint"] as const;
/** One role of a verb. */
export type VerbRole = (typeof VERB_ROLES)[number];

/** What starts a workload: a closed list. */
export const TRIGGER_KINDS = ["manual", "schedule", "event", "alert"] as const;
/** One kind of trigger. */
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/** How often a scheduled workload starts. */
export const CADENCES = ["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"] as const;
/** One cadence. */
export type Cadence = (typeof CADENCES)[number];

/** What a form says of an outcome in a form-neutral word: it completed what it set out to do, it parked for a person, or it failed. */
export const OUTCOMES = ["completes", "parks", "fails"] as const;
/** One outcome. */
export type Outcome = (typeof OUTCOMES)[number];

/** The forms: a closed list, each built or reserved. A reserved form is a named slot with the criteria for building it and has no code. */
export const FORM_IDS = ["runbook", "reconcile", "graph", "campaign"] as const;
/** One form. */
export type FormId = (typeof FORM_IDS)[number];

/** The forms that have code. */
export const BUILT_FORM_IDS = ["runbook", "reconcile", "graph"] as const satisfies readonly FormId[];
/** One built form. */
export type BuiltFormId = (typeof BUILT_FORM_IDS)[number];

/** What the registry says of a form. */
export type FormEntry =
  | { readonly status: "built"; readonly summary: string }
  | { readonly status: "reserved"; readonly summary: string; readonly criteria: string };

/** The registry of forms: one entry for each form, held by the compiler. A form is built where a second concrete user needs it (the rule of two) and not before. */
export const FORMS: Readonly<Record<FormId, FormEntry>> = {
  runbook: { status: "built", summary: "An ordered algebra of steps: a procedure that a person or an agent orchestrates, with gates, compensations and a record of the run." },
  reconcile: { status: "built", summary: "A loop toward a desired state: observe, diff, plan, approve by plan hash, apply, verify; level-triggered." },
  graph: { status: "built", summary: "A directed acyclic graph of nodes with edges (after), the same nodes and effects as the other forms, which an integration runner such as GitHub Actions carries." },
  campaign: { status: "reserved", summary: "A collection over a period with sampling.", criteria: "A second concrete user, besides the first, needs a collection over a period with sampling that cannot be said as a runbook with a schedule trigger." },
};

/** Whether a text names a form of the registry. */
export const isFormId = (text: string): text is FormId => (FORM_IDS as readonly string[]).includes(text);

/** Whether a text names a form that has code. */
export const isBuiltForm = (text: string): text is BuiltFormId => (BUILT_FORM_IDS as readonly string[]).includes(text);
