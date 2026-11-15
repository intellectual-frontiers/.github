// A strict reader of the Turtle the commons ontology is written in, and the graph it makes.
//
// There is no Turtle parser in Deno's standard library, and the ontology uses a small part of Turtle: `@prefix`, absolute IRIs, prefixed names, `a`, `;` and `,`,
// strings (in any of the four quotings, with their escapes) with an optional language tag or datatype, integers and booleans. This reads exactly that and refuses everything
// else (blank nodes, collections, `@base` and relative IRIs, decimals and doubles) by line and column, so that a construct it does not know is never read wrongly.
// Literals are kept as rdflib keeps them, which the tables were first generated with: an integer's or a boolean's text is its canonical form, and a triple is in the
// graph once, in the order it was first read.
import { assertNever, type Brand, brand, err, ok, type Result } from "./core.ts";

/** An absolute IRI. */
export type Iri = Brand<string, "Iri">;
/** A string read as an absolute IRI (the reader has checked it, or expanded it from a declared prefix). */
export const iri = (checked: string): Iri => brand<"Iri">(checked);

export const XSD = "http://www.w3.org/2001/XMLSchema#";
const XSD_STRING = `${XSD}string`;
const XSD_INTEGER = `${XSD}integer`;
const XSD_BOOLEAN = `${XSD}boolean`;
export const RDF_TYPE = iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

/** A term of the graph: an IRI or a literal (a plain one has neither a language nor a datatype). */
export type Term =
  | { readonly kind: "iri"; readonly iri: Iri }
  | {
    readonly kind: "literal";
    readonly text: string;
    readonly tag: { readonly kind: "plain" } | { readonly kind: "lang"; readonly lang: string } | { readonly kind: "typed"; readonly datatype: Iri };
  };

/** A term's text, as rdflib's `str()` gives it: an IRI itself, or a literal's lexical form. */
export const textOf = (t: Term): string => (t.kind === "iri" ? t.iri : t.text);

function keyOf(t: Term): string {
  if (t.kind === "iri") return `<${t.iri}>`;
  switch (t.tag.kind) {
    case "plain":
      return `"${t.text}"`;
    case "lang":
      return `"${t.text}"@${t.tag.lang}`;
    case "typed":
      return `"${t.text}"^^${t.tag.datatype}`;
    default:
      return assertNever(t.tag);
  }
}

/** The triples of one or more documents, each once, in the order first read. */
export class Graph {
  readonly #seen = new Set<string>();
  readonly #bySubject = new Map<Iri, Map<Iri, Term[]>>();
  readonly #byObject = new Map<Iri, Map<string, Iri[]>>();

  add(s: Iri, p: Iri, o: Term): void {
    const key = `<${s}> <${p}> ${keyOf(o)}`;
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    const sp = this.#bySubject.get(s) ?? new Map<Iri, Term[]>();
    this.#bySubject.set(s, sp);
    sp.set(p, [...(sp.get(p) ?? []), o]);
    const po = this.#byObject.get(p) ?? new Map<string, Iri[]>();
    this.#byObject.set(p, po);
    po.set(keyOf(o), [...(po.get(keyOf(o)) ?? []), s]);
  }

  /** The objects of `s p ?`, in the order read. */
  objects(s: Iri, p: Iri): readonly Term[] {
    return this.#bySubject.get(s)?.get(p) ?? [];
  }

  /** The subjects of `? p o`, in the order read. */
  subjects(p: Iri, o: Iri): readonly Iri[] {
    return this.#byObject.get(p)?.get(keyOf({ kind: "iri", iri: o })) ?? [];
  }
}

/** Why a document cannot be read: where, and what was found there. */
export type SyntaxError = { readonly line: number; readonly column: number; readonly message: string };

type Token =
  | { readonly t: "iri"; readonly iri: string }
  | { readonly t: "pname"; readonly prefix: string; readonly local: string }
  | { readonly t: "string"; readonly text: string }
  | { readonly t: "lang"; readonly lang: string }
  | { readonly t: "integer"; readonly text: string }
  | { readonly t: "boolean"; readonly text: "true" | "false" }
  | { readonly t: "a" }
  | { readonly t: "prefix" }
  | { readonly t: "punct"; readonly p: "." | ";" | "," | "^^" }
  | { readonly t: "end" };
type At = { readonly line: number; readonly column: number };
type Located = { readonly token: Token; readonly at: At };

class Fail {
  constructor(readonly at: At, readonly message: string) {}
}

const PN_CHARS_BASE =
  "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}";
const PN_CHARS = `${PN_CHARS_BASE}_\\-0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040`;
const PNAME = new RegExp(
  `^((?:[${PN_CHARS_BASE}](?:[${PN_CHARS}.]*[${PN_CHARS}])?)?):((?:[${PN_CHARS_BASE}_:0-9]|%[0-9A-Fa-f]{2})(?:(?:[${PN_CHARS}.:]|%[0-9A-Fa-f]{2})*(?:[${PN_CHARS}:]|%[0-9A-Fa-f]{2}))?)?`,
  "u",
);
const ECHAR: Readonly<Record<string, string>> = { t: "\t", b: "\b", n: "\n", r: "\r", f: "\f", '"': '"', "'": "'", "\\": "\\" };

