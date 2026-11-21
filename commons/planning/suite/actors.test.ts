/**
 * The actors of Planning (commons planning 0002-planning-core FR-004): a person, an agent that acts on behalf of a person (`prov:actedOnBehalfOf`, PROV-O section 4.1) and a tool; the rule is in the types and in
 * the smart constructors, and holds for a value that came from outside. A run's context makes an actor, and refuses a person's or an agent's event where it has no person.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  type Actor,
  type ActorRole,
  actorFor,
  agent,
  checkActor,
  contextOfCommit,
  describeActorProblem,
  type PersonActor,
  person,
  type PrincipalBasis,
  type RunContext,
  tool,
} from "@intellectual-frontiers/planning/governance";
import { ADA, BOB, must } from "./support.ts";

proves(["0002-planning-core FR-004"], "an agent names the person it acts for and how that was established, and a person names no agent and no principal", () => {
  const claude = must(agent("claude", "Claude", ADA, "session"));
  assertEquals(claude, { kind: "agent", id: "claude", name: "Claude", principal: ADA, basis: "session" });
  assertEquals(must(person("ada", "Ada")), { kind: "person", id: "ada", name: "Ada" });
  assertEquals(must(tool("scanner", "Scanner")), { kind: "tool", id: "scanner", name: "Scanner" });
  assertEquals(must(tool("scanner", "Scanner", ADA)).ranBy, ADA);
  // @ts-expect-error an agent with no principal does not compile
  const noPrincipal: Actor = { kind: "agent", id: "claude", name: "Claude", basis: "session" };
  // @ts-expect-error an agent with no basis for its principal does not compile
  const noBasis: Actor = { kind: "agent", id: "claude", name: "Claude", principal: ADA };
  // @ts-expect-error a person that carries a principal does not compile
  const personWithPrincipal: Actor = { kind: "person", id: "ada", name: "Ada", principal: BOB };
  // @ts-expect-error the principal of an agent is a person and not an agent
  const agentPrincipal = agent("a", "A", claude, "session");
  assertEquals([noPrincipal.kind, noBasis.kind, personWithPrincipal.kind, agentPrincipal.kind], ["agent", "agent", "person", "err"]);
});

proves(["0002-planning-core FR-004"], "an agent with no principal, an agent whose principal is not a person and an id that is not an id are refused by the constructors, whatever the types said", () => {
  const none = agent("claude", "Claude", undefined as unknown as PersonActor, "session");
  assert(none.kind === "err" && none.error.kind === "agent-without-principal");
  assertStringIncludes(describeActorProblem(none.error), "acts on behalf of a person");
  const nul = agent("claude", "Claude", null as unknown as PersonActor, "session");
  assert(nul.kind === "err" && nul.error.kind === "agent-without-principal");
  const notPerson = agent("claude", "Claude", { kind: "agent", id: "x", name: "X" } as unknown as PersonActor, "session");
  assert(notPerson.kind === "err" && notPerson.error.kind === "principal-not-a-person");
  for (const bad of ["", "a\nb", "x".repeat(257)]) {
    assert(person(bad, "n").kind === "err" && agent(bad, "n", ADA, "session").kind === "err" && tool(bad, "n").kind === "err");
  }
});

proves(["0002-planning-core FR-004"], "an actor read from outside is checked by the same rules: an agent with no principal is invalid, and a person that names an agent or a principal is invalid", () => {
  const claude = must(agent("claude", "Claude", ADA, "argument"));
  assertEquals(checkActor(JSON.parse(JSON.stringify(claude))), { kind: "ok", value: claude });
  assert(checkActor({ kind: "agent", id: "claude", name: "Claude", basis: "session" }).kind === "err");
  assert(checkActor({ kind: "agent", id: "claude", name: "Claude", principal: null, basis: "session" }).kind === "err");
  assert(checkActor({ kind: "agent", id: "claude", name: "Claude", principal: { kind: "agent", id: "x", name: "X", principal: ADA, basis: "session" }, basis: "session" }).kind === "err");
  assert(checkActor({ kind: "agent", id: "claude", name: "Claude", principal: ADA, basis: "guess" }).kind === "err");
  for (const field of ["principal", "basis", "ranBy", "agent", "onBehalfOf"]) {
    const r = checkActor({ kind: "person", id: "ada", name: "Ada", [field]: ADA });
    assert(r.kind === "err" && r.error.kind === "person-names-an-agent" && r.error.field === field, field);
  }
  assert(checkActor({ kind: "tool", id: "scanner", name: "S", ranBy: ADA }).kind === "ok");
  assert(checkActor({ kind: "tool", id: "scanner", name: "S" }).kind === "ok");
  assert(checkActor({ kind: "tool", id: "scanner", name: "S", ranBy: claude }).kind === "err");
  for (const junk of [null, 3, "ada", [], {}, { kind: "robot", id: "x", name: "x" }, { kind: "person", id: 1, name: "x" }]) assert(checkActor(junk).kind === "err");
});

proves(["0002-planning-core FR-004"], "a run's context makes the actor: a person's or an agent's event needs a person in the context, an agent takes it as its principal with the basis of the context", () => {
  const sessions: readonly RunContext[] = [
    { kind: "session", person: ADA },
    { kind: "argument", person: ADA },
    { kind: "configuration", person: ADA },
  ];
  for (const context of sessions) {
    assertEquals(must(actorFor(context, { kind: "person" })), ADA);
    const a = must(actorFor(context, { kind: "agent", id: "claude", name: "Claude" }));
    assert(a.kind === "agent" && a.principal === ADA && a.basis === context.kind);
    assertEquals(must(actorFor(context, { kind: "tool", id: "scanner", name: "S" })), { kind: "tool", id: "scanner", name: "S", ranBy: ADA });
  }
  const none: RunContext = { kind: "none" };
  for (const role of [{ kind: "person" }, { kind: "agent", id: "claude", name: "Claude" }] as const satisfies readonly ActorRole[]) {
    const r = actorFor(none, role);
    assert(r.kind === "err" && r.error.kind === "no-person-in-context");
    assertStringIncludes(describeActorProblem(r.error), "no principal is established");
  }
  assertEquals(must(actorFor(none, { kind: "tool", id: "scanner", name: "S" })), { kind: "tool", id: "scanner", name: "S" });
});

proves(["0002-planning-core FR-004"], "the principal may come from the author of a commit only where the configuration names that rule, and then the agent says so; the author is not credentials for a person's own event", () => {
  const refused = contextOfCommit(BOB, false);
  assert(refused.kind === "err" && refused.error.kind === "commit-rule-not-named");
  const context = must(contextOfCommit(BOB, true));
  const a = must(actorFor(context, { kind: "agent", id: "claude", name: "Claude" }));
  assert(a.kind === "agent" && a.principal === BOB && a.basis === "commit-author");
  assert(actorFor(context, { kind: "person" }).kind === "err");
});

proves(["0002-planning-core FR-004"], "for every context and role an agent made has a principal that is a person and a basis that is the context's, and a person is made only from credentials, configuration or an argument", () => {
  const contexts: readonly RunContext[] = [
    { kind: "session", person: ADA },
    { kind: "argument", person: BOB },
    { kind: "configuration", person: ADA },
    must(contextOfCommit(BOB, true)),
    { kind: "none" },
  ];
  fc.assert(
    fc.property(fc.constantFrom(...contexts), fc.constantFrom<ActorRole>({ kind: "person" }, { kind: "agent", id: "claude", name: "C" }, { kind: "tool", id: "t", name: "T" }), (context, role) => {
      const r = actorFor(context, role);
      if (r.kind === "err") return context.kind === "none" ? role.kind !== "tool" : context.kind === "commit-author" && role.kind === "person";
      const a = r.value;
      if (a.kind === "agent") return a.principal.kind === "person" && a.basis === (context.kind as PrincipalBasis);
      if (a.kind === "person") return context.kind === "session" || context.kind === "argument" || context.kind === "configuration";
      return true;
    }),
  );
});
