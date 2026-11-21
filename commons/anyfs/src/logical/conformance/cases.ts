// Spec: 0005-anyfs-conformance FR-001, FR-002
/**
 * The cases every backend passes: what a store does for the capabilities it has. Each case makes a new store, does what a program does with it and fails with a sentence that says what differed. A case needs
 * named capabilities and is only run for a store that has them, so that a store is held to what it claims and to nothing it does not.
 *
 * @module
 */
import {
  comparePaths,
  type Cursor,
  expectAbsent,
  expectAny,
  expectRev,
  isUnder,
  type Path,
  type Prefix,
  parsePrefix,
  parseRevision,
  ROOT,
  schemeOf,
} from "@intellectual-frontiers/anyfs/governance";
import { type Case, bad, bytes, ConformanceFailure, expect, good, pathOf, same, text, withCapabilities } from "./kit.ts";

const NAMES = ["b", "a/z", "a/y", "a/x/1", "c d", "é", "😀", "ab/q", "Z"] as const;

/** The cases that need only the core capabilities. */
const CORE: readonly Case[] = [
  {
    id: "round-trip",
    title: "bytes written are the bytes read, with the revision the write returned, and the revision is a revision",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("docs/one.txt");
      const w = good(await s.write(p, bytes("hello"), expectAny), "write");
      expect(w.created, "a first write says it made the object");
      const r = good(await s.read(p), "read");
      same(text(r.bytes), "hello", "the bytes read");
      same(r.rev, w.rev, "the revision of the read and of the write");
      expect(parseRevision(r.rev).kind === "ok" && schemeOf(r.rev).length > 0, `${r.rev} is a revision with a scheme`);
      const st = good(await s.stat(p), "stat");
      same([st.path, st.size, st.rev], [p, 5, w.rev], "the stat");
    },
  },
  {
    id: "revision-follows-bytes",
    title: "a revision changes when the bytes change, and is the same where they are written again",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("r");
      const one = good(await s.write(p, bytes("one"), expectAny), "first write");
      const again = good(await s.write(p, bytes("one"), expectAny), "the same bytes");
      same(again.rev, one.rev, "the revision of the same bytes");
      expect(!again.created, "writing over an object does not make it");
      const two = good(await s.write(p, bytes("two"), expectAny), "other bytes");
      expect(two.rev !== one.rev, "other bytes are another revision");
    },
  },
  {
    id: "expect-absent",
    title: "a write that expects no object makes one and conflicts with an object that is there, changing nothing",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("only-once");
      const first = good(await s.write(p, bytes("first"), expectAbsent), "the first write");
      const second = bad(await s.write(p, bytes("second"), expectAbsent), "conflict", "the second write");
      if (second.kind === "conflict") same(second.found, { kind: "rev", rev: first.rev }, "what the conflict found");
      same(text(good(await s.read(p), "read").bytes), "first", "the bytes after the conflict");
    },
  },
  {
    id: "expect-any",
    title: "a write that expects any state makes or replaces",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("any");
      good(await s.write(p, bytes("a"), expectAny), "make");
      good(await s.write(p, bytes("b"), expectAny), "replace");
      same(text(good(await s.read(p), "read").bytes), "b", "the bytes");
    },
  },
  {
    id: "expect-revision",
    title: "a write that expects a revision changes the object only where it is at that revision",
    needs: ["cas"],
    async run(make) {
      const s = withCapabilities(await make(), "cas");
      const p = pathOf("cas");
      const one = good(await s.write(p, bytes("one"), expectAbsent), "make");
      const two = good(await s.write(p, bytes("two"), expectRev(one.rev)), "replace at the revision");
      const stale = bad(await s.write(p, bytes("three"), expectRev(one.rev)), "conflict", "replace at a revision that is gone");
      if (stale.kind === "conflict") same(stale.found, { kind: "rev", rev: two.rev }, "what the conflict found");
      const none = bad(await s.write(pathOf("nothing"), bytes("x"), expectRev(one.rev)), "conflict", "replace where there is no object");
      if (none.kind === "conflict") same(none.found, { kind: "absent" }, "what the conflict found");
      same(text(good(await s.read(p), "read").bytes), "two", "the bytes after the conflicts");
    },
  },
  {
    id: "race-absent",
    title: "writers that race to make one object do not both win: one makes it and the others conflict",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("race/absent");
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => s.write(p, bytes(`writer ${i}`), expectAbsent)));
      const wins = results.flatMap((r, i) => (r.kind === "ok" ? [i] : []));
      same(wins.length, 1, "the writers that won");
      for (const r of results) if (r.kind === "err") expect(r.error.kind === "conflict", `a loser is a conflict, got ${r.error.kind}`);
      const winner = wins[0] ?? 0;
      same(text(good(await s.read(p), "read").bytes), `writer ${winner}`, "the bytes are the winner's");
    },
  },
  {
    id: "race-revision",
    title: "writers that race to replace one revision do not both win",
    needs: ["cas"],
    async run(make) {
      const s = withCapabilities(await make(), "cas");
      const p = pathOf("race/rev");
      const base = good(await s.write(p, bytes("base"), expectAbsent), "make");
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => s.write(p, bytes(`writer ${i}`), expectRev(base.rev))));
      const wins = results.flatMap((r, i) => (r.kind === "ok" ? [i] : []));
      same(wins.length, 1, "the writers that won");
      for (const r of results) if (r.kind === "err") expect(r.error.kind === "conflict", `a loser is a conflict, got ${r.error.kind}`);
      same(text(good(await s.read(p), "read").bytes), `writer ${wins[0] ?? 0}`, "the bytes are the winner's");
    },
  },
  {
    id: "list-order-and-prefix",
    title: "a list is in the order of the paths, below its prefix only, and a prefix is a folder and not a text",
    needs: [],
    async run(make) {
      const s = await make();
      for (const n of NAMES) good(await s.write(pathOf(n), bytes(n), expectAny), `write ${n}`);
      const all = good(await s.list(ROOT), "list the root").entries.map((e) => e.path);
      same(all, [...NAMES].map(pathOf).sort(comparePaths), "the paths of the root, in order");
      const a = good(await s.list(prefixOf("a")), "list a").entries.map((e) => e.path);
      same(a, ["a/x/1", "a/y", "a/z"], "the paths below a");
      same(good(await s.list(prefixOf("a/x")), "list a/x").entries.map((e) => e.path), ["a/x/1"], "the paths below a/x");
      same(good(await s.list(prefixOf("nothing")), "list nothing").entries.length, 0, "the paths below a prefix with none");
      for (const e of good(await s.list(prefixOf("a")), "list a").entries) expect(isUnder(prefixOf("a"), e.path), `${e.path} is below a`);
    },
  },
  {
    id: "list-paging",
    title: "a list in pages gives the whole list, once, with a cursor until the last page",
    needs: [],
    async run(make) {
      const s = await make();
      const names = Array.from({ length: 25 }, (_, i) => `page/${String(i).padStart(2, "0")}`);
      for (const n of names) good(await s.write(pathOf(n), bytes(n), expectAny), `write ${n}`);
      const seen: Path[] = [];
      let after: Cursor | undefined;
      let pages = 0;
      for (;;) {
        const page = good(await s.list(prefixOf("page"), after === undefined ? { limit: 10 } : { limit: 10, after }), "a page");
        pages++;
        expect(page.entries.length <= 10, "a page is at most its limit");
        seen.push(...page.entries.map((e) => e.path));
        if (page.next === undefined) break;
        expect(page.entries.length === 10, "a page with a cursor is full");
        after = page.next;
        expect(pages < 10, "the pages end");
      }
      same(pages, 3, "the pages");
      same(seen, names.map(pathOf), "the paths of the pages together");
    },
  },
  {
    id: "stat",
    title: "stat gives the size and the revision without the bytes, and a missing object is missing",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("stat/me");
      const w = good(await s.write(p, bytes("12345678"), expectAny), "write");
      const st = good(await s.stat(p), "stat");
      same([st.size, st.rev], [8, w.rev], "size and revision");
      const m = bad(await s.stat(pathOf("stat/missing")), "missing", "stat of a path with no object");
      if (m.kind === "missing") same(m.path, "stat/missing", "the path of the problem");
      bad(await s.read(pathOf("stat/missing")), "missing", "read of a path with no object");
    },
  },
  {
    id: "delete-is-idempotent",
    title: "a delete removes the object and succeeds where it is already gone",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("del/me");
      good(await s.write(p, bytes("x"), expectAny), "write");
      const one = good(await s.delete(p, expectAny), "delete");
      same(one.existed, true, "the first delete found it");
      const two = good(await s.delete(p, expectAny), "delete again");
      same(two.existed, false, "the second delete found nothing");
      bad(await s.read(p), "missing", "read after delete");
      good(await s.write(p, bytes("y"), expectAbsent), "write over a deleted object expecting none");
      bad(await s.delete(p, expectAbsent), "conflict", "delete that expects no object where there is one");
    },
  },
  {
    id: "delete-at-revision",
    title: "a delete that expects a revision removes the object only at that revision",
    needs: ["cas"],
    async run(make) {
      const s = withCapabilities(await make(), "cas");
      const p = pathOf("del/rev");
      const one = good(await s.write(p, bytes("one"), expectAbsent), "make");
      const two = good(await s.write(p, bytes("two"), expectAny), "replace");
      bad(await s.delete(p, expectRev(one.rev)), "conflict", "delete at a revision that is gone");
      good(await s.read(p), "the object is still there");
      good(await s.delete(p, expectRev(two.rev)), "delete at its revision");
      bad(await s.read(p), "missing", "read after delete");
    },
  },
  {
    id: "names",
    title: "names with spaces, non-ASCII text, a long segment and a deep path are held and listed as they were written",
    needs: [],
    async run(make) {
      const s = await make();
      const names = ["with space/and more.txt", "ünï/çödé", "日本語/ファイル", "emoji/😀.txt", `long/${"x".repeat(200)}`, "d/e/p/t/h/1/2/3/4/5/6/leaf"];
      for (const n of names) {
        good(await s.write(pathOf(n), bytes(n), expectAny), `write ${n}`);
        same(text(good(await s.read(pathOf(n)), `read ${n}`).bytes), n, `the bytes of ${n}`);
      }
      const listed = good(await s.list(ROOT), "list").entries.map((e) => e.path);
      same(listed, names.map(pathOf).sort(comparePaths), "the listed paths");
    },
  },
  {
    id: "empty-object",
    title: "an object of no bytes is an object",
    needs: [],
    async run(make) {
      const s = await make();
      const p = pathOf("empty");
      const w = good(await s.write(p, new Uint8Array(), expectAny), "write");
      same(good(await s.read(p), "read").bytes.length, 0, "the bytes read");
      same(good(await s.stat(p), "stat").size, 0, "the size");
      same(good(await s.read(p), "read").rev, w.rev, "the revision");
    },
  },
];

