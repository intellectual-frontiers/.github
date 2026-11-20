/**
 * File Aide's algebra: segments, path patterns and their two laws, computed key types, entries, layouts and names (commons 0010-file-aide
 * FR-006 to FR-013).
 *
 * @module
 */
import fc from "fast-check";
import { type Equal, expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  type AnySegment,
  bytes,
  checkNames,
  codec,
  custom,
  date,
  digest,
  entry,
  enumeration,
  err,
  fanout,
  fileName,
  formatLayoutError,
  integer,
  json5,
  type KeyOfPattern,
  layout,
  LINUX_LIMITS,
  literal,
  MACOS_LIMITS,
  mount,
  ok,
  partition,
  path,
  type Pattern,
  relPath,
  rest,
  S3_LIMITS,
  slug,
  text,
  ulid,
  uuid,
  WINDOWS_LIMITS,
} from "../../file-aide/mod.ts";

const kind = enumeration("kind", ["book", "deck", "book-series"]);
const work = slug("slug");
const id = ulid("id");

/** A path text drawn from the regular expressions of a pattern's segments: what a store might hold, valid or not. */
function arbitraryText<K>(p: Pattern<K>): fc.Arbitrary<string> {
  const parts = p.names.map((name) =>
    fc
      .tuple(
        ...name.map((part): fc.Arbitrary<string> => {
          if (part.kind === "text") return fc.constant(part.text);
          const s: AnySegment = part.segment;
          if (s.role.kind === "rest")
            return fc.array(fc.stringMatching(/^[a-z0-9 ._-]{1,8}$/), { minLength: 1, maxLength: 3 }).map((n) => n.join("/"));
          return fc.stringMatching(new RegExp(`^(?:${s.source})$`, "u"));
        }),
      )
      .map((pieces) => pieces.join("")),
  );
  return fc.tuple(...parts).map((names) => names.join("/"));
}

const patterns = {
  issue: path`${kind}/${work}/issues.d/${id}.json5`,
  rendition: path`${kind}/${work}/${rest("file", { except: ["issues.d"] })}`,
  dated: path`${partition(date("dt", "YYYY-MM-DD"))}/${fanout("shard", work, 2)}/${work}-${integer("n", { width: 3 })}.${enumeration("ext", ["pdf", "epub"])}`,
  counted: path`runs/${integer("run")}/${uuid("job")}/${digest("sum", "sha256")}.bin`,
  month: path`${date("month", "YYYY-MM")}/${fileName("name")}`,
};

/** Holds a pattern to its two laws over generated paths. */
function laws<K>(p: Pattern<K>): void {
  assertEquals(p.problems, [], p.text);
  fc.assert(
    fc.property(arbitraryText(p), (t) => {
      const k = p.parse(t);
      if (k.kind === "err") return true;
      const back = p.format(k.value);
      assert(back.kind === "ok", `${p.text}: ${t} read but not written`);
      assertEquals<string>(back.value, t, `${p.text}: format(parse(t)) is t`);
      assertEquals(p.parse(back.value), k, `${p.text}: parse(format(k)) is k`);
      return true;
    }),
    { numRuns: 300 },
  );
}

/** Equality of a branded value and plain data. */
const same = (actual: unknown, expected: unknown, message?: string): void => assertEquals(actual, expected, message);

proves(
  ["0010-file-aide FR-007"],
  "every path a pattern reads is written back as it was, and every key read is read again from what it writes (the two laws, as properties)",
  () => {
    laws(patterns.issue);
    laws(patterns.rendition);
    laws(patterns.dated);
    laws(patterns.counted);
    laws(patterns.month);
    // the control: the generator makes paths that are read, not only ones that are refused
    const read = fc.sample(arbitraryText(patterns.issue), 50).filter((t) => patterns.issue.parse(t).kind === "ok");
    assert(read.length > 0, "some generated issue paths are read");
  },
);

