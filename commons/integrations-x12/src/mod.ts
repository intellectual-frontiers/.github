// Spec: 0001-integrations-x12-skeleton FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The X12 envelope and acknowledgement skeleton of Integrations (commons integrations-x12 0001-integrations-x12-skeleton): the entries of X12 and of the HIPAA 5010 and
 * purchasing transaction sets with their licence as data, a codec for the fixed-width ISA envelope and the ISA, GS and ST levels, the control counts checked as findings, TA1
 * and 999 made and read, and a loader of a schema from the user's own transcription of a licensed guide. It embeds no transaction set, guide or companion guide of X12.
 *
 * @remarks
 * The delimiters are read from the ISA by position (`delimitersOf`) and kept on the envelope, and the codec writes with them; nothing assumes `*` or `~`. Elements are not split into components. A transaction's children are its segments between ST and SE, flat: loops (the HL loops of the 837) are the schema's, Planned.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseStandardUrn, ref, type EmbeddedContent, type Standard, type StandardUrn } from "@intellectual-frontiers/integrations/governance";
import {
  element,
  finding,
  segment,
  textOf,
  member,
  type AckPort,
  type Acknowledgement,
  type AckStatus,
  type Codec,
  type Constraint,
  type Envelope,
  type Finding,
  type Group,
  type Interchange,
  type Json,
  type Loader,
  type Part,
  type Schema,
  type Segment,
  type StandardsPlugin,
  type SyntaxProblem,
  type Transaction,
} from "@intellectual-frontiers/integrations/logical";

function urn(text: string): StandardUrn {
  const r = parseStandardUrn(text);
  if (r.kind === "err") throw new Error(`a constant of the plugin is not a standard urn: ${text}`);
  return r.value;
}

/** The X12 syntax, version 005010. */
export const X12_SYNTAX = urn("urn:standard:x12:edi:005010");

/** The transaction sets of the plugin: the HIPAA 5010 set and the purchasing documents. */
export const TRANSACTION_SETS = ["837", "835", "270", "271", "834", "850", "810", "856"] as const;
/** A transaction set the plugin lists. */
export type TransactionSet = (typeof TRANSACTION_SETS)[number];

/** The urn of a transaction set's schema. */
export const setUrn = (set: TransactionSet): StandardUrn => urn(`urn:standard:x12:${set}:005010`);

const TERMS = "X12 sells its transaction set standards, implementation guides and companion guides (https://x12.org). They are licensed to their buyer, so this library never embeds them: a schema is read from the user's own copy.";
const base = { issuer: "x12", version: "005010", location: "https://x12.org/", license: { spdx: "LicenseRef-X12-licensed", embedding: "user-supplied", terms: TERMS }, sha256: undefined } as const;

/** The standards the plugin registers. */
export const STANDARDS: readonly Standard[] = [
  { ...base, urn: X12_SYNTAX, level: "syntax", family: "message", title: "X12 interchange syntax", basis: { kind: "unaligned", reason: "the standard itself" } },
  ...TRANSACTION_SETS.map((s): Standard => ({ ...base, urn: setUrn(s), level: "schema", family: "message", title: `X12 ${s} transaction set`, basis: { kind: "unaligned", reason: "the standard itself" } })),
];

/** The files of standards content the package embeds: none. */
export const EMBEDDED: readonly EmbeddedContent[] = [];

const failure = (code: SyntaxProblem["code"], offset = 0): SyntaxProblem => ({ kind: "syntax", code, offset });

/** The widths of the sixteen elements of the ISA. */
const ISA_WIDTHS = [2, 10, 2, 10, 2, 15, 2, 15, 6, 4, 1, 5, 9, 1, 1, 1] as const;

const pad = (n: number): string => String(n).padStart(2, "0");
const seg = (id: string, ...values: readonly string[]): Segment => segment(id, ...values.map((v, i) => element(pad(i + 1), v)));
const valueAt = (s: Segment | undefined, n: number): string => s?.elements[n - 1]?.value ?? "";

function parseSegments(text: string, element: string, terminator: string): readonly Segment[] {
  return text.split(terminator).map((s) => s.trim()).filter((s) => s !== "").map((s) => {
    const [id = "", ...values] = s.split(element);
    return seg(id, ...values);
  });
}

