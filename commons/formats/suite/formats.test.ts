/**
 * Tests of `json5.ts` and `kernel/xml.ts`: what each writer writes, its reader reads back (property-tested), every example of the
 * JSON5 specification is read, JSON5 reads every JSON text as `JSON.parse` does, and what is not JSON5 or XML is named with its place.
 *
 * @module
 */
import fc from "fast-check";
import { formatJson5Error, isJsonObject, type Json, parseJson5, toJson5 } from "../src/json5.ts";
import {
  attribute,
  child,
  children,
  descendants,
  el,
  escapeXml,
  formatXmlError,
  leaf,
  localName,
  readXml,
  textOf,
  writeNode,
  writeXml,
  type XmlElement,
  type XmlNode,
} from "../src/xml.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const J5 = "0001-formats FR-001";
const XML = "0001-formats FR-004";
const LAWS = "0001-core FR-004";

const value = (text: string): Json => {
  const r = parseJson5(text);
  if (r.kind === "err") throw new Error(`${formatJson5Error(r.error)} in ${text}`);
  return r.value;
};

proves([J5, LAWS], "a JSON value written as JSON5 reads back the same; JSON read as JSON5 is what JSON.parse gives", () => {
  const json = fc.jsonValue() as fc.Arbitrary<Json>;
  fc.assert(fc.property(json, fc.string(), (v, comment) => assertEquals(parseJson5(toJson5(v, comment)), { kind: "ok", value: v })));
  fc.assert(
    fc.property(json, (v) =>
      assertEquals(parseJson5(JSON.stringify(v, null, 2)), { kind: "ok", value: JSON.parse(JSON.stringify(v)) as Json }),
    ),
  );
  const special = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 0.5, 1e300);
  fc.assert(fc.property(fc.array(special), (xs) => assertEquals(parseJson5(toJson5(xs)), { kind: "ok", value: xs })));
});

proves([J5], "the examples of the JSON5 specification are read", () => {
  const kitchen = `{
  // comments
  unquoted: 'and you can quote me on that',
  singleQuotes: 'I can use "double quotes" here',
  lineBreaks: "Look, Mom! \\
No \\\\n's!",
  hexadecimal: 0xdecaf,
  leadingDecimalPoint: .8675309, andTrailing: 8675309.,
  positiveSign: +1,
  trailingComma: 'in objects', andIn: ['arrays',],
  "backwardsCompatible": "with JSON",
  /* a block
     comment */
  infinities: [Infinity, -Infinity],
  notANumber: NaN,
  escapes: '\\x41\\u0042\\0\\v\\'',
  $dollar_: 1, ünïcödé: 2, \\u0061scaped: 3,
}`;
  assertEquals(value(kitchen), {
    unquoted: "and you can quote me on that",
    singleQuotes: 'I can use "double quotes" here',
    lineBreaks: "Look, Mom! No \\n's!",
    hexadecimal: 0xdecaf,
    leadingDecimalPoint: 0.8675309,
    andTrailing: 8675309,
    positiveSign: 1,
    trailingComma: "in objects",
    andIn: ["arrays"],
    backwardsCompatible: "with JSON",
    infinities: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
    notANumber: Number.NaN,
    escapes: "AB\0\v'",
    $dollar_: 1,
    ünïcödé: 2,
    ascaped: 3,
  });
  assertEquals(value("-0x10"), -16);
  assertEquals(value("\ufeff // only a value\n 'x' "), "x");
  assertEquals(value('{"__proto__": {"polluted": true}}'), JSON.parse('{"__proto__": {"polluted": true}}') as Json);
  assertEquals(Object.getPrototypeOf(value('{"__proto__": 1}')), Object.prototype);
});

proves([J5], "what is not JSON5 is refused with its line and column", () => {
  const bad: readonly (readonly [string, number, number])[] = [
    ["{a: 1,, }", 1, 7],
    ["[1 2]", 1, 4],
    ["'open", 1, 6],
    ['"line\nbreak"', 1, 6],
    ["01", 1, 2],
    ["/* open", 1, 1],
    ["{1a: 2}", 1, 2],
    ["\\x", 1, 1],
    ["'\\1'", 1, 3],
    ["nulls", 1, 1],
    ["{a: 1}\n  x", 2, 3],
    ["0x", 1, 2],
    ["", 1, 1],
  ];
  for (const [text, line, column] of bad) {
    const r = parseJson5(text);
    assert(r.kind === "err", `${JSON.stringify(text)} was read`);
    assertEquals([r.error.line, r.error.column], [line, column], `${JSON.stringify(text)}: ${formatJson5Error(r.error)}`);
  }
  assertEquals(parseJson5("[".repeat(600)).kind, "err");
});

proves([J5], "the writer: a comment at the head, keys bare where they can be, short lists of plain values on one line", () => {
  assertEquals(
    toJson5({ name: "a", "two words": [1, 2], deep: { list: [{ x: 1 }] }, none: [], empty: {} }, "What this is\n\nand more"),
    `// What this is
//
// and more
{
  name: "a",
  "two words": [1, 2],
  deep: {
    list: [
      {
        x: 1,
      },
    ],
  },
  none: [],
  empty: {},
}
`,
  );
  assertEquals(toJson5(["a".repeat(60), "b".repeat(60)]), `[\n  "${"a".repeat(60)}",\n  "${"b".repeat(60)}",\n]\n`);
  assert(isJsonObject({}) && !isJsonObject([]) && !isJsonObject(null));
});