/** A prefix the case names. */
function prefixOf(source: string): Prefix {
  const r = parsePrefix(source);
  if (r.kind === "err") throw new ConformanceFailure(`the suite names ${JSON.stringify(source)}, which is not a prefix: ${r.error}`);
  return r.value;
}

/** The cases that need an optional capability. */
const OPTIONAL: readonly Case[] = [
  {
    id: "batch-all-or-nothing",
    title: "a batch makes all its changes or none: one that fails leaves no change behind",
    needs: ["batch"],
    async run(make) {
      const s = withCapabilities(await make(), "batch");
      const have = pathOf("batch/have");
      good(await s.write(have, bytes("old"), expectAny), "make the object the batch conflicts with");
      const failing = await s.batch([
        { kind: "put", path: pathOf("batch/one"), bytes: bytes("1"), expect: expectAny },
        { kind: "put", path: pathOf("batch/two"), bytes: bytes("2"), expect: expectAny },
        { kind: "put", path: have, bytes: bytes("new"), expect: expectAbsent },
      ]);
      bad(failing, "conflict", "a batch with a change that conflicts");
      bad(await s.read(pathOf("batch/one")), "missing", "batch/one, the first change of the failed batch, was written");
      bad(await s.read(pathOf("batch/two")), "missing", "batch/two, the second change of the failed batch, was written");
      same(text(good(await s.read(have), "read").bytes), "old", "the object of the failed batch");
      const done = good(
        await s.batch([
          { kind: "put", path: pathOf("batch/one"), bytes: bytes("1"), expect: expectAny },
          { kind: "put", path: pathOf("batch/two"), bytes: bytes("2"), expect: expectAny },
          { kind: "delete", path: have, expect: expectAny },
        ]),
        "a batch that holds",
      );
      same(done.results.map((r) => [r.kind, r.path]), [["put", "batch/one"], ["put", "batch/two"], ["delete", "batch/have"]], "the results, in order");
      same(text(good(await s.read(pathOf("batch/two")), "read").bytes), "2", "the bytes of the batch");
      bad(await s.read(have), "missing", "the deleted object");
    },
  },
  {
    id: "rename-does-not-overwrite",
    title: "a rename moves an object, keeps its revision, and conflicts with an object at the target",
    needs: ["rename"],
    async run(make) {
      const s = withCapabilities(await make(), "rename");
      const from = pathOf("mv/from");
      const to = pathOf("mv/to");
      const w = good(await s.write(from, bytes("moved"), expectAny), "write");
      const r = good(await s.rename(from, to, expectAny), "rename");
      same(r.rev, w.rev, "the revision after the rename");
      bad(await s.read(from), "missing", "read of the old path");
      same(text(good(await s.read(to), "read").bytes), "moved", "the bytes at the new path");
      good(await s.write(from, bytes("other"), expectAny), "make an object at the old path");
      bad(await s.rename(from, to, expectAny), "conflict", "rename onto an object");
      same(text(good(await s.read(from), "read").bytes), "other", "the source after the conflict");
      same(text(good(await s.read(to), "read").bytes), "moved", "the target after the conflict");
      bad(await s.rename(pathOf("mv/none"), pathOf("mv/else"), expectAny), "missing", "rename of a path with no object");
    },
  },
  {
    id: "history-newest-first",
    title: "a history lists the revisions an object has had, newest first",
    needs: ["history"],
    async run(make) {
      const s = withCapabilities(await make(), "history");
      const p = pathOf("hist");
      const r1 = good(await s.write(p, bytes("1"), expectAny), "write 1");
      const r2 = good(await s.write(p, bytes("2"), expectAny), "write 2");
      const r3 = good(await s.write(p, bytes("3"), expectAny), "write 3");
      same(good(await s.history(p), "history").versions.map((v) => v.rev), [r3.rev, r2.rev, r1.rev], "the revisions");
      bad(await s.history(pathOf("hist/none")), "missing", "history of a path with no object");
    },
  },
];

/** Every case of the suite, in the order they are run. */
export const CASES: readonly Case[] = [...CORE, ...OPTIONAL];
