/**
 * The events of Planning (commons planning 0002-planning-core FR-005): the fourteen types as a closed union, an event built only by `makeEvent` and immutable once built, and the refusals of the build.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import * as governance from "@intellectual-frontiers/planning/governance";
import * as logical from "@intellectual-frontiers/planning/logical";
import { type Actor, describeEventProblem, EVENT_TYPES, type EventData, makeEvent, type PersonActor } from "@intellectual-frontiers/planning/governance";
import { ACTORS, ADA, at, eventIds, itemId, must, SAMPLES } from "./support.ts";

const item = itemId();
const [id] = eventIds(1);
if (id === undefined) throw new Error("an id");

proves(["0002-planning-core FR-005"], "an event is one case of the closed union of fourteen types, each with an id, an item, a time and an actor", () => {
  assertEquals(Object.keys(SAMPLES), [...EVENT_TYPES]);
  assertEquals(EVENT_TYPES.length, 14);
  for (const type of EVENT_TYPES) {
    const actor: Actor = type === "confirmed" ? ADA : (ACTORS[2] as Actor);
    const e = must(makeEvent({ id, item, at: at(1), actor }, SAMPLES[type]));
    assertEquals(e.data.type, type);
    assertEquals([e.id, e.item, e.at, e.actor], [id, item, at(1), actor]);
  }
  // @ts-expect-error a type that is not one of the fourteen does not compile
  const noType: EventData = { type: "seen" };
  assertEquals(noType.type, "seen");
});

proves(["0002-planning-core FR-005"], "an event is deeply frozen once built, whatever the caller does with what it passed in, and an item's history cannot be changed", () => {
  const data: Extract<EventData, { readonly type: "labeled" }> = { type: "labeled", add: ["x"], remove: [] };
  const e = must(makeEvent({ id, item, at: at(1), actor: ADA }, data));
  assert(Object.isFrozen(e) && Object.isFrozen(e.data) && Object.isFrozen(e.actor));
  assert(Object.isFrozen((e.data as typeof data).add), "the lists of the data are frozen");
  // The caller's own value is not frozen and does not reach into the event.
  (data.add as string[]).push("y");
  assertEquals((e.data as typeof data).add, ["x"]);
  let threw = false;
  try {
    (e as { id: string }).id = "other";
  } catch {
    threw = true;
  }
  assert(threw, "an assignment to a frozen event throws");
  assertEquals(e.id, id);
});

proves(["0002-planning-core FR-005"], "the library has no operation that changes or removes an event", () => {
  const names = [...Object.keys(governance), ...Object.keys(logical)];
  assert(names.length > 40);
  const forbidden = names.filter((n) => /event/i.test(n) && /^(update|remove|delete|mutate|change|edit|replace|set|overwrite|rewrite|drop)/i.test(n));
  assertEquals(forbidden, []);
  assert(names.includes("makeEvent") && names.includes("orderEvents"));
});

proves(["0002-planning-core FR-005"], "only a person confirms: a confirmation by an agent or a tool is refused when the event is built", () => {
  for (const actor of [ACTORS[2], ACTORS[3]] as readonly Actor[]) {
    const r = makeEvent({ id, item, at: at(1), actor }, { type: "confirmed" });
    assert(r.kind === "err" && r.error.kind === "confirmed-by-a-non-person");
    assertStringIncludes(describeEventProblem(r.error), "only a person confirms");
  }
  assert(makeEvent({ id, item, at: at(1), actor: ADA }, { type: "confirmed" }).kind === "ok");
});

proves(["0002-planning-core FR-005"], "an event of an agent with no principal is refused when built, whatever its types said, and so is a person that names an agent", () => {
  const noPrincipal = { kind: "agent", id: "claude", name: "Claude", basis: "session" } as unknown as Actor;
  const r = makeEvent({ id, item, at: at(1), actor: noPrincipal }, { type: "commented", body: "x" });
  assert(r.kind === "err" && r.error.kind === "actor" && r.error.problem.kind === "agent-without-principal");
  const naming = { kind: "person", id: "ada", name: "Ada", principal: ADA } as unknown as PersonActor;
  const p = makeEvent({ id, item, at: at(1), actor: naming }, { type: "commented", body: "x" });
  assert(p.kind === "err" && p.error.kind === "actor" && p.error.problem.kind === "person-names-an-agent");
});

proves(["0002-planning-core FR-005"], "an item is not linked to itself", () => {
  const r = makeEvent({ id, item, at: at(1), actor: ADA }, { type: "linked", change: "add", link: "relates-to", to: item });
  assert(r.kind === "err" && r.error.kind === "link-to-itself");
});
