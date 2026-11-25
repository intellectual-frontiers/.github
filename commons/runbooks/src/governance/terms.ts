// Spec: 0002-runbooks-algebra FR-001
/**
 * The terms of Runbooks, each said once, and the closed lists the library is made of. A **runbook** is typed data: a procedure whose steps are an algebra. A **verb** is a deterministic operation of the pinned
 * packages, named by an id. A **judge** is a bounded judgement of an agent whose output is typed and which has no effect. The probabilistic layer (an agent, or a person) orchestrates; every effect is a verb.
 *
 * @example
 * ```ts
 * import { STEP_KINDS, TERMS } from "./terms.ts";
 * STEP_KINDS.length; // 8
 * TERMS.includes("verb"); // true
 * ```
 *
 * @module
 */

/** The terms of the library: a closed list. */
export const TERMS = ["runbook", "step", "verb", "effect", "store", "attachment", "workshop", "run", "work-order", "proposal", "evidence", "checkpoint", "gate", "autonomy", "dialect", "harness-policy", "skill", "finding"] as const;
/** One term. */
export type Term = (typeof TERMS)[number];

/** What each term is, in a sentence. */
export const DEFINITIONS: Readonly<Record<Term, string>> = {
  runbook: "Typed data: a procedure whose steps are an algebra, which a person or an agent orchestrates and whose every effect is a verb.",
  step: "One element of the algebra of a runbook: a verb, a check, an ask, a judge, a branch, an each, a gate or an undo.",
  verb: "A deterministic operation of the pinned packages, named by an id such as store.checkpoint, with typed inputs and a registered effect.",
  effect: "The declared mark a verb step leaves on a store: the store, its class, the mode, whether it can be undone and how.",
  store: "Where something is kept: ephemeral, transactional, durable, git or external.",
  attachment: "A store given to a workshop by the capabilities it needs, for the length of a run, and detached when the workshop is disposed.",
  workshop: "Where the work happens (the term of the workbench): it owns nothing durable and is disposable when only ephemeral stores are attached.",
  run: "One execution of a runbook, recorded as events on a work order.",
  "work-order": "The planning item of kind task that a run is of.",
  proposal: "The typed output of a judge: recorded, and applied by no one without a person.",
  evidence: "What a check yields: a digest, a record or a measure that an auditor can look at.",
  checkpoint: "A step that makes a restore point of a store before it is changed.",
  gate: "A step that is a person's authority: approve, tag or pentest scope.",
  autonomy: "How far an agent may go alone on a step, derived from its effect and never declared.",
  dialect: "How one kind of operator, a harness or a person, receives a runbook.",
  "harness-policy": "Data a fleet owns that chooses a dialect for a run.",
  skill: "A folder with SKILL.md that a harness loads, made from one runbook.",
  finding: "One problem the static check made, with its code in the catalog.",
};

/** The eight kinds of step: a closed list. */
export const STEP_KINDS = ["verb", "check", "ask", "judge", "branch", "each", "gate", "undo"] as const;
/** One kind of step. */
export type StepKind = (typeof STEP_KINDS)[number];

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

/** What a check yields. */
export const EVIDENCE_KINDS = ["digest", "record", "measure"] as const;
/** One kind of evidence. */
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** What an `each` fans out over. */
export const EACH_KINDS = ["tenants", "hosts", "fleets"] as const;
/** One thing to fan out over. */
export type EachKind = (typeof EACH_KINDS)[number];

/** The roles of a verb in a workshop: the verbs the static checks know by what they do. */
export const VERB_ROLES = ["attach", "detach", "dispose", "checkpoint"] as const;
/** One role of a verb. */
export type VerbRole = (typeof VERB_ROLES)[number];
