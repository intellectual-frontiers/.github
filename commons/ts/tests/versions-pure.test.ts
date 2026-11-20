/**
 * The pure core of the `versions` tool (commons 0026-works-versioning): the schemes and their order, the typed record and its template, the files of a work, the version check over two trees, the
 * ledger from tags, the notes from commits, the citation file, the release gate and the rule plugin. These are values in and values out, so the tests give real records (written by the tool's own
 * template and read back by its decoder) and the facts Git would give; the tests that run Git and the command as a program are `versions-git.test.ts`.
 *
 * @module
 */
import { type Literal, tsLiteral } from "@intellectual-frontiers/formats/ts-literal";
import { RELEASE_TIERS, decodeDeclaration } from "../mizan/changes/declaration.ts";
import { citationOf } from "../mizan/versions/cite.ts";
import { isReleaseTier, releaseGate } from "../mizan/versions/gate.ts";
import { type EditionFacts, editionsNeeded, judgeWorks, type TreeFacts } from "../mizan/versions/judge.ts";
import {
  addDuration,
  lastRelease,
  ledgerJson,
  ledgerText,
  readEarlier,
  readLedger,
  splitTag,
  type TagFact,
} from "../mizan/versions/ledger.ts";
import { impactOf, impactOfCommits, notesOf } from "../mizan/versions/notes.ts";
import { versionsPlugin } from "../mizan/versions/plugin.ts";
import { decodeRelease, decodeReleaseSource, type Release, releaseSource } from "../mizan/versions/record.ts";
import {
  compareVersions,
  editionAt,
  IMPACTS,
  nextSemVer,
  parseVersion,
  SCHEMES,
  schemeOf,
  WORK_KINDS,
  companionOf,
} from "../mizan/versions/scheme.ts";
import { filesOf, scopeOf, workFolders } from "../mizan/versions/works.ts";
import { impacts, versionSchemes, workKinds } from "../../ontology/ifr/mod.ts";
import { qualityTiers } from "../../ontology/ifqs/mod.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { holdHarness } from "../mizan/harness.ts";
import { readWorks } from "../mizan/versions/scan.ts";

// ------------------------------------------------------------------------------------------------------------------------------- fixtures

const BASE = { slug: "lib", kind: "Library", title: "A library", authors: [{ name: "A. Person" }], version: "1.0.0" };

/** The text of a record file with the fields of `over` laid over a library's, written as the template writes a literal (so a test may also write what the decoder must refuse). */
function raw(over: Readonly<Record<string, Literal | undefined>> = {}): string {
  return `export const release = ${tsLiteral<Literal>({ ...BASE, ...over })};\n`;
}

/** A record decoded, the test failing where it does not decode. */
function rel(over: Readonly<Record<string, Literal | undefined>> = {}): Release {
  const r = decodeReleaseSource(raw(over));
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  return r.value;
}

/** A tree from files: the paths are the keys and a `release.ts` is a record. */
function tree(files: Readonly<Record<string, string>>): TreeFacts {
  const records = new Map<string, string>();
  for (const [p, t] of Object.entries(files))
    if (p === "release.ts" || p.endsWith("/release.ts")) records.set(p === "release.ts" ? "" : p.slice(0, -"/release.ts".length), t);
  return { paths: Object.keys(files), records };
}

const NO_EDITIONS: EditionFacts = { commits: new Map(), ancestry: new Set(), head: "f".repeat(40) };

function rules(found: readonly { readonly rule: string }[]): readonly string[] {
  return found.map((f) => f.rule);
}

// -------------------------------------------------------------------------------------------------------------------------------- schemes