proves(
  ["0010-file-aide FR-006"],
  "each segment reads and writes its own text, and refuses text that is not written as it writes it",
  () => {
    const n = integer("n");
    assertEquals(n.parse("42"), ok(42));
    assertEquals(
      patterns.counted.parse("runs/007/0190f3c2-7a4b-7c3d-8e5f-0a1b2c3d4e5f/" + "a".repeat(64) + ".bin").kind,
      "err",
      "007 is not how n writes 7",
    );
    assertEquals(integer("n", { width: 3 }).format(7), ok("007"));
    assertEquals(integer("n", { width: 2 }).format(123).kind, "err");
    assertEquals(date("d", "YYYY-MM-DD").parse("2026-02-30").kind, "err", "a day the calendar lacks");
    assertEquals(date("d", "YYYYMMDD").parse("20240229"), ok("20240229"));
    assertEquals(kind.parse("film").kind, "err");
    assertEquals(slug("s").parse("Design-Systems").kind, "err");
    assertEquals(slug("s").parse("design-systems--x").kind, "err");
    assertEquals(ulid("u").parse("01M6SFSZ7J1T8GX50X1H4RZH7V"), ok("01M6SFSZ7J1T8GX50X1H4RZH7V"));
    assertEquals(ulid("u").parse("81M6SFSZ7J1T8GX50X1H4RZH7V").kind, "err", "a ULID begins with at most 7");
    assertEquals(uuid("u").parse("0190F3C2-7A4B-7C3D-8E5F-0A1B2C3D4E5F").kind, "err", "lowercase only");
    assertEquals(digest("d", "sha1").parse("a".repeat(40)), ok("a".repeat(40)));
    assertEquals(literal("v", "v1").parse("v2").kind, "err");
    assertEquals(partition(date("dt", "YYYY"), "year").format("2026"), ok("year=2026"));
    assertEquals(fileName("f").parse("..").kind, "err");
    assertEquals(rest("r").parse("a//b").kind, "err");
    assertEquals(rest("r", { except: ["issues.d"] }).parse("issues.d/x").kind, "err");
    const upper = custom("code", {
      source: "[A-Z]{3}",
      variable: false,
      witnesses: ["ABC"],
      parse: (t) => (/^[A-Z]{3}$/.test(t) ? ok(t.toLowerCase()) : err("not three capitals")),
      format: (v: string) => ok(v.toUpperCase()),
    });
    assertEquals(path`codes/${upper}.txt`.parse("codes/XYZ.txt"), ok({ code: "xyz" }));
  },
);

proves(
  ["0010-file-aide FR-006", "0010-file-aide FR-007"],
  "a fan-out is written from the segment it begins and checked when read, and is not a field of the key",
  () => {
    const p = patterns.dated;
    same(p.format({ dt: "2026-11-15", slug: "abc", n: 7, ext: "pdf" }), ok("dt=2026-11-15/ab/abc-007.pdf"));
    assertEquals(p.parse("dt=2026-11-15/ab/abc-007.pdf"), ok({ dt: "2026-11-15", slug: "abc", n: 7, ext: "pdf" }));
    const wrong = p.parse("dt=2026-11-15/zz/abc-007.pdf");
    assert(wrong.kind === "err" && wrong.error.kind === "mismatch");
    assertStringIncludes(wrong.error.why, "shard is not the first 2 characters of slug");
  },
);

proves(["0010-file-aide FR-007"], "a pattern that cannot be read one way is kept with its problems, which a layout refuses", () => {
  const a = slug("a");
  const b = fileName("b");
  assertEquals(path`${a}${b}`.problems, ["a and b are side by side and both vary in length"]);
  assertEquals(path`${a}-${b}`.problems, [], "text between them is enough");
  assertEquals(path`${integer("n", { width: 4 })}${a}`.problems, [], "one of a fixed length is enough");
  assertStringIncludes(path`${rest("r")}/x`.problems.join(), "must be the whole of the last name");
  assertStringIncludes(path`${a}/${a}`.problems.join(), "a is named twice");
  assertStringIncludes(path`/${a}`.problems.join(), "begins with /");
  assertStringIncludes(path`x//${a}`.problems.join(), "is empty");
  assertStringIncludes(path`../${a}`.problems.join(), "is ..");
  assertStringIncludes(path`${fanout("f", a, 2)}/x`.problems.join(), "which the pattern does not have");
  const grouped = custom("g", { source: "(a|b)", variable: false, witnesses: ["a"], parse: (t) => ok(t), format: (v: string) => ok(v) });
  assertStringIncludes(path`${grouped}`.problems.join(), "capturing group");
  const e = entry("bad", path`${a}${b}`, { codec: bytes, description: "", owner: "" });
  const l = layout([e]);
  assert(l.kind === "err");
  assertStringIncludes(formatLayoutError(l.error), "the pattern of bad is not valid");
});

