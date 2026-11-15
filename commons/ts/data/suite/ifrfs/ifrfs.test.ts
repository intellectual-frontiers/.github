/**
 * IFRFS, the layout that accepts File Aide (commons 0010-file-aide FR-038): the committed synthetic tree matches it whole, and broken copies
 * of its paths do not. Each phase of File Aide adds what IFRFS must pass here.
 *
 * @module
 */
import { fs, path as hostPath } from "../../../runtime/mod.ts";
import { assert, assertArrayIncludes, assertEquals, assertStringIncludes, proves } from "../../../runtime/test.ts";
import {
  catalog,
  type Capability,
  checkNames,
  compile,
  formatParseError,
  formatQueryError,
  parseQuery,
  type Query,
  query,
  queryTree,
  formatLayoutError,
  MACOS_LIMITS,
  memoryStore,
  readEntry,
  type RelPath,
  relPath,
  S3_LIMITS,
  type Store,
  widen,
  WINDOWS_LIMITS,
  writeEntry,
} from "../../file-aide/mod.ts";
import { posixStore } from "../../file-aide/runtime/mod.ts";
import { ENTRIES, ifrfs, issue, KINDS, MARKER, readme, rendition } from "../../ifrfs/mod.ts";

const TREE = hostPath.fromFileUrl(new URL("./tree/", import.meta.url));

/** The committed tree's files, as paths relative to it with `/` between names. */
const treeFiles = async (): Promise<string[]> => (await fs.walkFiles(TREE)).map((p) => p.replaceAll("\\", "/")).sort();

const made = ifrfs();

proves(["0010-file-aide FR-038", "0010-file-aide FR-010"], "IFRFS is a layout of three entries that do not overlap", () => {
  assert(made.kind === "ok", made.kind === "err" ? formatLayoutError(made.error) : "");
  assertEquals(
    ENTRIES.map((e) => [e.name, e.pattern.text]),
    [
      ["readme", "README.md"],
      ["rendition", "${kind}/${slug}/${file}"],
      ["issue", "${kind}/${slug}/issues.d/${id}.json5"],
    ],
  );
  assertEquals(KINDS.length, 15);
});

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-011"],
  "every file of the committed tree matches one entry of IFRFS, with its key",
  async () => {
    assert(made.kind === "ok");
    const files = await treeFiles();
    assertEquals(files.length, 12);
    const byEntry = new Map<string, string[]>();
    for (const f of files) {
      const m = made.value.match(f);
      assert(m.kind === "matched", `${f}: ${m.kind === "unmatched" ? m.why : ""}`);
      byEntry.set(m.entry, [...(byEntry.get(m.entry) ?? []), f]);
    }
    assertEquals([...byEntry.keys()].sort(), ["issue", "readme", "rendition"]);
    assertEquals(byEntry.get("issue")?.length, 2);
    const site = made.value.match("deck/example-talk/site/assets/app.css");
    assertEquals(site.kind === "matched" && site.entry === "rendition" ? site.key : undefined, {
      kind: "deck",
      slug: "example-talk",
      file: "site/assets/app.css",
    });
  },
);

