/**
 * Tests of the comments source (commons planning 0004-planning-sources FR-009): the markers of the configuration, strings that are not comments, the fingerprint that survives a move of the line inside a file, the
 * anchor that is the only thing written, and the files that are refused.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { makeEvent, makePatch } from "@intellectual-frontiers/planning/governance";
import { applyPatch, checkLens, commentsLens, commentsOf, fileSource } from "@intellectual-frontiers/planning/physical";
import { ADA, eventIds, itemId, must } from "./support.ts";
import { harnessOf, lensContext, snapshotOf, storeWith } from "./harness.ts";
import { emptyWorld, instant, itemsOf, step } from "./world.ts";

const SRC = `import x from "y";

// TODO: tidy this up
export function alpha(a: number) {
  // FIXME(ada) handle zero
  const s = "// TODO not a comment";
  return a /* HACK: cast later */ + 1;
}

/**
 * XXX: block comment line
 */
class Beta {
  run() {
    // TODO: tidy this up
  }
}
`;

proves(["0004-planning-sources FR-009"], "a comment with a marker is read with its text and its enclosing symbol, in line and block comments, and a string that holds a marker is not a comment", () => {
  const found = commentsOf("a.ts", SRC, ["TODO", "FIXME", "XXX", "HACK"]);
  assertEquals(found.map((f) => [f.marker, f.text, f.symbol, f.line]), [
    ["TODO", "tidy this up", "", 3],
    ["FIXME", "handle zero", "alpha", 5],
    ["HACK", "cast later */ + 1;".replace(" */ + 1;", ""), "alpha", 7],
    ["XXX", "block comment line", "", 11],
    ["TODO", "tidy this up", "run", 15],
  ]);
  assertEquals(commentsOf("a.py", "x = 1  # TODO: py\nprint('# TODO no')\n", ["TODO"]).map((f) => f.text), ["py"]);
  assertEquals(commentsOf("a.sql", "select 1; -- FIXME: sql\n", ["FIXME"]).map((f) => f.text), ["sql"]);
  assertEquals(commentsOf("a.ts", "// TODO: a\n// OTHER: b\n", ["OTHER"]).map((f) => f.text), ["b"]);
  assertEquals(commentsOf("a.txt", "TODO: no syntax\n", ["TODO"]), []);
  assertEquals(commentsOf("a.ts", "// MYTODO: not a marker\n", ["TODO"]), []);
});

proves(["0004-planning-sources FR-009"], "the fingerprint is the same when the function moves down the file and when a line is added above, and equal comments in one symbol differ by their order", async () => {
  const before = "function f() {\n  // TODO: tidy\n}\n// TODO: tidy\n// TODO: tidy\n";
  const moved = "// a new line above\n\n\nfunction f() {\n  // TODO: tidy\n}\n// TODO: tidy\n// TODO: tidy\n";
  const ids = async (text: string) => {
    const s = must(fileSource(await storeWith({ "a.ts": text }), commentsLens(), "."));
    return must(await s.acquire()).observations.map((o) => o.fingerprint);
  };
  const a = await ids(before);
  const b = await ids(moved);
  assertEquals(a, b);
  assertEquals(new Set(a).size, 3);
  // and the item keeps its id through reconcile
  const s1 = must(fileSource(await storeWith({ "a.ts": before }), commentsLens(), "."));
  const w1 = (await step(emptyWorld(), "comments", must(await s1.acquire()).observations)).world;
  const s2 = must(fileSource(await storeWith({ "a.ts": moved }), commentsLens(), "."));
  const w2 = await step(w1, "comments", must(await s2.acquire()).observations);
  assertEquals(w2.result.events.length, 0);
  assertEquals(itemsOf(w2.world).length, 3);
});

proves(["0004-planning-sources FR-009"], "the anchor is the id of its item, written only as MARKER(#id) in a listed file, and a generated, a vendored or an unlisted file is refused", async () => {
  const id = itemId(3);
  const [e] = eventIds(1);
  assert(e !== undefined, "an id");
  const opened = must(makeEvent({ id: e, item: id, at: instant(1), actor: ADA }, { type: "opened", kind: "todo", title: "x", body: "", labels: [], assignees: [], origin: "derived" }));
  const store = await storeWith({ "src/a.ts": "// TODO: one\nconst x = 1;\n", "src/gen.auto.ts": "// TODO: generated\n", "vendor/v.ts": "// TODO: vendored\n", "other/o.ts": "// TODO: unlisted\n" });
  const source = must(fileSource(store, commentsLens({ anchorFiles: (p) => p.startsWith("src/") || p.startsWith("vendor/") }), "."));
  const read = must(await source.acquire());
  const of = (text: string) => read.observations.find((o) => o.content.title === text);
  const patchFor = (t: string) => must(makePatch("comments", ".", opened, of(t)?.fingerprint));
  const dry = await applyPatch(source, patchFor("one"), instant(2));
  assert(dry.kind === "dry-run", "a dry run");
  const done = await applyPatch(source, patchFor("one"), instant(2), dry.preview.hash);
  assert(done.kind === "written", "written");
  assertEquals((await snapshotOf(store))["src/a.ts"], `// TODO(#${id}): one\nconst x = 1;\n`);
  const now = must(await source.acquire());
  assertEquals(now.observations.find((o) => o.content.title === "one")?.content.anchor, id);
  assertEquals(now.observations.find((o) => o.content.title === "one")?.fingerprint, of("one")?.fingerprint);
  for (const t of ["generated", "vendored", "unlisted"]) {
    const r = await applyPatch(source, patchFor(t), instant(2));
    assert(r.kind === "failed" && r.problem.kind === "refused", `${t} is refused`);
  }
  const again = await applyPatch(source, patchFor("one"), instant(2));
  assert(again.kind === "dry-run" && again.preview.effects.length === 0, "an anchored comment needs nothing");
  // a comment that cannot be closed in place goes to the outbox
  const [e2] = eventIds(1, undefined, 1_774_000_000_000);
  assert(e2 !== undefined, "an id");
  const close = must(makePatch("comments", ".", must(makeEvent({ id: e2, item: id, at: instant(1), actor: ADA }, { type: "closed", reason: "completed" })), of("one")?.fingerprint));
  assertEquals((await applyPatch(source, close, instant(2))).kind, "outbox");
});

proves(["0004-planning-sources FR-009", "0004-planning-sources FR-004"], "the comments source keeps the laws of a lens over generated source files", async () => {
  assertEquals(await checkLens(harnessOf(() => commentsLens({ anchorFiles: () => true }), { "a.ts": SRC, "b.py": "# TODO: py\n" }), lensContext()), []);
});