const isDelimiter = (c: string | undefined): c is string => c !== undefined && c.length === 1 && !/[A-Za-z0-9\s]/.test(c);

/**
 * The delimiters of an interchange, read from its ISA by position as the standard fixes them: the element separator is the character after `ISA` (position 3), the component separator is
 * ISA16 (position 104), the segment terminator is the character after ISA16 (position 105), and the repetition separator is ISA11 where the version in ISA12 is 00501 or later (before it,
 * ISA11 is a standards identifier). They are four different characters that are not letters, digits or white space; nothing is assumed.
 */
export function delimitersOf(text: string): Result<Readonly<Record<string, string>>, SyntaxProblem> {
  const element = text[3];
  const component = text[104];
  const segment = text[105];
  if (!isDelimiter(element)) return err(failure("bad-delimiter", 3));
  if (!isDelimiter(component) || component === element) return err(failure("bad-delimiter", 104));
  if (!isDelimiter(segment) || segment === element || segment === component) return err(failure("bad-delimiter", 105));
  const parts = text.slice(0, 105).split(element);
  const repetition = parts[11];
  const version = parts[12] ?? "";
  const hasRepetition = /^\d{5}$/.test(version) && version >= "00501" && isDelimiter(repetition) && repetition !== element && repetition !== component && repetition !== segment;
  return ok(hasRepetition && repetition !== undefined ? { element, component, segment, repetition } : { element, component, segment });
}

/** The X12 codec. */
export const codec: Codec = {
  syntax: ref("syntax", X12_SYNTAX),
  parse: (text) => {
    if (text.trim() === "") return err(failure("empty"));
    if (text.length < 106 || !text.startsWith("ISA")) return err(failure("bad-envelope"));
    const delimiters = delimitersOf(text);
    if (delimiters.kind === "err") return delimiters;
    const segs = parseSegments(text, delimiters.value["element"] ?? "", delimiters.value["segment"] ?? "");
    const isa = segs[0];
    if (isa === undefined || isa.id !== "ISA" || isa.elements.length !== 16) return err(failure("bad-envelope"));
    for (const [i, w] of ISA_WIDTHS.entries()) if ((isa.elements[i]?.value.length ?? -1) !== w) return err(failure("bad-envelope", i + 1));
    const header: Segment[] = [isa];
    const trailer: Segment[] = [];
    const groups: Group[] = [];
    let group: { id: string; control: string; header: Segment[]; transactions: Transaction[] } | undefined;
    let tx: { id: string; control: string; header: Segment[]; children: Segment[] } | undefined;
    for (const s of segs.slice(1)) {
      switch (s.id) {
        case "GS":
          if (group !== undefined || tx !== undefined) return err(failure("unbalanced"));
          group = { id: valueAt(s, 1), control: valueAt(s, 6), header: [s], transactions: [] };
          break;
        case "ST":
          if (group === undefined || tx !== undefined) return err(failure("unbalanced"));
          tx = { id: valueAt(s, 1), control: valueAt(s, 2), header: [s], children: [] };
          break;
        case "SE":
          if (group === undefined || tx === undefined) return err(failure("unbalanced"));
          group.transactions.push({ kind: "transaction", id: tx.id, control: tx.control, children: tx.children, envelope: { header: tx.header, trailer: [s] } });
          tx = undefined;
          break;
        case "GE":
          if (group === undefined || tx !== undefined) return err(failure("unbalanced"));
          groups.push({ kind: "group", id: group.id, control: group.control, transactions: group.transactions, envelope: { header: group.header, trailer: [s] } });
          group = undefined;
          break;
        case "IEA":
          if (group !== undefined || tx !== undefined) return err(failure("unbalanced"));
          trailer.push(s);
          break;
        default:
          if (tx !== undefined) tx.children.push(s);
          else if (group !== undefined) return err(failure("bad-structure"));
          else if (groups.length === 0 && trailer.length === 0) header.push(s);
          else trailer.splice(trailer.length, 0, s);
      }
    }
    if (group !== undefined || tx !== undefined || trailer.at(-1)?.id !== "IEA") return err(failure("unexpected-end"));
    return ok({ kind: "interchange", syntax: ref("syntax", X12_SYNTAX), control: valueAt(isa, 13), groups, envelope: { header, trailer, delimiters: delimiters.value } });
  },
  serialize: (i) => {
    const out: string[] = [];
    const element = i.envelope?.delimiters?.["element"];
    const terminator = i.envelope?.delimiters?.["segment"];
    if (element === undefined || terminator === undefined) return err(failure("bad-delimiter"));
    const line = (s: Segment): string => `${[s.id, ...s.elements.map((e) => e.value)].join(element)}${terminator}`;
    const put = (env: Envelope | undefined, side: "header" | "trailer"): void => void out.push(...(env?.[side] ?? []).map(line));
    if (i.envelope === undefined || i.envelope.header[0]?.id !== "ISA") return err(failure("bad-envelope"));
    put(i.envelope, "header");
    for (const g of i.groups) {
      put(g.envelope, "header");
      for (const t of g.transactions) {
        put(t.envelope, "header");
        for (const p of t.children) {
          if (p.kind !== "segment") return err(failure("bad-structure"));
          out.push(line(p));
        }
        put(t.envelope, "trailer");
      }
      put(g.envelope, "trailer");
    }
    put(i.envelope, "trailer");
    return ok(`${out.join("\n")}\n`);
  },
};

