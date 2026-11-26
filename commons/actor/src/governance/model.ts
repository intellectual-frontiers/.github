// Spec: 0002-actor-roles FR-001, FR-002, FR-003
/**
 * The actors and the roles of an act (commons 0048-actors FR-001, FR-010, FR-011): a person, a system or an agent, and the six roles with the rule of which kind may hold which, made by the types. An agent never is the
 * initiator, the reviewer or the approver: a program that says so does not type check, and a value that arrives from outside is refused where it is decoded. The words that name what an agent did are `prepared`, `assisted`
 * and `drafted` (FR-014). Every one is a value; nothing here reads a file, a clock or a network.
 *
 * @module
 */

/** What an actor is: a person, a deterministic mechanism that a person validated, or an AI agent (commons 0048-actors FR-001). */
export type ActorKind = "person" | "system" | "agent";

/** Every kind, in the order of the documentation. */
export const ACTOR_KINDS: readonly ActorKind[] = ["person", "system", "agent"];

/** A person. */
export interface PersonActor {
  readonly kind: "person";
  /** The id of the person in the fleet's registry of people (never a real name in commons). */
  readonly id: string;
}

/** A deterministic mechanism that a person validated: a typed verb, the engine, a pipeline. */
export interface SystemActor {
  readonly kind: "system";
  readonly id: string;
}

/** How sure the controller is of a model identity: only what the harness says it is (`reported`) is possible at first. */
export type ModelAssurance = "reported";

/** The model an agent says it runs. */
export interface ModelIdentity {
  readonly name: string;
  readonly assurance: ModelAssurance;
}

/** An AI agent: a model run under instructions with tools. */
export interface AgentActor {
  readonly kind: "agent";
  readonly id: string;
  readonly model: ModelIdentity;
  /** The SHA-256 of the instruction set that governed the session (AGENTS.md, CLAUDE.md, the system prompt), as 64 lower-case hexadecimal digits, where it is known. */
  readonly instructionsDigest?: string;
}

/** Any actor. */
export type Actor = PersonActor | SystemActor | AgentActor;

/** A controlled instruction an act is done under (commons 0048-actors FR-020). */
export interface Directive {
  readonly id: string;
  readonly version: string;
  /** The SHA-256 of the text of the directive, as 64 lower-case hexadecimal digits. */
  readonly digest: string;
  /** The owner is a person, always. */
  readonly owner: PersonActor;
}

/** The six roles of an act, by the only words that name them (commons 0048-actors FR-010). */
export const ROLES = ["initiatedBy", "preparedBy", "assistedBy", "executedBy", "reviewedBy", "approvedBy"] as const;
/** A role. */
export type Role = (typeof ROLES)[number];

/**
 * An act as it is recorded. The types are the rule (commons 0048-actors FR-011): the initiator, the reviewer and the approver are persons; the executor is a person or a system; the assistant is an agent or a system;
 * the preparer is any kind. An act that names no directive is undirected (FR-022).
 */
export interface Act {
  readonly initiatedBy: PersonActor;
  readonly preparedBy?: Actor;
  readonly assistedBy: readonly (AgentActor | SystemActor)[];
  readonly executedBy?: PersonActor | SystemActor;
  readonly reviewedBy?: PersonActor;
  readonly approvedBy?: PersonActor;
  readonly directive: Directive | null;
}

/** Why a value is not an act: the role and what it needs. */
export type RoleError =
  | { readonly kind: "shape"; readonly path: string; readonly expected: string }
  | { readonly kind: "role"; readonly role: Role; readonly expected: string; readonly found: ActorKind }
  | { readonly kind: "initiator-not-owner"; readonly initiator: string; readonly owner: string };

/** A sentence for a role error, naming the role. */
export function formatRoleError(e: RoleError): string {
  switch (e.kind) {
    case "shape":
      return `${e.path}: expected ${e.expected}`;
    case "role":
      return `${e.role} must be ${e.expected}, found an actor of the kind ${e.found}`;
    case "initiator-not-owner":
      return `the initiator ${e.initiator} must be the owner of the directive, which is owned by ${e.owner}`;
  }
}

/** The levels of tasking (commons 0048-actors FR-040), from the least to the most. */
export const TASKING_LEVELS = ["T0", "T1", "T2", "T3"] as const;
/** A tasking level: T0 suggest, T1 prepare drafts in a branch or a sandbox, T2 assist execution with a per step approval of the plan hash, T3 assist reversible low risk steps under a standing directive. */
export type TaskingLevel = (typeof TASKING_LEVELS)[number];

/** What an agent may be doing. */
export type AgentWork = "suggest" | "prepare-draft" | "assist-step" | "assist-standing";

/** The trailers of a commit that name the actors (commons 0048-actors FR-063). */
export const TRAILER_KEYS = ["Prepared-by", "Directive", "Reviewed-by"] as const;
/** A trailer of this library. */
export type TrailerKey = (typeof TRAILER_KEYS)[number];

/** The words that MUST NOT be used of an agent (commons 0048-actors FR-014). */
export const FORBIDDEN_AGENT_WORDS = ["wrote", "completed", "approved", "signed", "confirmed", "initiated", "owns"] as const;
/** A forbidden word. */
export type ForbiddenWord = (typeof FORBIDDEN_AGENT_WORDS)[number];

/** The words that name what an agent did (commons 0048-actors FR-014). */
export const AGENT_WORDS = ["prepared", "assisted", "drafted"] as const;
