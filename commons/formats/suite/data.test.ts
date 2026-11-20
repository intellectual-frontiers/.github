/**
 * Tests of `toml.ts`, `kernel/yaml.ts`, `kernel/csv.ts`, `kernel/media-types.ts` and the entity tags of `kernel/http.ts`: what each
 * writer writes its reader reads back (property-tested), the examples of each language are read as they should be, and what breaks a
 * rule is named with its place.
 *
 * @module
 */
import fc from "fast-check";
import { csvField, formatCsvError, parseCsv, parseCsvRecords, toCsv } from "../src/csv.ts";
import { entityTag, entityTags, ifMatch, ifNoneMatch } from "../src/http.ts";
import type { Json } from "../src/json5.ts";
import { contentType, extensionOf, isTextual, mediaType } from "../src/media-types.ts";
import { formatTomlError, isTomlDateTime, isTomlTable, parseToml, type TomlTable, type TomlValue, toToml } from "../src/toml.ts";
import { formatYamlError, isPlainSafe, parseYaml, resolveCore, toYaml } from "../src/yaml.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const TOML = "0001-formats FR-003";
const CSV = "0001-formats FR-005";
const MEDIA = "0001-formats FR-018";
const YAML = "0001-formats FR-002";
const LAWS = "0005-typescript-runtime FR-014";

const toml = (text: string): TomlTable => {
  const r = parseToml(text);
  if (r.kind === "err") throw new Error(`${formatTomlError(r.error)}\n${text}`);
  return r.value;
};

const key = fc.oneof(fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/), fc.string({ minLength: 1, maxLength: 8 }));
const tomlScalar: fc.Arbitrary<TomlValue> = fc.oneof(
  fc.string(),
  fc.boolean(),
  fc.maxSafeInteger(),
  fc.double(),
  fc.constantFrom<TomlValue>(
    { kind: "offset-date-time", text: "1979-05-27T07:32:00Z" },
    { kind: "local-date-time", text: "1979-05-27T00:32:00.999999" },
    { kind: "local-date", text: "1979-05-27" },
    { kind: "local-time", text: "07:32:00" },
  ),
);
const tomlTable: fc.Arbitrary<TomlTable> = fc.letrec<{ table: TomlTable; value: TomlValue }>((tie) => ({
  table: fc.dictionary(key, tie("value"), { maxKeys: 4, noNullPrototype: true }),
  value: fc.oneof({ depthSize: "small" }, tomlScalar, fc.array(tie("value"), { maxLength: 3 }), tie("table")),
})).table;

proves([TOML, LAWS], "a table written as TOML reads back as the same table", () => {
  fc.assert(
    fc.property(tomlTable, (t) => assertEquals(parseToml(toToml(t)), { kind: "ok", value: t })),
    { numRuns: 200 },
  );
});

