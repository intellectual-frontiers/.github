/**
 * The records at the boundary (commons planning 0002-planning-core FR-011): the library's own files of events and items in JSON5 with the keys in the order of their names, decoded totally; and the monorepo's
 * issue file, event object and summary decoded and encoded as written, an issue file read as an item with all ten types of event, and the summary rendered from items. The files are made up.
 *
 * @module
 */
import fc from "fast-check";
import { parseJson5, type Json } from "@intellectual-frontiers/formats/json5";
import * as records from "@intellectual-frontiers/planning/records";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { type ItemEvent, EVENT_TYPES, type Item } from "@intellectual-frontiers/planning/governance";
import { canonical, fold } from "@intellectual-frontiers/planning/logical";
import { ACTORS, ADA, event, eventIds, history, historyArb, itemId, must, SAMPLES } from "./support.ts";
import { fullIssue, HEADER, issueText, storeEventText, ULIDS } from "./erga-fixtures.ts";

const { decodeEvent, decodeItem, encodeEvent, encodeItem, eventPath, itemPath, jsonOf } = records;

/** Whether every object in a value has its keys in the order of their names. */
function sorted(v: Json): boolean {
  if (Array.isArray(v)) return v.every(sorted);
  if (typeof v === "object" && v !== null) {
    const keys = Object.keys(v);
    return keys.every((k, i) => i === 0 || (keys[i - 1] ?? "") < k) && Object.values(v).every((x) => sorted(x as Json));
  }
  return true;
}

const item = itemId();
const sampleEvents = (): readonly ItemEvent[] => EVENT_TYPES.map((type, i) => event(item, eventIds(20)[i] as ItemEvent["id"], i, type === "confirmed" ? ADA : (ACTORS[2] as ItemEvent["actor"]), SAMPLES[type]));

proves(["0002-planning-core FR-011"], "an event of each of the fourteen types is encoded as a JSON5 file and decoded as the same event, with its keys in the order of their names", () => {
  for (const e of sampleEvents()) {
    const text = encodeEvent(e);
    assertEquals(canonical(must(decodeEvent(text))), canonical(e));
    const parsed = parseJson5(text);
    assert(parsed.kind === "ok" && sorted(parsed.value), `keys of ${e.data.type} are in order`);
    assertEquals(encodeEvent(must(decodeEvent(text))), text);
  }
});

proves(["0002-planning-core FR-011"], "the keys of a file do not depend on the order they were made in, so that a diff of two stores is a diff of events", () => {
  const e = sampleEvents()[0] as ItemEvent;
  const shuffled = JSON.parse(JSON.stringify(e), (_k, v: unknown) => (typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)) as ItemEvent;
  assertEquals(Object.keys(shuffled)[0], Object.keys(e).at(-1));
  assertEquals(encodeEvent(shuffled), encodeEvent(e));
  assertEquals(JSON.stringify(jsonOf({ b: 1, a: { d: undefined, c: [{ z: 1, y: 2 }] } })), '{"a":{"c":[{"y":2,"z":1}]},"b":1}');
});

proves(["0002-planning-core FR-011"], "the store has one file for each event named by its item and its id, and the edition one file for each item with its events in the order of the fold", () => {
  const events = sampleEvents();
  const e = events[1] as ItemEvent;
  assertEquals(eventPath(e), `${e.item}/${e.id}.json5`);
  assertEquals(itemPath(e.item), `${e.item}.json5`);
  const text = must(encodeItem([...events].reverse()));
  const read = must(decodeItem(text));
  assertEquals(read.map((x) => x.id), events.map((x) => x.id));
  const parsed = parseJson5(text);
  assert(parsed.kind === "ok" && sorted(parsed.value));
  assertEquals(must(encodeItem(read)), text);
  // Two events of one id that differ are no history.
  const clash = event(item, e.id, 1, ADA, { type: "commented", body: "other" });
  assert(encodeItem([e, clash]).kind === "err");
  // A file whose event is of another item is not an item file.
  const stray = event(itemId(2), eventIds(30)[29] as ItemEvent["id"], 3, ADA, { type: "commented", body: "x" });
  const swapped = text.replace(`id: "${item}"`, `id: "${itemId(2)}"`);
  assert(decodeItem(swapped).kind === "err");
  assert(stray.item !== item);
});

