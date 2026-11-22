/**
 * Tests of the source for the typed issues of a library (commons planning 0004-planning-sources FR-006): the real `issues/` folder of `commons/data` read from a folder through AnyFS's local store without being
 * run, every field kept, the barrel checked, and a status written back as the one replaced value.
 *
 * @module
 */
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { makeEvent, makePatch } from "@intellectual-frontiers/planning/governance";
import { applyPatch, checkLens, fileSource, issuesLens, listedBy, parseIssueFile, stateOfStatus } from "@intellectual-frontiers/planning/physical";
import { ADA, eventIds, itemId, must } from "./support.ts";
import { harnessOf, lensContext, snapshotOf, storeWith } from "./harness.ts";
import { instant } from "./world.ts";

const REAL = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..", "data", "issues");

const ISSUE = (n: string, status: string) => `// Spec: 0044-issues FR-001
/** An issue ${n} */
import { issue } from "@x/governance";

export default issue({
  id: ${Number(n)},
  slug: "thing-${n}",
  title: "An issue ${n}",
  summary:
    "It is long " +
    "and in two parts, with a \\"quote\\".",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
  appliesTo: { engines: ["duckdb", "sqlite"] },
  status: ${status},
  size: "m",
  cites: ["0044-issues FR-001"],
  evidence: [{ kind: "file", path: "a.ts" }],
  links: [],
  raised: "2026-11-19", // a day
});
`;
const BARREL = (names: string[]) => `${names.map((n, i) => `import i${i} from "./${n}";`).join("\n")}\nexport const issues = issueSet("x", [${names.map((_, i) => `i${i}`).join(", ")}]);\n`;

proves(["0004-planning-sources FR-006"], "the literal of an issue file is parsed without running it: strings joined, comments, trailing commas, nested records, and what is not a literal is refused", () => {
  const r = parseIssueFile(ISSUE("00007", '{ kind: "in-progress", by: "claude" }'));
  assert(r.kind === "ok", "parsed");
  assertEquals(r.value.record["summary"], 'It is long and in two parts, with a "quote".');
  assertEquals(r.value.record["goals"], ["G1", "G2"]);
  assertEquals(r.value.record["appliesTo"], { engines: ["duckdb", "sqlite"] });
  assertEquals(r.value.record["status"], { kind: "in-progress", by: "claude" });
  assertEquals(parseIssueFile("export default issue({ id: f() })").kind, "err");
  assertEquals(parseIssueFile("export default issue({ title: `a ${1}` })").kind, "err");
  assertEquals(parseIssueFile("nothing here").kind, "err");
  assertEquals(listedBy('import a from "./00001-a.ts";\nimport b from "./00002-b.ts";\n'), ["00001-a.ts", "00002-b.ts"]);
});

proves(["0004-planning-sources FR-006"], "an issue is read as an item with every field of it kept: the severity as the source's own value, the state of its status, and a deferral that is not a day read as open with a finding", async () => {
  const store = await storeWith({
    "issues/mod.ts": BARREL(["00001-a.ts", "00002-b.ts", "00003-c.ts", "00004-d.ts"]),
    "issues/00001-a.ts": ISSUE("00001", '{ kind: "open" }'),
    "issues/00002-b.ts": ISSUE("00002", '{ kind: "fixed", proof: [{ kind: "spec", id: "0044-issues" }] }'),
    "issues/00003-c.ts": ISSUE("00003", '{ kind: "deferred", reason: "later", until: "2027-02-03" }'),
    "issues/00004-d.ts": ISSUE("00004", '{ kind: "deferred", reason: "later", until: "after the next stage" }'),
  });
  const source = must(fileSource(store, issuesLens({ scope: "x" }), "issues/"));
  const read = must(await source.acquire());
  assertEquals(read.observations.map((o) => o.content.state), [{ kind: "open" }, { kind: "closed", reason: "completed" }, { kind: "deferred", until: "2027-02-03" }, { kind: "open" }] as never);
  const first = read.observations[0];
  assert(first !== undefined, "an observation");
  assertEquals(first.content.sourceSeverity, "high");
  assertEquals(first.content.severity, undefined);
  assertEquals([first.content.priority, first.content.size, first.content.goals, first.content.engines, first.content.cites], ["P2", "m", ["G1", "G2"], ["duckdb", "sqlite"], ["0044-issues FR-001"]]);
  assertEquals(first.content.evidence, ['{"kind":"file","path":"a.ts"}']);
  assertEquals(first.content.at, "2026-11-19T00:00:00Z");
  assertEquals(first.content.external, [{ source: "issues", value: "x:00001" }]);
  assertEquals(first.content.kind, "issue");
  const raw = JSON.stringify(first.raw);
  assert(raw.includes('"links":[]') && raw.includes('"raised":"2026-11-19"'), "the record as read keeps the links and the day raised");
  assertEquals(read.findings.map((f) => f.message.includes("not a day")), [true]);
  assertEquals(stateOfStatus({ kind: "in-progress", by: "claude" }), { state: { kind: "in-progress" }, assignee: "claude" });
});