proves(["0010-file-aide FR-038", "0010-file-aide FR-011"], "broken copies of the tree's paths are unmatched, each with why", () => {
  assert(made.kind === "ok");
  const broken: readonly [string, string][] = [
    ["film/example-handbook/x.pdf", "does not fit"],
    ["book/Example-Handbook/x.pdf", "does not fit"],
    ["book/example-handbook/issues.d/not-a-ulid.json5", "does not fit"],
    ["book/example-handbook/issues.d/01M6SFSZ7J1T8GX50X1H4RZH7V.json", "does not fit"],
    ["book/example-handbook", "names"],
    ["notes.txt", "does not fit"],
    [".DS_Store", "does not fit"],
    ["book/example-handbook/../x.pdf", "leave its place"],
  ];
  for (const [p, why] of broken) {
    const m = made.value.match(p);
    assert(m.kind === "unmatched", `${p} is unmatched`);
    assertStringIncludes(m.why, why, p);
  }
});

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-013"],
  "the tree's paths fit S3, Windows and macOS, and no two differ only in case",
  async () => {
    const paths = (await treeFiles()).map((f) => relPath(f)).flatMap((r) => (r.kind === "ok" ? [r.value] : []));
    assertEquals(paths.length, 12);
    assertEquals(checkNames(paths, [S3_LIMITS, WINDOWS_LIMITS, MACOS_LIMITS]), []);
  },
);

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-009"],
  "the README reads as text beginning with the marker, and an issue reads as JSON5",
  async () => {
    const r = readme.codec.decode(await fs.readFile(hostPath.join(TREE, "README.md")));
    assert(r.kind === "ok");
    assertEquals(r.value.split("\n")[0], MARKER);
    const i = issue.codec.decode(await fs.readFile(hostPath.join(TREE, "book/example-handbook/issues.d/01M6SFSZ7J1T8GX50X1H4RZH7V.json5")));
    assert(i.kind === "ok" && typeof i.value === "object" && i.value !== null && !Array.isArray(i.value));
    assertEquals("id" in i.value ? i.value["id"] : undefined, "01M6SFSZ7J1T8GX50X1H4RZH7V");
  },
);

/** The tree in memory, copied file by file. */
async function inMemory(): Promise<ReturnType<typeof memoryStore>> {
  const files: [RelPath, Uint8Array][] = [];
  for (const f of await treeFiles()) {
    const r = relPath(f);
    assert(r.kind === "ok");
    files.push([r.value, await fs.readFile(hostPath.join(TREE, f))]);
  }
  return memoryStore({ name: "ifrfs-memory", files });
}

/** What a store holds as the layout sees it: each path, its entry or why it is unmatched, and its size. */
async function seen<C extends Capability>(store: Store<C>): Promise<string[]> {
  assert(made.kind === "ok");
  const out: string[] = [];
  for await (const c of catalog(made.value, store)) {
    assert(c.kind === "ok", c.kind === "err" ? c.error.why : "");
    const m = c.value.match;
    out.push(`${m.path} ${m.kind === "matched" ? m.entry : "unmatched"} ${c.value.meta.size}`);
  }
  return out;
}

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-011", "0010-file-aide FR-014"],
  "IFRFS's tree is listed the same through posix and memory, every file matched",
  async () => {
    const onDisk = await seen(posixStore(TREE, { readOnly: true, name: "ifrfs-tree" }));
    assertEquals(onDisk.length, 12);
    assert(
      onDisk.every((l) => !l.includes(" unmatched ")),
      onDisk.join("\n"),
    );
    assertEquals(await seen(await inMemory()), onDisk);
    assertEquals(onDisk[0], "README.md readme " + String((await fs.stat(hostPath.join(TREE, "README.md"))).size));
  },
);

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-009"],
  "IFRFS's files are read by entry and key, and a new issue is written by its key",
  async () => {
    for (const store of [widen(posixStore(TREE, { readOnly: true })), widen(await inMemory())]) {
      const r = await readEntry(store, readme, {});
      assert(r.kind === "ok");
      assertEquals(r.value.split("\n")[0], MARKER);
      const i = await readEntry(store, issue, { kind: "book", slug: "example-handbook", id: "01M6SFSZ837831FK61F4S07GZ6" });
      assert(i.kind === "ok");
      const missing = await readEntry(store, issue, { kind: "deck", slug: "example-talk", id: "01M6SFSZ837831FK61F4S07GZ6" });
      assert(missing.kind === "err" && missing.error.kind === "store" && missing.error.error.kind === "not-found");
    }
    const m = await inMemory();
    const key = { kind: "deck", slug: "example-talk", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } as const;
    const w = await writeEntry(m, issue, key, { id: key.id, work: "deck/example-talk", events: [] }, { kind: "if-absent" });
    assert(w.kind === "ok");
    assertEquals(w.value.path, "deck/example-talk/issues.d/01ARZ3NDEKTSV4RRFFQ69G5FAV.json5");
    const again = await writeEntry(m, issue, key, { id: key.id, work: "deck/example-talk", events: [] }, { kind: "if-absent" });
    assert(again.kind === "err" && again.error.kind === "store" && again.error.error.kind === "conflict");
    const ro = await writeEntry(posixStore(TREE, { readOnly: true }), issue, key, null, { kind: "if-absent" });
    assert(ro.kind === "err" && ro.error.kind === "store" && ro.error.error.kind === "refused", "the committed tree is never written");
  },
);

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-011"],
  "a stray file in an IFRFS store is listed as unmatched with its metadata",
  async () => {
    const m = await inMemory();
    const stray = relPath(".DS_Store");
    assert(stray.kind === "ok");
    assert((await m.put(stray.value, new Uint8Array(3))).kind === "ok");
    const lines = await seen(m);
    assertEquals(lines.length, 13);
    assertArrayIncludes(lines, [".DS_Store unmatched 3"]);
  },
);

