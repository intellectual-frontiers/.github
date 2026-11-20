/**
 * Tests of the X12 skeleton (commons integrations-x12 0001-integrations-x12-skeleton FR-001 to FR-006): the entries and their licence, the fixed-width envelope read and written
 * back, the control counts, TA1 and 999, the loader of a user's own transcription and its refusal from an embedded source. The interchange is made up: the identifiers are
 * placeholders and no real party, claim or person is in it.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { embeddingFindings, register, sourceAllowed, type StandardsRegistry } from "@intellectual-frontiers/integrations/governance";
import { conformPlugin, loadFrom, registerPlugin, statusOf, validate, transactionsOf, type Interchange } from "@intellectual-frontiers/integrations/logical";
import { EMBEDDED, STANDARDS, TRANSACTION_SETS, X12_SYNTAX, acks, ack999, codec, delimitersOf, envelopeFindings, setUrn, ta1, x12Plugin } from "../src/mod.ts";

const W = [2, 10, 2, 10, 2, 15, 2, 15, 6, 4, 1, 5, 9, 1, 1, 1];
const isa = (values: readonly string[]): string => `ISA*${values.map((v, i) => v.padEnd(W[i] ?? 0)).join("*")}~`;
const ISA = isa(["00", "", "00", "", "ZZ", "SENDERID", "ZZ", "RECEIVERID", "260101", "1200", "^", "00501", "000000001", "0", "T", ":"]);

/** A made-up purchase order, set 850, in one group. */
const ORDER = [ISA.slice(0, -1), "GS*PO*SENDERID*RECEIVERID*20260101*1200*1*X*005010", "ST*850*0001", "BEG*00*SA*PO-123**20260101", "N1*BY*Zyxwvut Supplies", "PO1*1*5*EA*9.99**VP*WIDGET", "SE*5*0001", "GE*1*1", "IEA*1*000000001", ""].join("~\n").replace("~\n\n", "~\n");

proves(["0001-integrations-x12-skeleton FR-001"], "the entries carry a licence as data that refuses embedding, and nothing is embedded", () => {
  assertEquals(STANDARDS.length, 1 + TRANSACTION_SETS.length);
  for (const s of STANDARDS) {
    assertEquals(s.license.embedding, "user-supplied");
    assert(!sourceAllowed(s.license, "embedded-in-package"));
    assert(s.license.terms.includes("x12.org"));
  }
  assertEquals(EMBEDDED, []);
  const reg = STANDARDS.reduce<StandardsRegistry>((r, s) => {
    const x = register(r, s);
    return x.kind === "ok" ? x.value : r;
  }, new Map());
  assertEquals(reg.size, 9);
  assertEquals(embeddingFindings(reg, [{ path: "guides/837.json", standard: setUrn("837") }]).length, 1, "an embedded guide would be refused");
  assertEquals(registerPlugin(new Map(), x12Plugin).kind, "ok");
});

proves(["0001-integrations-x12-skeleton FR-002", "0001-integrations-x12-skeleton FR-003"], "the envelope is read and written back, and the plugin passes the conformance suite", () => {
  const parsed = codec.parse(ORDER);
  assert(parsed.kind === "ok");
  assertEquals(parsed.value.control, "000000001");
  assertEquals(parsed.value.groups.map((g) => [g.id, g.control]), [["PO", "1"]]);
  const t = transactionsOf(parsed.value)[0];
  assert(t !== undefined);
  assertEquals([t.id, t.control, t.children.map((c) => c.id)], ["850", "0001", ["BEG", "N1", "PO1"]]);
  const written = codec.serialize(parsed.value);
  assert(written.kind === "ok");
  assertEquals(written.value, ORDER);
  assertEquals(conformPlugin(x12Plugin, { valid: [ORDER], garbage: ["", "ISA", "Hello, I am not X12 at all, SECRETVALUE", `${ISA.replace("ISA*", "ISA|")}`] }), []);
});

proves(["0001-integrations-x12-skeleton FR-004"], "a syntax failure holds a code and an offset and none of the text", () => {
  const delim = codec.parse(ISA.replace("ISA*", "ISAA") + "GS*PO~");
  assert(delim.kind === "err" && delim.error.code === "bad-delimiter" && delim.error.offset === 3);
  const term = codec.parse(ISA.slice(0, 105) + "A" + "IEA*0*000000001~");
  assert(term.kind === "err" && term.error.code === "bad-delimiter");
  const width = codec.parse(ORDER.replace("SENDERID       ", "SENDERID      "));
  assert(width.kind === "err" && (width.error.code === "bad-envelope" || width.error.code === "bad-delimiter"), "a shifted fixed width is refused");  const open = codec.parse(ORDER.replace("SE*5*0001~\n", ""));
  assert(open.kind === "err" && open.error.code === "unbalanced");
  const noend = codec.parse(ORDER.replace("IEA*1*000000001~\n", ""));
  assert(noend.kind === "err" && noend.error.code === "unexpected-end");
  assert(!JSON.stringify(delim).includes("PO"));
});

