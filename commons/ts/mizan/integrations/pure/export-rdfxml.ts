/**
 * The RDF/XML writer (commons 0019-mizan-integrations FR-016): an ontology's triples as RDF/XML 1.1, as text, in one canonical form, so that a tool that reads only RDF/XML
 * (the OWL API, Protege, older triple stores) reads the same graph as the Turtle, and a generated file can be checked for staleness.
 *
 * @remarks
 * The form is flat: one `rdf:Description` for each subject, in the order of their N-Triples terms, its `rdf:type` first and its other predicates by IRI, each predicate's
 * objects in the order of their N-Triples terms (the order the kernel's Turtle writer uses), so the same triples give the same bytes whatever the order they were stated in.
 * A predicate's IRI is split into a namespace and an XML name: at a declared prefix where one fits, and otherwise after the last character that an XML name may not hold, the
 * namespace then getting a prefix `ns1`, `ns2` in the order of the namespaces' IRIs. A plain string (an `xsd:string`) has no `rdf:datatype`; a string in a language has `xml:lang`;
 * a blank node is an `rdf:nodeID`. What XML 1.0 cannot say is a finding, never silently changed: a predicate with no XML name (its IRI ends in a digit or in a character an XML name
 * may not hold) and a control character in a literal.
 *
 * @limits
 * ASCII names only for a predicate's local name; no `rdf:parseType`, no nested node elements and no `rdf:ID` (the graph, not the shorthand, is what is exported), and no typed node
 * elements (`<mz:Rung rdf:about=...>`), as a subject of several types has no canonical one.
 *
 * @example
 * ```ts
 * import { exportRdfXml } from "./export-rdfxml.ts";
 * exportRdfXml({ prefixes: [], triples: [] }); // { kind: "ok", value: '<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF xmlns:rdf="...">\n</rdf:RDF>\n' }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { namespace, nTriplesTerm, RDF_TYPE, XSD_STRING } from "../../../kernel/rdf-term.ts";
import type { Namespace, Subject, Term, Triple } from "../../../kernel/rdf-term.ts";
import { compareCodePoints } from "../../../kernel/rdf-write.ts";

/** What the document is made of: the prefixes it may declare, its triples and the comment lines of its head. */
export type RdfXmlDocument = {
  readonly comments?: readonly string[];
  readonly prefixes: readonly Namespace[];
  readonly triples: readonly Triple[];
};

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
/** Whether the text holds a character XML 1.0 does not allow in a document, whatever the escape: a control other than tab, line feed and carriage return, or U+FFFE or U+FFFF. */
function notXml(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff) return true;
  }
  return false;
}
const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** The text for an element's content, or for an attribute's value (`attribute`). */
function esc(s: string, attribute: boolean): string {
  const text = s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\r", "&#13;");
  return attribute ? text.replaceAll('"', "&quot;").replaceAll("\n", "&#10;").replaceAll("\t", "&#9;") : text;
}

/** An IRI cut into a namespace and an XML name, or nothing where it has no XML name at its end. */
function split(iri: string, declared: readonly Namespace[]): { readonly ns: string; readonly local: string } | undefined {
  let best: { readonly ns: string; readonly local: string } | undefined;
  for (const d of declared) {
    const local = iri.slice(d.iri.length);
    if (iri.startsWith(d.iri) && NAME.test(local) && (best === undefined || d.iri.length > best.ns.length)) best = { ns: d.iri, local };
  }
  if (best !== undefined) return best;
  let at = iri.length;
  while (at > 0 && /[A-Za-z0-9_.-]/.test(iri.charAt(at - 1))) at--;
  while (at < iri.length && !/[A-Za-z_]/.test(iri.charAt(at))) at++;
  return at === iri.length || at === 0 ? undefined : { ns: iri.slice(0, at), local: iri.slice(at) };
}