proves(
  ["0010-file-aide FR-008"],
  "a key's type is computed from the segments, and a key that lacks a field, has another or holds a wrong value does not compile",
  () => {
    type Issue = KeyOfPattern<typeof patterns.issue>;
    expectType<Equal<Issue, { readonly kind: "book" | "deck" | "book-series"; readonly slug: string; readonly id: string }>>();
    type Dated = KeyOfPattern<typeof patterns.dated>;
    expectType<Equal<Dated, { readonly dt: string; readonly slug: string; readonly n: number; readonly ext: "pdf" | "epub" }>>();
    type Fixed = KeyOfPattern<ReturnType<typeof readmePattern>>;
    expectType<Equal<Fixed, {}>>();
    const p = patterns.issue;
    // @ts-expect-error the key lacks its id
    p.format({ kind: "book", slug: "a" });
    // @ts-expect-error film is not a kind of the enumeration
    p.format({ kind: "film", slug: "a", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    // @ts-expect-error a number is not a slug
    p.format({ kind: "book", slug: 7, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    // @ts-expect-error the key has a field no segment fills
    p.format({ kind: "book", slug: "a", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", extra: 1 });
    // the control: the right key compiles and writes
    same(p.format({ kind: "book", slug: "a", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }), ok("book/a/issues.d/01ARZ3NDEKTSV4RRFFQ69G5FAV.json5"));
  },
);

const readmePattern = () => path`README.md`;

proves(
  ["0010-file-aide FR-009"],
  "an entry carries its codec, description and owner; the library's codecs are bytes, text, JSON5 and the caller's own",
  () => {
    const e = entry("issue", patterns.issue, { codec: json5, description: "An issue.", owner: "if" });
    assertEquals([e.name, e.description, e.owner, e.codec.kind], ["issue", "An issue.", "if", "json5"]);
    assertEquals(json5.decode(new TextEncoder().encode("{a: 1, }")), ok({ a: 1 }));
    assertEquals(json5.decode(new TextEncoder().encode("{a: ")).kind, "err");
    assertEquals(text.decode(new Uint8Array([0xff])).kind, "err", "not UTF-8");
    assertEquals(bytes.decode(new Uint8Array([1, 2])), ok(new Uint8Array([1, 2])));
    const csvLine = codec(
      (b) => {
        const t = text.decode(b);
        return t.kind === "ok" ? ok(t.value.split(",")) : t;
      },
      (v: readonly string[]) => text.encode(v.join(",")),
    );
    assertEquals(csvLine.decode(csvLine.encode(["a", "b"])), ok(["a", "b"]));
  },
);

proves(
  ["0010-file-aide FR-010"],
  "a layout refuses two entries whose patterns match one path, found by the witnesses of their segments",
  () => {
    const s = slug("s");
    const pdf = entry("pdf", path`${s}.pdf`, { codec: bytes, description: "", owner: "" });
    const any = entry("any", path`${fileName("f")}`, { codec: bytes, description: "", owner: "" });
    const l = layout([pdf, any]);
    assert(l.kind === "err");
    assertEquals(l.error, { kind: "ambiguous", entries: ["pdf", "any"], path: "slug.pdf" });
    assertEquals(formatLayoutError(l.error), "pdf and any both match slug.pdf");
    const named = layout([pdf, pdf]);
    assert(named.kind === "err" && named.error.kind === "named-twice");
    assertEquals(layout([]).kind, "err");
    // the control: names of different counts, and a rest that refuses a folder, do not overlap
    const files = entry("files", path`${s}/${rest("file", { except: ["meta"] })}`, { codec: bytes, description: "", owner: "" });
    const meta = entry("meta", path`${s}/meta/${slug("m")}.json5`, { codec: json5, description: "", owner: "" });
    assertEquals(layout([files, meta]).kind, "ok");
  },
);

proves(
  ["0010-file-aide FR-010", "0010-file-aide FR-011"],
  "matching gives one entry and its key, or unmatched with why, never a throw",
  () => {
    const a = entry("a", path`${kind}/${work}.txt`, { codec: text, description: "", owner: "" });
    const b = entry("b", path`${kind}/${work}/${id}.json5`, { codec: json5, description: "", owner: "" });
    const l = layout([a, b]);
    assert(l.kind === "ok");
    same(l.value.match("deck/intro.txt"), { kind: "matched", path: "deck/intro.txt", entry: "a", key: { kind: "deck", slug: "intro" } });
    const m = l.value.match("deck/intro/x.json5");
    assert(m.kind === "unmatched");
    assertStringIncludes(m.why, "does not fit");
    const bad = l.value.match("deck/../x");
    assert(bad.kind === "unmatched");
    assertStringIncludes(bad.why, "leave its place");
    // a path given in another normalization form is matched as its form C
    const accented = entry("c", path`notes/${fileName("f")}`, { codec: text, description: "", owner: "" });
    const lc = layout([accented]);
    assert(lc.kind === "ok");
    const decomposed = "notes/café.txt";
    const got = lc.value.match(decomposed);
    assert(got.kind === "matched");
    assertEquals(got.path, "notes/café.txt");
    // narrowing by the entry's name gives its key's type
    const n = l.value.match("book/x/01ARZ3NDEKTSV4RRFFQ69G5FAV.json5");
    if (n.kind === "matched" && n.entry === "b")
      expectType<Equal<typeof n.key, { readonly kind: "book" | "deck" | "book-series"; readonly slug: string; readonly id: string }>>();
    else assert(false, "matched as b");
  },
);

proves(["0010-file-aide FR-010"], "a layout mounted under a prefix matches below it alone", () => {
  const inner = [entry("note", path`${work}.md`, { codec: text, description: "", owner: "" })] as const;
  const l = layout([...mount("archive/2026", inner), entry("top", path`${work}.md`, { codec: text, description: "", owner: "" })]);
  assert(l.kind === "ok");
  same(l.value.match("archive/2026/a.md"), { kind: "matched", path: "archive/2026/a.md", entry: "note", key: { slug: "a" } });
  same(l.value.match("a.md"), { kind: "matched", path: "a.md", entry: "top", key: { slug: "a" } });
});

proves(
  ["0010-file-aide FR-012"],
  "a path is relative, normalized and cannot leave its root, and is refused before any store is reached",
  () => {
    for (const bad of ["", "/etc/passwd", "a/", "a//b", "./a", "a/../../b", "..", "a\\b", "a\u0000b", "a\nb"])
      assertEquals(relPath(bad).kind, "err", JSON.stringify(bad));
    same(relPath("a/b c/d.pdf"), ok("a/b c/d.pdf"));
    same(relPath("café"), ok("café"));
    assertEquals(patterns.month.parse("2026-11/café").kind, "err", "a pattern reads only a path already in form C");
  },
);

proves(
  ["0010-file-aide FR-013"],
  "a path is checked against the limits of each store it is used with, and paths that differ only in case are reported where case folds",
  () => {
    const long = relPath("a/" + "x".repeat(1100));
    const reserved = relPath("works/CON.txt");
    const colon = relPath("works/a:b.txt");
    const upper = relPath("works/Readme.md");
    const lower = relPath("works/readme.md");
    const longName = relPath("b/" + "é".repeat(200));
    assert(
      long.kind === "ok" &&
        reserved.kind === "ok" &&
        colon.kind === "ok" &&
        upper.kind === "ok" &&
        lower.kind === "ok" &&
        longName.kind === "ok",
    );
    const s3 = checkNames([long.value, upper.value, lower.value], [S3_LIMITS]);
    assertEquals(
      s3.map((f) => f.kind),
      ["too-long"],
      "S3 keeps case and allows 1,024 bytes",
    );
    const win = checkNames([reserved.value, colon.value, upper.value, lower.value], [WINDOWS_LIMITS]);
    assertEquals(
      win.map((f) => f.kind),
      ["reserved", "reserved", "case-collision"],
    );
    assertEquals(
      checkNames([longName.value], [LINUX_LIMITS]).map((f) => f.kind),
      ["name-too-long"],
      "400 bytes of UTF-8 in one name",
    );
    assertEquals(
      checkNames([upper.value, lower.value], [MACOS_LIMITS, LINUX_LIMITS]).map((f) => `${f.kind}:${f.store}`),
      ["case-collision:macos"],
    );
  },
);
