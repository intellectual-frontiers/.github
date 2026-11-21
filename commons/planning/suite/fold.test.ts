/**
 * The fold of events into an item (commons planning 0002-planning-core FR-002, FR-006): a pure and total function that gives the same item for the same events in any order and with any repeats, a conflict value
 * for two contents of one id, a proposed state until a person confirms, and the authority of each field applied over the events.
 *
 * @module
 */
import fc from "fast-check";
import { absurd } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  type Actor,
  type AuthorityField,
  type EventData,
  type FieldAuthority,
  type Item,
  type ItemEvent,
  type ItemOf,
  type Policy,
  isCounted,
  ITEM_KINDS,
  parseDay,
  STATE_KINDS,
} from "@intellectual-frontiers/planning/governance";
import { canonical, describeFoldProblem, fold, mintEventId, newClock, orderEvents, seeId } from "@intellectual-frontiers/planning/logical";
import { ACTORS, ADA, BOB, event, eventIds, history, historyArb, itemId, must, OTHER_REPLICA, policyArb, REPLICA, WALL } from "./support.ts";

const AGENT = ACTORS[2] as Actor;
const TOOL = ACTORS[3] as Actor;

/** The events in any order and with some repeated: a random key for each. */
const scrambled = (events: readonly ItemEvent[]) =>
  fc.tuple(fc.array(fc.nat({ max: Math.max(events.length - 1, 0) }), { maxLength: 8 }), fc.array(fc.integer(), { minLength: events.length + 8, maxLength: events.length + 8 })).map(([again, keys]) => {
    const all = [...events, ...again.map((i) => events[i]).filter((e): e is ItemEvent => e !== undefined)];
    return all.map((e, i) => ({ e, k: keys[i] ?? 0 })).sort((a, b) => a.k - b.k).map((x) => x.e);
  });

proves(["0002-planning-core FR-006"], "the same events in any order or with any repeats give the same item, under any policy", () => {
  const item = itemId();
  fc.assert(
    fc.property(
      historyArb.chain((h) => fc.tuple(fc.constant(history(item, h.origin, h.opener, h.steps)), policyArb)).chain(([events, policy]) => fc.tuple(fc.constant(events), fc.constant(policy), scrambled(events), scrambled(events))),
      ([events, policy, a, b]) => {
        const plain = fold(events, policy);
        assert(plain.kind === "ok");
        const ra = fold(a, policy);
        const rb = fold(b, policy);
        return canonical(ra) === canonical(plain) && canonical(rb) === canonical(plain);
      },
    ),
    { numRuns: 400 },
  );
});

proves(["0002-planning-core FR-006"], "two stores' events merge by union: any interleaving of the events of two replicas, each store holding repeats, folds to one item, and the next id made after the merge is after every id taken", () => {
  const item = itemId();
  fc.assert(
    fc.property(fc.array(fc.record({ replica: fc.boolean(), step: fc.integer({ min: 0, max: 12 }), wall: fc.integer({ min: 0, max: 30 }) }), { minLength: 1, maxLength: 20 }), fc.integer(), (specs, seed) => {
      let clocks = { a: newClock(REPLICA), b: newClock(OTHER_REPLICA) };
      const first = must(mintEventId(clocks.a, WALL));
      clocks = { ...clocks, a: first.clock };
      const events: ItemEvent[] = [event(item, first.id, 0, ADA, { type: "opened", kind: "issue", title: "T", body: "", labels: [], assignees: [], origin: "declared" })];
      specs.forEach((s, i) => {
        const side = s.replica ? "a" : "b";
        const m = must(mintEventId(clocks[side], WALL + s.wall * 1000));
        clocks = { ...clocks, [side]: m.clock };
        events.push(event(item, m.id, i + 1, s.replica ? ADA : BOB, s.step % 2 === 0 ? { type: "commented", body: `c${i}` } : { type: "labeled", add: [`l${i % 3}`], remove: [`l${(i + 1) % 3}`] }));
      });
      const a = events.filter((_, i) => i % 2 === 0 || i === 0);
      const b = events.filter((_, i) => i % 2 === 1 || i === 0);
      const merged = [...b, ...a, ...a];
      const shuffled = merged.map((e, i) => ({ e, k: (seed * (i + 7919)) % 1009 })).sort((x, y) => x.k - y.k).map((x) => x.e);
      assert(canonical(fold(shuffled)) === canonical(fold(events)));
      // After the merge, the next id made by either replica is after every id taken.
      let c = newClock(REPLICA);
      for (const e of events) c = must(seeId(c, e.id, WALL + 60_000));
      const next = must(mintEventId(c, WALL));
      return events.every((e) => next.id > e.id);
    }),
    { numRuns: 200 },
  );
});