proves(["0001-integrations-x12-skeleton FR-005"], "the control counts are checked as findings with paths and codes only", () => {
  const good = codec.parse(ORDER);
  assert(good.kind === "ok");
  assertEquals(envelopeFindings(good.value), []);
  const bad = codec.parse(ORDER.replace("SE*5*0001", "SE*9*0002").replace("GE*1*1", "GE*2*7").replace("IEA*1*000000001", "IEA*3*000000009"));
  assert(bad.kind === "ok");
  assertEquals(envelopeFindings(bad.value).map((f) => f.path).sort(), ["GE.01", "GE.02", "IEA.01", "IEA.02", "SE.01", "SE.02"]);
  assert(envelopeFindings(bad.value).every((f) => !f.message.includes("Zyxwvut")));
});

function reparsed(i: Interchange): Interchange {
  const w = codec.serialize(i);
  assert(w.kind === "ok");
  const p = codec.parse(w.value);
  assert(p.kind === "ok");
  return p.value;
}

proves(["0001-integrations-x12-skeleton FR-006"], "TA1 and 999 are made, written, read back, and the licensed-schema loader refuses an embedded source", () => {
  const received = codec.parse(ORDER);
  assert(received.kind === "ok");
  for (const status of ["accepted", "accepted-with-errors", "rejected"] as const) {
    const t = reparsed(ta1(received.value, status));
    const r = acks.read(t);
    assert(r.kind === "ok");
    const first = r.value[0];
    assert(first !== undefined);
    assertEquals([first.kind, statusOf(first)], ["x12-ta1", status]);
    const n = reparsed(ack999(received.value, status));
    assertEquals(envelopeFindings(n), []);
    const r9 = acks.read(n);
    assert(r9.kind === "ok");
    const nine = r9.value[0];
    assert(nine !== undefined);
    assertEquals([nine.kind, statusOf(nine)], ["x12-999", status]);
    assert(!JSON.stringify(r9).includes("Zyxwvut"));
  }
  const viaPort = acks.acknowledge(received.value, "accepted");
  assert(viaPort.kind === "ok" && viaPort.value.groups[0]?.transactions[0]?.id === "999");
  assertEquals(acks.read(received.value).kind, "err");

  const mine = JSON.stringify({ transaction: "850", segments: [{ id: "BEG", min: 1, max: 1 }, { id: "N1", min: 0, max: ">1" }, { id: "PO1", min: 1, max: ">1" }] });
  assertEquals(loadFrom(x12Plugin, { origin: "embedded-in-package", standard: setUrn("850"), text: mine }).kind, "err");
  const defs = loadFrom(x12Plugin, { origin: "user-supplied", standard: setUrn("850"), text: mine });
  assert(defs.kind === "ok");
  const schema = defs.value.schemas[0];
  assert(schema !== undefined);
  const t = transactionsOf(received.value)[0];
  assert(t !== undefined);
  assertEquals(validate(t, schema), []);
  const short = codec.parse(ORDER.replace("BEG*00*SA*PO-123**20260101~\n", "").replace("SE*5*0001", "SE*4*0001"));
  assert(short.kind === "ok");
  assertEquals(validate(transactionsOf(short.value)[0] ?? t, schema).map((f) => f.code), ["cardinality-min"]);
  assertEquals(loadFrom(x12Plugin, { origin: "user-supplied", standard: setUrn("850"), text: "nope" }).kind, "err");
  assertEquals(loadFrom(x12Plugin, { origin: "user-supplied", standard: setUrn("850"), text: JSON.stringify({ transaction: "810", segments: [] }) }).kind, "err");
  assertEquals(x12Plugin.codec.syntax.urn, X12_SYNTAX);
});

proves(["0001-integrations-x12-skeleton FR-002", "0001-integrations-x12-skeleton FR-006"], "the delimiters are read from the ISA by position, the codec writes with them, and the acknowledgements keep them", () => {
  // element separator `|`, component separator `>`, segment terminator `!`, repetition separator `^`, version 00501
  const text = ORDER.replaceAll("*", "|").replaceAll("~", "!").replace("|:!", "|>!");
  const d = delimitersOf(text);
  assert(d.kind === "ok");
  assertEquals(d.value, { element: "|", component: ">", segment: "!", repetition: "^" });
  const parsed = codec.parse(text);
  assert(parsed.kind === "ok");
  assertEquals(parsed.value.envelope?.delimiters, { element: "|", component: ">", segment: "!", repetition: "^" });
  assertEquals(transactionsOf(parsed.value)[0]?.children.map((c) => c.id), ["BEG", "N1", "PO1"]);
  const written = codec.serialize(parsed.value);
  assert(written.kind === "ok");
  assertEquals(written.value, text);
  assertEquals(envelopeFindings(parsed.value), []);
  const nine = ack999(parsed.value, "accepted");
  const out = codec.serialize(nine);
  assert(out.kind === "ok" && out.value.startsWith("ISA|") && out.value.includes("!\nGS|FA|"), "an acknowledgement is written with the delimiters received");
  assertEquals(acks.read(nine).kind, "ok");
  // before version 00501 ISA11 is a standards identifier, not a repetition separator
  const old = delimitersOf(text.replace("|00501|", "|00401|"));
  assert(old.kind === "ok" && old.value["repetition"] === undefined);
  // the delimiters are four different characters that are not letters, digits or white space
  assertEquals(delimitersOf(text.replace("|>!", "||!")).kind, "err");
  assertEquals(delimitersOf(text.replace("|>!", "|>>")).kind, "err");
  assertEquals(codec.serialize({ ...parsed.value, envelope: { header: parsed.value.envelope?.header ?? [], trailer: [] } }).kind, "err");
});
