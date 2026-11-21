// Spec: 0002-planning-core FR-004
/**
 * The actor of an event: a person, an agent or a tool (0037-planning FR-005). An agent acts on behalf of a person, its principal (PROV-O section 4.1, `prov:actedOnBehalfOf`; delegation is the assignment of
 * authority and responsibility to an agent while the agent it acts on behalf of retains some responsibility for the outcome), and the actor says how the principal was established. The rule is in the
 * types and in the smart constructors: an agent value has a principal that is a person, a person value has no principal, and a tool may name the person who ran it. The principal of an agent is established
 * from who runs the work and never guessed (FR-045): `actorFor` takes a run's context and refuses an agent or a person where the context has none.
 *
 * @example
 * ```ts
 * import { agent, person } from "./actor.ts";
 * const p = person("ada", "Ada");
 * p.kind === "ok" && agent("claude", "Claude", p.value, "session"); // an agent acting for Ada
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { PrincipalBasis } from "./vocab.ts";

/** A person: an id and a name. It names no agent and no principal. */
export type PersonActor = { readonly kind: "person"; readonly id: string; readonly name: string };
/** An AI agent, with the person it acts for and how that person was established. */
export type AgentActor = { readonly kind: "agent"; readonly id: string; readonly name: string; readonly principal: PersonActor; readonly basis: PrincipalBasis };
/** A program with no judgement of its own; it may name the person who ran it. */
export type ToolActor = { readonly kind: "tool"; readonly id: string; readonly name: string; readonly ranBy?: PersonActor };
/** The one who wrote an event: a person, an agent or a tool. */
export type Actor = PersonActor | AgentActor | ToolActor;

/** Why an actor is refused. */
export type ActorProblem =
  | { readonly kind: "bad-actor-id"; readonly message: string }
  | { readonly kind: "agent-without-principal"; readonly agent: string }
  | { readonly kind: "principal-not-a-person"; readonly agent: string }
  | { readonly kind: "person-names-an-agent"; readonly person: string; readonly field: string }
  | { readonly kind: "no-person-in-context"; readonly asked: "person" | "agent" | "tool" }
  | { readonly kind: "commit-rule-not-named" };

/** One sentence for a refusal. */
export function describeActorProblem(p: ActorProblem): string {
  switch (p.kind) {
    case "bad-actor-id":
      return p.message;
    case "agent-without-principal":
      return `the agent ${p.agent} names no principal: an agent acts on behalf of a person`;
    case "principal-not-a-person":
      return `the principal of the agent ${p.agent} is not a person`;
    case "person-names-an-agent":
      return `the person ${p.person} carries ${p.field}: a person names no agent and no principal`;
    case "no-person-in-context":
      return `no principal is established for this run (no person's credentials, configuration or argument), so ${p.asked === "person" ? "an event of a person" : p.asked === "agent" ? "an event of an agent" : "the person who ran a tool"} cannot be made`;
    case "commit-rule-not-named":
      return "the configuration does not name the rule that takes the principal from the author of a commit";
    default:
      return absurd(p);
  }
}

function checkText(what: string, text: string): ActorProblem | undefined {
  // eslint-disable-next-line no-control-regex
  return text.length === 0 || text.length > 256 || /[\u0000-\u001f\u007f]/u.test(text) ? { kind: "bad-actor-id", message: `the ${what} of an actor is 1 to 256 characters with no control character` } : undefined;
}

/** A person. */
export function person(id: string, name: string): Result<PersonActor, ActorProblem> {
  const bad = checkText("id", id) ?? (name.length > 256 ? ({ kind: "bad-actor-id", message: "the name of an actor is at most 256 characters" } as const) : undefined);
  return bad === undefined ? ok({ kind: "person", id, name }) : err(bad);
}

/** An agent acting for `principal`, the person it acts for, established as `basis` says. A principal that is not a person is refused. */
export function agent(id: string, name: string, principal: PersonActor, basis: PrincipalBasis): Result<AgentActor, ActorProblem> {
  const bad = checkText("id", id);
  if (bad !== undefined) return err(bad);
  // A value of JavaScript may name anything as its principal, whatever its type says.
  const named: unknown = principal;
  if (named === undefined || named === null) return err({ kind: "agent-without-principal", agent: id });
  if (typeof named !== "object" || Reflect.get(named, "kind") !== "person") return err({ kind: "principal-not-a-person", agent: id });
  return ok({ kind: "agent", id, name, principal, basis });
}

