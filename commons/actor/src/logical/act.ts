// Spec: 0002-actor-roles FR-001, FR-002, FR-003, FR-004
/**
 * An act from outside, and the rules of its roles (commons 0048-actors FR-011, FR-013, FR-022): the decoder that refuses an agent as initiator, reviewer or approver with an error that names the role, the check that the
 * initiator owns the directive, the finding that one person holds every role, and what an agent may do at each tasking level. Pure.
 *
 * @example
 * ```ts
 * import { decodeAct } from "./act.ts";
 * decodeAct({ initiatedBy: { kind: "agent", id: "a", model: { name: "m", assurance: "reported" } }, assistedBy: [], directive: null }).kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Act, Actor, ActorKind, AgentActor, AgentWork, Directive, PersonActor, Role, RoleError, SystemActor, TaskingLevel } from "@intellectual-frontiers/actor/governance";
import { ACTOR_KINDS, TASKING_LEVELS } from "@intellectual-frontiers/actor/governance";

type Obj = { readonly [key: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v !== "";
const DIGEST = /^[0-9a-f]{64}$/;

const shape = (path: string, expected: string): RoleError => ({ kind: "shape", path, expected });

/** An actor from outside: its kind and the fields of its kind. */
export function decodeActor(input: unknown, path = "$"): Result<Actor, RoleError> {
  if (!isObj(input)) return err(shape(path, "an actor object"));
  const kind = ACTOR_KINDS.find((k) => k === input["kind"]);
  if (kind === undefined) return err(shape(`${path}.kind`, "person, system or agent"));
  const id = input["id"];
  if (!isText(id)) return err(shape(`${path}.id`, "an id"));
  switch (kind) {
    case "person":
      return ok({ kind, id });
    case "system":
      return ok({ kind, id });
    case "agent": {
      const model = input["model"];
      if (!isObj(model) || !isText(model["name"]) || model["assurance"] !== "reported") return err(shape(`${path}.model`, "a model identity {name, assurance: reported}"));
      const digest = input["instructionsDigest"];
      if (digest !== undefined && !(typeof digest === "string" && DIGEST.test(digest))) return err(shape(`${path}.instructionsDigest`, "64 lower-case hexadecimal digits"));
      return ok(digest === undefined ? { kind, id, model: { name: model["name"], assurance: "reported" } } : { kind, id, model: { name: model["name"], assurance: "reported" }, instructionsDigest: digest });
    }
  }
}

const KINDS_WORD: Readonly<Record<Role, string>> = {
  initiatedBy: "a person",
  preparedBy: "any actor",
  assistedBy: "an agent or a system",
  executedBy: "a person or a system",
  reviewedBy: "a person",
  approvedBy: "a person",
};

function wrong(role: Role, found: ActorKind): Result<never, RoleError> {
  return err({ kind: "role", role, expected: KINDS_WORD[role], found });
}

function person(role: Role, input: unknown, path: string): Result<PersonActor, RoleError> {
  const a = decodeActor(input, path);
  if (a.kind === "err") return a;
  return a.value.kind === "person" ? ok(a.value) : wrong(role, a.value.kind);
}

function personOrSystem(role: Role, input: unknown, path: string): Result<PersonActor | SystemActor, RoleError> {
  const a = decodeActor(input, path);
  if (a.kind === "err") return a;
  return a.value.kind === "agent" ? wrong(role, "agent") : ok(a.value);
}

function agentOrSystem(role: Role, input: unknown, path: string): Result<AgentActor | SystemActor, RoleError> {
  const a = decodeActor(input, path);
  if (a.kind === "err") return a;
  return a.value.kind === "person" ? wrong(role, "person") : ok(a.value);
}

function directiveOf(input: unknown): Result<Directive | null, RoleError> {
  if (input === null || input === undefined) return ok(null);
  if (!isObj(input)) return err(shape("$.directive", "a directive or null"));
  const { id, version, digest } = input;
  if (!isText(id) || !isText(version)) return err(shape("$.directive", "an id and a version"));
  if (typeof digest !== "string" || !DIGEST.test(digest)) return err(shape("$.directive.digest", "64 lower-case hexadecimal digits"));
  const owner = person("initiatedBy", input["owner"], "$.directive.owner");
  if (owner.kind === "err") return owner;
  return ok({ id, version, digest, owner: owner.value });
}

