// Spec: 0001-rdf FR-001
/**
 * RDF terms as typed values (commons 0012-ontology FR-001, FR-002): an IRI branded once checked, a namespace that pairs a prefix with
 * its IRI, a named node branded with the classes its term is an individual of, blank nodes, literals typed by their language or their
 * datatype, and triples and quads of them. A vocabulary is a typed value made from a namespace and the local names of its terms, so a
 * term it does not list does not compile. Generalized from erga's ontology DSL (`erga 248-ontology-in-typescript`).
 *
 * @example
 * ```ts
 * import { en, namespace, vocabulary } from "./rdf-term.ts";
 * const ex = vocabulary(namespace("ex", "https://example.org/terms#"), { Widget: "rdfs:Class", size: "rdf:Property" });
 * ex.Widget.iri; // "https://example.org/terms#Widget"
 * en("a widget"); // { kind: "lang", value: "a widget", language: "en" }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";

/** An absolute IRI, checked by `parseIri` or made from a namespace. */
export type Iri = Brand<string, "rdf/Iri">;

/** Why a text is not an IRI: it has no scheme, or holds a character an IRI may not hold in N-Triples. */
export type IriError =
  | { readonly kind: "not-absolute"; readonly text: string }
  | { readonly kind: "forbidden-character"; readonly text: string; readonly at: number };

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
/** The characters N-Triples' IRIREF excludes besides the controls and the space. */
const FORBIDDEN = new Set([...'<>"{}|^`\\']);

/** The text as an IRI, or why it is not one. */
export function parseIri(text: string): Result<Iri, IriError> {
  for (let at = 0; at < text.length; at++) {
    if (text.charCodeAt(at) <= 0x20 || FORBIDDEN.has(text.charAt(at))) return err({ kind: "forbidden-character", text, at });
  }
  if (!SCHEME.test(text)) return err({ kind: "not-absolute", text });
  return ok(text as Iri);
}

/** The sentence an IRI error is told with. */
export function formatIriError(e: IriError): string {
  switch (e.kind) {
    case "not-absolute":
      return `${JSON.stringify(e.text)} is not an absolute IRI: it has no scheme`;
    case "forbidden-character":
      return `${JSON.stringify(e.text)} is not an IRI: the character at ${e.at} may not be in one`;
    default:
      return absurd(e);
  }
}

/** A fault of the code: a constant namespace or term whose IRI does not parse. It is thrown where the constant is made. */
export class RdfFault extends Error {
  /** The fault, told as a sentence. */
  constructor(message: string) {
    super(message);
    this.name = "RdfFault";
  }
}

function checked(text: string): Iri {
  const r = parseIri(text);
  if (r.kind === "err") throw new RdfFault(formatIriError(r.error));
  return r.value;
}

/** The classes a named node is an individual of, as the compiler sees them: one key for each class's name. */
export type Classes<C extends string> = { readonly [K in C]: true };

/**
 * A named node: an IRI, branded with the classes its term is an individual of (by their CURIEs, `"pm:PackageManager"`). A
 * `Named<"a" | "b">` is an individual of both, so it is accepted where either is asked for; a `Named<"a">` is not accepted where `"b"` is,
 * and a `Named` of no known class (`Named`, which is `Named<never>`) is not accepted where any one class is asked for: every named node is
 * a `Named`, so it is the type of a predicate or of any node at all.
 */
export type Named<C extends string = never> = { readonly kind: "named"; readonly iri: Iri; readonly "@ifc/rdf-classes": Classes<C> };

/** A named node of any one of the classes `C` (`NamedOf<"a" | "b">` is a `Named<"a">` or a `Named<"b">`). */
export type NamedOf<C extends string> = C extends string ? Named<C> : never;

/** The named node of an IRI, as an individual of the classes `C`; the brand is for the compiler alone. */
export function named<C extends string = never>(iri: Iri): Named<C> {
  return { kind: "named", iri } as Named<C>;
}

