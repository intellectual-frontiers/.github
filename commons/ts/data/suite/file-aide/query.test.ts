/**
 * File Aide's queries: the value, the typed builder and the text form, the plan and `explain`, full scans, the compiled walk with its
 * order, limit and parallelism, globs and regular expressions, no contents read, ignore files, and the same paths as `fd` (commons
 * 0010-file-aide FR-019 to FR-028, FR-036).
 *
 * @module
 */
import { type Equal, expectType } from "../../../kernel/mod.ts";
import { fs, proc } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves, test } from "@intellectual-frontiers/test";
import {
  bytes,
  type Capability,
  compile,
  date,
  entry,
  enumeration,
  explain,
  formatParseError,
  formatQueryError,
  glob,
  memoryStore,
  parseQuery,
  path,
  type Query,
  query,
  queryTree,
  type RelPath,
  relPath,
  slug,
  type Store,
  ulid,
  widen,
} from "../../file-aide/mod.ts";
import { posixStore } from "../../file-aide/runtime/mod.ts";

const rel = (t: string): RelPath => {
  const r = relPath(t);
  if (r.kind === "err") throw new Error(r.error.why);
  return r.value;
};
const enc = (t: string): Uint8Array => new TextEncoder().encode(t);

const kind = enumeration("kind", ["book", "deck", "essay"]);
const work = slug("slug");
const report = entry("report", path`${kind}/${work}/${date("day", "YYYY-MM-DD")}/${ulid("id")}.pdf`, {
  codec: bytes,
  description: "A report.",
  owner: "if",
});

const FILES = [
  "book/alpha/2026-11-01/01ARZ3NDEKTSV4RRFFQ69G5FAV.pdf",
  "book/alpha/2026-11-02/01ARZ3NDEKTSV4RRFFQ69G5FAW.pdf",
  "book/beta/2026-11-03/01ARZ3NDEKTSV4RRFFQ69G5FAX.pdf",
  "deck/gamma/2026-10-30/01ARZ3NDEKTSV4RRFFQ69G5FAY.pdf",
  "essay/delta/2026-11-15/01ARZ3NDEKTSV4RRFFQ69G5FAZ.pdf",
  "essay/delta/notes.txt",
];

/** A store in memory that counts what it is asked, and how many listings run at once. */
function counted(files: readonly string[] = FILES): { store: Store; lists: string[]; gets: string[]; most: () => number } {
  const inner = memoryStore({ files: files.map((f) => [rel(f), enc(f)] as const) });
  const lists: string[] = [];
  const gets: string[] = [];
  let now = 0;
  let most = 0;
  const store: Store = {
    ...widen(inner),
    get: (p, r) => {
      gets.push(p);
      return inner.get(p, r);
    },
    list: async (req) => {
      lists.push(req?.prefix ?? "");
      now++;
      most = Math.max(most, now);
      await new Promise((resolve) => setTimeout(resolve, 1));
      now--;
      return inner.list(req);
    },
  };
  return { store, lists, gets, most: () => most };
}

async function rows<R, C extends Capability>(q: Query<R>, store: Store<C>): Promise<R[]> {
  const c = compile(q, { now: () => Date.parse("2026-11-15T12:00:00Z") });
  assert(c.kind === "ok", c.kind === "err" ? formatQueryError(c.error) : "");
  const out: R[] = [];
  for await (const r of c.value.run(store)) {
    assert(r.kind === "ok", r.kind === "err" ? r.error.why : "");
    out.push(r.value);
  }
  return out;
}