proves(
  ["0026-works-versioning FR-005", "0026-works-versioning FR-006"],
  "the tool's kinds, schemes, impacts and companion scheme are the ontology's, and each scheme reads the versions it should and no others",
  () => {
    assertEquals([...WORK_KINDS], Object.keys(workKinds));
    assertEquals([...SCHEMES], Object.keys(versionSchemes));
    assertEquals([...IMPACTS].map((i) => i[0]?.toUpperCase() + i.slice(1)).sort(), Object.keys(impacts).sort());
    for (const [kind, k] of Object.entries(workKinds)) {
      assertEquals(`ifr:${schemeOf(kind as (typeof WORK_KINDS)[number])}`, k.values.usesScheme.iri.replace(/^.*#/, "ifr:"), kind);
      const companion = k.values.companionScheme?.iri.replace(/^.*#/, "");
      assertEquals(companionOf(kind as (typeof WORK_KINDS)[number]), companion, kind);
    }
    assertEquals([...RELEASE_TIERS], Object.keys(qualityTiers), "the tiers a declaration may name are the keys of ifqs:QualityTier");
    const ok = (s: (typeof SCHEMES)[number], t: string): boolean => parseVersion(s, t).kind === "ok";
    assert(ok("SemVer", "1.2.3") && ok("SemVer", "1.0.0-rc.1") && ok("SemVer", "0.0.0"));
    assert(!ok("SemVer", "1.2") && !ok("SemVer", "v1.2.3") && !ok("SemVer", "01.2.3"));
    assert(!ok("SemVer", "1.2.3+abc123def456"), "build metadata is not part of a record or a tag (FR-010)");
    assert(
      ok("CommitDateEdition", "2026.11.17-1a2b3c4d") &&
        !ok("CommitDateEdition", "2026.13.17-1a2b3c4d") &&
        !ok("CommitDateEdition", "2026.11.17-1A2B3C4D"),
    );
    assert(ok("SnapshotDate", "2026-11-17") && !ok("SnapshotDate", "2026-02-30"));
    assert(ok("IntegerRevision", "7") && !ok("IntegerRevision", "0") && !ok("IntegerRevision", "7.0"));
    assert(!ok("NoVersion", "1"));
    // the kind decides the scheme and a pattern never does: an edition is also a Semantic Version
    assert(ok("SemVer", "2026.11.17-1a2b3c4d") && schemeOf("Prose") === "CommitDateEdition");
  },
);

proves(
  ["0026-works-versioning FR-010", "0026-works-versioning FR-011", "0026-works-versioning FR-012", "0026-works-versioning FR-013"],
  "versions compare by the scheme: precedence with build ignored, an edition by day then history, a snapshot by day, a revision by number, and never across schemes",
  () => {
    const v = (s: (typeof SCHEMES)[number], t: string) => {
      const r = parseVersion(s, t);
      assert(r.kind === "ok", t);
      return r.value;
    };
    assertEquals(compareVersions(v("SemVer", "1.2.0"), v("SemVer", "1.10.0")), -1);
    assertEquals(compareVersions(v("SemVer", "1.0.0-rc.1"), v("SemVer", "1.0.0")), -1, "a pre-release comes before its release");
    assertEquals(compareVersions(v("SemVer", "1.0.0-rc.2"), v("SemVer", "1.0.0-rc.10")), -1);
    assertEquals(compareVersions(v("SnapshotDate", "2026-11-17"), v("SnapshotDate", "2026-11-10")), 1);
    assertEquals(compareVersions(v("IntegerRevision", "10"), v("IntegerRevision", "9")), 1);
    assertEquals(compareVersions(v("CommitDateEdition", "2026.11.17-1a2b3c4d"), v("CommitDateEdition", "2026.11.10-ffffffff")), 1);
    assertEquals(
      compareVersions(v("CommitDateEdition", "2026.11.17-aaaaaaaa"), v("CommitDateEdition", "2026.11.17-bbbbbbbb"), () => 5),
      1,
      "the same day: the history says",
    );
    assertEquals(compareVersions(v("CommitDateEdition", "2026.11.17-aaaaaaaa"), v("CommitDateEdition", "2026.11.17-bbbbbbbb")), 0);
    assertEquals(compareVersions(v("SemVer", "1.0.0"), v("IntegerRevision", "1")), undefined, "never across schemes (FR-037)");
    assertEquals(nextSemVer("1.4.2", "major"), { kind: "ok", value: "2.0.0" });
    assertEquals(nextSemVer("1.4.2", "minor"), { kind: "ok", value: "1.5.0" });
    assertEquals(nextSemVer("1.4.2", "patch"), { kind: "ok", value: "1.4.3" });
    assertEquals(
      editionAt("1a2b3c4d" + "0".repeat(32), Date.UTC(2026, 10, 17, 23, 59) / 1000),
      "2026.11.17-1a2b3c4d",
      "the committer's UTC day, never the clock's",
    );
  },
);

// --------------------------------------------------------------------------------------------------------------------------------- record

proves(
  ["0026-works-versioning FR-008"],
  "the record decodes as data and never runs, an unknown field and a wrong type are findings that name the field, and the template writes one layout that reads back",
  () => {
    const full: Release = rel({
      iri: "https://example.org/lib",
      partOf: "suite",
      position: 2,
      identifier: "10.5555/lib.1",
      repository: "https://example.org/lib.git",
      exclude: ["docs", "test/data"],
      retention: "P10Y",
      retired: [{ version: "0.9.0", on: "2026-01-02", replacedBy: "1.0.0", archivedOn: "2026-02-01" }],
      replaces: "old-lib",
    });
    const written = releaseSource(full);
    assertStringIncludes(written, "export const release = {");
    assert(
      written.indexOf("\n  slug:") < written.indexOf("\n  kind:") && written.indexOf("\n  kind:") < written.indexOf("\n  version:"),
      "fields in a fixed order",
    );
    assertEquals(decodeReleaseSource(written), { kind: "ok", value: full });
    assertEquals(releaseSource(full), written, "the same record is the same text");
    // an unknown field and a wrong type name the field
    const unknown = decodeReleaseSource(raw({ colour: "blue" }));
    assert(unknown.kind === "err" && unknown.error.kind === "decode" && unknown.error.message.includes("release.colour"));
    const wrong = decodeReleaseSource(raw({ position: "two" }));
    assert(wrong.kind === "err" && wrong.error.kind === "decode" && wrong.error.message.includes("release.position"));
    assert(decodeReleaseSource(raw({ slug: "Not A Slug" })).kind === "err");
    assert(decodeReleaseSource(raw({ authors: [] })).kind === "err", "a work has an author");
    assert(decodeReleaseSource(raw({ exclude: ["../outside"] })).kind === "err", "an excluded path is inside the folder");
    assert(decodeReleaseSource(raw({ retention: "ten years" })).kind === "err");
    // data is read and never run: code is not a literal, and a second export is refused
    const code = decodeReleaseSource('export const release = { slug: "x".repeat(2) };\n');
    assert(code.kind === "err" && code.error.kind === "literal", "an expression is not data");
    const twice = decodeReleaseSource(`${raw()}export const other = 1;\n`);
    assert(twice.kind === "err" && twice.error.kind === "decode" && twice.error.message.includes("only release"));
    // what the kind does not allow
    assert(decodeRelease({ ...BASE, version: undefined }).kind === "err", "a library with no version");
    assert(decodeRelease({ ...BASE, kind: "Data", version: "2026-11-17" }).kind === "err", "data carries its snapshot");
    assert(
      decodeRelease({ ...BASE, snapshot: { digest: "0".repeat(64), schemaVersion: "1.0.0" } }).kind === "err",
      "only data has a snapshot",
    );
    assert(
      decodeRelease({ ...BASE, approval: { approvedBy: "P", role: "R", on: "2026-01-01", decision: "D1" } }).kind === "err",
      "only a controlled document has an approval",
    );
  },
);

proves(
  ["0026-works-versioning FR-009"],
  "a work is a folder with a release.ts and its files are the tracked files under it except nested works, its record, CITATION.cff and its exclude",
  () => {
    const paths = [
      "a/release.ts",
      "a/CITATION.cff",
      "a/src/x.ts",
      "a/docs/guide.md",
      "a/docs/deep/more.md",
      "a/b/release.ts",
      "a/b/y.ts",
      "c/z.ts",
      "release.ts",
    ];
    const folders = workFolders(paths);
    assertEquals(folders, ["", "a", "a/b"]);
    assertEquals(
      filesOf(paths, "a", folders, ["docs"]),
      ["a/src/x.ts"],
      "the nested work, the record, the citation and the excluded folder are not a's",
    );
    assertEquals(filesOf(paths, "a/b", folders, []), ["a/b/y.ts"]);
    assertEquals(filesOf(paths, "", folders, []), ["c/z.ts"], "the root work holds what no nested work holds");
    assert(scopeOf("a", folders, [])("a/deleted-since.ts"), "a path is a work's by its place, so a deleted file still is");
    assert(!scopeOf("a", folders, ["docs"])("a/docs/deep/more.md"));
  },
);

// ---------------------------------------------------------------------------------------------------------------------------------- check

proves(
  ["0026-works-versioning FR-022", "0026-works-versioning FR-010"],
  "a work whose files changed and whose version did not grow is versions/not-grown, a grown version (by precedence) and a change outside its files are not, and a version with build metadata is versions/scheme-mismatch",
  () => {
    const base = tree({ "lib/release.ts": raw(), "lib/a.ts": "1", "other/b.ts": "1" });
    const same = tree({ "lib/release.ts": raw(), "lib/a.ts": "2", "other/b.ts": "1" });
    const found = judgeWorks({ head: same, base, changed: ["lib/a.ts"], editions: NO_EDITIONS });
    assertEquals(rules(found), ["versions/not-grown"]);
    assertEquals(found[0]?.file, "lib/release.ts");
    assertStringIncludes(found[0]?.message ?? "", "lib/a.ts");
    const grown = tree({ "lib/release.ts": raw({ version: "1.1.0" }), "lib/a.ts": "2" });
    assertEquals(judgeWorks({ head: grown, base, changed: ["lib/a.ts", "lib/release.ts"], editions: NO_EDITIONS }), []);
    assertEquals(
      judgeWorks({ head: same, base, changed: ["other/b.ts"], editions: NO_EDITIONS }),
      [],
      "a file outside the work is not the work's",
    );
    const pre = tree({ "lib/release.ts": raw({ version: "1.0.0-rc.1" }) });
    assertEquals(
      rules(judgeWorks({ head: pre, base, changed: ["lib/release.ts"], editions: NO_EDITIONS })),
      ["versions/not-grown"],
      "a pre-release comes before its release",
    );
    const back = tree({ "lib/release.ts": raw({ version: "0.9.0" }) });
    assertEquals(
      rules(judgeWorks({ head: back, base, changed: ["lib/release.ts"], editions: NO_EDITIONS })),
      ["versions/not-grown"],
      "a version that went back",
    );
    const build = tree({ "lib/release.ts": raw({ version: "1.2.3+abc123def456" }) });
    assertEquals(rules(judgeWorks({ head: build, base, changed: ["lib/release.ts"], editions: NO_EDITIONS })), [
      "versions/scheme-mismatch",
    ]);
    // a record that does not decode
    const broken = tree({ "lib/release.ts": raw({ colour: "blue" }) });
    const bad = judgeWorks({ head: broken, base, changed: ["lib/release.ts"], editions: NO_EDITIONS });
    assertEquals(rules(bad), ["versions/record-invalid"]);
    assertStringIncludes(bad[0]?.message ?? "", "release.colour");
    // a new work has nothing to compare with
    assertEquals(
      judgeWorks({
        head: tree({ "new/release.ts": raw({ slug: "new" }), "new/x.ts": "1" }),
        base: tree({}),
        changed: ["new/x.ts"],
        editions: NO_EDITIONS,
      }),
      [],
    );
  },
);

proves(
  ["0026-works-versioning FR-009"],
  "a change only under a path the record excludes is no finding, and a nested work is judged by its own files",
  () => {
    const record = raw({ exclude: ["docs"] });
    const base = tree({ "lib/release.ts": record, "lib/docs/g.md": "1", "lib/src/a.ts": "1" });
    assertEquals(judgeWorks({ head: base, base, changed: ["lib/docs/g.md"], editions: NO_EDITIONS }), []);
    assertEquals(rules(judgeWorks({ head: base, base, changed: ["lib/src/a.ts"], editions: NO_EDITIONS })), ["versions/not-grown"]);
    const nested = tree({
      "lib/release.ts": raw(),
      "lib/src/a.ts": "1",
      "lib/inner/release.ts": raw({ slug: "inner" }),
      "lib/inner/i.ts": "1",
    });
    const found = judgeWorks({ head: nested, base: nested, changed: ["lib/inner/i.ts"], editions: NO_EDITIONS });
    assertEquals(
      found.map((f) => f.work),
      ["inner"],
      "only the nested work changed",
    );
  },
);

proves(
  ["0026-works-versioning FR-007"],
  "a changed slug, IRI or position is versions/identity-changed, a renamed work is a new work that names the one it replaces, and a moved folder is the same work",
  () => {
    const iri = "https://example.org/book-one";
    const base = tree({ "book/release.ts": raw({ slug: "book-one", kind: "Prose", version: "2026.11.10-1a2b3c4d", iri, position: 1 }) });
    const edition: EditionFacts = {
      head: "f".repeat(40),
      commits: new Map([["1a2b3c4d", { commit: "1a2b3c4d".padEnd(40, "0"), day: "2026-11-10" }]]),
      ancestry: new Set(["1a2b3c4d".padEnd(40, "0") + " " + "f".repeat(40)]),
    };
    const head = (over: Readonly<Record<string, Literal | undefined>>): TreeFacts =>
      tree({ "book/release.ts": raw({ slug: "book-one", kind: "Prose", version: "2026.11.10-1a2b3c4d", iri, position: 1, ...over }) });
    assertEquals(judgeWorks({ head: head({}), base, changed: [], editions: edition }), []);
    assertEquals(rules(judgeWorks({ head: head({ iri: "https://example.org/other" }), base, changed: [], editions: edition })), [
      "versions/identity-changed",
    ]);
    assertEquals(rules(judgeWorks({ head: head({ position: 2 }), base, changed: [], editions: edition })), ["versions/identity-changed"]);
    assertEquals(
      rules(judgeWorks({ head: head({ slug: "book-1" }), base, changed: [], editions: edition })),
      ["versions/identity-changed"],
      "the same folder under another slug",
    );
    assertEquals(
      judgeWorks({ head: head({ slug: "book-1", replaces: "book-one" }), base, changed: [], editions: edition }),
      [],
      "a new work that replaces the old",
    );
    const moved = tree({
      "books/one/release.ts": raw({ slug: "book-one", kind: "Prose", version: "2026.11.10-1a2b3c4d", iri, position: 1 }),
    });
    assertEquals(judgeWorks({ head: moved, base, changed: [], editions: edition }), [], "the same slug in another folder is the same work");
  },
);

proves(
  ["0026-works-versioning FR-011"],
  "the commit-date edition takes the commit's UTC day, is in the history of the head, and grows by a later day or, on the same day, by a descendant commit",
  () => {
    const id = (c8: string): string => c8.padEnd(40, "0");
    const facts = (pairs: readonly [string, string][], ancestry: readonly [string, string][]): EditionFacts => ({
      head: id("ffffffff"),
      commits: new Map(pairs.map(([c8, day]) => [c8, { commit: id(c8), day }] as const)),
      ancestry: new Set([
        ...ancestry.map(([a, b]) => `${id(a)} ${id(b)}`),
        `${id("aaaaaaaa")} ${id("ffffffff")}`,
        `${id("bbbbbbbb")} ${id("ffffffff")}`,
        `${id("cccccccc")} ${id("ffffffff")}`,
      ]),
    });
    const book = (v: string): TreeFacts => tree({ "book/release.ts": raw({ slug: "book", kind: "Prose", version: v }), "book/ch.md": "x" });
    const f = facts(
      [
        ["aaaaaaaa", "2026-11-10"],
        ["bbbbbbbb", "2026-11-10"],
        ["cccccccc", "2026-11-12"],
      ],
      [["aaaaaaaa", "bbbbbbbb"]],
    );
    const run = (head: string, base: string) => judgeWorks({ head: book(head), base: book(base), changed: ["book/ch.md"], editions: f });
    assertEquals(run("2026.11.12-cccccccc", "2026.11.10-aaaaaaaa"), [], "a later day");
    assertEquals(run("2026.11.10-bbbbbbbb", "2026.11.10-aaaaaaaa"), [], "the same day, a descendant commit");
    assertEquals(rules(run("2026.11.10-aaaaaaaa", "2026.11.10-bbbbbbbb")), ["versions/not-grown"], "the same day, an ancestor commit");
    assertEquals(rules(run("2026.11.10-aaaaaaaa", "2026.11.12-cccccccc")), ["versions/not-grown"], "before the base's edition");
    assertEquals(rules(run("2026.11.10-aaaaaaaa", "2026.11.10-aaaaaaaa")), ["versions/not-grown"], "the same edition, files changed");
    // the date is the commit's, never the clock's; the commit exists and is in the history of the head
    assertEquals(rules(judgeWorks({ head: book("2026.11.11-aaaaaaaa"), base: tree({}), changed: [], editions: f })), [
      "versions/scheme-mismatch",
    ]);
    assertEquals(rules(judgeWorks({ head: book("2026.11.10-dddddddd"), base: tree({}), changed: [], editions: f })), [
      "versions/scheme-mismatch",
    ]);
    const lost = { ...f, ancestry: new Set<string>() };
    assertEquals(
      rules(judgeWorks({ head: book("2026.11.10-aaaaaaaa"), base: tree({}), changed: [], editions: lost })),
      ["versions/scheme-mismatch"],
      "not in the history of the head",
    );
    assertEquals(
      editionsNeeded(book("2026.11.12-cccccccc"), book("2026.11.10-aaaaaaaa")),
      ["aaaaaaaa", "cccccccc"],
      "what the host asks Git about",
    );
  },
);

proves(
  ["0026-works-versioning FR-012"],
  "data needs a later snapshot date and another digest, and a schema version that grew where the schema's files changed",
  () => {
    const data = (day: string, digest: string, schemaVersion = "1.0.0"): TreeFacts =>
      tree({
        "d/release.ts": raw({ slug: "d", kind: "Data", version: day, snapshot: { digest, schemaVersion, schemaPaths: ["schema"] } }),
        "d/data.csv": "x",
        "d/schema/s.json": "{}",
      });
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    const run = (head: TreeFacts, changed: readonly string[], base = data("2026-11-10", a)) =>
      rules(judgeWorks({ head, base, changed, editions: NO_EDITIONS }));
    assertEquals(run(data("2026-11-17", b), ["d/data.csv"]), []);
    assertEquals(
      run(data("2026-11-10", b), ["d/data.csv"]),
      ["versions/not-grown"],
      "a snapshot taken twice on one day is not a new version",
    );
    assertEquals(run(data("2026-11-17", a), ["d/release.ts"]), ["versions/not-grown"], "a later date with the same digest");
    assertEquals(run(data("2026-11-05", b), ["d/data.csv"]), ["versions/not-grown"], "the date went back");
    assertEquals(
      run(data("2026-11-17", b), ["d/data.csv", "d/schema/s.json"]),
      ["versions/not-grown"],
      "the schema's files changed and its version did not",
    );
    assertEquals(run(data("2026-11-17", b, "1.1.0"), ["d/data.csv", "d/schema/s.json"]), []);
    assertEquals(
      rules(
        judgeWorks({
          head: tree({
            "d/release.ts": raw({ slug: "d", kind: "Data", version: "2026-11-17", snapshot: { digest: b, schemaVersion: "1.0" } }),
          }),
          base: tree({}),
          changed: [],
          editions: NO_EDITIONS,
        }),
      ),
      ["versions/scheme-mismatch"],
      "the schema's version is a Semantic Version",
    );
  },
);

proves(
  ["0026-works-versioning FR-013", "0026-works-versioning FR-014"],
  "a revision is an integer that grew and has its approval (a finding that gates), and a specification has no version",
  () => {
    const approval = { approvedBy: "A. Person", role: "Quality lead", on: "2026-11-17", decision: "D-12" };
    const policy = (v: string, withApproval: boolean): TreeFacts =>
      tree({
        "pol/release.ts": raw({ slug: "pol", kind: "ControlledDocument", version: v, ...(withApproval ? { approval } : {}) }),
        "pol/policy.md": "x",
      });
    const run = (head: TreeFacts, base: TreeFacts, changed: readonly string[]) =>
      rules(judgeWorks({ head, base, changed, editions: NO_EDITIONS }));
    assertEquals(run(policy("8", true), policy("7", true), ["pol/policy.md"]), []);
    assertEquals(run(policy("7", true), policy("7", true), ["pol/policy.md"]), ["versions/not-grown"]);
    assertEquals(
      run(policy("7", false), policy("6", true), ["pol/policy.md"]),
      ["versions/approval-missing"],
      "revision 7 with no approval",
    );
    const plugin = versionsPlugin(
      [{ path: "pol/release.ts", text: raw({ slug: "pol", kind: "ControlledDocument", version: "7" }) }],
      "0001-x",
    );
    const found = plugin.check({ slug: "0001-x", spec: "" });
    assertEquals(
      found.map((f) => [f.rule, f.severity]),
      [["versions/approval-missing", "gate"]],
    );
    // a specification
    const spec = decodeReleaseSource(raw({ slug: "s", kind: "Specification", version: "1.0.0" }));
    assert(
      spec.kind === "err" && spec.error.kind === "decode" && spec.error.message.includes("no version"),
      "a specification whose record carries a version is refused",
    );
    const none = tree({ "s/release.ts": raw({ slug: "s", kind: "Specification", version: undefined }), "s/spec.md": "x" });
    assertEquals(judgeWorks({ head: none, base: none, changed: ["s/spec.md"], editions: NO_EDITIONS }), [], "no version to grow");
  },
);

proves(
  ["0026-works-versioning FR-037"],
  "a work that changes its scheme names the scheme it came from and the first version of the new one, and is compared only within one scheme",
  () => {
    const before = tree({ "d/release.ts": raw({ slug: "d", kind: "Prose", version: "2026.11.10-aaaaaaaa" }), "d/x.md": "1" });
    const f: EditionFacts = {
      head: "f".repeat(40),
      commits: new Map([["aaaaaaaa", { commit: "a".repeat(40), day: "2026-11-10" }]]),
      ancestry: new Set([`${"a".repeat(40)} ${"f".repeat(40)}`]),
    };
    const lib = (over: Readonly<Record<string, Literal | undefined>>): TreeFacts =>
      tree({ "d/release.ts": raw({ slug: "d", kind: "Library", ...over }), "d/x.md": "2" });
    assertEquals(
      rules(judgeWorks({ head: lib({ version: "1.0.0" }), base: before, changed: ["d/x.md"], editions: f })),
      ["versions/scheme-mismatch"],
      "no migratedFrom",
    );
    assertEquals(
      judgeWorks({
        head: lib({ version: "1.0.0", migratedFrom: { scheme: "CommitDateEdition", firstVersion: "1.0.0" } }),
        base: before,
        changed: ["d/x.md"],
        editions: f,
      }),
      [],
    );
    assertEquals(
      rules(
        judgeWorks({
          head: lib({ version: "1.1.0", migratedFrom: { scheme: "CommitDateEdition", firstVersion: "1.0.0" } }),
          base: before,
          changed: ["d/x.md"],
          editions: f,
        }),
      ),
      ["versions/scheme-mismatch"],
      "the new scheme begins at the version the record names",
    );
    assertEquals(
      rules(
        judgeWorks({
          head: lib({ version: "1.0.0", migratedFrom: { scheme: "SnapshotDate", firstVersion: "1.0.0" } }),
          base: before,
          changed: ["d/x.md"],
          editions: f,
        }),
      ),
      ["versions/scheme-mismatch"],
      "it names the scheme it came from",
    );
  },
);

// --------------------------------------------------------------------------------------------------------------------------------- ledger

const C = (n: number): string => String(n).repeat(40).slice(0, 40);
function tag(name: string, n: number, over: Partial<TagFact> = {}): TagFact {
  return { name, annotated: true, signed: true, commit: C(n), tree: C(n + 5), seconds: Date.UTC(2026, 10, n) / 1000, ...over };
}
const chain =
  (...order: readonly number[]) =>
  (a: string, b: string): boolean => {
    const i = order.findIndex((n) => C(n) === a);
    const j = order.findIndex((n) => C(n) === b);
    return i >= 0 && j >= 0 && i < j;
  };

proves(
  ["0026-works-versioning FR-019", "0026-works-versioning FR-017"],
  "the ledger is derived from the tags: each release with its commit, tree, signature and day, ordered by the scheme, deterministic as text and as JSON, and a tag of no work is no release",
  () => {
    const works = [rel(), rel({ slug: "lib-extra", version: "0.1.0" })];
    const tags = [
      tag("lib-v1.10.0", 3),
      tag("lib-v1.2.0", 2),
      tag("lib-extra-v0.1.0", 1, { signed: false }),
      tag("unrelated-v1", 4),
      tag("lib-v1.0.0", 1, { annotated: false, signed: false }),
    ];
    const { entries, findings } = readLedger({ tags, works, isAncestor: chain(1, 2, 3) });
    assertEquals(findings, []);
    assertEquals(
      entries.map((e) => `${e.work} ${e.version}`),
      ["lib 1.0.0", "lib 1.2.0", "lib 1.10.0", "lib-extra 0.1.0"],
      "1.2.0 before 1.10.0: by precedence, not by text",
    );
    assertEquals(splitTag("lib-extra-v0.1.0", ["lib", "lib-extra"]), { slug: "lib-extra", version: "0.1.0" }, "the longest slug wins");
    assertEquals(splitTag("unrelated-v1", ["lib"]), undefined);
    const e = entries[1];
    assertEquals([e?.commit, e?.tree, e?.signed, e?.annotated, e?.day], [C(2), C(7), true, true, "2026-11-02"]);
    assertStringIncludes(ledgerText(entries), `lib\t1.2.0\t${C(2)}\t${C(7)}\tsigned\t2026-11-02`);
    assertStringIncludes(ledgerText(entries), "lightweight");
    const again = readLedger({ tags: [...tags].reverse(), works: [...works].reverse(), isAncestor: chain(1, 2, 3) });
    assertEquals(
      ledgerJson(again.entries),
      ledgerJson(entries),
      "the same tags give the same document, whatever the order they are read in",
    );
    assertEquals(lastRelease(entries, works[0] as Release)?.version, "1.10.0");
    assertEquals(lastRelease(entries, works[0] as Release, new Set(["lib-v1.2.0"]))?.version, "1.2.0", "the last of those reachable");
  },
);

proves(
  ["0026-works-versioning FR-020"],
  "a tag not greater than one of its own history is versions/ledger-order, a tag that moved or is gone against an earlier ledger is versions/tag-moved or versions/tag-removed, and versions are compared within one scheme",
  () => {
    const works = [rel()];
    const wrong = readLedger({ tags: [tag("lib-v1.2.0", 1), tag("lib-v1.1.0", 2)], works, isAncestor: chain(1, 2) });
    assertEquals(rules(wrong.findings), ["versions/ledger-order"]);
    assertStringIncludes(wrong.findings[0]?.message ?? "", "lib-v1.2.0");
    assertEquals(readLedger({ tags: [tag("lib-v1.1.0", 1), tag("lib-v1.2.0", 2)], works, isAncestor: chain(1, 2) }).findings, []);
    assertEquals(
      readLedger({ tags: [tag("lib-v1.2.0", 1), tag("lib-v1.1.0", 2)], works, isAncestor: () => false }).findings,
      [],
      "tags of unrelated histories are not ordered by each other",
    );
    const first = readLedger({ tags: [tag("lib-v1.0.0", 1), tag("lib-v1.1.0", 2)], works, isAncestor: chain(1, 2) });
    const earlier = readEarlier(ledgerJson(first.entries));
    assert(earlier.kind === "ok");
    const moved = readLedger({
      tags: [tag("lib-v1.0.0", 3), tag("lib-v1.1.0", 2)],
      works,
      isAncestor: () => false,
      earlier: earlier.value,
    });
    assertEquals(rules(moved.findings), ["versions/tag-moved"]);
    const gone = readLedger({ tags: [tag("lib-v1.0.0", 1)], works, isAncestor: chain(1), earlier: earlier.value });
    assertEquals(rules(gone.findings), ["versions/tag-removed"]);
    const retired = readLedger({
      tags: [tag("lib-v1.0.0", 1)],
      works: [rel({ retired: [{ version: "1.1.0", on: "2026-11-20" }] })],
      isAncestor: chain(1),
      earlier: earlier.value,
    });
    assertEquals(retired.findings, [], "retired names it: nothing is found");
    assert(readEarlier("not json").kind === "err" && readEarlier('{"releases": 3}').kind === "err");
    // a tag of the old scheme and a tag of the new one are not compared with each other
    const migrated = rel({
      slug: "doc",
      kind: "Library",
      version: "1.0.0",
      migratedFrom: { scheme: "CommitDateEdition", firstVersion: "1.0.0" },
    });
    const both = readLedger({
      tags: [tag("doc-v2026.11.01-aaaaaaaa", 1), tag("doc-v1.0.0", 2)],
      works: [migrated],
      isAncestor: chain(1, 2),
    });
    assertEquals(both.findings, []);
    assertEquals(
      both.entries.map((e) => [e.version, e.scheme]),
      [
        ["2026.11.01-aaaaaaaa", "CommitDateEdition"],
        ["1.0.0", "SemVer"],
      ],
      "the old tag stays in the ledger as it was tagged",
    );
    assertEquals(lastRelease(both.entries, migrated)?.version, "1.0.0");
    const mismatch = readLedger({ tags: [tag("lib-vbanana", 1)], works, isAncestor: () => false });
    assertEquals(rules(mismatch.findings), ["versions/scheme-mismatch"]);
  },
);

proves(
  ["0026-works-versioning FR-027", "0026-works-versioning FR-028"],
  "a retired version, its replacement and its tombstone are read from the record, and bytes removed before the retention period ends are versions/retention-early",
  () => {
    const works = [
      rel({
        retention: "P10Y",
        retired: [
          { version: "1.0.0", on: "2026-12-01", replacedBy: "1.0.1", archivedOn: "2027-01-01" },
          { version: "1.1.0", on: "2026-12-01", bytesRemovedOn: "2036-11-30" },
          { version: "1.2.0", on: "2026-12-01", bytesRemovedOn: "2036-11-01" },
        ],
      }),
    ];
    const tags = [tag("lib-v1.0.0", 1), tag("lib-v1.1.0", 2), tag("lib-v1.2.0", 3)];
    const { entries, findings } = readLedger({ tags, works, isAncestor: chain(1, 2, 3) });
    assertEquals(entries[0]?.retired, { on: "2026-12-01", replacedBy: "1.0.1", archivedOn: "2027-01-01" });
    assertEquals(entries[1]?.tombstone, "2036-11-30", "the identifier resolves to a tombstone where the bytes are gone");
    assertEquals(
      findings.map((f) => [f.rule, f.file]),
      [["versions/retention-early", "refs/tags/lib-v1.2.0"]],
      "10 years from 2026-11-03 end on 2036-11-03, and 2036-11-01 is before it",
    );
    assertEquals(addDuration("2026-01-31", "P1M"), "2026-02-28", "clamped to the end of a short month");
    assertEquals(addDuration("2026-11-17", "P1Y2M1W3D"), "2028-01-27");
    assertEquals(addDuration("2026-11-17", "ten years"), undefined);
    const none = readLedger({
      tags: [tag("lib-v1.1.0", 2)],
      works: [rel({ retired: [{ version: "1.1.0", on: "2026-12-01", bytesRemovedOn: "2030-01-01" }] })],
      isAncestor: () => false,
    });
    assertEquals(rules(none.findings), ["versions/retention-early"], "no retention period is stated");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------------- notes

proves(
  ["0026-works-versioning FR-021", "0026-works-versioning FR-023"],
  "the impact is read from an Impact line (the greatest wins), and the notes group the Closes lines by impact, in order of issue number, deterministic, with the count of commits that closed none",
  () => {
    assertEquals(impactOf("Add\n\nCloses #4\nImpact: minor\n"), "minor");
    assertEquals(impactOf("Add\n\nimpact: PATCH\nImpact: major\n"), "major", "the greatest");
    assertEquals(
      impactOf("Add\n\nSee Impact: major in the text\n> Impact: major\n"),
      undefined,
      "a line of its own, and a quoted line is not read",
    );
    assertEquals(impactOf("Add\n\nImpact: huge\n"), undefined);
    const c = (sha: string, subject: string, body: string) => ({
      sha: sha.padEnd(40, "0"),
      subject,
      message: `${subject}\n\n${body}`,
      files: ["lib/a.ts"],
    });
    const commits = [
      c("bbbbbbb", "Fix the thing", "Closes #12\nImpact: patch"),
      c("aaaaaaa", "Add the other thing", "Closes #7\nImpact: minor"),
      c("ccccccc", "Rename it", "Closes #3\nCloses #9\nImpact: major"),
      c("ddddddd", "Tidy", "Refs #5"),
      c("eeeeeee", "Close one", "Closes #2"),
      c("fffffff", "Tidy again", ""),
    ];
    assertEquals(impactOfCommits(commits), "major");
    assertEquals(impactOfCommits([c("a", "x", "Closes #1")]), undefined);
    const text = notesOf({ slug: "lib", title: "A library", version: "2.0.0", from: "lib-v1.0.0", commits });
    assertEquals(
      text,
      [
        "# Release notes: lib 2.0.0",
        "",
        "A library.",
        "",
        "The capabilities closed since lib-v1.0.0.",
        "",
        "## Major",
        "",
        "- #3 Rename it (ccccccc)",
        "- #9 Rename it (ccccccc)",
        "",
        "## Minor",
        "",
        "- #7 Add the other thing (aaaaaaa)",
        "",
        "## Patch",
        "",
        "- #12 Fix the thing (bbbbbbb)",
        "",
        "## Impact not stated",
        "",
        "- #2 Close one (eeeeeee)",
        "",
        "2 commits closed no capability.",
        "",
      ].join("\n"),
    );
    assertEquals(
      notesOf({ slug: "lib", title: "A library", version: "2.0.0", from: "lib-v1.0.0", commits: [...commits].reverse() }),
      text,
      "the same commits in any order give the same text",
    );
    assertStringIncludes(
      notesOf({ slug: "lib", title: "A library", version: undefined, from: undefined, commits: [] }),
      "0 commits closed no capability.",
    );
  },
);

// ----------------------------------------------------------------------------------------------------------------------------------- cite

proves(
  ["0026-works-versioning FR-024", "0026-works-versioning FR-029"],
  "CITATION.cff is made deterministically from the record, and the identifier is written only where the record carries one",
  () => {
    const without = citationOf(rel({ repository: "https://example.org/lib.git" }), "2026-11-17");
    assertEquals(
      without,
      [
        "cff-version: 1.2.0",
        'message: "If you use this work, please cite it as below."',
        'title: "A library"',
        'version: "1.0.0"',
        "date-released: 2026-11-17",
        "authors:",
        '  - name: "A. Person"',
        'repository-code: "https://example.org/lib.git"',
        "",
      ].join("\n"),
    );
    assert(!(without ?? "").includes("identifiers"), "no DOI is written where the record carries none");
    const doi = citationOf(rel({ identifier: "https://doi.org/10.5555/lib.1" }), "2026-11-17") ?? "";
    assertStringIncludes(doi, 'identifiers:\n  - type: doi\n    value: "10.5555/lib.1"\n');
    assertStringIncludes(citationOf(rel({ identifier: "978-3-16-148410-0" }), "2026-11-17") ?? "", "type: other");
    assertEquals(citationOf(rel(), "2026-11-17"), citationOf(rel(), "2026-11-17"), "deterministic");
    assertEquals(
      citationOf(rel({ slug: "s", kind: "Specification", version: undefined }), "2026-11-17"),
      undefined,
      "a specification is not cited",
    );
  },
);

// ------------------------------------------------------------------------------------------------------------------------------------ gate

proves(
  ["0026-works-versioning FR-026"],
  "a regulated harness releases only on the tier it declares: it is refused with no releaseTier, with no tier judged and below the declared tier, and the declaration reads the field compatibly",
  () => {
    const d = (over: Readonly<Record<string, Literal | undefined>>) => {
      const r = decodeDeclaration({ regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-01-01", ...over });
      assert(r.kind === "ok");
      return r.value;
    };
    assertEquals(releaseGate(d({}), "Tier2").kind, "refused", "a regulated harness that declares no release tier");
    assertEquals(releaseGate(d({ releaseTier: "Tier2" }), undefined).kind, "refused", "no tier judged");
    assertEquals(releaseGate(d({ releaseTier: "Tier2" }), "Tier1").kind, "refused", "below the declared tier");
    assertEquals(releaseGate(d({ releaseTier: "Tier1" }), "Tier2"), { kind: "allowed", tier: "Tier2" });
    assertEquals(releaseGate(d({ releaseTier: "Tier1" }), "Tier1"), { kind: "allowed", tier: "Tier1" });
    assertEquals(
      releaseGate(undefined, "Tier0"),
      { kind: "allowed", tier: "Tier0" },
      "a harness that declares no regulated domain is not held to a tier",
    );
    assertEquals(releaseGate({ regulatedDomains: [] }, undefined), { kind: "allowed", tier: undefined });
    assert(isReleaseTier("Tier1") && !isReleaseTier("Tier9"));
    // the field is optional and a declaration with none decodes as it did
    const old = decodeDeclaration({ regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-01-01" });
    assert(old.kind === "ok" && !("releaseTier" in old.value));
    assert(decodeDeclaration({ regulatedDomains: [], releaseTier: "Tier7" }).kind === "err");
  },
);

// --------------------------------------------------------------------------------------------------------------------------------- plugin

proves(
  ["0026-works-versioning FR-032"],
  "the rule plugin judges every record under a root by itself: it decodes, its version matches its scheme, a specification has none, and it is reported once, for the anchored specification",
  () => {
    const works = [
      { path: "good/release.ts", text: raw({ slug: "good" }) },
      { path: "bad/release.ts", text: raw({ slug: "bad", colour: "blue" }) },
      { path: "pattern/release.ts", text: raw({ slug: "pattern", version: "1.2.3+abc" }) },
      { path: "spec/release.ts", text: raw({ slug: "spec", kind: "Specification" }) },
      { path: "twice/release.ts", text: raw({ slug: "good" }) },
    ];
    const plugin = versionsPlugin(works, "0001-x");
    const found = plugin.check({ slug: "0001-x", spec: "" });
    assertEquals(
      found.map((f) => [f.file, f.rule]),
      [
        ["bad/release.ts", "versions/record-invalid"],
        ["pattern/release.ts", "versions/scheme-mismatch"],
        ["spec/release.ts", "versions/record-invalid"],
        ["twice/release.ts", "versions/record-invalid"],
      ],
    );
    assertEquals(plugin.check({ slug: "0002-y", spec: "" }), [], "reported for the anchored specification only");
    assertEquals(versionsPlugin([], "0001-x").check({ slug: "0001-x", spec: "" }), []);
  },
);

proves(
  ["0026-works-versioning FR-032"],
  "holdHarness runs the plugin: a folder whose records are sound passes, a record that does not decode or a controlled document with no approval fails (the latter whatever the baseline holds), and the records under a root are found by walking it",
  async () => {
    await withTempDir((root) => {
      mkdirSync(join(root, "specs", "0001-x"), { recursive: true });
      writeTextFileSync(
        join(root, "specs", "0001-x", "spec.md"),
        "# Feature Specification: X\n\n**Spec ID:** 0001-x\n**Status:** Draft\n\n- **FR-001**: The thing MUST work.\n",
      );
      const baselineFile = join(root, "mizan.baseline.txt");
      const base = { root, baselineFile, today: "2026-11-17" } as const;
      mkdirSync(join(root, "lib"), { recursive: true });
      mkdirSync(join(root, "node_modules", "x"), { recursive: true });
      writeTextFileSync(join(root, "lib", "release.ts"), raw());
      writeTextFileSync(join(root, "node_modules", "x", "release.ts"), "not a record");
      assertEquals(
        readWorks(root).map((w) => w.path),
        ["lib/release.ts"],
        "node_modules holds no work",
      );
      assertEquals(holdHarness({ ...base, works: readWorks(root) }), 0);
      writeTextFileSync(join(root, "lib", "release.ts"), raw({ colour: "blue" }));
      assertEquals(holdHarness({ ...base, works: readWorks(root) }), 1);
      writeTextFileSync(baselineFile, "");
      assertEquals(
        holdHarness({ ...base, works: readWorks(root), writeBaseline: true }),
        0,
        "a finding of the plugin can be held by the baseline",
      );
      assertEquals(holdHarness({ ...base, works: readWorks(root) }), 0);
      writeTextFileSync(join(root, "lib", "release.ts"), raw({ kind: "ControlledDocument", version: "7" }));
      assertEquals(holdHarness({ ...base, works: readWorks(root) }), 1);
      assertEquals(holdHarness({ ...base, works: readWorks(root), writeBaseline: true }), 0);
      assertEquals(
        readTextFileSync(baselineFile).includes("approval-missing"),
        false,
        "an approval that is missing is never held by the baseline",
      );
      assertEquals(holdHarness({ ...base, works: readWorks(root) }), 1);
      return Promise.resolve();
    });
  },
);