/** Triples as RDF/XML in its canonical form, or what XML cannot say of them, one sentence each. */
export function exportRdfXml(doc: RdfXmlDocument): Result<string, readonly string[]> {
  const findings: string[] = [];
  const rdf = namespace("rdf", RDF_NS);
  const declared = doc.prefixes.filter((p) => p.iri !== RDF_NS && p.prefix !== "rdf");
  for (const p of declared) {
    if (!NAME.test(p.prefix) || /^xml/i.test(p.prefix))
      findings.push(`the prefix ${JSON.stringify(p.prefix)} is not one an XML namespace may have`);
  }
  const triples = [
    ...new Map(doc.triples.map((t) => [`${nTriplesTerm(t.subject)} ${nTriplesTerm(t.predicate)} ${nTriplesTerm(t.object)}`, t])).values(),
  ];
  // the namespaces of the predicates that no declared prefix names get `ns1`, `ns2`, in the order of their IRIs
  const unnamed = new Set<string>();
  for (const t of triples) {
    const s = split(t.predicate.iri, [rdf, ...declared]);
    if (s === undefined) findings.push(`${nTriplesTerm(t.predicate)} has no XML name at its end, so RDF/XML cannot write it as an element`);
    else if (s.ns !== RDF_NS && !declared.some((d) => d.iri === s.ns)) unnamed.add(s.ns);
  }
  const all: readonly Namespace[] = [
    rdf,
    ...declared,
    ...[...unnamed].sort(compareCodePoints).map((ns, i) => namespace(`ns${i + 1}`, ns)),
  ].sort((a, b) => compareCodePoints(a.prefix, b.prefix));
  const nameOf = (iri: string): string => {
    const s = split(iri, all);
    const p = s === undefined ? undefined : all.find((d) => d.iri === s.ns);
    return s === undefined || p === undefined ? "" : `${p.prefix}:${s.local}`;
  };
  const checkText = (what: string, s: string): void => {
    if (notXml(s)) findings.push(`${what} holds a control character that XML 1.0 cannot hold`);
  };
  const subjectAttr = (s: Subject): string =>
    s.kind === "named" ? `rdf:about="${esc(s.iri, true)}"` : `rdf:nodeID="${esc(s.label, true)}"`;
  const property = (name: string, o: Term): string => {
    switch (o.kind) {
      case "named":
        return `    <${name} rdf:resource="${esc(o.iri, true)}"/>\n`;
      case "blank":
        return `    <${name} rdf:nodeID="${esc(o.label, true)}"/>\n`;
      case "lang":
        checkText(nTriplesTerm(o), o.value);
        return `    <${name} xml:lang="${esc(o.language, true)}">${esc(o.value, false)}</${name}>\n`;
      case "typed":
        checkText(nTriplesTerm(o), o.value);
        return o.datatype === XSD_STRING
          ? `    <${name}>${esc(o.value, false)}</${name}>\n`
          : `    <${name} rdf:datatype="${esc(o.datatype, true)}">${esc(o.value, false)}</${name}>\n`;
      default:
        return absurd(o);
    }
  };
  const subjects = new Map<string, { readonly subject: Subject; readonly predicates: Map<string, Term[]> }>();
  for (const t of triples) {
    const key = nTriplesTerm(t.subject);
    const entry = subjects.get(key) ?? { subject: t.subject, predicates: new Map<string, Term[]>() };
    subjects.set(key, entry);
    entry.predicates.set(t.predicate.iri, [...(entry.predicates.get(t.predicate.iri) ?? []), t.object]);
  }
  const blocks: string[] = [];
  for (const key of [...subjects.keys()].sort(compareCodePoints)) {
    const entry = subjects.get(key);
    if (entry === undefined) continue;
    const predicates = [...entry.predicates.keys()].sort((a, b) => (a === RDF_TYPE ? -1 : b === RDF_TYPE ? 1 : compareCodePoints(a, b)));
    const body = predicates.map((p) => {
      const objects = [...new Map((entry.predicates.get(p) ?? []).map((o) => [nTriplesTerm(o), o]))].sort(([a], [b]) =>
        compareCodePoints(a, b),
      );
      return objects.map(([, o]) => property(nameOf(p), o)).join("");
    });
    blocks.push(`  <rdf:Description ${subjectAttr(entry.subject)}>\n${body.join("")}  </rdf:Description>\n`);
  }
  if (findings.length > 0) return err([...new Set(findings)]);
  const head = (doc.comments ?? []).map((c) => `<!-- ${c.replaceAll("--", "- -")} -->\n`).join("");
  const xmlns = all.map((n) => `xmlns:${n.prefix}="${esc(n.iri, true)}"`).join("\n    ");
  return ok(`<?xml version="1.0" encoding="UTF-8"?>\n${head}<rdf:RDF ${xmlns}>\n${blocks.join("")}</rdf:RDF>\n`);
}