async function rowsOf<R, C extends Capability>(q: Query<R>, store: Store<C>): Promise<R[]> {
  const c = compile(q);
  assert(c.kind === "ok", c.kind === "err" ? formatQueryError(c.error) : "");
  const out: R[] = [];
  for await (const r of c.value.run(store)) {
    assert(r.kind === "ok", r.kind === "err" ? r.error.why : "");
    out.push(r.value);
  }
  return out;
}

proves(
  ["0010-file-aide FR-038", "0010-file-aide FR-021", "0010-file-aide FR-024"],
  "IFRFS is queried the same through posix and memory, by builder and by text",
  async () => {
    const stores = [widen(posixStore(TREE, { readOnly: true })), widen(await inMemory())];
    const pdfs = query(rendition)
      .select("kind", "slug", "file")
      .where((w) => w.and(w.in("kind", ["book", "book-series"]), w.glob("file", "*.pdf")))
      .orderByKey();
    const text = parseQuery(
      "select kind, slug, file from rendition where kind in ('book', 'book-series') and file glob '*.pdf' order by key",
      ENTRIES,
    );
    assert(text.kind === "ok", text.kind === "err" ? formatParseError(text.error) : "");
    // in byte order of the paths: "book-series/" sorts before "book/", since "-" is before "/"
    const want = [
      { kind: "book-series", slug: "example-manuals", file: "Example Manuals 2026-11-15.pdf" },
      { kind: "book", slug: "example-handbook", file: "Example Handbook Final 2026-11-09.pdf" },
      { kind: "book", slug: "example-handbook", file: "Example Handbook Review 2026-11-02.pdf" },
    ];
    for (const s of stores) {
      assertEquals(await rowsOf(pdfs, s), want);
      assertEquals(await rowsOf(text.value, s), want);
      const issues = await rowsOf(
        query(issue)
          .select("id")
          .where((w) => w.eq("slug", "example-handbook"))
          .orderByKey(),
        s,
      );
      assertEquals(
        issues.map((r) => r.id),
        ["01M6SFSZ7J1T8GX50X1H4RZH7V", "01M6SFSZ837831FK61F4S07GZ6"],
      );
      const site = await rowsOf(
        query(rendition)
          .select("file")
          .where((w) => w.and(w.eq("kind", "deck"), w.glob("file", "site/**")))
          .orderByKey(),
        s,
      );
      assertEquals(
        site.map((r) => r.file),
        ["site/assets/app.css", "site/index.html"],
      );
      const works = await rowsOf(
        queryTree()
          .select("path")
          .where((w) => w.and(w.eq("type", "folder"), w.eq("depth", 2)))
          .orderByKey(),
        s,
      );
      assertEquals(
        works.map((r) => r.path),
        ["book-series/example-manuals", "book/example-handbook", "deck/example-talk", "os-cli/example-tool"],
      );
    }
  },
);