/** The findings of the control counts of an interchange: IEA against the groups and the ISA, GE against its transactions and the GS, SE against its segments and the ST. Paths and codes only. */
export function envelopeFindings(i: Interchange): readonly Finding[] {
  const out: Finding[] = [];
  const bad = (path: string): void => void out.push(finding("syntax", "error", "syntax-error", path, "control count or number does not agree"));
  const iea = i.envelope?.trailer.find((s) => s.id === "IEA");
  if (valueAt(iea, 1) !== String(i.groups.length)) bad("IEA.01");
  if (valueAt(iea, 2) !== valueAt(i.envelope?.header[0], 13)) bad("IEA.02");
  for (const g of i.groups) {
    const ge = g.envelope?.trailer[0];
    if (valueAt(ge, 1) !== String(g.transactions.length)) bad("GE.01");
    if (valueAt(ge, 2) !== valueAt(g.envelope?.header[0], 6)) bad("GE.02");
    for (const t of g.transactions) {
      const se = t.envelope?.trailer[0];
      if (valueAt(se, 1) !== String(t.children.length + 2)) bad("SE.01");
      if (valueAt(se, 2) !== valueAt(t.envelope?.header[0], 2)) bad("SE.02");
    }
  }
  return out;
}

const STATUS_CODE = { accepted: "A", "accepted-with-errors": "E", rejected: "R" } as const;

function isaFor(received: Interchange): Segment {
  const isa = received.envelope?.header[0];
  const v = (n: number): string => valueAt(isa, n);
  // the answer goes back: the receiver's identifier is the sender's, and the other way round
  return seg("ISA", v(1), v(2), v(3), v(4), v(7), v(8), v(5), v(6), v(9), v(10), v(11), v(12), v(13), "0", v(15), v(16));
}

function interchangeOf(received: Interchange, isa: Segment, header: readonly Segment[], groups: readonly Group[], control: string): Interchange {
  const delimiters = received.envelope?.delimiters;
  return { kind: "interchange", syntax: ref("syntax", X12_SYNTAX), control, groups, envelope: { header: [isa, ...header], trailer: [seg("IEA", String(groups.length), valueAt(isa, 13))], ...(delimiters === undefined ? {} : { delimiters }) } };
}

/** A TA1: the acknowledgement of an interchange envelope: its control number, date and time, the status and a note code (`000` where there is no error, `001` otherwise; the detailed codes are Planned). */
export function ta1(received: Interchange, status: AckStatus): Interchange {
  const isa = received.envelope?.header[0];
  const note = status === "accepted" ? "000" : "001";
  return interchangeOf(received, isaFor(received), [seg("TA1", valueAt(isa, 13), valueAt(isa, 9), valueAt(isa, 10), STATUS_CODE[status], note)], [], valueAt(isa, 13));
}