proves([TOML], "the examples of TOML 1.0 are read as the language defines them", () => {
  const doc = toml(`# This is a TOML document
title = "TOML Example"
"quoted key" = 'literal \\n'
site."google.com" = true
3.14159 = "pi"

[owner]
name = "Tom Preston-Werner"
dob = 1979-05-27T07:32:00-08:00

[database]
enabled = true
ports = [ 8000, 8001, 8002, ]
data = [ ["delta", "phi"], [3.14] ]
temp_targets = { cpu = 79.5, case = 72.0 }

[servers]
  [servers.alpha]
  ip = "10.0.0.1"

[[fruits]]
name = "apple"
  [fruits.physical]
  color = "red"
  [[fruits.varieties]]
  name = "red delicious"
  [[fruits.varieties]]
  name = "granny smith"
[[fruits]]
name = "banana"

[numbers]
int = +99
neg = -17
big = 5_349_221
hex = 0xDEAD_BEEF
oct = 0o755
bin = 0b1101_0110
float = 6.626e-34
under = 224_617.445_991
inf = -inf
nan = nan
date = 1979-05-27
time = 00:32:00.999999
local = 1979-05-27 07:32:00
str1 = """
Roses are red
Violets are blue"""
str2 = """\\
       The quick brown \\
       fox."""
str3 = '''I [dw]on't need \\d{2} apples'''
str4 = """Here are fifteen quotation marks: ""\\"""\\"""\\"""\\"""\\"."""
str5 = "\\u00e9\\U0001F600"
`);
  assertEquals(doc["title"], "TOML Example");
  assertEquals(doc["quoted key"], "literal \\n");
  assertEquals(doc["site"], { "google.com": true });
  assertEquals(doc["3"], { "14159": "pi" });
  assertEquals((doc["owner"] as TomlTable)["dob"], { kind: "offset-date-time", text: "1979-05-27T07:32:00-08:00" });
  assertEquals(doc["database"], {
    enabled: true,
    ports: [8000, 8001, 8002],
    data: [["delta", "phi"], [3.14]],
    temp_targets: { cpu: 79.5, case: 72 },
  });
  assertEquals(doc["servers"], { alpha: { ip: "10.0.0.1" } });
  assertEquals(doc["fruits"], [
    { name: "apple", physical: { color: "red" }, varieties: [{ name: "red delicious" }, { name: "granny smith" }] },
    { name: "banana" },
  ]);
  const n = doc["numbers"] as TomlTable;
  assertEquals(
    [n["int"], n["neg"], n["big"], n["hex"], n["oct"], n["bin"], n["float"], n["under"], n["inf"]],
    [99, -17, 5349221, 0xdeadbeef, 0o755, 0b11010110, 6.626e-34, 224617.445991, Number.NEGATIVE_INFINITY],
  );
  assert(Number.isNaN(n["nan"]));
  assertEquals(
    [n["date"], n["time"], n["local"]],
    [
      { kind: "local-date", text: "1979-05-27" },
      { kind: "local-time", text: "00:32:00.999999" },
      { kind: "local-date-time", text: "1979-05-27T07:32:00" },
    ],
  );
  assertEquals(n["str1"], "Roses are red\nViolets are blue");
  assertEquals(n["str2"], "The quick brown fox.");
  assertEquals(n["str3"], "I [dw]on't need \\d{2} apples");
  assertEquals(n["str4"], 'Here are fifteen quotation marks: """"""""""""""".');
  assertEquals(n["str5"], "\u00e9\u{1F600}");
  assert(isTomlDateTime({ kind: "local-date", text: "1979-05-27" }) && !isTomlDateTime({ kind: "x", text: "y" }));
  assert(isTomlTable({}) && !isTomlTable([]) && !isTomlTable({ kind: "local-time", text: "07:00:00" }));
});

proves([TOML], "what breaks a rule of TOML is refused with its line and column", () => {
  const bad: readonly (readonly [string, number, number])[] = [
    ["a = 1\na = 2", 2, 1],
    ["[t]\n[t]", 2, 1],
    ["[t]\nx = 1\n[t.x]", 3, 1],
    ["a = {x = 1}\n[a]", 2, 1],
    ["a = {x = 1}\na.y = 2", 2, 1],
    ["a = [1]\n[[a]]", 2, 1],
    ["[a.b]\nc = 1\n[a]\nb.d = 2", 4, 1],
    ["a.b = 1\n[a]", 2, 1],
    ["x = 01", 1, 6],
    ["x = 9007199254740992", 1, 5],
    ["x = 1979-02-30", 1, 5],
    ['x = "open', 1, 10],
    ["x = {a = 1,}", 1, 12],
    ["x = 1 y = 2", 1, 7],
    ['x = "\\q"', 1, 6],
    ["= 1", 1, 1],
    ["x = tru", 1, 5],
  ];
  for (const [text, line, column] of bad) {
    const r = parseToml(text);
    assert(r.kind === "err", `${JSON.stringify(text)} was read`);
    assertEquals([r.error.line, r.error.column], [line, column], `${JSON.stringify(text)}: ${formatTomlError(r.error)}`);
  }
  assertEquals(toml("[a.b.c]\n[a]\nx = 1"), { a: { b: { c: {} }, x: 1 } });
  assertEquals(toml('"__proto__" = 1')["__proto__"], 1);
  assertEquals(toToml({}), "");
});

const yaml = (text: string): Json => {
  const r = parseYaml(text);
  if (r.kind === "err") throw new Error(`${formatYamlError(r.error)}\n${text}`);
  return r.value;
};

proves([YAML, LAWS], "a value written as YAML reads back as the same value", () => {
  const json = fc.jsonValue({ maxDepth: 4 }) as fc.Arbitrary<Json>;
  fc.assert(
    fc.property(json, (v) => assertEquals(parseYaml(toYaml(v)), { kind: "ok", value: v })),
    { numRuns: 300 },
  );
  const text = fc.string({ unit: "binary", maxLength: 12 });
  fc.assert(
    fc.property(fc.dictionary(text, text, { noNullPrototype: true }), (v) => assertEquals(parseYaml(toYaml(v)), { kind: "ok", value: v })),
  );
  const special = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 1e21, 5e-324);
  fc.assert(fc.property(fc.array(special), (xs) => assertEquals(parseYaml(toYaml(xs)), { kind: "ok", value: xs })));
});

