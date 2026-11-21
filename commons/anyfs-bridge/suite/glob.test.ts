/**
 * Tests of the vocabulary of the bridge (commons anyfs-bridge 0002-bridge-plans FR-001 to FR-007): the closed unions of modes and actions, the plan in a fixed order, the rails, the patterns of a filter,
 * the canonical text and hash of a plan, and the rules that rewrite a path.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ACTION_ORDER, allowDeletes, anyGlobMatches, COMPARATORS, describeAction, describeMode, describeRefusal, forbidDeletes, globMatches, parseGlob } from "../src/governance/mod.ts";
import { addPrefix, canonical, compose, hashPlan, lowerCase, stripPrefix } from "../src/logical/mod.ts";
import { parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import { p } from "./kit.ts";

const glob = (t: string) => {
  const g = parseGlob(t);
  if (g.kind === "err") throw new Error(g.error);
  return g.value;
};

proves(["0002-bridge-plans FR-001"], "a mode is one of four and a delete policy forbids or allows a number", () => {
  assertStringIncludes(describeMode({ kind: "copy" }), "delete nothing");
  assertStringIncludes(describeMode({ kind: "sync", deletes: allowDeletes(3) }), "at most 3");
  assertStringIncludes(describeMode({ kind: "sync", deletes: forbidDeletes }), "nothing is removed");
  assertStringIncludes(describeMode({ kind: "move" }), "remove the source");
  assertStringIncludes(describeMode({ kind: "check" }), "differ");
  assertEquals(COMPARATORS, ["native-digest", "size-mtime", "content-hash"]);
});

proves(["0002-bridge-plans FR-002"], "an action is one of seven kinds, each said in a sentence, in a fixed order", () => {
  assertEquals(ACTION_ORDER, ["create", "update", "rename", "delete", "remove-source", "skip", "conflict"]);
  assertStringIncludes(describeAction({ kind: "delete", target: p("a"), dst: "sha256:ab" as never }), "delete a");
  assertStringIncludes(describeAction({ kind: "rename", from: p("a"), to: p("b"), dst: "sha256:ab" as never }), "rename a to b");
  assertStringIncludes(describeAction({ kind: "skip", target: p("a"), reason: "protected" }), "protected");
  assertStringIncludes(describeAction({ kind: "conflict", target: p("a"), reason: "case-collision", detail: "x" }), "case-collision");
  assertStringIncludes(describeRefusal({ kind: "delete-budget", wanted: 5, max: 2 }), "allowance is 2");
});

proves(["0002-bridge-plans FR-006"], "a pattern with no slash matches at any depth, one with a slash is anchored, ** takes any number of segments", () => {
  assert(globMatches(glob("*.tmp"), p("a/b/c.tmp")));
  assert(!globMatches(glob("*.tmp"), p("a/b/c.txt")));
  assert(globMatches(glob("node_modules"), p("x/node_modules/y/z.js")), "a name excludes a whole subtree");
  assert(globMatches(glob("src/*.ts"), p("src/a.ts")));
  assert(!globMatches(glob("src/*.ts"), p("lib/src/a.ts")), "anchored");
  assert(!globMatches(glob("src/*.ts"), p("src/deep/a.ts")), "a star stays in its segment");
  assert(globMatches(glob("src/**/a.ts"), p("src/a.ts")) && globMatches(glob("src/**/a.ts"), p("src/x/y/a.ts")), "** takes none or many");
  assert(globMatches(glob("a?c"), p("abc")) && !globMatches(glob("a?c"), p("ac")));
  assert(anyGlobMatches([glob("x"), glob("*.md")], p("r/readme.md")));
  assert(!anyGlobMatches([], p("a")));
});

proves(["0002-bridge-plans FR-006"], "a pattern that is empty, has an empty segment, a backslash or ** inside a segment is refused, and matching is bounded", () => {
  for (const bad of ["", "a//b", "a\\b", "a**b", "/a", "a/"]) assertEquals(parseGlob(bad).kind, "err", bad);
  assertEquals(parseGlob("a".repeat(513)).kind, "err");
  const hostile = glob("*a*a*a*a*a*a*a*a*b");
  const started = Date.now();
  assert(!globMatches(hostile, p("a".repeat(200))), "a pattern that makes a regular expression take for ever");
  assert(Date.now() - started < 1000, "the match took too long");
  fc.assert(fc.property(fc.stringMatching(/^[a-z]{1,8}(\/[a-z]{1,8}){0,3}$/), (s) => globMatches(glob("**"), p(s)) && globMatches(glob(s), p(s))));
});

proves(["0002-bridge-plans FR-005"], "the canonical text keeps the keys in order and the hash does not depend on how a plan was made", async () => {
  assertEquals(canonical({ b: 1, a: [2, { d: 1, c: 0 }], u: undefined }), '{"a":[2,{"c":0,"d":1}],"b":1}');
  const base = { mode: "copy" as const, source: "memory:a#", dest: "memory:b#", actions: [], unchanged: 0, carries: ["bytes"] as const, bytes: 0, losses: [] };
  const x = await hashPlan(base);
  const y = await hashPlan({ losses: [], bytes: 0, carries: ["bytes"], unchanged: 0, actions: [], dest: "memory:b#", source: "memory:a#", mode: "copy" });
  assertEquals(x, y);
  assertEquals(/^[0-9a-f]{64}$/u.test(x), true);
  assert((await hashPlan({ ...base, unchanged: 1 })) !== x, "a changed plan has another hash");
});

proves(["0002-bridge-plans FR-007"], "a rewrite adds or strips a prefix, folds the case, and composes, with the reason where it cannot", () => {
  const pre = parsePrefix("backup/2026");
  if (pre.kind === "err") throw new Error(pre.error);
  const add = addPrefix(pre.value)(p("a/b"));
  assertEquals(add.kind === "ok" ? String(add.value) : "", "backup/2026/a/b");
  const strip = stripPrefix(pre.value)(p("backup/2026/a/b"));
  assertEquals(strip.kind === "ok" ? String(strip.value) : "", "a/b");
  assertEquals(stripPrefix(pre.value)(p("other/a")).kind, "err");
  const both = compose(lowerCase, addPrefix(pre.value))(p("A/B"));
  assertEquals(both.kind === "ok" ? String(both.value) : "", "backup/2026/a/b");
  assertEquals(compose(stripPrefix(pre.value), lowerCase)(p("x")).kind, "err");
});
