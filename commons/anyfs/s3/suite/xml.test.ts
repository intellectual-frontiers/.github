/**
 * Tests of the reader of the XML that S3 answers with (commons anyfs-s3 0002-anyfs-s3-store FR-003): it reads the listing and the error as S3 writes them, and refuses everything an answer of S3 never has and an attacker
 * would use, within bounds it states.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { DEFAULT_LIMITS, parseErrorBody, parseListing, parseXml } from "../src/mod.ts";

const LISTING = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>b</Name><Prefix>p/</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextContinuationToken>abc</NextContinuationToken>
<Contents><Key>p/a%20b</Key><LastModified>2026-11-21T10:00:00.000Z</LastModified><ETag>&quot;d41d8cd98f00b204e9800998ecf8427e&quot;</ETag><Size>0</Size><StorageClass>STANDARD</StorageClass></Contents>
<Contents><Key>p/&amp;&lt;x&gt;</Key><ETag>"abc"</ETag><Size>12</Size></Contents></ListBucketResult>`;

proves(["0002-anyfs-s3-store FR-003"], "a listing is read as S3 writes it: the keys as given, the entity tags without their quotes, the sizes, the token and whether it is cut off", () => {
  const r = parseListing(LISTING);
  assert(r.kind === "ok", "the listing is read");
  assertEquals(r.value.truncated, true);
  assertEquals(r.value.next, "abc");
  assertEquals(r.value.objects.map((o) => [o.key, o.size, o.etag]), [["p/a%20b", 0, "d41d8cd98f00b204e9800998ecf8427e"], ["p/&<x>", 12, "abc"]]);
  assertEquals(r.value.objects[0]?.modified, "2026-11-21T10:00:00.000Z");
});

proves(["0002-anyfs-s3-store FR-003"], "an error is read as its code, message and request id, and an answer that is neither a listing nor an error is said to be the other thing", () => {
  assertEquals(parseErrorBody("<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><RequestId>R1</RequestId><Key>x</Key></Error>"), { kind: "ok", value: { code: "NoSuchKey", message: "The specified key does not exist.", requestId: "R1" } });
  assertEquals(parseErrorBody("<Error><Message>no code</Message></Error>").kind, "err");
  assertEquals(parseListing("<Error><Code>X</Code></Error>").kind, "err");
  assertEquals(parseErrorBody(LISTING).kind, "err");
});

proves(["0002-anyfs-s3-store FR-003"], "text is kept as written in a leaf (a key with spaces at its ends) and the five named entities and numeric references are read, and nothing else is an entity", () => {
  const r = parseXml("<a><k> x &amp; &#65;&#x42;&#128512; </k><e/></a>");
  assert(r.kind === "ok");
  assertEquals(r.value.children[0]?.text, " x & AB😀 ");
  for (const bad of ["<a>&nbsp;</a>", "<a>&#0;</a>", "<a>&#xD800;</a>", "<a>&#1;</a>", "<a>&amp</a>", "<a>&#99999999;</a>"]) assertEquals(parseXml(bad).kind, "err", bad);
});

proves(["0002-anyfs-s3-store FR-003"], "hostile documents are refused: a document type with entities (the billion laughs and the external entity), a comment, CDATA, an instruction, text after the root, an unclosed or mismatched tag, a lone surrogate", () => {
  const hostile = [
    '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><lolz>&lol2;</lolz>',
    '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    "<a><!-- c --></a>",
    "<a><![CDATA[x]]></a>",
    "<a><?php x ?></a>",
    "<a/>trailing",
    "<a><b></a>",
    "<a><b></c></a>",
    "<a>\ud800</a>",
    "<a>\u0001</a>",
    "",
    "no markup",
    "<a b=c></a>",
  ];
  for (const doc of hostile) assertEquals(parseXml(doc).kind, "err", doc.slice(0, 40));
});

proves(["0002-anyfs-s3-store FR-003"], "a document past a bound of size, depth or number of elements is refused, and one at the bound is read", () => {
  assertEquals(parseXml(`<a>${"x".repeat(100)}</a>`, { maxBytes: 50, maxDepth: 16, maxNodes: 100 }).kind, "err");
  assertEquals(parseXml("<a>".repeat(17) + "</a>".repeat(17)).kind, "err");
  assertEquals(parseXml("<a>".repeat(16) + "</a>".repeat(16)).kind, "ok");
  assertEquals(parseXml(`<a>${"<b/>".repeat(DEFAULT_LIMITS.maxNodes)}</a>`).kind, "err");
  assertEquals(parseXml("<a>" + "<b/>".repeat(1000) + "</a>").kind, "ok");
});

proves(["0002-anyfs-s3-store FR-003"], "property: reading text never throws, and a name or a text made of any characters that XML allows survives a write and a read", () => {
  fc.assert(fc.property(fc.string({ unit: "binary" }), (s) => {
    const r = parseXml(s);
    return r.kind === "ok" || r.kind === "err";
  }), { numRuns: 300 });
  const allowed = (c: number): boolean => c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);
  const text = fc.string({ unit: "grapheme" }).filter((s) => s.isWellFormed() && [...s].every((ch) => allowed(ch.codePointAt(0) ?? 0)));
  fc.assert(fc.property(text, (s) => {
    const escaped = s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const r = parseXml(`<a><k>${escaped}</k></a>`);
    return r.kind === "ok" && r.value.children[0]?.text === s;
  }), { numRuns: 300 });
});