/** A namespace: a prefix and the IRI its terms' local names are appended to. */
export type Namespace<P extends string = string> = { readonly prefix: P; readonly iri: Iri };

const PREFIX = /^(?:[A-Za-z][A-Za-z0-9_-]*)?$/;

/** A namespace; one whose prefix or IRI is not well formed is a fault of the code, thrown as an `RdfFault`. */
export function namespace<const P extends string>(prefix: P, iri: string): Namespace<P> {
  if (!PREFIX.test(prefix)) throw new RdfFault(`${JSON.stringify(prefix)} is not a prefix`);
  return { prefix, iri: checked(iri) };
}

/** The IRI of a local name in a namespace; one that does not parse is a fault of the code, thrown as an `RdfFault`. */
export function iriIn(ns: Namespace, local: string): Iri {
  return checked(`${ns.iri}${local}`);
}

/**
 * The named node of a local name in a namespace, as an individual of the classes `C`, which the compiler takes from where it is used.
 * It is how a term no module here states is named (an individual of another ontology); a term this code states comes from its schema.
 */
export function term<C extends string = never>(ns: Namespace, local: string): Named<C> {
  return named<C>(iriIn(ns, local));
}

/** The IRI of the ontology a namespace's terms belong to: the namespace's IRI without its last `#` or `/`. */
export function ontologyIri(ns: Namespace): Iri {
  return checked(ns.iri.replace(/[#/]$/, ""));
}

/** A term of a vocabulary: a named node of its class, with its CURIE. */
export type VocabularyTerm<C extends string, Curie extends string> = Named<C> & { readonly curie: Curie };

/** A typed vocabulary: each local name of `T` gives a term of the class `T` names for it. */
export type Vocabulary<P extends string, T extends Readonly<Record<string, string>>> = {
  readonly [K in keyof T & string]: VocabularyTerm<T[K], `${P}:${K}`>;
};

/** The vocabulary of a namespace: its terms by local name, each of the class given (`{ label: "rdf:Property" }`). */
export function vocabulary<const P extends string, const T extends Readonly<Record<string, string>>>(
  ns: Namespace<P>,
  terms: T,
): Vocabulary<P, T> {
  const out: Record<string, { readonly kind: "named"; readonly iri: Iri; readonly curie: string }> = {};
  for (const local of Object.keys(terms)) out[local] = { kind: "named", iri: iriIn(ns, local), curie: `${ns.prefix}:${local}` };
  return out as unknown as Vocabulary<P, T>;
}

/** A language tag, checked against BCP 47's shape (letters, then subtags of letters and digits, joined by `-`). */
export type LanguageTag = Brand<string, "rdf/LanguageTag">;

const LANGUAGE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** The text as a language tag, in lower case, or nothing where it is not one. */
export function languageTag(text: string): LanguageTag | undefined {
  return LANGUAGE.test(text) ? (text.toLowerCase() as LanguageTag) : undefined;
}

/** A string in a language: `"install"@en`. */
export type LangString = { readonly kind: "lang"; readonly value: string; readonly language: LanguageTag };

/** A literal with its datatype (a plain string is an `xsd:string`). */
export type TypedLiteral = { readonly kind: "typed"; readonly value: string; readonly datatype: Iri };

/** A literal: a string in a language, or a lexical form with its datatype. */
export type Literal = LangString | TypedLiteral;

/** A blank node, by its label. */
export type Blank = { readonly kind: "blank"; readonly label: string };

/** A node of the default graph's name. */
export type DefaultGraph = { readonly kind: "default" };

/** Any RDF term. */
export type Term = Named | Blank | Literal;

/** What a triple may be about. */
export type Subject = Named | Blank;

/** A triple. */
export type Triple = { readonly subject: Subject; readonly predicate: Named; readonly object: Term };

/** A triple in a named graph, or in the default graph. */
export type Quad = Triple & { readonly graph: Named | DefaultGraph };

/** Why a literal or a blank node could not be made. */
export type TermError = { readonly kind: "language"; readonly tag: string } | { readonly kind: "blank-label"; readonly label: string };

/** The sentence a term error is told with. */
export function formatTermError(e: TermError): string {
  switch (e.kind) {
    case "language":
      return `${JSON.stringify(e.tag)} is not a language tag`;
    case "blank-label":
      return `${JSON.stringify(e.label)} is not a blank node label`;
    default:
      return absurd(e);
  }
}

/** A string in the language of a tag, or why the tag is not one. */
export function lang(value: string, tag: string): Result<LangString, TermError> {
  const language = languageTag(tag);
  return language === undefined ? err({ kind: "language", tag }) : ok({ kind: "lang", value, language });
}

/** A string in English: `en("install")`. */
export function en(value: string): LangString {
  return { kind: "lang", value, language: "en" as LanguageTag };
}

const XSD = "http://www.w3.org/2001/XMLSchema#";
/** The IRI of `xsd:string`. */
export const XSD_STRING = `${XSD}string` as Iri;
/** The IRI of `xsd:integer`. */
export const XSD_INTEGER = `${XSD}integer` as Iri;
/** The IRI of `xsd:boolean`. */
export const XSD_BOOLEAN = `${XSD}boolean` as Iri;
/** The IRI of `rdf:type`. */
export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" as Iri;

/** A literal of a datatype: `typed("2026-11-16", xsd.date)`. */
export function typed(value: string, datatype: Named): TypedLiteral {
  return { kind: "typed", value, datatype: datatype.iri };
}

/** A plain string, an `xsd:string`. */
export function plain(value: string): TypedLiteral {
  return { kind: "typed", value, datatype: XSD_STRING };
}

const BLANK = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$/;

/** A blank node, or why its label is not one. */
export function blank(label: string): Result<Blank, TermError> {
  return BLANK.test(label) ? ok({ kind: "blank", label }) : err({ kind: "blank-label", label });
}

/** The default graph. */
export const defaultGraph: DefaultGraph = { kind: "default" };

/** One value of a field: a plain string, an integer, a boolean, a literal or a named node. */
export type Value = string | number | boolean | Literal | Named;

/** The term of a value: a string is an `xsd:string`, a number an `xsd:integer` (in its canonical form), a boolean an `xsd:boolean`. */
export function termOf(v: Value): Term {
  if (typeof v === "string") return plain(v);
  if (typeof v === "number") return { kind: "typed", value: String(v), datatype: XSD_INTEGER };
  if (typeof v === "boolean") return { kind: "typed", value: String(v), datatype: XSD_BOOLEAN };
  return v.kind === "named" ? ({ kind: "named", iri: v.iri } as Named) : v;
}

/** A string's characters escaped as N-Triples and Turtle write them, in quotes: `\b \t \n \f \r \" \\` and `\uXXXX` for the other controls. */
export function quoted(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    const e = ESCAPES.get(ch);
    if (e !== undefined) out += e;
    else if (c < 0x20 || c === 0x7f) out += `\\u${c.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ["\b", "\\b"],
  ["\t", "\\t"],
  ["\n", "\\n"],
  ["\f", "\\f"],
  ["\r", "\\r"],
  ['"', '\\"'],
  ["\\", "\\\\"],
]);

/** A term as N-Triples writes it: `<iri>`, `_:label`, or a quoted literal with its language or its datatype (none for `xsd:string`). */
export function nTriplesTerm(t: Term): string {
  switch (t.kind) {
    case "named":
      return `<${t.iri}>`;
    case "blank":
      return `_:${t.label}`;
    case "lang":
      return `${quoted(t.value)}@${t.language}`;
    case "typed":
      return t.datatype === XSD_STRING ? quoted(t.value) : `${quoted(t.value)}^^<${t.datatype}>`;
    default:
      return absurd(t);
  }
}
