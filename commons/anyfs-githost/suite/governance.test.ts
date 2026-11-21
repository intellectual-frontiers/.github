/**
 * Tests of the governance of the Git host stores (commons anyfs-githost 0002-anyfs-githost-store FR-001, FR-002): who a commit is by and what its message says, and what a store will hold: the largest object and the names Git
 * or another computer reads wrongly.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { parsePath, type Path } from "@intellectual-frontiers/anyfs/governance";
import { caseCollisions, DEFAULT_MAX_OBJECT_BYTES, defaultSubject, gitPathProblems, messageOf, parseIdentity, parseTrailer } from "../src/mod.ts";

const p = (t: string): Path => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-anyfs-githost-store FR-001"], "an identity and a trailer are made only by their parsers, and a message is the subject, a line for each change of a commit of several, and the trailers after a blank line", () => {
  assert(parseIdentity("Fleet Writer", "fleet@example.test").kind === "ok");
  for (const [name, email] of [["", "a@b"], [" padded", "a@b"], ["Bad <angle>", "a@b"], ["Name", "no-at"], ["Name", "a b@c"], ["Name", "a@b\n"], ["Na\nme", "a@b"]] as const) assertEquals(parseIdentity(name, email).kind, "err", `${name} ${email}`);
  assert(parseTrailer("Refs", "#21").kind === "ok");
  for (const [k, v] of [["", "x"], ["1bad", "x"], ["Has Space", "x"], ["Key", ""], ["Key", " padded"], ["Key", "two\nlines"]] as const) assertEquals(parseTrailer(k, v).kind, "err", `${k}=${v}`);
  const t = parseTrailer("Refs", "#21");
  assert(t.kind === "ok");
  assertEquals(messageOf(defaultSubject, [{ kind: "put", path: "a/b" }], [t.value]), "anyfs: write a/b\n\nRefs: #21\n");
  const many = messageOf(defaultSubject, [{ kind: "put", path: "a" }, { kind: "delete", path: "b" }, { kind: "move", path: "c", to: "d" }], []);
  assertEquals(many, "anyfs: 3 changes\n\n- write a\n- delete b\n- move c to d\n");
  assertEquals(messageOf(() => "  \n ", [{ kind: "put", path: "a" }], []), "anyfs: write a\n", "an empty subject is the default one");
  assertEquals(messageOf(() => "two\nlines", [{ kind: "put", path: "a" }], []).split("\n")[0], "two lines", "a subject is one line");
});

proves(["0002-anyfs-githost-store FR-002"], "the largest object is 25 MiB, a path that Git or another computer reads as the folder of Git is a problem, and paths that differ only by case are found", () => {
  assertEquals(DEFAULT_MAX_OBJECT_BYTES, 25 * 1024 * 1024);
  for (const bad of [".git/config", "a/.GIT/x", "a/.git. /x", "a/git~1/x", ".git"]) assert(gitPathProblems(p(bad)).length > 0, bad);
  for (const good of ["a/b.txt", "gitignore", "a/.gitignore", "a/.github/x", "dotgit/x"]) assertEquals(gitPathProblems(p(good)), [], good);
  const groups = caseCollisions([p("a/B"), p("a/b"), p("c"), p("c"), p("D"), p("d"), p("d")]);
  assertEquals(groups, [[p("a/B"), p("a/b")], [p("D"), p("d")]]);
  assertEquals(caseCollisions([p("a"), p("b")]), []);
  assertStringIncludes(gitPathProblems(p(".git/x"))[0] ?? "", ".git");
});
