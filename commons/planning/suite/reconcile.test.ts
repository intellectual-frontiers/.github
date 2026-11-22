/**
 * Tests of `reconcile` (commons planning 0003-planning-reconcile FR-002 to FR-006): the classes of an observation, the match order, the three-way merge with its conflicts, the derived close and reopening, and the
 * history a place keeps itself, over a store held as values.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { externalId, makeEvent, parseDay, type ItemEvent } from "@intellectual-frontiers/planning/governance";
import { fold } from "@intellectual-frontiers/planning/logical";
import { ADA, event, eventIds, must } from "./support.ts";
import { emptyWorld, instant, itemsOf, observe, SOURCE_ACTOR, step } from "./world.ts";

proves(["0003-planning-reconcile FR-002"], "an unchanged place gives no event and every class is unchanged; a first read gives new, a change gives updated", async () => {
  const w0 = emptyWorld();
  const a = await observe("md", "fp-a", "Write the spec");
  const b = await observe("md", "fp-b", "Write the code", { line: 2 });
  const first = await step(w0, "md", [a, b]);
  assertEquals(first.result.classes.map((c) => c.class), ["new", "new"]);
  assertEquals(itemsOf(first.world).map((i) => i.title).sort(), ["Write the code", "Write the spec"]);
  const second = await step(first.world, "md", [a, b]);
  assertEquals(second.result.events.length, 0);
  assertEquals(second.result.classes.map((c) => c.class), ["unchanged", "unchanged"]);
  const changed = await observe("md", "fp-a", "Write the spec and the plan");
  const third = await step(second.world, "md", [changed, b]);
  assertEquals(third.result.classes.map((c) => c.class), ["updated", "unchanged"]);
  assertEquals(third.result.events.map((e) => e.data.type), ["edited"]);
  assertEquals(itemsOf(third.world).find((i) => i.title.startsWith("Write the spec"))?.title, "Write the spec and the plan");
});

proves(["0003-planning-reconcile FR-002"], "for any generated set of things, reading the place twice gives no event the second time and the result is data", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(fc.tuple(fc.constantFrom("a", "b", "c", "d", "e", "f"), fc.constantFrom("one", "two", "three"), fc.boolean()), { selector: (t) => t[0], maxLength: 6 }), async (things) => {
      const obs = await Promise.all(things.map(([fp, title, done], i) => observe("md", fp, title, { line: i + 1, state: done ? { kind: "closed", reason: "completed" } : { kind: "open" } })));
      const one = await step(emptyWorld(), "md", obs);
      const two = await step(one.world, "md", obs);
      assertEquals(two.result.events.length, 0);
      assertEquals(two.result.conflicts.length, 0);
      assertEquals(itemsOf(one.world).length, things.length);
    }),
    { numRuns: 40 },
  );
});

proves(["0003-planning-reconcile FR-003"], "an observation is matched by the anchor, then an external id, then the fingerprint, then the locator, and an item is matched once in a run", async () => {
  const first = await step(emptyWorld(), "md", [
    await observe("md", "fp-1", "One", { line: 1, extra: { external: [must(externalId("tracker", "T-1"))] } }),
    await observe("md", "fp-2", "Two", { line: 2 }),
    await observe("md", "fp-3", "Three", { line: 3 }),
  ]);
  const items = itemsOf(first.world);
  const id = (t: string) => items.find((i) => i.title === t)?.id;
  const one = id("One");
  const two = id("Two");
  const three = id("Three");
  assert(one !== undefined && two !== undefined && three !== undefined, "three items");
  // the anchor first: a new fingerprint and a new place, but the id of item Two in the place
  const byAnchor = await observe("other", "fp-x", "Two again", { line: 40, extra: { anchor: two } });
  // an external id: a new fingerprint, no anchor
  const byExternal = await observe("other", "fp-y", "One again", { line: 41, extra: { external: [must(externalId("tracker", "T-1"))] } });
  // the fingerprint of the trace of another source
  const byFingerprint = await observe("other", "fp-3", "Three again", { line: 42 });
  // a second thing with the fingerprint of the first: matches no item twice, so it is new
  const twin = await observe("other", "fp-3", "Three twin", { line: 43 });
  const r = await step(first.world, "other", [byAnchor, byExternal, byFingerprint, twin]);
  const matched = r.result.classes.map((c) => c.item);
  assertEquals(matched.slice(0, 3), [two, one, three]);
  assert(matched[3] !== undefined && !(matched[3] === three), "the twin is not the item already matched");
  // the locator: the same source, a changed fingerprint at the same place
  const moved = await observe("md", "fp-new", "One is renamed", { line: 1 });
  const r2 = await step(first.world, "md", [moved, await observe("md", "fp-2", "Two", { line: 2 }), await observe("md", "fp-3", "Three", { line: 3 })]);
  assertEquals(r2.result.classes.find((c) => c.fingerprint === "fp-new")?.item, one);
});

proves(["0003-planning-reconcile FR-003"], "a new item from an external id has the id the function of external ids gives, the same in two stores, and one from the clock has a fresh id", async () => {
  const day = instant(0);
  const obs = await observe("tracker", "fp-e", "From a tracker", { extra: { external: [must(externalId("tracker", "ABC-1"))], at: day } });
  const a = await step(emptyWorld(), "tracker", [obs]);
  const b = await step({ ...emptyWorld(), step: 5 }, "tracker", [obs]);
  assertEquals(a.result.events.map((e) => [e.id, e.item]), b.result.events.map((e) => [e.id, e.item]));
  assertEquals(itemsOf(a.world)[0]?.external, [{ source: "tracker", value: "ABC-1" }]);
  const c = await step(emptyWorld(), "md", [await observe("md", "fp-c", "From the clock")]);
  assert(c.result.events[0]?.item !== undefined, "an item has an id");
});

proves(["0003-planning-reconcile FR-004"], "the place's changes become events of the source as a tool, labels and assignees merge as added and removed, and a state change is a state event", async () => {
  const w1 = (await step(emptyWorld(), "md", [await observe("md", "f", "Task", { labels: ["a"] })])).world;
  const r = await step(w1, "md", [await observe("md", "f", "Task", { labels: ["a", "b"], state: { kind: "closed", reason: "completed" } })]);
  assertEquals(r.result.events.map((e) => e.data.type), ["labeled", "closed"]);
  assert(r.result.events.every((e) => e.actor.kind === "tool" && e.actor.id === SOURCE_ACTOR.id), "the actor is the source");
  const item = itemsOf(r.world)[0];
  assertEquals(item?.labels, ["a", "b"]);
  assertEquals(item?.state.kind, "closed");
  const back = await step(r.world, "md", [await observe("md", "f", "Task", { labels: ["a", "b"] })]);
  assertEquals(back.result.events.map((e) => e.data.type), ["reopened"]);
});

proves(["0003-planning-reconcile FR-004"], "where the place, its base and the store all differ and no authority decides it is a conflict naming the three values; with an authority an event is given and fold decides", async () => {
  const w1 = (await step(emptyWorld(), "md", [await observe("md", "f", "Base title")])).world;
  const item = itemsOf(w1)[0];
  assert(item !== undefined, "the item");
  const [id] = eventIds(1, undefined, 1_770_000_000_000);
  assert(id !== undefined, "an id");
  const storeEdit = event(item.id, id, 100, ADA, { type: "edited", title: "Store title" });
  const w2 = { ...w1, events: [...w1.events, storeEdit] };
  const place = await observe("md", "f", "Place title");
  const none = await step(w2, "md", [place]);
  assertEquals(none.result.events.length, 0);
  assertEquals(none.result.conflicts, [{ kind: "field", item: item.id, field: "title", base: "Base title", now: "Place title", store: "Store title", source: "md" }]);
  const withAuthority = await step(w2, "md", [place], { authority: { title: "source-wins" }, confirmers: "any-person" });
  assertEquals(withAuthority.result.conflicts.length, 0);
  assertEquals(withAuthority.result.events.map((e) => e.data.type), ["edited"]);
  // the store changed and the place did not: nothing
  const quiet = await step(w2, "md", [await observe("md", "f", "Base title", { body: "" })]);
  assertEquals(quiet.result.events.length, 0);
});

proves(["0003-planning-reconcile FR-005"], "a thing no longer found is closed as completed by a tool and reopened when found again, and an event of a person wins over both", async () => {
  const a = await observe("md", "f", "A comment");
  const w1 = (await step(emptyWorld(), "md", [a])).world;
  const gone = await step(w1, "md", []);
  assertEquals(gone.result.events.map((e) => [e.data.type, e.actor.kind]), [["closed", "tool"]]);
  assertEquals(gone.result.classes.map((c) => c.class), ["absent"]);
  assertEquals(itemsOf(gone.world)[0]?.state.kind, "closed");
  const stillGone = await step(gone.world, "md", []);
  assertEquals(stillGone.result.events.length, 0);
  const back = await step(gone.world, "md", [a]);
  assertEquals(back.result.events.map((e) => e.data.type), ["reopened"]);
  assertEquals(itemsOf(back.world)[0]?.state.kind, "open");
  // a person closes it, the thing is gone and then found again: no derived reopening
  const item = itemsOf(w1)[0];
  assert(item !== undefined, "the item");
  const [id] = eventIds(1, undefined, 1_771_000_000_000);
  assert(id !== undefined, "an id");
  const w2 = { ...w1, events: [...w1.events, event(item.id, id, 50, ADA, { type: "closed", reason: "not-planned" })] };
  const goneAfter = await step(w2, "md", []);
  assertEquals(goneAfter.result.events.length, 0);
  const found = await step(goneAfter.world, "md", [a]);
  assertEquals(found.result.events.length, 0);
  assertEquals(itemsOf(found.world)[0]?.state.kind, "closed");
});

proves(["0003-planning-reconcile FR-006"], "an observation that carries the history its place keeps gives those events as they are, a union by id, and an id with other content is a conflict", async () => {
  const [e1, e2] = eventIds(2, undefined, 1_772_000_000_000);
  assert(e1 !== undefined && e2 !== undefined, "ids");
  const item = must((await import("@intellectual-frontiers/planning/governance")).parseItemId(e1));
  const opened: ItemEvent = must(makeEvent({ id: e1, item, at: instant(1), actor: ADA }, { type: "opened", kind: "issue", title: "Filed", body: "", labels: [], assignees: [], origin: "declared" }));
  const commented: ItemEvent = must(makeEvent({ id: e2, item, at: instant(2), actor: ADA }, { type: "commented", body: "Seen." }));
  const obs = await observe("files", "item-1", "Filed", { extra: { history: [opened, commented] } });
  const r = await step(emptyWorld(), "files", [obs]);
  assertEquals(r.result.events.map((e) => e.id), [e1, e2]);
  assertEquals(itemsOf(r.world)[0]?.comments.length, 1);
  const again = await step(r.world, "files", [obs]);
  assertEquals(again.result.events.length, 0);
  assertEquals(again.result.classes.map((c) => c.class), ["unchanged"]);
  const changed: ItemEvent = must(makeEvent({ id: e2, item, at: instant(2), actor: ADA }, { type: "commented", body: "Seen again." }));
  const clash = await step(r.world, "files", [await observe("files", "item-1", "Filed", { extra: { history: [opened, changed] } })]);
  assertEquals(clash.result.conflicts, [{ kind: "event-id", item, id: e2, source: "files" }]);
  assertEquals(clash.result.events.length, 0);
  const folded = fold(r.world.events);
  assert(folded.kind === "ok", "the item folds");
});

proves(["0003-planning-reconcile FR-004"], "nested things give a link of kind parent of from the parent to the child, once", async () => {
  const parent = await observe("md", "p", "Parent");
  const child = await observe("md", "c", "Child", { line: 2, extra: { parent: "p" } });
  const r = await step(emptyWorld(), "md", [parent, child]);
  assertEquals(r.result.links.map((l) => l.kind), ["parent-of"]);
  const items = itemsOf(r.world);
  const p = items.find((i) => i.title === "Parent");
  assertEquals(p?.links.map((l) => l.kind), ["parent-of"]);
  const again = await step(r.world, "md", [parent, child]);
  assertEquals(again.result.events.length, 0);
  assert(parseDay("2027-01-01").kind === "ok", "a day parses");
});

proves(["0003-planning-reconcile FR-001"], "an item seen in two places has one id and a trace for each, with the content last taken, so every place it was seen is found from it", async () => {
  const one = await observe("md", "same-thing", "Do the thing", { line: 3 });
  const w1 = (await step(emptyWorld(), "md", [one])).world;
  const two = await observe("comments", "same-thing", "Do the thing", { line: 9, extra: { origin: "inferred" } });
  const w2 = (await step(w1, "comments", [two])).world;
  const items = itemsOf(w2);
  assertEquals(items.length, 1);
  const traces = w2.traces.filter((t) => t.item === items[0]?.id);
  assertEquals(traces.map((t) => t.source).sort(), ["comments", "md"]);
  assert(traces.every((t) => t.presence === "present" && t.observed.title === "Do the thing" && t.contentHash.length === 64), "each trace holds the content and the hash");
  assertEquals(traces.find((t) => t.source === "md")?.locator, { kind: "file-span", path: "a.md", startLine: 3, endLine: 3 });
  assert(one.raw !== undefined, "the record as read is kept");
});
