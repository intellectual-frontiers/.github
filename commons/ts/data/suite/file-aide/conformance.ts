/**
 * The conformance suite every driver of File Aide passes (commons 0010-file-aide FR-014 to FR-018, FR-035): each operation, each condition
 * and two writers racing, the edges of a page, ranges, and names in many scripts. A driver's test calls `conformance` with a way to make an
 * empty store of it.
 *
 * @module
 */
import { assert, assertEquals, proves } from "../../../runtime/test.ts";
import {
  can,
  type Capability,
  compareKeys,
  widen,
  type FileMeta,
  listAll,
  type RelPath,
  relPath,
  type Store,
} from "../../file-aide/mod.ts";

/** A path the tests know to be valid. */
export const rel = (text: string): RelPath => {
  const r = relPath(text);
  if (r.kind === "err") throw new Error(`${text}: ${r.error.why}`);
  return r.value;
};

const bytesOf = (t: string): Uint8Array => new TextEncoder().encode(t);
const textOf = (b: Uint8Array): string => new TextDecoder().decode(b);

/** Names in many scripts and of many kinds, in the order of their code points. */
export const NAMES = ["a-x", "a/1", "a/2", "a/b/3", "b", "z", "é.txt", "Ελληνικά/α.txt", "日本/語.txt", "😀.txt"] as const;

/** Every path of a store, in the order its listing gives them. */
export async function allPaths<C extends Capability>(store: Store<C>, prefix = "", pageSize = 1000): Promise<string[]> {
  const out: string[] = [];
  for await (const f of listAll(store, prefix, pageSize)) {
    assert(f.kind === "ok", f.kind === "err" ? f.error.why : "");
    out.push(f.value.path);
  }
  return out;
}

/**
 * Registers the suite for one driver.
 *
 * @param driver - its name, in each test's name
 * @param make - makes an empty store of it, and a way to let it go
 */
