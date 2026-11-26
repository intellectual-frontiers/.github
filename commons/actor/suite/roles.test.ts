/**
 * Tests of the roles of an act (commons actor 0002-actor-roles FR-001 to FR-004): the types refuse an agent as initiator, reviewer or approver, the decoder refuses it with the role named, the directive belongs to the
 * initiator, the findings, and the tasking levels.
 *
 * @module
 */
import fc from "fast-check";
import type { Act, Role } from "@intellectual-frontiers/actor/governance";
import { TASKING_LEVELS } from "@intellectual-frontiers/actor/governance";
import { decodeAct, decodeActor, levelAllows, roleFindings, undirected } from "@intellectual-frontiers/actor/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { agent, DIGEST, directive, person, system } from "./fixtures.ts";

const act = (over: Partial<Record<Role | "directive", unknown>> = {}): unknown => ({ initiatedBy: person(1), preparedBy: agent, assistedBy: [], directive: directive(person(1)), ...over });

proves(["0002-actor-roles FR-002"], "an agent as initiator, reviewer or approver does not type check", () => {
  // @ts-expect-error an agent is not a person: it cannot initiate
  const a: Act = { initiatedBy: agent, assistedBy: [], directive: null };
  // @ts-expect-error an agent is not a person: it cannot review
  const b: Act = { initiatedBy: person(1), reviewedBy: agent, assistedBy: [], directive: null };
  // @ts-expect-error an agent is not a person: it cannot approve
  const c: Act = { initiatedBy: person(1), approvedBy: agent, assistedBy: [], directive: null };
  // @ts-expect-error a person is not an agent or a system: it is not an assistant
  const d: Act = { initiatedBy: person(1), assistedBy: [person(2)], directive: null };
  // @ts-expect-error an agent is not a person or a system: it does not execute
  const e: Act = { initiatedBy: person(1), executedBy: agent, assistedBy: [], directive: null };
  assert([a, b, c, d, e].length === 5);
  const ok: Act = { initiatedBy: person(1), preparedBy: agent, assistedBy: [agent, system], executedBy: system, reviewedBy: person(2), approvedBy: person(2), directive: directive(person(1)) };
  assertEquals(ok.initiatedBy.kind, "person");
});

proves(["0002-actor-roles FR-002", "0002-actor-roles FR-003"], "a value from outside is refused with the role named", () => {
  for (const role of ["initiatedBy", "reviewedBy", "approvedBy"] as const) {
    const r = decodeAct(act({ [role]: agent, directive: null }));
    assert(r.kind === "err" && r.error.kind === "role" && r.error.role === role && r.error.found === "agent", role);
  }
  const executed = decodeAct(act({ executedBy: agent }));
  assert(executed.kind === "err" && executed.error.kind === "role" && executed.error.role === "executedBy");
  const assisted = decodeAct(act({ assistedBy: [person(2)] }));
  assert(assisted.kind === "err" && assisted.error.kind === "role" && assisted.error.role === "assistedBy" && assisted.error.found === "person");
  assert(decodeAct(act({ preparedBy: person(2) })).kind === "ok");
  assert(decodeAct(act({ preparedBy: system })).kind === "ok");
});

proves(["0002-actor-roles FR-001"], "an actor is decoded with its kind, an id and for an agent the reported model", () => {
  assert(decodeActor({ kind: "robot", id: "x" }).kind === "err");
  assert(decodeActor({ kind: "person" }).kind === "err");
  assert(decodeActor({ kind: "agent", id: "a" }).kind === "err", "an agent with no model");
  assert(decodeActor({ kind: "agent", id: "a", model: { name: "m", assurance: "verified" } }).kind === "err", "verified is not offered");
  assert(decodeActor({ kind: "agent", id: "a", model: { name: "m", assurance: "reported" }, instructionsDigest: "zz" }).kind === "err");
  const good = decodeActor({ kind: "agent", id: "a", model: { name: "m", assurance: "reported" }, instructionsDigest: DIGEST });
  assert(good.kind === "ok" && good.value.kind === "agent" && good.value.instructionsDigest === DIGEST);
});

proves(["0002-actor-roles FR-004"], "the initiator owns the directive; an agent's act with no directive is undirected; the findings", () => {
  const other = decodeAct(act({ directive: directive(person(2)) }));
  assert(other.kind === "err" && other.error.kind === "initiator-not-owner");
  const none = decodeAct(act({ directive: null }));
  assert(none.kind === "ok" && undirected(none.value) && roleFindings(none.value).some((f) => f.rule === "undirected"));
  const alone = decodeAct(act({ reviewedBy: person(1), approvedBy: person(1) }));
  assert(alone.kind === "ok" && roleFindings(alone.value).some((f) => f.rule === "roles-not-separate"));
  const self = decodeAct(act({ preparedBy: person(1), reviewedBy: person(1) }));
  assert(self.kind === "ok" && roleFindings(self.value).some((f) => f.rule === "reviewer-is-preparer"));
  const fine = decodeAct(act({ reviewedBy: person(2), approvedBy: person(2) }));
  assert(fine.kind === "ok" && roleFindings(fine.value).length === 0 && !undirected(fine.value));
});

proves(["0002-actor-roles FR-004"], "each tasking level allows what the levels below it allow", () => {
  assert(levelAllows("T0", "suggest") && !levelAllows("T0", "prepare-draft"));
  assert(levelAllows("T1", "prepare-draft") && !levelAllows("T1", "assist-step"));
  assert(levelAllows("T2", "assist-step") && !levelAllows("T2", "assist-standing"));
  assert(levelAllows("T3", "assist-standing"));
  fc.assert(
    fc.property(fc.constantFrom(...TASKING_LEVELS), fc.constantFrom("suggest", "prepare-draft", "assist-step", "assist-standing" as const), (level, work) => {
      const i = TASKING_LEVELS.indexOf(level);
      const higher = TASKING_LEVELS[Math.min(i + 1, TASKING_LEVELS.length - 1)] ?? level;
      return !levelAllows(level, work) || levelAllows(higher, work);
    }),
  );
});

proves(["0002-actor-roles FR-002"], "no generated act of any actors gives an agent one of the three persons' roles", () => {
  const kinds = fc.constantFrom(person(1), person(2), system, agent);
  fc.assert(
    fc.property(kinds, kinds, kinds, (i, r, a) => {
      const d = decodeAct({ initiatedBy: i, reviewedBy: r, approvedBy: a, assistedBy: [], directive: null });
      const should = i.kind === "person" && r.kind === "person" && a.kind === "person";
      return should ? d.kind === "ok" : d.kind === "err";
    }),
  );
});