proves(
  ["0010-file-aide FR-019", "0010-file-aide FR-020"],
  "a query is a value of its parts, its fields typed by the entry, and its rows by select",
  () => {
    const q = query(report)
      .select("kind", "slug", "size")
      .where((w) => w.and(w.eq("kind", "book"), w.gt("size", 10)));
    expectType<
      Equal<
        typeof q extends Query<infer R> ? R : never,
        Pick<import("../../file-aide/mod.ts").RowOf<typeof report>, "kind" | "slug" | "size">
      >
    >();
    assertEquals(Object.keys(q.value).sort(), ["from", "limit", "orderByKey", "scan", "select", "where", "with"]);
    const typed = (): void => {
      // @ts-expect-error the entry has no field author
      query(report).where((w) => w.eq("author", "x"));
      // @ts-expect-error film is not a kind
      query(report).where((w) => w.eq("kind", "film"));
      // @ts-expect-error a size is a number
      query(report).where((w) => w.gt("size", "big"));
      // @ts-expect-error a glob is matched against text, and size is a number
      query(report).where((w) => w.glob("size", "*"));
      // @ts-expect-error type is a field of a tree, not of an entry
      query(report).select("type");
      // the control: the same, written right
      query(report).where((w) =>
        w.and(w.eq("kind", "deck"), w.glob("slug", "g*"), w.within("modified", "7d"), w.ge("modified", "2026-11-01")),
      );
      queryTree().where((w) => w.eq("type", "folder"));
    };
    void typed;
  },
);

proves(
  ["0010-file-aide FR-021"],
  "the text of a query is read into the value the builder makes, and its failures name the line and the column",
  () => {
    const text = parseQuery(
      "select kind, slug, size from report\nwhere kind in ('book', 'deck') and size >= 1KiB and slug glob 'a*' and modified within 7d\norder by key limit 3 with (parallel = 2, ignore = off) scan",
      [report],
    );
    assert(text.kind === "ok", text.kind === "err" ? formatParseError(text.error) : "");
    const built = query(report)
      .select("kind", "slug", "size")
      .where((w) => w.and(w.in("kind", ["book", "deck"]), w.ge("size", 1024), w.glob("slug", "a*"), w.within("modified", "7d")))
      .orderByKey()
      .limit(3)
      .with({ parallel: 2, ignore: false })
      .scan();
    assertEquals(text.value.value, built.value);
    const tree = parseQuery("select path from './works/' where not name glob '*.tmp' and (depth <= 2 or hidden = true)");
    assert(tree.kind === "ok");
    assertEquals(tree.value.value.from, { kind: "root", root: "works" });
    const cases: readonly [string, string][] = [
      ["select author from report", "line 1, column 8: author is not a field of report"],
      ["select * from reports", "line 1, column 15: reports is not an entry of the layout: report"],
      ["select *\nfrom report\nwhere size ~ 3", "line 3, column 12"],
      ["select * from report where kind = 'book", "line 1, column 35: a string with no closing quote"],
      ["select * from report where modified within 7 days", "line 1, column 44"],
      ["select * from report with (colour = on)", "colour is not an option"],
    ];
    for (const [t, want] of cases) {
      const r = parseQuery(t, [report]);
      assert(r.kind === "err", t);
      assertStringIncludes(formatParseError(r.error), want, t);
    }
  },
);

proves(
  ["0010-file-aide FR-022"],
  "a plan lists the prefixes of bound keys, starts and stops at a range, and prunes by the fields it can",
  () => {
    const p1 = explain(query(report).where((w) => w.and(w.in("kind", ["book", "deck"]), w.eq("slug", "alpha"))));
    assert(p1.kind === "ok");
    assertEquals(p1.value.prefixes, ["book/alpha/", "deck/alpha/"]);
    assertEquals(p1.value.everything, false);
    const p2 = explain(
      query(report).where((w) => w.and(w.eq("kind", "book"), w.eq("slug", "alpha"), w.between("day", "2026-11-02", "2026-11-30"))),
    );
    assert(p2.kind === "ok");
    assertEquals(p2.value.prefixes, ["book/alpha/"]);
    assertEquals(p2.value.ranges, [{ depth: 2, field: "day", after: "2026-11-01\u{10FFFF}", stop: "2026-11-30" }]);
    const p3 = explain(query(report).where((w) => w.gt("id", "01ARZ3NDEKTSV4RRFFQ69G5FAW")));
    assert(p3.kind === "ok");
    assertEquals([p3.value.prefixes, p3.value.pruned, p3.value.everything], [[""], ["id"], false]);
    const p4 = explain(query(report).where((w) => w.gt("size", 3)));
    assert(p4.kind === "ok");
    assertEquals([p4.value.everything, p4.value.filters], [true, ["size > 3"]]);
  },
);