/** A 999: the acknowledgement of each group of an interchange, AK1 for the group, AK9 for its status and counts. */
export function ack999(received: Interchange, status: AckStatus): Interchange {
  const groups = received.groups.map((g, n): Group => {
    const count = String(g.transactions.length);
    const accepted = status === "rejected" ? "0" : count;
    const children: Part[] = [seg("AK1", g.id, g.control), seg("AK9", STATUS_CODE[status], count, count, accepted)];
    const tx: Transaction = { kind: "transaction", id: "999", control: pad(n + 1).padStart(4, "0"), children, envelope: { header: [seg("ST", "999", pad(n + 1).padStart(4, "0"))], trailer: [seg("SE", String(children.length + 2), pad(n + 1).padStart(4, "0"))] } };
    return { kind: "group", id: "FA", control: String(n + 1), transactions: [tx], envelope: { header: [seg("GS", "FA", "SENDER", "RECEIVER", "20260101", "1200", String(n + 1), "X", "005010X231A1")], trailer: [seg("GE", "1", String(n + 1))] } };
  });
  return interchangeOf(received, isaFor(received), [], groups, valueAt(received.envelope?.header[0], 13));
}

const statusOfCode = (c: string): AckStatus => (c === "A" ? "accepted" : c === "E" ? "accepted-with-errors" : "rejected");

/** The acknowledgement port of X12: a 999 where the interchange has groups, a TA1 where it has none; TA1 and 999 read back. */
export const acks: AckPort = {
  acknowledge: (received, status) => ok(received.groups.length > 0 ? ack999(received, status) : ta1(received, status)),
  read: (i) => {
    const out: Acknowledgement[] = [];
    const t = i.envelope?.header.find((s) => s.id === "TA1");
    if (t !== undefined) out.push({ kind: "x12-ta1", control: valueAt(t, 1), status: statusOfCode(valueAt(t, 4)), note: valueAt(t, 5) });
    for (const g of i.groups) {
      for (const tx of g.transactions) {
        if (tx.id !== "999") continue;
        const ak1 = tx.children.find((c) => c.kind === "segment" && c.id === "AK1");
        const ak9 = tx.children.find((c) => c.kind === "segment" && c.id === "AK9");
        if (ak1?.kind !== "segment" || ak9?.kind !== "segment") return err(failure("bad-structure"));
        out.push({ kind: "x12-999", control: tx.control, groupControl: valueAt(ak1, 2), status: statusOfCode(valueAt(ak9, 1)), errors: Math.max(0, Number(valueAt(ak9, 2)) - Number(valueAt(ak9, 4))) });
      }
    }
    return out.length === 0 ? err(failure("bad-structure")) : ok(out);
  },
};

function loadSchema(standard: StandardUrn, set: TransactionSet, text: string): Result<{ readonly schemas: readonly Schema[]; readonly profiles: readonly []; readonly terminologies: readonly [] }, { readonly kind: "malformed"; readonly standard: StandardUrn; readonly code: "not-json" | "wrong-resource" | "no-elements" }> {
  const bad = (code: "not-json" | "wrong-resource" | "no-elements") => err({ kind: "malformed" as const, standard, code });
  let j: Json;
  try {
    j = JSON.parse(text) as Json;
  } catch {
    return bad("not-json");
  }
  const list = member(j, "segments");
  if (textOf(j, "transaction") !== set) return bad("wrong-resource");
  if (!Array.isArray(list) || list.length === 0) return bad("no-elements");
  const paths: string[] = [set];
  const constraints: Constraint[] = [];
  for (const s of list) {
    const id = textOf(s, "id");
    const min = member(s, "min");
    const max = member(s, "max");
    if (id === undefined || typeof min !== "number") return bad("no-elements");
    paths.push(`${set}.${id}`);
    constraints.push({ kind: "cardinality", path: `${set}.${id}`, min, max: max === ">1" || max === "*" ? "*" : typeof max === "number" ? max : 1 });
  }
  return ok({ schemas: [{ id: ref("schema", standard), transaction: set, paths, constraints }], profiles: [], terminologies: [] });
}

/** The loaders of the transaction sets: each reads the user's own transcription of the segments of a set from a licensed guide (`{transaction, segments: [{id, min, max}]}`); nothing of a guide is in the package. */
export const loaders: readonly Loader[] = TRANSACTION_SETS.map((set): Loader => ({ standard: setUrn(set), load: (s) => loadSchema(s.standard, set, s.text) }));

/** The plugin of X12. */
export const x12Plugin: StandardsPlugin = { id: "x12", standards: STANDARDS, codec, loaders, acks };