const xmlName = fc.stringMatching(/^[a-z][a-z0-9-]{0,6}(:[a-z][a-z0-9]{0,4})?$/);
const xmlText = fc.string({ unit: "grapheme", maxLength: 20 }).filter((s) => s.trim() !== "" && escapeXml(s) === escapeXml(s.normalize()));
const xmlTree: fc.Arbitrary<XmlElement> = fc.letrec<{ element: XmlElement }>((tie) => ({
  element: fc.record({
    kind: fc.constant("element" as const),
    name: xmlName,
    attributes: fc.uniqueArray(fc.tuple(xmlName, fc.string({ maxLength: 12 })), { selector: ([k]) => k, maxLength: 3 }),
    children: fc.array(
      fc.oneof(
        { depthSize: "small" },
        xmlText.map((text): XmlNode => ({ kind: "text", text })),
        tie("element"),
      ),
      { maxLength: 3 },
    ),
  }),
})).element;

const FORBIDDEN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8, 11, 12, 14)}-${String.fromCharCode(31)}\ufffe\uffff]`,
  "g",
);

/** A tree as the reader gives it back: neighbouring texts joined, the characters XML forbids removed, white space in attributes as spaces. */
function normal(n: XmlElement): XmlElement {
  const out: XmlNode[] = [];
  for (const c of n.children) {
    if (c.kind === "element") out.push(normal(c));
    else {
      const t = c.text.replace(FORBIDDEN, "").replace(/\r\n?/g, "\n");
      const last = out.at(-1);
      if (last?.kind === "text") out[out.length - 1] = { kind: "text", text: last.text + t };
      else out.push({ kind: "text", text: t });
    }
  }
  const children = out.filter((c) => c.kind === "element" || c.text.trim() !== "");
  const attributes = n.attributes.map(([k, v]): readonly [string, string] => [k, v.replace(FORBIDDEN, "").replace(/\r\n|[\t\n\r]/g, " ")]);
  return { kind: "element", name: n.name, attributes, children };
}

proves([XML, LAWS], "a tree written and read back is the same tree", () => {
  fc.assert(fc.property(xmlTree, (t) => assertEquals(readXml(writeXml(t)), { kind: "ok", value: normal(t) })));
});

proves([XML], "the reader: entities, references, CDATA, comments, prefixes, white space; the finders", () => {
  const doc = `<?xml version="1.0"?>
<!DOCTYPE package>
<!-- before -->
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version='3.0'>
  <opf:metadata>
    <dc:title>Ada &amp; Charles &#x2014; &#169;<![CDATA[ <raw> & ]]></dc:title>
    <dc:creator id="c1">A<!-- inside -->B</dc:creator>
  </opf:metadata>
  <opf:manifest><opf:item id="i" href="a b.xhtml"/></opf:manifest>
</opf:package>
<?pi after?>`;
  const r = readXml(doc);
  if (r.kind === "err") throw new Error(formatXmlError(r.error));
  const root = r.value;
  assertEquals([root.name, localName(root.name), attribute(root, "version")], ["opf:package", "package", "3.0"]);
  const meta = child(root, "metadata");
  assertEquals(textOf(child(meta ?? root, "title")), "Ada & Charles — © <raw> & ");
  assertEquals(textOf(child(meta ?? root, "creator")), "AB");
  assertEquals(attribute(descendants(root, "item")[0], "href"), "a b.xhtml");
  assertEquals(children(root, "metadata").length, 1);
  assertEquals(child(root, "nothing"), undefined);
  assertEquals(textOf(undefined), "");
  const kept = readXml("<a> <b/> </a>", { keepWhitespace: true });
  assertEquals(kept.kind === "ok" ? kept.value.children.length : 0, 3);
});

proves([XML], "what is not well formed, or would expand an entity, is refused with its line and column", () => {
  const bad: readonly (readonly [string, number, number])[] = [
    ["<a><b></a>", 1, 9],
    ["<a>", 1, 4],
    ["<a x='1' x='2'/>", 1, 10],
    ["<a x=1/>", 1, 6],
    ["<a>&nbsp;</a>", 1, 4],
    ["<a>&amp</a>", 1, 4],
    ['<!DOCTYPE a [<!ENTITY e "x">]>\n<a>&e;</a>', 1, 1],
    ["<a/><b/>", 1, 5],
    ["text", 1, 1],
    ["<a x='<'/>", 1, 7],
    ["<a>\n  <!-- open\n</a>", 2, 3],
  ];
  for (const [text, line, column] of bad) {
    const r = readXml(text);
    assert(r.kind === "err", `${JSON.stringify(text)} was read`);
    assertEquals([r.error.line, r.error.column], [line, column], `${JSON.stringify(text)}: ${formatXmlError(r.error)}`);
  }
});

proves([XML], "the writer escapes every value and drops what XML forbids", () => {
  assertEquals(escapeXml(`<a href="x">'&'\u0001</a>`), "&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
  assertEquals(
    writeNode(el("p", ["a<b", 1, true, undefined, leaf("i", undefined), leaf("b", 2)], [["title", '"q"']])),
    '<p title="&quot;q&quot;">a&lt;b1true<b>2</b></p>',
  );
  assertEquals(writeXml(el("empty")), '<?xml version="1.0" encoding="UTF-8"?>\n<empty/>');
});