proves(["0002-planning-core FR-011"], "any history is encoded and decoded as itself, as events and as an item file, and the same fold comes of it; two stores merge by the union of their files", () => {
  fc.assert(
    fc.property(historyArb, fc.integer(), (h, seed) => {
      const events = history(item, h.origin, h.opener, h.steps, [itemId(4)]);
      const files = new Map(events.map((e) => [eventPath(e), encodeEvent(e)] as const));
      assertEquals(files.size, events.length);
      const decoded = [...files.values()].map((t) => must(decodeEvent(t)));
      assertEquals(canonical(fold(decoded)), canonical(fold(events)));
      const edition = must(decodeItem(must(encodeItem(events))));
      assertEquals(canonical(fold(edition)), canonical(fold(events)));
      // Two stores, each with some of the files and some in common: the union of the files is the history, in any order.
      const a = new Map([...files].filter((_, i) => (i + seed) % 3 !== 0));
      const b = new Map([...files].filter((_, i) => (i + seed) % 3 !== 1));
      const union = new Map([...b, ...a]);
      const merged = [...union.values()].map((t) => must(decodeEvent(t)));
      return union.size === files.size && canonical(fold(merged)) === canonical(fold(events));
    }),
    { numRuns: 150 },
  );
});

proves(["0002-planning-core FR-011"], "decoding is total: a text that is not an event or an item of the schema is an error value, and nothing throws", () => {
  const good = encodeEvent(sampleEvents()[0] as ItemEvent);
  const reject = (text: string, part: string): void => {
    const r = decodeEvent(text);
    assert(r.kind === "err", part);
  };
  reject("", "empty");
  reject("{", "not json5");
  reject("[]", "an array");
  reject("null", "null");
  reject(good.replace("planning/event@1", "planning/event@2"), "schema");
  reject(good.replace(/id: "[^"]+",\n {2}item/, 'id: "nope",\n  item'), "event id");
  reject(good.replace(/at: "[^"]+"/, 'at: "yesterday"'), "time");
  reject(good.replace('type: "opened"', 'type: "seen"'), "type");
  reject(good.replace('kind: "task"', 'kind: "roadmap-item"'), "kind");
  reject(good.replace('origin: "declared"', 'origin: "guessed"'), "origin");
  reject(good.replace('severity: "warning"', 'severity: "fatal"'), "severity");
  // An agent with no principal and a person that names one are refused when read.
  reject(good.replace(/actor: \{[\s\S]*?\n {2}\},/, 'actor: { basis: "session", id: "claude", kind: "agent", name: "Claude" },'), "agent with no principal");
  reject(good.replace(/actor: \{[\s\S]*?\n {2}\},/, `actor: { id: "ada", kind: "person", name: "Ada", principal: { id: "bob", kind: "person", name: "Bob" } },`), "person naming a principal");
  const confirmed = encodeEvent(event(item, eventIds(2)[1] as ItemEvent["id"], 1, ADA, { type: "confirmed" }));
  assert(decodeEvent(confirmed).kind === "ok");
  reject(confirmed.replace(/actor: \{[\s\S]*?\n {2}\},/, `actor: { id: "scanner", kind: "tool", name: "Scanner" },`), "confirmation by a tool");
  reject(confirmed.replace('type: "confirmed"', 'type: "linked"'), "link with no target");
  assert(decodeItem(good).kind === "err" && decodeItem("").kind === "err");
  fc.assert(
    fc.property(fc.jsonValue(), (v) => {
      const r = decodeEvent(JSON.stringify(v));
      const i = decodeItem(JSON.stringify(v));
      return (r.kind === "err" || r.kind === "ok") && (i.kind === "err" || i.kind === "ok");
    }),
    { numRuns: 300 },
  );
  fc.assert(
    fc.property(fc.nat({ max: good.length - 1 }), fc.string({ maxLength: 3 }), (at, junk) => {
      const r = decodeEvent(good.slice(0, at) + junk + good.slice(at + 1));
      return r.kind === "ok" || r.kind === "err";
    }),
    { numRuns: 500 },
  );
});

// ---- the monorepo's records

const OPTIONS = { source: "event-files", agents: {}, knownAgents: records.DEFAULT_KNOWN_AGENTS } as const;

proves(["0002-planning-core FR-011"], "an issue file, an event object and a summary of the monorepo are decoded and encoded as written, byte for byte", () => {
  const full = fullIssue();
  const text = issueText(full.id, full.events);
  const file = must(records.decodeIssueFile(text));
  assertEquals(file.header, HEADER);
  assertEquals(file.events.length, 11);
  assertEquals(records.encodeIssueFile(file), text);
  // A file written with another comment keeps its comment, and one with no comment has none.
  const other = issueText(full.id, full.events, "book/example", "// written by an older version\n");
  assertEquals(records.encodeIssueFile(must(records.decodeIssueFile(other))), other);
  const bare = issueText(full.id, full.events, "book/example", "");
  assertEquals(records.encodeIssueFile(must(records.decodeIssueFile(bare))), bare);
  const events = full.events.map((e) => storeEventText(full.id, "book/example", e));
  for (const t of events) assertEquals(records.encodeStoreEvent(must(records.decodeStoreEvent(t))), t);
  // JSON5 that is not JSON (comments, unquoted keys, trailing commas, single quotes) is read.
  const loose = `// c\n{ schema: 'erga/issue@1', id: 'x', work: 'w', events: [ { id: 'e', at: '2026-11-07T13:20:23Z', actor: { type: 'tool', id: 't' }, type: 'reopened', }, ], }`;
  assertEquals(must(records.decodeIssueFile(loose)).events[0]?.type, "reopened");
  // Two events of one second are written in the order of their id.
  const same = issueText("x", [
    { id: "b", at: "2026-11-07T13:20:23Z", actor: { type: "tool", id: "t" }, type: "reopened" },
    { id: "a", at: "2026-11-07T13:20:23Z", actor: { type: "tool", id: "t" }, type: "reopened" },
  ]);
  assertEquals(must(records.decodeIssueFile(same)).events.map((e) => e.id), ["a", "b"]);
});

proves(["0002-planning-core FR-011"], "a text that is not an issue file, an event object or a summary is an error value", () => {
  const full = fullIssue();
  const text = issueText(full.id, full.events);
  for (const bad of ["", "{", "[]", text.replace("erga/issue@1", "erga/issue@2"), text.replace('"events": [', '"events": [],\n  "x": ['), text.replace('"type": "opened"', '"type": "opening"'), text.replace(/"at": "(\d{4})-(\d{2})-(\d{2})/, '"at": "$3-$2-$1'), text.replace('"title": "Key rotation is not audited"', '"titles": 1')]) {
    assert(records.decodeIssueFile(bad).kind === "err", bad.slice(0, 40));
  }
  assert(records.decodeIssueFile(issueText("x", [])).kind === "err");
  assert(records.decodeStoreEvent(text).kind === "err" && records.decodeIndex(text).kind === "err");
  assert(records.decodeStoreEvent(storeEventText("i", "w", { id: "e", at: "2026-11-07T13:20:23Z", actor: { type: "robot", id: "r" }, type: "reopened" })).kind === "err");
  const severity = issueText("x", [{ id: "e", at: "2026-11-07T13:20:23Z", actor: { type: "tool", id: "t" }, type: "severity", data: { severity: "fatal" } }]);
  assert(records.decodeIssueFile(severity).kind === "err");
  const decision = issueText("x", [{ id: "e", at: "2026-11-07T13:20:23Z", actor: { type: "tool", id: "t" }, type: "decided", data: { decision: "maybe" } }]);
  assert(records.decodeIssueFile(decision).kind === "err");
  fc.assert(
    fc.property(fc.jsonValue(), (v) => {
      const t = JSON.stringify(v);
      return [records.decodeIssueFile(t), records.decodeStoreEvent(t), records.decodeIndex(t)].every((r) => r.kind === "ok" || r.kind === "err");
    }),
    { numRuns: 200 },
  );
});

proves(["0002-planning-core FR-011"], "an issue file is read as an item with all ten types of event and every field of its opening, and its fold is the item the monorepo's fold gives", async () => {
  const full = fullIssue();
  const file = must(records.decodeIssueFile(issueText(full.id, full.events)));
  const read = must(await records.readIssueFile(file, OPTIONS));
  assertEquals(read.findings, []);
  assertEquals(read.events.map((e) => e.data.type), ["opened", "commented", "edited", "labeled", "assigned", "severity-set", "blocker-set", "decided", "closed", "reopened", "closed"]);
  const opened = read.events[0]?.data;
  assert(opened?.type === "opened");
  assertEquals(
    [opened.title, opened.body, opened.labels, opened.assignees, opened.severity, opened.motivation, opened.blocker, opened.target, opened.source, opened.kind, opened.origin],
    ["Key rotation is not audited", "The audit code is never written.", ["audit"], ["ada@example.test"], "warning", "assessing", true, { file: "doc/keys.md", page: 3, quote: "a quoted text" }, { tool: "lint", rule: "R1", file: "src/keys.ts", line: 12 }, "finding", "declared"],
  );
  const item = must(fold(read.events));
  assertEquals([item.title, item.body, [...item.labels], [...item.assignees], item.severity, item.blocker], ["Key rotation is not audited or listed", "More.", ["security"], ["bob@example.test"], "error", false]);
  assert(item.state.kind === "closed" && item.state.reason === "duplicate" && item.state.by.id === "ada@example.test");
  assertEquals([item.comments.length, item.decisions.length, item.decisions[0]?.verdict], [1, 1, "minor-revision"]);
  assertEquals(item.external[0], { source: "event-files", value: full.id });
  // The tool's close, by the reason `not_planned`, is the reason `not-planned`.
  const toolClose = read.events.find((e) => e.actor.kind === "tool");
  assert(toolClose?.data.type === "closed" && toolClose.data.reason === "not-planned");
});

/** The monorepo's own fold, written again from its description: the events by time and then id, the opening first, each type applied in turn. */
function monorepoFold(events: readonly records.ErgaEvent[]) {
  const es = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const first = es[0];
  const d0 = (first?.data ?? {}) as { title: string; body?: string; labels?: string[]; assignees?: string[]; severity?: string; blocker?: boolean };
  let title = d0.title;
  let body = d0.body ?? "";
  let state: { kind: "open" } | { kind: "closed"; reason: string; by: string } = { kind: "open" };
  const labels = new Set(d0.labels ?? []);
  const assignees = new Set(d0.assignees ?? []);
  let severity = d0.severity ?? "note";
  let blocker = d0.blocker === true;
  let comments = 0;
  const decisions: string[] = [];
  for (const e of es.slice(1)) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "commented":
        comments += 1;
        break;
      case "edited":
        title = (d["title"] as string | undefined) ?? title;
        body = (d["body"] as string | undefined) ?? body;
        break;
      case "labeled":
        for (const l of (d["add"] as string[]) ?? []) labels.add(l);
        for (const l of (d["remove"] as string[]) ?? []) labels.delete(l);
        break;
      case "assigned":
        for (const l of (d["add"] as string[]) ?? []) assignees.add(l);
        for (const l of (d["remove"] as string[]) ?? []) assignees.delete(l);
        break;
      case "severity":
        severity = d["severity"] as string;
        break;
      case "blocker":
        blocker = d["blocker"] === true;
        break;
      case "closed":
        state = { kind: "closed", reason: (d["reason"] as string | undefined) ?? "completed", by: e.actor.id };
        break;
      case "reopened":
        state = { kind: "open" };
        break;
      case "decided":
        decisions.push(`${String(d["decision"])}:${String(d["note"] ?? "")}`);
        break;
      case "opened":
        break;
    }
  }
  return { title, body, state, labels: [...labels].sort(), assignees: [...assignees].sort(), severity, blocker, comments, decisions, updated: es.at(-1)?.at, author: first?.actor.id };
}

const ergaStep = fc.record({ type: fc.integer({ min: 0, max: 8 }), person: fc.boolean(), a: fc.constantFrom("alpha", "beta", "gamma"), b: fc.constantFrom("alpha", "beta", "gamma"), n: fc.integer({ min: 0, max: 3 }) });

proves(["0002-planning-core FR-011"], "over any made-up issue file, the item read and folded agrees with the monorepo's fold on every field both have", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(ergaStep, { maxLength: 18 }), fc.boolean(), async (steps, blocker) => {
      const T0 = Date.UTC(2026, 10, 7, 13, 0, 0);
      const stamp = (i: number) => new Date(T0 + i * 7000).toISOString().slice(0, 19) + "Z";
      const id = (i: number) => `${ULIDS.item.slice(0, 10)}${(i + 1000).toString(32).toUpperCase().padStart(2, "0")}${ULIDS.item.slice(12, 26)}`.slice(0, 26);
      const ada = { type: "person", id: "ada@example.test", name: "Ada" };
      const tool = { type: "tool", id: "agora work build" };
      const events = [
        { id: id(0), at: stamp(0), actor: ada, type: "opened", data: { title: "T", body: "B", labels: ["alpha"], assignees: [], severity: "note", type: "commenting", blocker } },
        ...steps.map((s, i) => {
          const actor = s.person ? ada : tool;
          const [type, data] = ((): [string, unknown] => {
            switch (s.type) {
              case 0:
                return ["commented", { body: s.a }];
              case 1:
                return ["edited", { title: s.a, body: s.b }];
              case 2:
                return ["labeled", { add: [s.a], remove: [s.b] }];
              case 3:
                return ["assigned", { add: [s.a], remove: [s.b] }];
              case 4:
                return ["severity", { severity: s.n === 0 ? "error" : s.n === 1 ? "warning" : "note" }];
              case 5:
                return ["blocker", { blocker: s.n % 2 === 0 }];
              case 6:
                return ["closed", { reason: s.n === 0 ? "completed" : s.n === 1 ? "not_planned" : "duplicate" }];
              case 7:
                return ["reopened", undefined];
              default:
                return ["decided", { decision: s.n === 0 ? "accept" : "reject", note: s.a }];
            }
          })();
          return { id: id(i + 1), at: stamp(i + 1), actor, type, ...(data === undefined ? {} : { data }) };
        }),
      ];
      const file = must(records.decodeIssueFile(issueText(ULIDS.item, events)));
      const read = must(await records.readIssueFile(file, OPTIONS));
      const item = must(fold(read.events));
      const want = monorepoFold(file.events);
      assertEquals([item.title, item.body, [...item.labels], [...item.assignees], item.severity ?? "note", item.blocker ?? false, item.comments.length], [want.title, want.body, want.labels, want.assignees, want.severity, want.blocker, want.comments]);
      assertEquals(item.decisions.map((d) => `${d.verdict}:${d.note}`), want.decisions.map((d) => d.replace(/^reject/, "reject")));
      if (want.state.kind === "closed") assert(item.state.kind === "closed" && item.state.by.id === want.state.by && item.state.reason === (want.state.reason === "not_planned" ? "not-planned" : want.state.reason));
      else assertEquals(item.state.kind, "open");
      assertEquals([item.updatedAt, item.openedBy.id], [want.updated, want.author]);
      return true;
    }),
    { numRuns: 120 },
  );
});