proves(
  ["0010-file-aide FR-022", "0010-file-aide FR-024"],
  "a plan's prefixes and ranges are what the walk lists, and it lists nothing it prunes",
  async () => {
    const c = counted();
    const got = await rows(
      query(report)
        .select("id")
        .where((w) => w.and(w.eq("kind", "book"), w.eq("slug", "alpha"), w.ge("day", "2026-11-02")))
        .orderByKey(),
      c.store,
    );
    assertEquals(got, [{ id: "01ARZ3NDEKTSV4RRFFQ69G5FAW" }]);
    assertEquals(c.lists, ["book/alpha/", "book/alpha/2026-11-02/"], "only the bound prefix and the day in range");
    const d = counted();
    await rows(
      query(report)
        .select("id")
        .where((w) => w.eq("slug", "delta")),
      d.store,
    );
    assertEquals(
      d.lists.sort(),
      ["", "book/", "deck/", "essay/", "essay/delta/", "essay/delta/2026-11-15/"],
      "folders of other slugs are not listed",
    );
  },
);

proves(["0010-file-aide FR-023"], "a query that would read everything is refused unless it says scan", async () => {
  const q = query(report).where((w) => w.gt("size", 3));
  const refused = compile(q);
  assert(refused.kind === "err" && refused.error.kind === "needs-scan");
  assertStringIncludes(formatQueryError(refused.error), "say scan to allow it");
  assertEquals((await rows(q.scan(), counted().store)).length, 5);
  assert(compile(queryTree().where((w) => w.eq("extension", "pdf"))).kind === "err");
  assert(compile(queryTree().where((w) => w.le("depth", 1))).kind === "ok", "a bound on depth is not everything");
  assert(compile(queryTree().where((w) => w.glob("path", "book/**/*.pdf"))).kind === "ok", "a glob's literal folders are a prefix");
});