proves([YAML], "front matter, configuration and the scalar styles are read as YAML 1.2 reads them", () => {
  assertEquals(
    yaml(`---
name: build-skill   # a comment
description: >
  Builds the work,
  then checks it.

  Twice.
script: |
  set -e
    indented
  done
strip: |-
  no break
keep: |+
  breaks

tags: [build, "ci: yes", 'x''y']
env: { NODE: 26, DEBUG: false }
steps:
- run: make
  times: 2
- - nested
  - list
-
  late: value
empty:
nulls: [~, null, Null]
numbers: [0o17, 0x1F, -1.5, .5, 1e3, .inf, -.Inf]
text: [yes, no, on, "true", 1.2.3, 2026-11-15]
plain: one
  two

  three
double: "a\\tb \\u00e9 \\x41 \\U0001F600 \\
  folded"
...
`),
    {
      name: "build-skill",
      description: "Builds the work, then checks it.\nTwice.\n",
      script: "set -e\n  indented\ndone\n",
      strip: "no break",
      keep: "breaks\n\n",
      tags: ["build", "ci: yes", "x'y"],
      env: { NODE: 26, DEBUG: false },
      steps: [{ run: "make", times: 2 }, ["nested", "list"], { late: "value" }],
      empty: null,
      nulls: [null, null, null],
      numbers: [15, 31, -1.5, 0.5, 1000, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
      text: ["yes", "no", "on", "true", "1.2.3", "2026-11-15"],
      plain: "one two\nthree",
      double: "a\tb \u00e9 A \u{1F600} folded",
    },
  );
  assertEquals(parseYaml("a: 1\nb: [x, 2]", { schema: "failsafe" }), { kind: "ok", value: { a: "1", b: ["x", "2"] } });
  assertEquals(yaml(""), null);
  assertEquals(yaml("# only a comment\n"), null);
  assertEquals(yaml("just text"), "just text");
  const proto = yaml('"__proto__": 1');
  assertEquals(
    typeof proto === "object" && proto !== null && !Array.isArray(proto)
      ? Object.getOwnPropertyDescriptor(proto, "__proto__")?.value
      : undefined,
    1,
  );
  assertEquals(
    [resolveCore("NULL"), resolveCore("TRUE"), resolveCore("+12"), resolveCore(".NaN"), resolveCore("1_000")],
    [null, true, 12, Number.NaN, "1_000"],
  );
});

proves([YAML], "what is ambiguous or unsafe to read is refused with its line and column", () => {
  const bad: readonly (readonly [string, number, number, string])[] = [
    ["a: &x 1\nb: *x", 1, 4, "anchor"],
    ["a: !!str 1", 1, 4, "tag"],
    ["? complex\n: key", 1, 1, "simple key"],
    ["%YAML 1.2\n---\na: 1", 1, 1, "directive"],
    ["a: 1\n---\nb: 2", 2, 1, "one document"],
    ["a: 1\na: 2", 2, 1, "only once"],
    ["a:\n\tb: 1", 2, 1, "tab"],
    ["a: b: c", 1, 4, "another key"],
    ["a: 'open", 1, 9, "closing quote"],
    ["a: [1, 2", 1, 9, "comma or ]"],
    ["a:\n  b: 1\n c: 2", 3, 2, "indentation"],
    ['a: "\\q"', 1, 5, "known escape"],
  ];
  for (const [text, line, column, says] of bad) {
    const r = parseYaml(text);
    assert(r.kind === "err", `${JSON.stringify(text)} was read`);
    assertEquals([r.error.line, r.error.column], [line, column], `${JSON.stringify(text)}: ${formatYamlError(r.error)}`);
    assert(r.error.message.includes(says), `${JSON.stringify(text)}: ${r.error.message}`);
  }
});

proves([YAML], "the writer: block style, text plain only where it reads back as the same text", () => {
  assertEquals(
    toYaml({ a: [1, { b: "x: y", c: [] }], "k k": "true", n: null, e: "", nested: [[1, 2]] }),
    `a:
  - 1
  - b: "x: y"
    c: []
k k: "true"
n: null
e: ""
nested:
  - - 1
    - 2
`,
  );
  assertEquals(toYaml([]), "[]\n");
  for (const s of ["yes", "a b", "x-1", "http://example.com/a"]) assert(isPlainSafe(s), s);
  for (const s of ["true", "1", "~", "- x", "a: b", "a #b", " x", "", "@x", "---", "a\nb"]) assert(!isPlainSafe(s), s);
});

proves([CSV, LAWS], "records written as CSV read back as the same records", () => {
  const field = fc.string({ unit: "binary", maxLength: 10 });
  const records = fc.array(fc.array(field, { minLength: 1, maxLength: 4 }), { maxLength: 5 });
  fc.assert(
    fc.property(records, fc.constantFrom(",", ";", "\t"), fc.constantFrom<"\r\n" | "\n">("\r\n", "\n"), (rs, separator, lineEnding) => {
      assertEquals(parseCsv(toCsv(rs, { separator, lineEnding }), { separator }), { kind: "ok", value: rs });
    }),
  );
});

proves([CSV], "RFC 4180: quotes, doubled quotes, line breaks in fields, a header; what breaks it is named", () => {
  assertEquals(parseCsv('name,quote\r\nAda,"Hello, ""world"""\r\n"multi\nline",x'), {
    kind: "ok",
    value: [
      ["name", "quote"],
      ["Ada", 'Hello, "world"'],
      ["multi\nline", "x"],
    ],
  });
  assertEquals(parseCsv(""), { kind: "ok", value: [] });
  assertEquals(parseCsv("a,,\n"), { kind: "ok", value: [["a", "", ""]] });
  assertEquals(parseCsvRecords("id,name\n1,Ada\n2,Charles\n"), {
    kind: "ok",
    value: [
      { id: "1", name: "Ada" },
      { id: "2", name: "Charles" },
    ],
  });
  const ragged = parseCsvRecords("id,name\n1\n");
  assertEquals(ragged.kind === "err" ? [ragged.error.line, ragged.error.message] : [], [2, "2 fields, as the header has, not 1"]);
  for (const [text, line, column] of [
    ['a,b"c', 1, 4],
    ['"open', 1, 6],
    ['"a"b', 1, 4],
  ] as const) {
    const r = parseCsv(text);
    assert(r.kind === "err", text);
    assertEquals([r.error.line, r.error.column], [line, column], formatCsvError(r.error));
  }
  assertEquals([csvField("plain"), csvField("a,b"), csvField(" lead"), csvField('q"')], ["plain", '"a,b"', '" lead"', '"q"""']);
});

proves([MEDIA], "media types by extension, with a charset for text", () => {
  assertEquals(contentType("site/index.html"), "text/html; charset=UTF-8");
  assertEquals(contentType("book.EPUB"), "application/epub+zip");
  assertEquals(contentType(".svg"), "image/svg+xml; charset=UTF-8");
  assertEquals(contentType("feed.xml"), "application/xml; charset=UTF-8");
  assertEquals(contentType("noext"), "application/octet-stream");
  assertEquals(contentType("archive.tar.gz"), "application/gzip");
  assertEquals(
    [mediaType("woff2"), mediaType("C:\\fonts\\a.ttf"), mediaType(".bashrc"), mediaType("dir.d/file")],
    ["font/woff2", "font/ttf", undefined, undefined],
  );
  assertEquals([extensionOf("a/b.TXT"), extensionOf("a/.hidden"), extensionOf("html"), extensionOf(".md")], ["txt", "", "html", "md"]);
  assert(isTextual("application/json") && isTextual("application/vnd.api+json") && !isTextual("image/png"));
});

proves(["0001-formats FR-019"], "If-Match compares strongly and If-None-Match weakly, as RFC 9110 says", () => {
  const tag = entityTag("abc");
  const weak = entityTag("abc", true);
  assertEquals([tag, weak], ['"abc"', 'W/"abc"']);
  assertEquals(entityTags('"a", W/"b" ,"c"'), ['"a"', 'W/"b"', '"c"']);
  assertEquals(entityTags(" * "), "*");
  assertEquals(
    [
      ifMatch(undefined, tag),
      ifMatch("*", tag),
      ifMatch('"abc"', tag),
      ifMatch('W/"abc"', tag),
      ifMatch('"abc"', weak),
      ifMatch('"x"', tag),
    ],
    [true, true, true, false, false, false],
  );
  assertEquals(
    [ifNoneMatch(null, tag), ifNoneMatch("*", tag), ifNoneMatch('W/"abc"', tag), ifNoneMatch('"abc"', weak), ifNoneMatch('"x", "y"', tag)],
    [true, false, false, false, true],
  );
});
