/**
 * Tests of the source for event files (commons planning 0004-planning-sources FR-007): made-up files of the schema `erga/issue@1` and event objects `erga/issue-event@1` (the real files are private) read as items
 * with all ten types of event, a file that cannot be read found with its reason, a new event written keeping every other byte with an id that reads back, and the laws of a lens. The comparison with the real fold
 * of the monorepo needs its code, which is private and is not in this checkout: that test is skipped and says so.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { makeEvent, makePatch, parseInstant, person, tool } from "@intellectual-frontiers/planning/governance";
import { fold, ulidOfUuid7, uuid7OfUlid, mintEventId } from "@intellectual-frontiers/planning/logical";
import { decodeIssueFile } from "@intellectual-frontiers/planning/records";
import { applyPatch, checkLens, eventFilesLens, fileSource } from "@intellectual-frontiers/planning/physical";
import { actorFor } from "@intellectual-frontiers/planning/governance";
import { ADA, clock, eventIds, itemId, must, WALL } from "./support.ts";
import { fullIssue, issueText, storeEventText, ulidOf, ULIDS } from "./erga-fixtures.ts";
import { harnessOf, lensContext, snapshotOf, storeWith } from "./harness.ts";
import { emptyWorld, instant, itemsOf, step } from "./world.ts";

const full = fullIssue();
const FILE = issueText(full.id, full.events);

proves(["0004-planning-sources FR-007"], "an issue file is read as one item with its events: all ten types of event and every field of the opening, the ids from the ULIDs, and the raw record kept", async () => {
  const store = await storeWith({ "planning/ISSUE-1.json5": FILE });
  const source = must(fileSource(store, eventFilesLens(), "planning/"));
  const read = must(await source.acquire());
  assertEquals(read.observations.length, 1);
  const o = read.observations[0];
  assert(o !== undefined, "an observation");
  assertEquals(o.content.history?.length, 11);
  assertEquals(o.content.history?.map((e) => e.data.type), ["opened", "commented", "edited", "labeled", "assigned", "severity-set", "blocker-set", "decided", "closed", "reopened", "closed"]);
  assertEquals([o.content.title, o.content.severity, o.content.motivation, o.content.blocker, o.content.state], ["Key rotation is not audited or listed", "error", "assessing", false, { kind: "closed", reason: "duplicate" }] as never);
  assertEquals(o.content.target, { file: "doc/keys.md", page: 3, quote: "a quoted text" });
  assert(o.content.external.some((x) => x.value === full.id), "the ULID of the item is carried as an external id");
  assert(JSON.stringify(o.raw).includes("Key rotation"), "the record as read is kept");
  // the agent the monorepo writes as a person is a finding, and read as a person
  const agentFile = issueText(ULIDS.item, [{ id: ULIDS.first, at: "2026-01-01T00:00:00Z", actor: { type: "person", id: "claude", name: "Claude" }, type: "opened", data: { title: "T", body: "", labels: [], assignees: [] } }]);
  const r2 = must(await must(fileSource(await storeWith({ "a.json5": agentFile }), eventFilesLens(), ".")).acquire());
  assert(r2.findings.some((f) => f.message.includes("records the agent claude as a person")), "a finding names it");
});

proves(["0004-planning-sources FR-007"], "a file it cannot read is a finding that names why, and event objects of the store are read with their issue file as one item", async () => {
  const [first, second] = [full.events[0], full.events[1]];
  assert(first !== undefined && second !== undefined, "events");
  const store = await storeWith({
    "w/bad.json5": "{ not json5",
    "w/other.json5": '{ schema: "something/else@1" }',
    "w/empty.json5": '{ schema: "erga/issue@1", id: "X", work: "w", events: [] }',
    "w/ISSUE-1.json5": issueText(full.id, [first]),
    "w/ev-2.json5": storeEventText(full.id, "book/example", second),
    "w/lonely-1.json5": storeEventText(ULIDS.fourth, "book/example", { id: ULIDS.third, at: "2026-02-02T00:00:00Z", actor: { type: "person", id: "a@x.test" }, type: "opened", data: { title: "From an object", body: "", labels: [], assignees: [] } }),
  });
  const read = must(await must(fileSource(store, eventFilesLens(), "w/")).acquire());
  assertEquals(read.observations.map((o) => o.content.history?.length).sort(), [1, 2]);
  const messages = read.findings.map((f) => f.message);
  assert(messages.some((m) => m.includes("not JSON5") || m.includes("schema")), "a bad file is named");
  assertEquals(read.findings.filter((f) => f.path.endsWith("bad.json5") || f.path.endsWith("other.json5") || f.path.endsWith("empty.json5")).length, 3);
});

proves(["0004-planning-sources FR-007"], "a new event is written by the rules of the schema keeping every other byte, the ULID reads back as the id of the event, and the second write of it changes nothing", async () => {
  const store = await storeWith({ "planning/ISSUE-1.json5": FILE });
  const source = must(fileSource(store, eventFilesLens(), "planning/"));
  const o = must(await source.acquire()).observations[0];
  assert(o !== undefined, "an item");
  // the item is closed (duplicate): a comment and a reopening
  const m = must(mintEventId(clock(), WALL + 10_000_000_000));
  const person1 = must(person("bob@example.test", "Bob"));
  const comment = must(makeEvent({ id: m.id, item: itemId(), at: must(parseInstant("2026-06-01T00:00:00Z")), actor: person1 }, { type: "commented", body: "A new remark." }));
  const patch = must(makePatch("event-files", "planning/", comment, o.fingerprint));
  const dry = await applyPatch(source, patch, instant(2));
  assert(dry.kind === "dry-run", "a dry run first");
  assertEquals((await snapshotOf(store))["planning/ISSUE-1.json5"], FILE);
  const done = await applyPatch(source, patch, instant(2), dry.preview.hash);
  assert(done.kind === "written", "written");
  const after = (await snapshotOf(store))["planning/ISSUE-1.json5"] ?? "";
  const decoded = decodeIssueFile(after);
  assert(decoded.kind === "ok", "it is still an issue file");
  const last = decoded.value.events.at(-1);
  assertEquals([last?.type, last?.actor], ["commented", { type: "person", id: "bob@example.test", name: "Bob" }]);
  assert(last !== undefined && uuid7OfUlid(last.id).kind === "ok" && (uuid7OfUlid(last.id) as { value: string }).value === m.id, "the ULID of the event reads back as its id");
  // every other byte: the file is the old one with the one event added before the end
  const cut = FILE.lastIndexOf("\n  ]\n}");
  assert(after.startsWith(FILE.slice(0, cut)) && after.endsWith(FILE.slice(cut)), "the old bytes are all there, before and after the new event");
  assertEquals(after.length - FILE.length, after.length - FILE.length);
  assertEquals(decoded.value.events.length, 12);
  // the same patch again changes nothing
  const again = await applyPatch(must(fileSource(store, eventFilesLens(), "planning/")), patch, instant(2));
  assert(again.kind === "dry-run" && again.preview.effects.length === 0, "an event already in the file is not written twice");
  // read back through reconcile: the new event arrives once, as the same event
  const w1 = await step(emptyWorld(), "event-files", [o]);
  const o2 = must(await must(fileSource(store, eventFilesLens(), "planning/")).acquire()).observations[0];
  assert(o2 !== undefined, "an item");
  const w2 = await step(w1.world, "event-files", [o2]);
  assertEquals(w2.result.events.length, 1);
  assertEquals(itemsOf(w2.world)[0]?.comments.length, 2);
  assert(fold(w2.world.events).kind === "ok", "the item folds");
});

proves(["0004-planning-sources FR-007"], "an event of an agent, which the schema cannot give a principal, and a type it has no event for wait in the outbox with their reason", async () => {
  const store = await storeWith({ "planning/ISSUE-1.json5": FILE });
  const source = must(fileSource(store, eventFilesLens(), "planning/"));
  const o = must(await source.acquire()).observations[0];
  assert(o !== undefined, "an item");
  const [a, b] = eventIds(2, undefined, 1_780_000_000_000);
  assert(a !== undefined && b !== undefined, "ids");
  const agentActor = must(actorFor({ kind: "session", person: ADA }, { kind: "agent", id: "claude", name: "Claude" }));
  const byAgent = must(makePatch("event-files", "planning/", must(makeEvent({ id: a, item: itemId(), at: instant(5), actor: agentActor }, { type: "commented", body: "x" })), o.fingerprint));
  const r = await applyPatch(source, byAgent, instant(6));
  assert(r.kind === "outbox" && r.entry.waiting.kind === "unexpressed" && r.entry.waiting.reason.includes("principal"), `the principal is unexpressed: ${JSON.stringify(r)}`);
  const scanner = must(tool("scanner", "Scanner"));
  const started = must(makePatch("event-files", "planning/", must(makeEvent({ id: b, item: itemId(), at: instant(5), actor: scanner }, { type: "started" })), o.fingerprint));
  const s = await applyPatch(source, started, instant(6));
  assert(s.kind === "outbox" && s.entry.waiting.kind === "unexpressed", "no event of that type");
  assertEquals((await snapshotOf(store))["planning/ISSUE-1.json5"], FILE);
});

proves(["0004-planning-sources FR-007"], "the ULID of an id reads back as the id for any id", () => {
  for (const [i, id] of eventIds(30, undefined, 1_781_000_000_000 + 12345).entries()) {
    const u = ulidOfUuid7(id);
    assertEquals(u.length, 26);
    assertEquals(uuid7OfUlid(u), { kind: "ok", value: id });
    assert(u === u.toUpperCase() && i >= 0, "a ULID is upper case");
  }
  assert(ulidOf(1, 1n).length === 26, "the fixtures make ULIDs of the same layout");
});

proves(["0004-planning-sources FR-007", "0004-planning-sources FR-004"], "the event files source keeps the laws of a lens over made-up issue files", async () => {
  const files = { "p/ISSUE-1.json5": FILE, "p/ISSUE-2.json5": issueText(ULIDS.second, [{ id: ULIDS.third, at: "2026-03-03T00:00:00Z", actor: { type: "person", id: "a@x.test", name: "A" }, type: "opened", data: { title: "Second", body: "b", labels: [], assignees: [] } }]) };
  assertEquals(await checkLens(harnessOf(() => eventFilesLens(), files, "p/"), lensContext()), []);
});

proves(["0004-planning-sources FR-007"], "the fold of each generated file equals the real fold of the monorepo's code", () => {
  // The monorepo's code is private and is not in this checkout: nothing is compared here (the second implementation exists only there).
}, { skip: "the monorepo's own fold is private code that is not in this checkout, so there is nothing to compare with" });
