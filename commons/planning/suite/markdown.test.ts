/**
 * Tests of the Markdown source (commons planning 0004-planning-sources FR-008): the task list items of GitHub Flavored Markdown 0.29-gfm section 5.3 (its two examples, 279 and 280, and every rule of the marker),
 * nesting, fenced code, the one-character write and the laws of a lens over generated documents.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { makeEvent, makePatch } from "@intellectual-frontiers/planning/governance";
import { applyPatch, checkLens, markdownLens, tasksOf } from "@intellectual-frontiers/planning/physical";
import { ADA, event, eventIds, itemId, must } from "./support.ts";
import { harnessOf, lensContext, snapshotOf, storeWith } from "./harness.ts";
import { instant } from "./world.ts";

const SPEC_279 = "- [ ] foo\n- [x] bar\n";
const SPEC_280 = "- [x] foo\n  - [ ] bar\n  - [x] baz\n- [ ] bim\n";

proves(["0004-planning-sources FR-008"], "every example of the task list section of GFM 0.29-gfm is read: examples 279 and 280, with checked and unchecked as the spec says and the nesting", () => {
  assertEquals(tasksOf(SPEC_279).map((t) => [t.title, t.mark]), [["foo", " "], ["bar", "x"]]);
  const t = tasksOf(SPEC_280);
  assertEquals(t.map((x) => [x.title, x.mark, x.parentLine]), [["foo", "x", undefined], ["bar", " ", 1], ["baz", "x", 1], ["bim", " ", undefined]]);
});

proves(["0004-planning-sources FR-008"], "the marker is read by the rule of the text: any list marker, a tab or X, optional spaces, and a whitespace after the bracket; what does not meet it is not a task", () => {
  const read = (text: string) => tasksOf(text).map((t) => `${t.title}:${t.mark === " " || t.mark === "\t" ? "open" : "done"}`);
  assertEquals(read("- [ ] a\n+ [x] b\n* [X] c\n1. [ ] d\n2) [x] e\n"), ["a:open", "b:done", "c:done", "d:open", "e:done"]);
  assertEquals(read("-\t[\t]\tt\n"), ["t:open"]);
  assertEquals(read("- [ ]no space\n- [] none\n- [xx] two\n- [ ]\n- text [ ] inside\n- [y] other\n"), []);
  assertEquals(read("  - [ ] indented\n   - [x] more\n"), ["indented:open", "more:done"]);
  assertEquals(read("```\n- [ ] in code\n```\n- [ ] out\n~~~md\n- [x] tilde\n~~~\n"), ["out:open"]);
  assertEquals(read("- [ ] one\n- [ ] one\n").length, 2);
  assertEquals(read("---\n- [ ] after a rule\n"), ["after a rule:open"]);
});

proves(["0004-planning-sources FR-008"], "a task nested under a plain item is a child of the nearest task above, a body is the text under an item, and a heading ends the list", () => {
  const text = "- [ ] top\n  body line\n  - plain\n    - [ ] deep\n\n# Heading\n- [x] after\n";
  const t = tasksOf(text);
  assertEquals(t.map((x) => [x.title, x.parentLine, x.body]), [["top", undefined, "body line"], ["deep", 1, ""], ["after", undefined, ""]]);
});

async function closeThing(files: Record<string, string>, pick: (titles: string[]) => number, data: Parameters<typeof makeEvent>[1]) {
  const store = await storeWith(files);
  const { fileSource } = await import("@intellectual-frontiers/planning/physical");
  const source = must(fileSource(store, markdownLens(), "."));
  const read = must(await source.acquire());
  const o = read.observations[pick(read.observations.map((x) => x.content.title))];
  assert(o !== undefined, "an observation");
  const [id] = eventIds(1);
  assert(id !== undefined, "an id");
  const patch = must(makePatch("markdown", ".", must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, data)), o.fingerprint));
  return { store, source, patch, o };
}

proves(["0004-planning-sources FR-008"], "closing an item changes the one character between its brackets to x and reopening it to a space, and no other byte, with a dry run first and the hash after", async () => {
  const original = "# Plan\n\nText kept as it is  \n- [ ] first\n  - [ ] nested\n- [ ] last\n\ttail\n";
  const { store, source, patch } = await closeThing({ "plan.md": original }, () => 1, { type: "closed", reason: "completed" });
  const dry = await applyPatch(source, patch, instant(2));
  assert(dry.kind === "dry-run", "a dry run");
  assertEquals((await snapshotOf(store))["plan.md"], original);
  const stale = await applyPatch(source, patch, instant(2), "f".repeat(64));
  assertEquals(stale.kind, "stale");
  const done = await applyPatch(source, patch, instant(2), dry.preview.hash);
  assert(done.kind === "written", "written");
  const after = (await snapshotOf(store))["plan.md"] ?? "";
  assertEquals(after, original.replace("  - [ ] nested", "  - [x] nested"));
  assertEquals(after.length, original.length);
  // and back
  const [id2] = eventIds(1, undefined, 1_773_000_000_000);
  assert(id2 !== undefined, "an id");
  const read = must(await source.acquire());
  const o = read.observations.find((x) => x.content.title === "nested");
  assert(o !== undefined, "nested is read");
  assertEquals(o.content.state, { kind: "closed", reason: "completed" });
  const reopen = must(makePatch("markdown", ".", event(itemId(), id2, 5, ADA, { type: "reopened" }), o.fingerprint));
  const preview = await applyPatch(source, reopen, instant(3));
  assert(preview.kind === "dry-run", "a preview");
  await applyPatch(source, reopen, instant(3), preview.preview.hash);
  assertEquals((await snapshotOf(store))["plan.md"], original);
});

proves(["0004-planning-sources FR-008"], "a close for a reason a checked box cannot say, and every event a task list cannot hold, waits in the outbox with its reason", async () => {
  const notPlanned = await closeThing({ "a.md": "- [ ] x\n" }, () => 0, { type: "closed", reason: "not-planned" });
  const r = await applyPatch(notPlanned.source, notPlanned.patch, instant(2));
  assert(r.kind === "outbox" && r.entry.waiting.kind === "unexpressed", "unexpressed");
  const started = await closeThing({ "a.md": "- [ ] x\n" }, () => 0, { type: "started" });
  const s = await applyPatch(started.source, started.patch, instant(2));
  assert(s.kind === "outbox" && s.entry.waiting.kind === "capability" && s.entry.waiting.capability === "edit", "no edit capability");
});

proves(["0004-planning-sources FR-008", "0004-planning-sources FR-004"], "over generated documents the Markdown source keeps the laws of a lens, and a source that breaks them is found", async () => {
  const line = fc.tuple(fc.constantFrom("-", "+", "*", "1."), fc.constantFrom(" ", "x", "X"), fc.constantFrom("alpha", "beta task", "gamma"), fc.integer({ min: 0, max: 2 }));
  const doc = fc.array(fc.oneof(line.map(([m, c, t, d]) => `${"  ".repeat(d)}${m} [${c}] ${t}`), fc.constantFrom("", "plain text", "# Heading", "```", "> quote")), { minLength: 1, maxLength: 12 });
  await fc.assert(
    fc.asyncProperty(fc.array(doc, { minLength: 1, maxLength: 2 }), async (docs) => {
      const files = Object.fromEntries(docs.map((d, i) => [`d${i}.md`, `${d.join("\n")}\n`]));
      assertEquals(await checkLens(harnessOf(markdownLens, files), lensContext()), []);
    }),
    { numRuns: 40 },
  );
  // a lens that writes a different thing when it is only asked to keep the state is found
  const sloppy = () => ({ ...markdownLens(), edit: (file: { readonly text: string }) => ({ kind: "ok" as const, value: `${file.text}\n` }) });
  const found = await checkLens(harnessOf(sloppy, { "a.md": "- [ ] one\n- [x] two\n" }), lensContext());
  assert(found.some((v) => v.law === "get-put"), "get-put is broken");
  const lossy = () => ({ ...markdownLens(), parse: async (path: string, text: string) => ({ observations: (await markdownLens().parse(path, text)).observations.map((o, i) => ({ ...o, fingerprint: `${o.fingerprint}${i}${Math.random()}` })), findings: [] }) });
  const unstable = await checkLens(harnessOf(lossy, { "a.md": "- [ ] one\n" }), lensContext());
  assert(unstable.some((v) => v.law === "get-get"), "get-get is broken");
});

proves(["0004-planning-sources FR-008"], "an item from a task list is derived and open or closed, nested items are linked as parent of by the next reconcile, and a new item is appended as a task", async () => {
  const store = await storeWith({ "t.md": "- [ ] parent\n  - [x] child\n" });
  const { fileSource } = await import("@intellectual-frontiers/planning/physical");
  const source = must(fileSource(store, markdownLens(), "."));
  const read = must(await source.acquire());
  assertEquals(read.observations.map((o) => [o.content.title, o.content.state.kind, o.content.origin, o.content.parent === undefined]), [["parent", "open", "derived", true], ["child", "closed", "derived", false]]);
  const [id] = eventIds(1);
  assert(id !== undefined, "an id");
  const opened = must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, { type: "opened", kind: "task", title: "new one", body: "", labels: [], assignees: [], origin: "declared" }));
  const patch = must(makePatch("markdown", ".", opened));
  const dry = await applyPatch(source, patch, instant(2));
  assert(dry.kind === "dry-run", "a dry run");
  await applyPatch(source, patch, instant(2), dry.preview.hash);
  assertEquals((await snapshotOf(store))["tasks.md"], "- [ ] new one\n");
});