proves(["0002-planning-core FR-006"], "two events with one id and different content are a conflict value that names the ids, and the same event twice is one", () => {
  const item = itemId();
  const [a, b] = eventIds(2);
  if (a === undefined || b === undefined) throw new Error("ids");
  const open = event(item, a, 0, ADA, { type: "opened", kind: "issue", title: "T", body: "", labels: [], assignees: [], origin: "declared" });
  const c1 = event(item, b, 1, ADA, { type: "commented", body: "one" });
  const c2 = event(item, b, 1, ADA, { type: "commented", body: "two" });
  const r = fold([open, c1, c2]);
  assert(r.kind === "err" && r.error.kind === "conflict" && r.error.ids.join() === b);
  assertStringIncludes(describeFoldProblem(r.error), "nothing is settled");
  assertEquals(canonical(fold([c2, c1, open])), canonical(r));
  const twice = must(fold([open, c1, c1, open]));
  assertEquals(twice.events.length, 2);
  assertEquals(twice.comments.length, 1);
  // The same content made by two builds is the same event.
  assert(fold([open, event(item, b, 1, ADA, { type: "commented", body: "one" }), c1]).kind === "ok");
});

proves(["0002-planning-core FR-006"], "an empty history, a history of two items and a history that does not begin with its opening are error values", () => {
  assertEquals(fold([]), { kind: "err", error: { kind: "no-events" } });
  const item = itemId();
  const other = itemId(1);
  const [a, b, c] = eventIds(3);
  if (a === undefined || b === undefined || c === undefined) throw new Error("ids");
  const open = event(item, a, 0, ADA, { type: "opened", kind: "issue", title: "T", body: "", labels: [], assignees: [], origin: "declared" });
  const stray = event(other, b, 1, ADA, { type: "commented", body: "x" });
  const mixed = fold([open, stray]);
  assert(mixed.kind === "err" && mixed.error.kind === "mixed-items" && mixed.error.expected === item && mixed.error.found === other);
  assertEquals(canonical(fold([stray, open])), canonical(mixed));
  const headless = fold([event(item, c, 2, ADA, { type: "commented", body: "x" })]);
  assert(headless.kind === "err" && headless.error.kind === "not-opened" && headless.error.first === c);
  assertStringIncludes(describeFoldProblem(headless.error), "not the opening");
  assert(orderEvents([open, stray]).kind === "ok");
});

proves(["0002-planning-core FR-006"], "a second opening is passed over and the first event is the opening, as the history is ordered by id", () => {
  const item = itemId();
  const [a, b] = eventIds(2);
  if (a === undefined || b === undefined) throw new Error("ids");
  const r = must(fold([event(item, b, 1, BOB, { type: "opened", kind: "task", title: "Later", body: "", labels: [], assignees: [], origin: "declared" }), event(item, a, 0, ADA, { type: "opened", kind: "issue", title: "First", body: "", labels: [], assignees: [], origin: "declared" })]));
  assertEquals([r.title, r.kind, r.openedBy.id], ["First", "issue", ADA.id]);
});