proves(["0002-planning-core FR-011"], "every key of an event's data that the record does not know is a finding, so that nothing is dropped silently", async () => {
  const text = issueText(ULIDS.item, [
    { id: ULIDS.first, at: "2026-11-07T13:20:23Z", actor: { type: "person", id: "ada@example.test" }, type: "opened", data: { title: "T", colour: "red" } },
    { id: ULIDS.second, at: "2026-11-07T13:21:23Z", actor: { type: "person", id: "ada@example.test" }, type: "commented", data: { body: "b", mood: 1 } },
  ]);
  const read = must(await records.readIssueFile(must(records.decodeIssueFile(text)), OPTIONS));
  assertEquals(read.findings, [
    { kind: "unknown-key", event: ULIDS.first, key: "colour" },
    { kind: "unknown-key", event: ULIDS.second, key: "mood" },
  ]);
  assertStringIncludes(records.describeReadFinding(read.findings[0] ?? { kind: "unknown-key", event: "", key: "" }), "not carried");
});

/** The summary of a work's issues as the monorepo's own code makes it, written again from its description. */
function monorepoIndex(work: string, updated: string, issues: readonly { id: string; events: readonly records.ErgaEvent[] }[]) {
  const views = issues.map((i) => ({ id: i.id, view: monorepoFold(i.events), events: i.events }));
  return {
    schema: "erga/issues-index@1",
    work,
    updated,
    open: views.filter((v) => v.view.state.kind === "open").length,
    blockers: views.filter((v) => v.view.state.kind === "open" && v.view.blocker).length,
    issues: views.map((v) => {
      const sorted = [...v.events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
      const opening = (sorted[0]?.data ?? {}) as { type?: string; source?: unknown };
      const closed = v.view.state.kind === "closed" ? v.view.state : undefined;
      return {
        id: v.id,
        title: v.view.title,
        state: v.view.state.kind,
        state_reason: closed?.reason ?? "",
        severity: v.view.severity,
        motivation: opening.type ?? "commenting",
        blocker: v.view.blocker,
        labels: v.view.labels,
        assignees: v.view.assignees,
        author: v.view.author,
        created: sorted[0]?.at,
        updated: v.view.updated,
        comments: v.view.comments,
        source: opening.source ?? null,
      };
    }),
  };
}

proves(["0002-planning-core FR-011"], "the summary of a work's issues is rendered from items as the monorepo's own summary is made, and is encoded and decoded as written", async () => {
  const full = fullIssue();
  const second = { id: ULIDS.second, events: [{ id: ULIDS.third, at: "2026-11-08T08:00:00Z", actor: { type: "person", id: "bob@example.test" }, type: "opened", data: { title: "Plain", body: "", labels: [], severity: "warning", type: "commenting", blocker: true } }] };
  const files = [full, second].map((i) => must(records.decodeIssueFile(issueText(i.id, i.events))));
  const items: Item[] = [];
  for (const f of files) items.push(must(fold(must(await records.readIssueFile(f, OPTIONS)).events)));
  const index = records.indexOf("book/example", items, "event-files", "2026-11-21T10:00:00Z");
  const want = monorepoIndex("book/example", "2026-11-21T10:00:00Z", files.map((f) => ({ id: f.id, events: f.events })));
  assertEquals(JSON.parse(records.encodeIndex(index)), JSON.parse(JSON.stringify(want)));
  assertEquals(Object.keys(JSON.parse(records.encodeIndex(index)) as object), Object.keys(want));
  const text = records.encodeIndex(index);
  assertEquals(records.encodeIndex(must(records.decodeIndex(text))), text);
  assertEquals([index.open, index.blockers], [1, 1]);
});