function tokenize(src: string): Located[] {
  const out: Located[] = [];
  let i = 0, line = 1, lineStart = 0;
  const at = (): At => ({ line, column: i - lineStart + 1 });
  const fail = (message: string): never => {
    throw new Fail(at(), message);
  };
  const advance = (n: number): void => {
    for (let k = 0; k < n; k++) {
      if (src[i] === "\n") {
        line++;
        lineStart = i + 1;
      }
      i++;
    }
  };
  const uchar = (): string => {
    const len = src[i + 1] === "u" ? 4 : 8;
    const hex = src.slice(i + 2, i + 2 + len);
    if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length !== len) fail("a \\u or \\U escape needs its hexadecimal digits");
    const cp = parseInt(hex, 16);
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) fail("an escape names no character");
    advance(2 + len);
    return String.fromCodePoint(cp);
  };
  while (i < src.length) {
    const c = src[i] ?? "";
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance(1);
      continue;
    }
    if (c === "#") {
      while (i < src.length && src[i] !== "\n" && src[i] !== "\r") advance(1);
      continue;
    }
    const start = at();
    const push = (token: Token): void => void out.push({ token, at: start });
    if (c === "<") {
      advance(1);
      let iri = "";
      while (src[i] !== ">") {
        const d = src[i];
        // an IRI may hold no control character, on purpose
        // deno-lint-ignore no-control-regex
        if (d === undefined || /[\x00-\x20<"{}|^`]/.test(d)) fail("an IRI is not closed, or holds a character an IRI cannot");
        if (d === "\\") {
          if (src[i + 1] !== "u" && src[i + 1] !== "U") fail("an IRI's only escapes are \\u and \\U");
          iri += uchar();
        } else {
          iri += d;
          advance(1);
        }
      }
      advance(1);
      if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(iri)) throw new Fail(start, `a relative IRI (<${iri}>); only absolute IRIs are read`);
      push({ t: "iri", iri });
      continue;
    }
    if (c === '"' || c === "'") {
      const long = src.startsWith(c.repeat(3), i);
      const q = long ? c.repeat(3) : c;
      advance(q.length);
      let text = "";
      for (;;) {
        if (i >= src.length) throw new Fail(start, "a string is not closed");
        if (src.startsWith(q, i)) {
          if (long && src[i + 3] === c) { // `""""` closes after the first quote is taken as text
            text += c;
            advance(1);
            continue;
          }
          advance(q.length);
          break;
        }
        const d = src[i] ?? "";
        if (!long && (d === "\n" || d === "\r")) fail("a short string runs past the end of its line");
        if (d === "\\") {
          const e = src[i + 1] ?? "";
          if (e === "u" || e === "U") text += uchar();
          else {
            const v = ECHAR[e];
            if (v === undefined) fail(`an unknown escape \\${e}`);
            text += v ?? "";
            advance(2);
          }
          continue;
        }
        text += d;
        advance(1);
      }
      push({ t: "string", text });
      continue;
    }
    if (c === "@") {
      const m = /^@([A-Za-z]+(?:-[A-Za-z0-9]+)*)/.exec(src.slice(i, i + 100));
      if (m === null) fail("a lone @");
      const word = m?.[1] ?? "";
      if (word === "prefix") push({ t: "prefix" });
      else if (word === "base") fail("@base is not read: write absolute IRIs");
      else push({ t: "lang", lang: word.toLowerCase() });
      advance(word.length + 1);
      continue;
    }
    if (c === "^" && src[i + 1] === "^") {
      push({ t: "punct", p: "^^" });
      advance(2);
      continue;
    }
    if (c === "." || c === ";" || c === ",") {
      if (c === "." && /[0-9]/.test(src[i + 1] ?? "")) fail("a decimal number is not read");
      push({ t: "punct", p: c });
      advance(1);
      continue;
    }
    if (c === "[" || c === "(" || (c === "_" && src[i + 1] === ":")) fail("a blank node or a collection is not read: name the node with an IRI");
    const num = /^[+-]?[0-9]+/.exec(src.slice(i, i + 64));
    if (num !== null) {
      const after = src[i + num[0].length] ?? "";
      if (/[eE]/.test(after) || (after === "." && /[0-9]/.test(src[i + num[0].length + 1] ?? ""))) fail("a decimal or a double is not read");
      push({ t: "integer", text: num[0] });
      advance(num[0].length);
      continue;
    }
    const word = /^[A-Za-z]+/.exec(src.slice(i, i + 16))?.[0] ?? "";
    const next = src[i + word.length] ?? "";
    if (word !== "" && next !== ":" && !/[A-Za-z0-9_.-]/.test(next)) {
      if (word === "a") push({ t: "a" });
      else if (word === "true" || word === "false") push({ t: "boolean", text: word });
      else if (/^(prefix|base)$/i.test(word)) fail(`SPARQL's ${word.toUpperCase()} is not read: write @${word.toLowerCase()}`);
      else fail(`an unknown word ${word}`);
      advance(word.length);
      continue;
    }
    const pn = PNAME.exec(src.slice(i, i + 4096));
    if (pn === null) fail(`an unexpected character ${JSON.stringify(c)}`);
    const all = pn?.[0] ?? "";
    if (src[i + all.length] === "\\") fail("an escape in a prefixed name is not read");
    push({ t: "pname", prefix: pn?.[1] ?? "", local: pn?.[2] ?? "" });
    advance(all.length);
  }
  out.push({ token: { t: "end" }, at: at() });
  return out;
}

