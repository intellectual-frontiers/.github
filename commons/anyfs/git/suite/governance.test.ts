/**
 * Tests of the governance of the Git stores (commons anyfs-git 0002-git-governance FR-001, FR-002, FR-003): identities and trailers made only by their parsers, the message of a commit, and the names a store
 * will not hold.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { caseCollisions, defaultSubject, DEFAULT_MAX_OBJECT_BYTES, gitPathProblems, messageOf, parseIdentity, parseTrailer } from "../src/governance/mod.ts";
import { p } from "./kit.ts";

proves(["0002-git-governance FR-001"], "an identity and a trailer are made only by their parsers, and a text that is not one is refused with a sentence", () => {
  assertEquals(parseIdentity("A Person", "a@example.test").kind, "ok");
  for (const [name, email] of [["", "a@x"], [" A", "a@x"], ["A <b>", "a@x"], ["A", "no-at"], ["A", "a b@x"], ["A\nB", "a@x"], ["A", "<a@x>"]] as const) {
    const r = parseIdentity(name, email);
    assertEquals(r.kind, "err", `${JSON.stringify([name, email])}`);
    assert(r.kind === "err" && r.error.length > 10);
  }
  assertEquals(parseTrailer("Refs", "#21").kind, "ok");
  assertEquals(parseTrailer("Co-Authored-By", "A <a@x>").kind, "ok");
  for (const [k, v] of [["1Refs", "x"], ["Re fs", "x"], ["Refs", ""], ["Refs", "a\nb"], ["Refs", " x"]] as const) assertEquals(parseTrailer(k, v).kind, "err", `${JSON.stringify([k, v])}`);
});

proves(["0002-git-governance FR-002"], "the message is the subject, a line for each change where there are several, and the trailers after a blank line, and the first line holds no line break", () => {
  const t = parseTrailer("Refs", "#21");
  const u = parseTrailer("Claude-Session", "https://example.test/s");
  assert(t.kind === "ok" && u.kind === "ok");
  if (t.kind !== "ok" || u.kind !== "ok") return;
  assertEquals(messageOf(defaultSubject, [{ kind: "put", path: "a/b" }], [t.value]), "anyfs: write a/b\n\nRefs: #21\n");
  assertEquals(messageOf(defaultSubject, [{ kind: "delete", path: "a" }], []), "anyfs: delete a\n");
  assertEquals(messageOf(defaultSubject, [{ kind: "move", path: "a", to: "b" }], []), "anyfs: move a to b\n");
  assertEquals(
    messageOf(defaultSubject, [{ kind: "put", path: "a" }, { kind: "delete", path: "b" }, { kind: "move", path: "c", to: "d" }], [t.value, u.value]),
    "anyfs: 3 changes\n\n- write a\n- delete b\n- move c to d\n\nRefs: #21\nClaude-Session: https://example.test/s\n",
  );
  const broken = messageOf(() => "one\ntwo\r\nthree", [{ kind: "put", path: "a" }], []);
  assertEquals(broken, "one two three\n");
  assertEquals(messageOf(() => "  ", [{ kind: "put", path: "a" }], []), "anyfs: write a\n");
});

proves(["0002-git-governance FR-003"], "a component read as the folder of Git is refused in every spelling, case collisions are grouped, and the default limit is 50 MiB", () => {
  for (const bad of ["a/.git", ".GIT/x", "a/.Git/config", "x/.git.", "x/.git ", "x/git~1/y", "x/GIT~1"]) assert(gitPathProblems(p(bad)).length > 0, bad);
  for (const good of ["a/.gitignore", "a/.gitmodules", "a/git", "a/mygit", "a/.github/x", "a/.gitx"]) assertEquals(gitPathProblems(p(good)), [], good);
  assertEquals(caseCollisions([p("A/b"), p("a/B"), p("a/b"), p("c")]), [[p("A/b"), p("a/B"), p("a/b")].toSorted()]);
  assertEquals(caseCollisions([p("a"), p("b")]), []);
  assertEquals(DEFAULT_MAX_OBJECT_BYTES, 50 * 1024 * 1024);
});