/** A tool, with the person who ran it where there is one. */
export function tool(id: string, name: string, ranBy?: PersonActor): Result<ToolActor, ActorProblem> {
  const bad = checkText("id", id);
  return bad !== undefined ? err(bad) : ok(ranBy === undefined ? { kind: "tool", id, name } : { kind: "tool", id, name, ranBy });
}

/** Whether a value that came from outside (a file, a call) is an actor that keeps the rules, or why it is not. */
export function checkActor(value: unknown): Result<Actor, ActorProblem> {
  if (typeof value !== "object" || value === null) return err({ kind: "bad-actor-id", message: "an actor is an object" });
  const kind: unknown = Reflect.get(value, "kind");
  const id: unknown = Reflect.get(value, "id");
  const name: unknown = Reflect.get(value, "name");
  if (typeof id !== "string" || typeof name !== "string") return err({ kind: "bad-actor-id", message: "an actor has an id and a name, both text" });
  const principal: unknown = Reflect.get(value, "principal");
  const basis: unknown = Reflect.get(value, "basis");
  const ranBy: unknown = Reflect.get(value, "ranBy");
  switch (kind) {
    case "person": {
      for (const field of ["principal", "basis", "ranBy", "agent", "onBehalfOf"] as const) if (Reflect.has(value, field)) return err({ kind: "person-names-an-agent", person: id, field });
      return person(id, name);
    }
    case "agent": {
      if (principal === undefined || principal === null) return err({ kind: "agent-without-principal", agent: id });
      const p = checkActor(principal);
      if (p.kind === "err") return p;
      if (p.value.kind !== "person") return err({ kind: "principal-not-a-person", agent: id });
      const b = basisOf(basis);
      return b === undefined ? err({ kind: "bad-actor-id", message: `the agent ${id} says no valid basis for its principal` }) : agent(id, name, p.value, b);
    }
    case "tool": {
      if (ranBy === undefined) return tool(id, name);
      const p = checkActor(ranBy);
      if (p.kind === "err") return p;
      return p.value.kind === "person" ? tool(id, name, p.value) : err({ kind: "principal-not-a-person", agent: id });
    }
    default:
      return err({ kind: "bad-actor-id", message: "the kind of an actor is person, agent or tool" });
  }
}

function basisOf(value: unknown): PrincipalBasis | undefined {
  return value === "session" || value === "argument" || value === "configuration" || value === "commit-author" ? value : undefined;
}

/**
 * Who runs the work (0037-planning FR-045): the person whose credentials or session launched the program, a person an argument names, the principal of a headless run's configuration, or the author of a
 * commit where the configuration names that rule. A context with no person is `none`.
 */
export type RunContext =
  | { readonly kind: "session"; readonly person: PersonActor }
  | { readonly kind: "argument"; readonly person: PersonActor }
  | { readonly kind: "configuration"; readonly person: PersonActor }
  | { readonly kind: "commit-author"; readonly person: PersonActor }
  | { readonly kind: "none" };

/** The context of a commit whose author is a person and whose trailer names an agent: allowed only where the configuration names the rule. */
export function contextOfCommit(author: PersonActor, configurationNamesTheRule: boolean): Result<RunContext, ActorProblem> {
  return configurationNamesTheRule ? ok({ kind: "commit-author", person: author }) : err({ kind: "commit-rule-not-named" });
}

/** Who the event is to be written as: the person who runs the work, an agent acting for that person, or a tool. */
export type ActorRole = { readonly kind: "person" } | { readonly kind: "agent"; readonly id: string; readonly name: string } | { readonly kind: "tool"; readonly id: string; readonly name: string };

/**
 * The actor of an event made in a context. A person's event needs a person's credentials, configuration or argument; an agent's event takes the context's person as its principal, with the basis the context
 * says; a tool names the person who ran it where there is one. A context with no person refuses a person and an agent, and says that no principal is established.
 */
export function actorFor(context: RunContext, role: ActorRole): Result<Actor, ActorProblem> {
  switch (role.kind) {
    case "person":
      return context.kind === "session" || context.kind === "argument" || context.kind === "configuration" ? ok(context.person) : err({ kind: "no-person-in-context", asked: "person" });
    case "agent":
      return context.kind === "none" ? err({ kind: "no-person-in-context", asked: "agent" }) : agent(role.id, role.name, context.person, context.kind);
    case "tool":
      return context.kind === "none" ? tool(role.id, role.name) : tool(role.id, role.name, context.person);
    default:
      return absurd(role);
  }
}