/** An act from outside, or the role that is wrong: an agent as initiator, reviewer or approver is refused with the role in the error (commons 0048-actors FR-011). */
export function decodeAct(input: unknown): Result<Act, RoleError> {
  if (!isObj(input)) return err(shape("$", "an act object"));
  const initiated = person("initiatedBy", input["initiatedBy"], "$.initiatedBy");
  if (initiated.kind === "err") return initiated;
  const directive = directiveOf(input["directive"]);
  if (directive.kind === "err") return directive;
  if (directive.value !== null && directive.value.owner.id !== initiated.value.id) {
    return err({ kind: "initiator-not-owner", initiator: initiated.value.id, owner: directive.value.owner.id });
  }
  const prepared = input["preparedBy"] === undefined ? undefined : decodeActor(input["preparedBy"], "$.preparedBy");
  if (prepared?.kind === "err") return prepared;
  const assistedIn = input["assistedBy"] ?? [];
  if (!Array.isArray(assistedIn)) return err(shape("$.assistedBy", "an array"));
  const assisted: (AgentActor | SystemActor)[] = [];
  for (const [i, a] of assistedIn.entries()) {
    const h = agentOrSystem("assistedBy", a, `$.assistedBy[${i}]`);
    if (h.kind === "err") return h;
    assisted.push(h.value);
  }
  const executed = input["executedBy"] === undefined ? undefined : personOrSystem("executedBy", input["executedBy"], "$.executedBy");
  if (executed?.kind === "err") return executed;
  const reviewed = input["reviewedBy"] === undefined ? undefined : person("reviewedBy", input["reviewedBy"], "$.reviewedBy");
  if (reviewed?.kind === "err") return reviewed;
  const approved = input["approvedBy"] === undefined ? undefined : person("approvedBy", input["approvedBy"], "$.approvedBy");
  if (approved?.kind === "err") return approved;
  const act: Act = {
    initiatedBy: initiated.value,
    ...(prepared === undefined ? {} : { preparedBy: prepared.value }),
    assistedBy: assisted,
    ...(executed === undefined ? {} : { executedBy: executed.value }),
    ...(reviewed === undefined ? {} : { reviewedBy: reviewed.value }),
    ...(approved === undefined ? {} : { approvedBy: approved.value }),
    directive: directive.value,
  };
  return ok(act);
}

/** Whether an act that an agent took part in names no directive (commons 0048-actors FR-022): such an act is undirected, a nonconformance, and a regulated verb is not allowed it. */
export function undirected(act: Act): boolean {
  const agent = act.preparedBy?.kind === "agent" || act.assistedBy.some((a) => a.kind === "agent");
  return agent && act.directive === null;
}

/** A finding about the roles of an act. */
export interface RoleFinding {
  readonly rule: "roles-not-separate" | "reviewer-is-preparer" | "undirected";
  readonly text: string;
}

/** The findings about who held which role (commons 0048-actors FR-013, FR-022): the reviewer is the preparer, one person holds the roles of initiator, reviewer and approver, or an agent worked under no directive. */
export function roleFindings(act: Act): readonly RoleFinding[] {
  const found: RoleFinding[] = [];
  if (act.reviewedBy !== undefined && act.preparedBy?.kind === "person" && act.preparedBy.id === act.reviewedBy.id) {
    found.push({ rule: "reviewer-is-preparer", text: `the reviewer ${act.reviewedBy.id} is the person who prepared the artifact` });
  }
  const p: PersonActor = act.initiatedBy;
  if (act.reviewedBy?.id === p.id && act.approvedBy?.id === p.id) {
    found.push({ rule: "roles-not-separate", text: `${p.id} is the initiator, the reviewer and the approver: a person with the authority must accept this as a finding` });
  }
  if (undirected(act)) found.push({ rule: "undirected", text: "an agent took part and the act names no directive" });
  return found;
}

/** What an agent at a tasking level may be doing (commons 0048-actors FR-040): T0 suggests; T1 also prepares drafts; T2 also assists a step the plan hash of which a person approved; T3 also assists the steps of a standing directive. */
export function levelAllows(level: TaskingLevel, work: AgentWork): boolean {
  const rank = TASKING_LEVELS.indexOf(level);
  const needs: Readonly<Record<AgentWork, number>> = { suggest: 0, "prepare-draft": 1, "assist-step": 2, "assist-standing": 3 };
  return rank >= needs[work];
}