/** An integer's or a boolean's text in its canonical form, as rdflib writes it; any other literal's as it was written. */
function canonical(text: string, datatype: string): string {
  if (datatype === XSD_INTEGER && /^[+-]?[0-9]+$/.test(text)) return BigInt(text).toString();
  if (datatype === XSD_BOOLEAN) return text === "true" || text === "1" ? "true" : text === "false" || text === "0" ? "false" : text;
  return text;
}

/** Reads one document into `graph`; on a syntax error, the graph holds what came before it. */
export function parseInto(graph: Graph, src: string): Result<number, SyntaxError> {
  let tokens: Located[];
  try {
    tokens = tokenize(src);
  } catch (e) {
    if (e instanceof Fail) return err({ ...e.at, message: e.message });
    throw e;
  }
  const prefixes = new Map<string, string>();
  let k = 0, count = 0;
  const peek = (): Located => tokens[k] ?? { token: { t: "end" }, at: { line: 0, column: 0 } };
  const take = (): Located => {
    const t = peek();
    k++;
    return t;
  };
  const fail = (l: Located, message: string): never => {
    throw new Fail(l.at, message);
  };
  const iriOf = (l: Located): Iri => {
    const t = l.token;
    if (t.t === "iri") return iri(t.iri);
    if (t.t === "pname") {
      const ns = prefixes.get(t.prefix);
      if (ns === undefined) fail(l, `the prefix ${t.prefix}: is not declared`);
      return iri(`${ns ?? ""}${t.local}`);
    }
    return fail(l, "an IRI or a prefixed name was expected here");
  };
  const punct = (p: "." | ";" | ","): boolean => {
    const t = peek().token;
    return t.t === "punct" && t.p === p;
  };
  const expect = (p: "." | ";" | ","): void => {
    const l = take();
    if (l.token.t !== "punct" || l.token.p !== p) fail(l, `'${p}' was expected here`);
  };
  const object = (): Term => {
    const l = take();
    const t = l.token;
    switch (t.t) {
      case "iri":
      case "pname":
        return { kind: "iri", iri: iriOf(l) };
      case "integer":
        return { kind: "literal", text: canonical(t.text, XSD_INTEGER), tag: { kind: "typed", datatype: iri(XSD_INTEGER) } };
      case "boolean":
        return { kind: "literal", text: t.text, tag: { kind: "typed", datatype: iri(XSD_BOOLEAN) } };
      case "string": {
        const n = peek().token;
        if (n.t === "lang") {
          take();
          return { kind: "literal", text: t.text, tag: { kind: "lang", lang: n.lang } };
        }
        if (n.t === "punct" && n.p === "^^") {
          take();
          const dl = take();
          const datatype = iriOf(dl);
          if (datatype !== XSD_STRING && datatype !== XSD_INTEGER && datatype !== XSD_BOOLEAN) {
            fail(dl, `the datatype ${datatype} is not read (only xsd:string, xsd:integer and xsd:boolean)`);
          }
          return { kind: "literal", text: canonical(t.text, datatype), tag: { kind: "typed", datatype } };
        }
        return { kind: "literal", text: t.text, tag: { kind: "plain" } };
      }
      case "lang":
      case "a":
      case "prefix":
      case "punct":
      case "end":
        return fail(l, "an object (an IRI or a literal) was expected here");
      default:
        return assertNever(t);
    }
  };
  try {
    while (peek().token.t !== "end") {
      const first = take();
      if (first.token.t === "prefix") {
        const name = take();
        if (name.token.t !== "pname" || name.token.local !== "") fail(name, "@prefix names a prefix, `name:`");
        const ns = take();
        if (ns.token.t !== "iri") fail(ns, "@prefix needs an IRI");
        prefixes.set(name.token.t === "pname" ? name.token.prefix : "", ns.token.t === "iri" ? ns.token.iri : "");
        expect(".");
        continue;
      }
      const s = iriOf(first);
      for (;;) {
        const v = take();
        const p = v.token.t === "a" ? RDF_TYPE : iriOf(v);
        for (;;) {
          graph.add(s, p, object());
          count++;
          if (!punct(",")) break;
          take();
        }
        if (!punct(";")) break;
        while (punct(";")) take();
        if (punct(".")) break;
      }
      expect(".");
    }
  } catch (e) {
    if (e instanceof Fail) return err({ ...e.at, message: e.message });
    throw e;
  }
  return ok(count);
}