proves(
  ["0010-file-aide FR-024"],
  "compiled once, a query gives the same rows on every run and every store, in key order where asked",
  async () => {
    const q = query(report).select("path").orderByKey().scan();
    const c = compile(q);
    assert(c.kind === "ok");
    const m = counted().store;
    const first: string[] = [];
    const second: string[] = [];
    for await (const r of c.value.run(m)) if (r.kind === "ok") first.push(r.value.path);
    for await (const r of c.value.run(m)) if (r.kind === "ok") second.push(r.value.path);
    assertEquals(first, second);
    assertEquals(
      first,
      FILES.filter((f) => f.endsWith(".pdf")),
    );
    const dir = await fs.makeTempDir({ prefix: "file-aide-q-" });
    try {
      const disk = posixStore(dir);
      for (const f of FILES) assert((await disk.put(rel(f), enc(f))).kind === "ok");
      assertEquals(
        (await rows(q, disk)).map((r) => r.path),
        first,
      );
      const unordered = (await rows(query(report).select("path").scan().with({ parallel: 3 }), disk)).map((r) => r.path).sort();
      assertEquals(unordered, [...first].sort());
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(
  ["0010-file-aide FR-024"],
  "a walk lists folders in parallel up to its bound, and stops listing once its limit is reached",
  async () => {
    const wide = Array.from({ length: 40 }, (_, i) => `book/w${String(i).padStart(2, "0")}/2026-11-01/01ARZ3NDEKTSV4RRFFQ69G5FAV.pdf`);
    const a = counted(wide);
    assertEquals((await rows(query(report).scan().with({ parallel: 4 }), a.store)).length, 40);
    assert(a.most() <= 4 && a.most() >= 2, `at most four at once, and more than one (${a.most()})`);
    const b = counted(wide);
    assertEquals((await rows(query(report).scan().orderByKey().limit(2), b.store)).length, 2);
    assert(b.lists.length < 10, `the walk stopped early (${b.lists.length} listings of 82)`);
  },
);

proves(
  ["0010-file-aide FR-025"],
  "globs are the library's own and linear; a regular expression is only where allowed, and not too long",
  async () => {
    const cases: readonly [string, string, boolean][] = [
      ["*.pdf", "a.pdf", true],
      ["*.pdf", "a/b.pdf", false],
      ["**/*.pdf", "a/b/c.pdf", true],
      ["**/*.pdf", "c.pdf", true],
      ["a/**/b", "a/b", true],
      ["a/**/b", "a/x/y/b", true],
      ["?.txt", "ab.txt", false],
      ["[a-c]x", "bx", true],
      ["[!a-c]x", "bx", false],
      ["{draft,final}/*", "final/x", true],
      ["{draft,final}/*", "review/x", false],
      ["\\*", "*", true],
    ];
    for (const [g, t, want] of cases) {
      const c = glob(g);
      assert(c.kind === "ok", g);
      assertEquals(c.value.matches(t), want, `${g} on ${t}`);
    }
    const hard = glob("*a*a*a*a*a*a*a*a*b");
    assert(hard.kind === "ok");
    const started = performance.now();
    assertEquals(hard.value.matches("a".repeat(20_000)), false);
    assert(performance.now() - started < 1000, "a pattern that backtracks elsewhere runs here in linear time");
    const q = query(report)
      .where((w) => w.regex("slug", "^a"))
      .scan();
    const refused = compile(q);
    assert(refused.kind === "err" && refused.error.kind === "regex-not-allowed");
    assertEquals(
      (await rows(q.with({ regex: true }).select("slug"), counted().store)).map((r) => r.slug),
      ["alpha", "alpha"],
    );
    const long = compile(
      query(report)
        .where((w) => w.regex("slug", "a".repeat(300)))
        .with({ regex: true })
        .scan(),
    );
    assert(long.kind === "err" && long.error.kind === "bad-value");
    const recent = await rows(
      query(report)
        .select("day")
        .where((w) => w.ge("modified", "2026-01-01T00:00:00Z"))
        .scan(),
      counted().store,
    );
    assertEquals(recent.length, 5, "a time compared in UTC with a time given as ISO 8601");
  },
);

proves(["0010-file-aide FR-026"], "a query reads no file's contents: only ignore files are ever read", async () => {
  const c = counted();
  await rows(query(report).scan(), c.store);
  await rows(queryTree().scan(), c.store);
  assert(
    c.gets.every((g) => g.endsWith(".gitignore") || g.endsWith(".faignore") || g === ".git/info/exclude"),
    c.gets.join(", "),
  );
  const noIgnore = counted();
  await rows(queryTree().scan().with({ ignore: false }), noIgnore.store);
  assertEquals(noIgnore.gets, []);
});

const TREE = [
  ".gitignore",
  ".git/HEAD",
  ".hidden/secret.txt",
  "build/out.js",
  "docs/.faignore",
  "docs/a.md",
  "docs/b.tmp",
  "docs/keep.log",
  "docs/sub/c.md",
  "logs/x.log",
  "src/.gitignore",
  "src/gen/x.ts",
  "src/main.ts",
  "src/main.log",
];
const IGNORES: { readonly [p: string]: string } = {
  ".gitignore": "# what the build leaves\nbuild/\n*.log\n/logs\n!docs/keep.log\n",
  "src/.gitignore": "gen/\n!main.log\n",
  "docs/.faignore": "*.tmp\n",
};
const treeStore = (): Store => widen(memoryStore({ files: TREE.map((f) => [rel(f), enc(IGNORES[f] ?? f)] as const) }));

proves(
  ["0010-file-aide FR-027", "0010-file-aide FR-028"],
  "ignore files leave out what Git would, a .faignore the same, .git and hidden names by default",
  async () => {
    const files = async (q: ReturnType<typeof queryTree>, store: Store): Promise<string[]> =>
      (
        await rows(
          q
            .select("path")
            .where((w) => w.eq("type", "file"))
            .scan()
            .orderByKey(),
          store,
        )
      ).map((r) => r.path);
    assertEquals(await files(queryTree(), treeStore()), ["docs/a.md", "docs/keep.log", "docs/sub/c.md", "src/main.log", "src/main.ts"]);
    assertEquals(await files(queryTree().with({ ignore: false }), treeStore()), [
      "build/out.js",
      "docs/a.md",
      "docs/b.tmp",
      "docs/keep.log",
      "docs/sub/c.md",
      "logs/x.log",
      "src/gen/x.ts",
      "src/main.log",
      "src/main.ts",
    ]);
    const hidden = await files(queryTree().with({ hidden: true }), treeStore());
    assert(
      hidden.includes(".hidden/secret.txt") && hidden.includes(".gitignore") && !hidden.some((p) => p.startsWith(".git/")),
      hidden.join(", "),
    );
    assertEquals(
      await files(queryTree("docs"), treeStore()),
      ["docs/a.md", "docs/keep.log", "docs/sub/c.md"],
      "the ignore files above the root still apply",
    );
    const text = parseQuery("select path from '.' where type = 'file' with (ignore = off) scan");
    assert(text.kind === "ok" && text.value.value.with.ignore === false);
  },
);

const fd = proc.env.get("FILE_AIDE_FD") ?? ["/usr/bin/fdfind", "/usr/bin/fd", "/usr/local/bin/fd"].find((p) => fs.existsSync(p));
const git = ["/usr/bin/git", "/usr/local/bin/git"].find((p) => fs.existsSync(p));

if (fd === undefined || git === undefined)
  test("0010-file-aide FR-036: fd or git is not installed, so the comparison with fd is skipped", () => {}, { skip: "no fd or git" });
else
  proves(["0010-file-aide FR-036"], "a query of a tree gives the same paths as fd with the same filters", async () => {
    const dir = await fs.makeTempDir({ prefix: "file-aide-fd-" });
    try {
      const disk = posixStore(dir);
      for (const f of TREE) if (!f.startsWith(".git/")) assert((await disk.put(rel(f), enc(IGNORES[f] ?? f))).kind === "ok");
      // fd reads a .faignore's rules from a .fdignore, which has the same syntax
      for (const f of TREE.filter((t) => t.endsWith(".faignore")))
        assert((await disk.put(rel(f.replace(".faignore", ".fdignore")), enc(IGNORES[f] ?? ""))).kind === "ok");
      const init = await proc.run([git, "init", "-q", dir]);
      assert(init.success);
      const run = async (args: string[]): Promise<string[]> => {
        const out = await proc.run([fd, "--base-directory", dir, ...args]);
        assert(out.success, out.stderr);
        return out.stdout
          .split("\n")
          .filter((l) => l !== "")
          .map((l) => l.replace(/^\.\//, "").replace(/\/$/, ""))
          .sort();
      };
      const ours = async (q: Query<{ readonly path: string }>): Promise<string[]> =>
        (await rows(q, disk))
          .map((r) => r.path)
          .filter((p) => !p.startsWith(".git"))
          .sort();
      assertEquals(await ours(queryTree().select("path").scan()), await run([]));
      assertEquals(
        await ours(
          queryTree()
            .select("path")
            .where((w) => w.eq("type", "file"))
            .scan(),
        ),
        await run(["--type", "f"]),
      );
      assertEquals(
        await ours(
          queryTree()
            .select("path")
            .where((w) => w.eq("extension", "md"))
            .scan(),
        ),
        await run(["--extension", "md"]),
      );
      assertEquals(
        await ours(
          queryTree()
            .select("path")
            .where((w) => w.le("depth", 1)),
        ),
        await run(["--max-depth", "1"]),
      );
      assertEquals(await ours(queryTree().select("path").scan().with({ ignore: false })), await run(["--no-ignore"]));
      assertEquals(
        await ours(
          queryTree()
            .select("path")
            .where((w) => w.glob("name", "*.md"))
            .scan(),
        ),
        await run(["--glob", "*.md"]),
      );
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  });