export function conformance<C extends Capability>(
  driver: string,
  make: () => Promise<{ readonly store: Store<C>; readonly done: () => Promise<void> }>,
): void {
  const run = (requirements: readonly [string, ...string[]], what: string, f: (store: Store) => Promise<void>): void =>
    proves(requirements, `${driver}: ${what}`, async () => {
      const { store, done } = await make();
      try {
        await f(widen(store));
      } finally {
        await done();
      }
    });

  run(
    ["0010-file-aide FR-014", "0010-file-aide FR-018"],
    "a file is written, described, read, copied and removed, and a missing one is a value",
    async (s) => {
      const p = rel("works/a.txt");
      const put = await s.put(p, bytesOf("hello"));
      assert(put.kind === "ok");
      assertEquals([put.value.path, put.value.size], [p, 5]);
      const head = await s.head(p);
      assert(head.kind === "ok");
      assertEquals(head.value.version, put.value.version);
      const got = await s.get(p);
      assert(got.kind === "ok");
      assertEquals(textOf(got.value), "hello");
      const again = await s.put(p, bytesOf("hello, again"));
      assert(again.kind === "ok");
      assert(again.value.version !== put.value.version, "a write changes the version");
      const copied = await s.copy(p, rel("works/b.txt"));
      assert(copied.kind === "ok");
      assertEquals(copied.value.size, 12);
      assert((await s.delete(p)).kind === "ok");
      const gone = await s.get(p);
      assert(gone.kind === "err");
      assertEquals([gone.error.kind, gone.error.store, gone.error.path], ["not-found", s.name, p]);
      assertEquals((await s.head(p)).kind, "err");
      assertEquals((await s.delete(p)).kind, "ok", "removing what is not there is not a failure");
    },
  );

  run(["0010-file-aide FR-014"], "a range of bytes is read without the rest", async (s) => {
    const p = rel("r.bin");
    assert((await s.put(p, bytesOf("0123456789"))).kind === "ok");
    if (!can(s, "range")) return;
    const r = await widen(s).get(p, { start: 2, end: 5 });
    assert(r.kind === "ok");
    assertEquals(textOf(r.value), "234");
    const tail = await widen(s).get(p, { start: 7 });
    assert(tail.kind === "ok");
    assertEquals(textOf(tail.value), "789");
  });

  run(
    ["0010-file-aide FR-016"],
    "a write only where nothing is there lets one of two racing writers in and answers the other conflict",
    async (s) => {
      const p = rel("once/file.txt");
      if (!can(s, "write-if-absent")) return;
      const any = widen(s);
      const results = await Promise.all(["first", "second", "third"].map((w) => any.put(p, bytesOf(w), { kind: "if-absent" })));
      const won = results.filter((r) => r.kind === "ok");
      assertEquals(won.length, 1, "exactly one writer is let in");
      assertEquals(results.filter((r) => r.kind === "err" && r.error.kind === "conflict").length, 2);
      const kept = await s.get(p);
      assert(kept.kind === "ok");
      assert(["first", "second", "third"].includes(textOf(kept.value)), "the file is one writer's whole");
      const late = await any.put(p, bytesOf("late"), { kind: "if-absent" });
      assert(late.kind === "err" && late.error.kind === "conflict");
    },
  );

  run(
    ["0010-file-aide FR-015", "0010-file-aide FR-016"],
    "a write on a version is kept where the store can, and refused as a value where it cannot",
    async (s) => {
      const p = rel("v.txt");
      const first = await s.put(p, bytesOf("1"));
      assert(first.kind === "ok");
      const any = widen(s);
      if (!can(s, "write-if-match")) {
        const refused = await any.put(p, bytesOf("2"), { kind: "if-match", version: first.value.version });
        assert(refused.kind === "err");
        assertEquals(refused.error.kind, "refused");
        return;
      }
      const second = await any.put(p, bytesOf("2"), { kind: "if-match", version: first.value.version });
      assert(second.kind === "ok");
      const stale = await any.put(p, bytesOf("3"), { kind: "if-match", version: first.value.version });
      assert(stale.kind === "err" && stale.error.kind === "conflict");
      const got = await s.get(p);
      assert(got.kind === "ok");
      assertEquals(textOf(got.value), "2");
    },
  );

  run(
    ["0010-file-aide FR-014", "0010-file-aide FR-024"],
    "a listing is in the order of code points, in pages that never hold more than asked",
    async (s) => {
      for (const n of NAMES) assert((await s.put(rel(n), bytesOf(n))).kind === "ok", n);
      const want = [...NAMES].sort(compareKeys);
      assertEquals(want, [...NAMES], "the names are written in that order");
      assertEquals(await allPaths(s), want);
      assertEquals(await allPaths(s, "", 2), want, "pages of two give the same paths");
      const page = await s.list({ limit: 3 });
      assert(page.kind === "ok");
      assertEquals(page.value.files.length, 3);
      assertEquals(page.value.continuation, "a/2");
      assertEquals(await allPaths(s, "a"), ["a-x", "a/1", "a/2", "a/b/3"], "a prefix need not be a whole name");
      assertEquals(await allPaths(s, "a/"), ["a/1", "a/2", "a/b/3"]);
      const after = await s.list({ after: "b" });
      assert(after.kind === "ok");
      assertEquals(
        after.value.files.map((f: FileMeta): string => f.path),
        want.slice(5),
      );
      for (const n of NAMES) {
        const got = await s.get(rel(n));
        assert(got.kind === "ok" && textOf(got.value) === n, n);
      }
    },
  );

  run(
    ["0010-file-aide FR-014", "0010-file-aide FR-017"],
    "a listing by delimiter gives each folder once, and a folder is only the prefix of its files",
    async (s) => {
      for (const n of NAMES) assert((await s.put(rel(n), bytesOf(n))).kind === "ok", n);
      const root = await s.list({ delimiter: "/" });
      assert(root.kind === "ok");
      assertEquals(root.value.folders, ["a/", "Ελληνικά/", "日本/"]);
      assertEquals(
        root.value.files.map((f): string => f.path),
        ["a-x", "b", "z", "é.txt", "😀.txt"],
      );
      const a = await s.list({ prefix: "a/", delimiter: "/" });
      assert(a.kind === "ok");
      assertEquals([a.value.files.map((f): string => f.path), a.value.folders], [["a/1", "a/2"], ["a/b/"]]);
      const paged = await s.list({ delimiter: "/", limit: 2 });
      assert(paged.kind === "ok");
      assertEquals([paged.value.folders, paged.value.files.map((f): string => f.path), paged.value.continuation], [["a/"], ["a-x"], "a/"]);
      assert((await s.delete(rel("a/b/3"))).kind === "ok");
      const after = await s.list({ prefix: "a/", delimiter: "/" });
      assert(after.kind === "ok");
      assertEquals(after.value.folders, [], "a folder whose last file is gone is gone");
    },
  );
}