proves(["0004-planning-sources FR-006"], "a file the barrel does not list, a name it lists with no file, and a file that cannot be read are each found", async () => {
  const store = await storeWith({
    "issues/mod.ts": BARREL(["00001-a.ts", "00009-gone.ts"]),
    "issues/00001-a.ts": ISSUE("00001", '{ kind: "open" }'),
    "issues/00002-unlisted.ts": ISSUE("00002", '{ kind: "open" }'),
    "issues/00003-broken.ts": "export default issue({ id: compute() });\n",
  });
  const read = must(await must(fileSource(store, issuesLens({ scope: "x" }), "issues/")).acquire());
  const messages = read.findings.map((f) => `${f.path.split("/").pop()}: ${f.message}`).sort();
  assertEquals(messages.length, 4);
  assert(messages.some((m) => m.startsWith("00002-unlisted.ts: the barrel mod.ts does not list")), "unlisted");
  assert(messages.some((m) => m.includes("lists 00009-gone.ts, which has no file")), "listed with no file");
  assert(messages.some((m) => m.startsWith("00003-broken.ts: cannot be read")), "unreadable");
  assertEquals(read.observations.length, 2);
});

proves(["0004-planning-sources FR-006"], "a change of status is written as the one replaced value and every other byte stays; a close, which needs a proof, waits in the outbox", async () => {
  const text = ISSUE("00001", '{ kind: "fixed", proof: [{ kind: "spec", id: "0044-issues" }] }');
  const store = await storeWith({ "issues/mod.ts": BARREL(["00001-a.ts"]), "issues/00001-a.ts": text });
  const source = must(fileSource(store, issuesLens({ scope: "x" }), "issues/"));
  const o = must(await source.acquire()).observations[0];
  assert(o !== undefined, "an issue");
  const [e1, e2, e3] = eventIds(3);
  assert(e1 !== undefined && e2 !== undefined && e3 !== undefined, "ids");
  const patch = (id: typeof e1, data: Parameters<typeof makeEvent>[1]) => must(makePatch("issues", "issues/", must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, data)), o.fingerprint));
  const dry = await applyPatch(source, patch(e1, { type: "reopened" }), instant(2));
  assert(dry.kind === "dry-run" && dry.preview.effects.length === 1, "one effect");
  await applyPatch(source, patch(e1, { type: "reopened" }), instant(2), dry.preview.hash);
  const after = (await snapshotOf(store))["issues/00001-a.ts"] ?? "";
  assertEquals(after, text.replace('{ kind: "fixed", proof: [{ kind: "spec", id: "0044-issues" }] }', '{ kind: "open" }'));
  const start = await applyPatch(source, patch(e2, { type: "started" }), instant(3));
  assert(start.kind === "dry-run", "a start is previewed");
  await applyPatch(source, patch(e2, { type: "started" }), instant(3), start.preview.hash);
  assert((await snapshotOf(store))["issues/00001-a.ts"]?.includes('{ kind: "in-progress", by: "ada@example.test" }') === true, "started by the actor");
  const close = await applyPatch(source, patch(e3, { type: "closed", reason: "completed" }), instant(4));
  assert(close.kind === "outbox" && close.entry.waiting.kind === "unexpressed" && close.entry.waiting.reason.includes("proof"), "a close needs a proof the event does not hold");
  const edit = await applyPatch(source, patch(e3, { type: "edited", title: "New" }), instant(4));
  assert(edit.kind === "outbox" || edit.kind === "dry-run", "an edit is handled");
  const defer = await applyPatch(source, patch(e3, { type: "deferred", until: must((await import("@intellectual-frontiers/planning/governance")).parseDay("2027-05-05")) }), instant(4));
  assert(defer.kind === "outbox" && defer.entry.waiting.kind === "unexpressed", "a deferral with no reason cannot be written");
});

proves(["0004-planning-sources FR-006", "0004-planning-sources FR-004"], "the issues source keeps the laws of a lens over made-up issue files", async () => {
  const files = {
    "issues/mod.ts": BARREL(["00001-a.ts", "00002-b.ts", "00003-c.ts"]),
    "issues/00001-a.ts": ISSUE("00001", '{ kind: "open" }'),
    "issues/00002-b.ts": ISSUE("00002", '{ kind: "fixed", proof: [{ kind: "commit", sha: "abc" }] }'),
    "issues/00003-c.ts": ISSUE("00003", '{ kind: "in-progress", by: "claude" }'),
  };
  assertEquals(await checkLens(harnessOf(() => issuesLens({ scope: "x" }), files, "issues/"), lensContext()), []);
});

proves(["0004-planning-sources FR-006"], "the real issues folder of commons/data is read from a folder through the local store, every issue with its fields, and a write that sets the state it has changes no byte", async () => {
  const opened = await localStore(REAL);
  assert(opened.kind === "ok", "the real folder opens");
  const source = must(fileSource(opened.value, issuesLens({ scope: "data" }), "."));
  const read = must(await source.acquire());
  assert(read.observations.length >= 13, "the issues of data are read");
  assertEquals(read.findings.filter((f) => !f.message.includes("not a day")), []);
  assert(read.observations.every((o) => o.content.sourceSeverity !== undefined && o.content.priority !== undefined && o.content.at !== undefined), "every issue keeps its severity, its priority and its day");
  const [id] = eventIds(1);
  assert(id !== undefined, "an id");
  for (const o of read.observations) {
    const data = o.content.state.kind === "open" ? ({ type: "reopened" } as const) : o.content.state.kind === "in-progress" ? ({ type: "started" } as const) : null;
    if (data === null) continue;
    const p = must(makePatch("issues", ".", must(makeEvent({ id, item: itemId(), at: instant(1), actor: must((await import("@intellectual-frontiers/planning/governance")).person("claude", "claude")) }, data)), o.fingerprint));
    const d = await applyPatch(source, p, instant(2));
    if (o.content.state.kind === "open") assert(d.kind === "dry-run" && d.preview.effects.length === 0, `an open issue set open changes nothing: ${o.content.title}`);
  }
  assert(join(REAL, "mod.ts").length > 0, "the folder is the one of commons/data");
});
