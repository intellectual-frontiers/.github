/**
 * IFRFS, the layout that accepts File Aide (commons 0010-file-aide FR-038): the committed synthetic tree matches it whole, and broken copies
 * of its paths do not. Each phase of File Aide adds what IFRFS must pass here.
 *
 * @module
 */
import { fs, path as hostPath } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../../runtime/test.ts";
import { checkNames, formatLayoutError, MACOS_LIMITS, relPath, S3_LIMITS, WINDOWS_LIMITS } from "../../file-aide/mod.ts";
import { ENTRIES, ifrfs, issue, KINDS, MARKER, readme } from "../../ifrfs/mod.ts";

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