/** The fields of an item that a plain history decides, written again as the monorepo's own fold writes them: the events by id, each type applied in turn. */
function reference(events: readonly ItemEvent[]) {
  const es = [...new Map(events.map((e) => [e.id, e])).values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  let title = "";
  let body = "";
  let severity: string | undefined;
  let blocker: boolean | undefined;
  const labels = new Set<string>();
  const assignees = new Set<string>();
  const comments: string[] = [];
  const decisions: string[] = [];
  es.forEach((e, i) => {
    const d = e.data;
    switch (d.type) {
      case "opened":
        if (i > 0) return;
        title = d.title;
        body = d.body;
        severity = d.severity;
        blocker = d.blocker;
        d.labels.forEach((l) => labels.add(l));
        d.assignees.forEach((l) => assignees.add(l));
        return;
      case "commented":
        comments.push(d.body);
        return;
      case "edited":
        title = d.title ?? title;
        body = d.body ?? body;
        return;
      case "labeled":
        d.add.forEach((l) => labels.add(l));
        d.remove.forEach((l) => labels.delete(l));
        return;
      case "assigned":
        d.add.forEach((l) => assignees.add(l));
        d.remove.forEach((l) => assignees.delete(l));
        return;
      case "severity-set":
        severity = d.severity;
        return;
      case "blocker-set":
        blocker = d.blocker;
        return;
      case "decided":
        decisions.push(`${d.verdict}:${d.note}`);
        return;
      case "started":
      case "deferred":
      case "closed":
      case "reopened":
      case "linked":
      case "confirmed":
        return;
      default:
        return absurd(d);
    }
  });
  return { title, body, severity, blocker, labels: [...labels].sort(), assignees: [...assignees].sort(), comments, decisions };
}

proves(["0002-planning-core FR-006"], "with no authority set, the fields are what a plain fold of the events by id gives (the monorepo's fold written again)", () => {
  const item = itemId();
  fc.assert(
    fc.property(historyArb, (h) => {
      const events = history(item, "declared", h.opener, h.steps);
      const r = must(fold(events));
      const want = reference(events);
      assertEquals(r.title, want.title);
      assertEquals(r.body, want.body);
      assertEquals(r.severity, want.severity);
      assertEquals(r.blocker, want.blocker);
      assertEquals([...r.labels], want.labels);
      assertEquals([...r.assignees], want.assignees);
      assertEquals(r.comments.map((c) => c.body), want.comments);
      assertEquals(r.decisions.map((d) => `${d.verdict}:${d.note}`), want.decisions);
      assertEquals([r.openedAt, r.updatedAt, r.openedBy], [events[0]?.at, events.at(-1)?.at, events[0]?.actor]);
      return true;
    }),
    { numRuns: 300 },
  );
});

const OPENING = (origin: "declared" | "derived" | "inferred" = "declared"): EventData => ({ type: "opened", kind: "issue", title: "T", body: "B", labels: [], assignees: [], origin });

/** A history from a list of the actors and data of the events after an opening by `opener`. */
function story(opener: Actor, origin: "declared" | "derived" | "inferred", rest: readonly (readonly [Actor, EventData])[]) {
  const item = itemId();
  const ids = eventIds(rest.length + 1);
  const events = [event(item, ids[0] as ItemEvent["id"], 0, opener, OPENING(origin))];
  rest.forEach(([actor, data], i) => events.push(event(item, ids[i + 1] as ItemEvent["id"], i + 1, actor, data)));
  return events;
}

const UNTIL = must(parseDay("2027-03-01"));

proves(["0002-planning-core FR-002", "0002-planning-core FR-006"], "the state is a fold: open, started, deferred with its day, closed with its reason and its actor, and reopened", () => {
  const state = (rest: readonly (readonly [Actor, EventData])[]) => must(fold(story(ADA, "declared", rest))).state;
  assertEquals(state([]), { kind: "open" });
  assertEquals(state([[ADA, { type: "started" }]]), { kind: "in-progress" });
  assertEquals(state([[ADA, { type: "deferred", until: UNTIL }]]), { kind: "deferred", until: UNTIL });
  assertEquals(state([[ADA, { type: "started" }], [ADA, { type: "deferred", until: UNTIL }], [ADA, { type: "started" }]]), { kind: "in-progress" });
  const closed = state([[ADA, { type: "closed", reason: "not-planned" }]]);
  assert(closed.kind === "closed" && closed.reason === "not-planned" && closed.by.id === ADA.id);
  assertEquals(state([[ADA, { type: "closed", reason: "completed" }], [ADA, { type: "reopened" }]]), { kind: "open" });
  assertEquals(state([[ADA, { type: "deferred", until: UNTIL }], [ADA, { type: "reopened" }]]), { kind: "open" });
  // A closed item is not started or deferred again: it is reopened first. An open one is not reopened into anything else.
  assertEquals(state([[ADA, { type: "closed", reason: "completed" }], [ADA, { type: "started" }]]).kind, "closed");
  assertEquals(state([[ADA, { type: "closed", reason: "completed" }], [ADA, { type: "deferred", until: UNTIL }]]).kind, "closed");
  assertEquals(state([[ADA, { type: "started" }], [ADA, { type: "reopened" }]]).kind, "in-progress");
  const again = state([[ADA, { type: "closed", reason: "completed" }], [BOB, { type: "closed", reason: "duplicate" }]]);
  assert(again.kind === "closed" && again.reason === "duplicate" && again.by.id === BOB.id);
});

proves(["0002-planning-core FR-002"], "an item of each of the four kinds has every field of the core, and the five states are all reachable", () => {
  for (const kind of ITEM_KINDS) {
    const item = itemId();
    const [a] = eventIds(1);
    const r = must(fold([event(item, a as ItemEvent["id"], 0, ADA, { type: "opened", kind, title: "T", body: "B", labels: ["l"], assignees: ["a"], origin: "declared", severity: "error", priority: "P1", goals: ["G1"] })]));
    assertEquals(r.kind, kind);
    for (const f of ["id", "title", "body", "labels", "assignees", "severity", "origin", "state", "external", "links", "comments", "decisions", "waiting", "openedBy", "openedAt", "updatedAt", "events", "priority", "goals"] as const) {
      assert(f in r, `${kind} has ${f}`);
    }
  }
  const seen = new Set<string>();
  for (const rest of [[], [[ADA, { type: "started" }]], [[ADA, { type: "deferred", until: UNTIL }]], [[ADA, { type: "closed", reason: "completed" }]]] as const) seen.add(must(fold(story(ADA, "declared", rest))).state.kind);
  seen.add(must(fold(story(AGENT, "inferred", []))).state.kind);
  assertEquals([...seen].sort(), [...STATE_KINDS].sort());
  const kindName = (i: Item): string => {
    switch (i.kind) {
      case "issue":
      case "task":
      case "todo":
      case "finding":
        return i.kind;
      default:
        return absurd(i);
    }
  };
  assertEquals(kindName(must(fold(story(ADA, "declared", [])))), "issue");
  // @ts-expect-error an item of the kind issue with no title does not compile: no kind removes a field of the core
  const noTitle: ItemOf<"issue"> = { kind: "issue", id: itemId() };
  assertEquals(noTitle.kind, "issue");
});

proves(["0002-planning-core FR-006"], "an item that a tool derived from a place by an exact rule, or that a person declared, is open and counted: only an inferred one is proposed", () => {
  for (const [opener, origin] of [[TOOL, "derived"], [ADA, "declared"], [AGENT, "declared"], [TOOL, "declared"]] as const) {
    const item = must(fold(story(opener, origin, [])));
    assertEquals(item.state, { kind: "open" });
    assert(isCounted(item));
  }
  assertEquals(must(fold(story(TOOL, "inferred", []))).state, { kind: "proposed" });
});

proves(["0002-planning-core FR-006"], "the links of an item are the adds and removes of its linked events, in order, as a set", () => {
  const a = itemId(7);
  const b = itemId(8);
  const link = (change: "add" | "remove", to: typeof a): [Actor, EventData] => [ADA, { type: "linked", change, link: "same-as", to }];
  const links = (rest: readonly (readonly [Actor, EventData])[]) => must(fold(story(ADA, "declared", rest))).links.map((l) => `${l.kind} ${l.to === a ? "a" : "b"}`);
  assertEquals(links([link("add", a), link("add", b), link("add", a)]), ["same-as a", "same-as b"].sort());
  assertEquals(links([link("add", a), link("remove", a)]), []);
  assertEquals(links([link("add", a), link("remove", a), link("add", a)]), ["same-as a"]);
  assertEquals(links([link("remove", a), link("add", b)]), ["same-as b"]);
});

proves(["0002-planning-core FR-006"], "an item inferred by an agent or a heuristic starts proposed, is not counted, and leaves proposed only by a person's confirmation", () => {
  const proposed = must(fold(story(AGENT, "inferred", [])));
  assertEquals(proposed.state, { kind: "proposed" });
  assert(!isCounted(proposed));
  // Nothing but a confirmation leaves proposed: not a start, a deferral or a close.
  const moved = must(fold(story(AGENT, "inferred", [[ADA, { type: "started" }], [ADA, { type: "deferred", until: UNTIL }], [ADA, { type: "closed", reason: "completed" }], [ADA, { type: "commented", body: "x" }]])));
  assertEquals(moved.state, { kind: "proposed" });
  assertEquals(moved.comments.length, 1);
  const confirmed = must(fold(story(AGENT, "inferred", [[ADA, { type: "confirmed" }]])));
  assertEquals(confirmed.state, { kind: "open" });
  assert(isCounted(confirmed));
  // A heuristic (a tool) proposes too, and any person confirms it by default.
  assertEquals(must(fold(story(TOOL, "inferred", [[BOB, { type: "confirmed" }]]))).state, { kind: "open" });
  // A declared item is open and a confirmation changes nothing.
  assertEquals(must(fold(story(ADA, "declared", [[BOB, { type: "confirmed" }]]))).state, { kind: "open" });
});

proves(["0002-planning-core FR-006"], "an agent never confirms: a confirmation by one that was forged past the build is passed over by the fold, and with confirmers set to principal only the principal of the proposing event confirms", () => {
  const events = story(AGENT, "inferred", [[ADA, { type: "commented", body: "x" }]]);
  const [first] = events;
  if (first === undefined) throw new Error("an opening");
  const forgedId = eventIds(9)[8];
  const forged = { ...first, id: forgedId as ItemEvent["id"], actor: AGENT, data: { type: "confirmed" } } as ItemEvent;
  assertEquals(must(fold([...events, forged])).state, { kind: "proposed" });
  const principal: Policy = { authority: {}, confirmers: "principal" };
  const byBob = [...events, { ...forged, actor: BOB } as ItemEvent];
  assertEquals(must(fold(byBob, principal)).state, { kind: "proposed" });
  assertEquals(must(fold(byBob)).state, { kind: "open" });
  const byAda = [...events, { ...forged, actor: ADA } as ItemEvent];
  assertEquals(must(fold(byAda, principal)).state, { kind: "open" });
  // A tool that was run by Bob proposes for Bob; a person who opens has no principal and any person confirms.
  const toolForBob = must(fold(story({ kind: "tool", id: "scanner", name: "S", ranBy: BOB }, "inferred", [[ADA, { type: "confirmed" }]]), principal));
  assertEquals(toolForBob.state, { kind: "proposed" });
  assertEquals(must(fold(story(ADA, "inferred", [[BOB, { type: "confirmed" }]]), principal)).state, { kind: "open" });
});

const EDIT = (title: string): EventData => ({ type: "edited", title });
const titlePolicy = (a: FieldAuthority): Policy => ({ authority: { title: a }, confirmers: "any-person" });

proves(["0002-planning-core FR-006"], "the authority over a field is applied in the fold: latest wins, source wins, store wins and person only, each over the events and none by overwriting", () => {
  const events = story(ADA, "declared", [[ADA, EDIT("by ada")], [AGENT, EDIT("by agent")], [TOOL, EDIT("by tool")], [BOB, EDIT("by bob")], [TOOL, EDIT("by tool again")], [BOB, EDIT("by bob again")]]);
  const title = (a: FieldAuthority) => must(fold(events, titlePolicy(a))).title;
  assertEquals(title("latest-wins"), "by bob again");
  assertEquals(title("source-wins"), "by tool again");
  assertEquals(title("store-wins"), "by bob again");
  assertEquals(title("person-only"), "by bob again");
  assertEquals(must(fold(events)).title, "by bob again");
  // Store wins takes the latest of the people and the agents, whoever of them it was.
  const agentLast = story(ADA, "declared", [[ADA, EDIT("by ada")], [AGENT, EDIT("by agent")], [TOOL, EDIT("by tool")]]);
  assertEquals(must(fold(agentLast, titlePolicy("store-wins"))).title, "by agent");
  // Source wins falls back to the others where no source spoke, and store wins to the source where the store did not.
  const noTool = story(ADA, "declared", [[ADA, EDIT("a")], [AGENT, EDIT("b")]]);
  assertEquals(must(fold(noTool, titlePolicy("source-wins"))).title, "b");
  const onlyTool = story(ADA, "declared", [[TOOL, EDIT("t")]]);
  assertEquals(must(fold(onlyTool, titlePolicy("store-wins"))).title, "t");
  // Another field is not touched by the authority of the title.
  const mixed = story(ADA, "declared", [[AGENT, EDIT("by agent")], [AGENT, { type: "edited", body: "agent body" }]]);
  const r = must(fold(mixed, titlePolicy("person-only")));
  assertEquals([r.title, r.body], ["T", "agent body"]);
});

proves(["0002-planning-core FR-006"], "where a field is person only, a change by an agent or a tool waits as a proposal that names the agent and its principal and changes nothing, and an agent that acts for a person is not that person", () => {
  const events = story(ADA, "declared", [[AGENT, EDIT("by agent")], [TOOL, EDIT("by tool")]]);
  const r = must(fold(events, titlePolicy("person-only")));
  assertEquals(r.title, "T");
  assertEquals(r.waiting.map((w) => [w.event, w.field, w.by.kind]), [[events[1]?.id, "title", "agent"], [events[2]?.id, "title", "tool"]]);
  const by = r.waiting[0]?.by;
  assert(by?.kind === "agent" && by.principal.id === ADA.id && by.basis === "session", "the proposal names the agent and its principal");
  // The agent acts for Ada, a person, and still is not Ada: only Ada's own event changes the field, and it clears the proposals before it.
  const later = story(ADA, "declared", [[AGENT, EDIT("by agent")], [ADA, EDIT("by ada")], [AGENT, EDIT("agent again")]]);
  const l = must(fold(later, titlePolicy("person-only")));
  assertEquals([l.title, l.waiting.length], ["by ada", 1]);
  assertEquals(l.waiting[0]?.event, later[3]?.id);
  // With another authority nothing waits.
  assertEquals(must(fold(events, titlePolicy("latest-wins"))).waiting, []);
});

const FIELD_OF = (e: ItemEvent): AuthorityField[] => {
  const d = e.data;
  return d.type === "edited" ? [...(d.title === undefined ? [] : (["title"] as const)), ...(d.body === undefined ? [] : (["body"] as const))] : d.type === "labeled" ? ["labels"] : d.type === "assigned" ? ["assignees"] : d.type === "severity-set" ? ["severity"] : d.type === "blocker-set" ? ["blocker"] : d.type === "started" || d.type === "deferred" || d.type === "closed" || d.type === "reopened" ? ["state"] : [];
};

proves(["0002-planning-core FR-006"], "with every field person only, the item is what the person's own events alone give: nothing an agent or a tool changed is counted, and each such change waits", () => {
  const all: Policy = { authority: { title: "person-only", body: "person-only", labels: "person-only", assignees: "person-only", severity: "person-only", blocker: "person-only", state: "person-only" }, confirmers: "any-person" };
  const item = itemId();
  fc.assert(
    fc.property(historyArb, (h) => {
      const events = history(item, h.origin === "inferred" ? "declared" : h.origin, 0, h.steps);
      const personal = events.filter((e) => e.actor.kind === "person" || FIELD_OF(e).length === 0);
      const a = must(fold(events, all));
      const b = must(fold(personal, all));
      for (const f of ["title", "body", "labels", "assignees", "severity", "blocker", "state"] as const) assertEquals(canonical(a[f]), canonical(b[f]), f);
      assert(a.waiting.every((w) => w.by.kind !== "person"));
      assert(a.waiting.every((w) => w.by.kind !== "agent" || w.by.principal.kind === "person"));
      return true;
    }),
    { numRuns: 300 },
  );
});

proves(["0002-planning-core FR-006"], "the changes that wait are exactly the changes of an agent or a tool to a person-only field that no person changed after", () => {
  const all: Policy = { authority: { title: "person-only", body: "person-only", labels: "person-only", assignees: "person-only", severity: "person-only", blocker: "person-only", state: "person-only" }, confirmers: "any-person" };
  const item = itemId();
  fc.assert(
    fc.property(historyArb, (h) => {
      const events = history(item, "declared", 0, h.steps);
      const r = must(fold(events, all));
      const later = events.slice(1);
      const want = later.flatMap((e) =>
        e.actor.kind === "person" ? [] : FIELD_OF(e).filter((f) => !later.some((x) => x.id > e.id && x.actor.kind === "person" && FIELD_OF(x).includes(f))).map((f) => `${e.id} ${f}`),
      );
      return canonical(r.waiting.map((w) => `${w.event} ${w.field}`).sort()) === canonical(want.sort());
    }),
    { numRuns: 300 },
  );
});

proves(["0002-planning-core FR-006"], "the fold does not change its events and takes no time: folding twice gives the same item", () => {
  const events = story(ADA, "declared", [[AGENT, EDIT("x")], [ADA, { type: "labeled", add: ["a"], remove: [] }]]);
  const before = canonical(events);
  assertEquals(canonical(fold(events)), canonical(fold(events)));
  assertEquals(canonical(events), before);
  assertEquals(must(fold(events)).events, orderEventsOf(events));
  assert(ADA.id !== BOB.id);
});

function orderEventsOf(events: readonly ItemEvent[]): readonly ItemEvent[] {
  return must(orderEvents(events));
}
