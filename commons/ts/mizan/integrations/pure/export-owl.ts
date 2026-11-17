/**
 * The OWL 2 writer (commons 0019-mizan-integrations FR-017): an ontology's classes and properties as OWL 2 in functional syntax, as text, deterministically, so that an
 * OWL tool (the OWL API, ROBOT, Protege) reads the vocabulary and a generated file can be checked for staleness.
 *
 * @remarks
 * Only what the typed schemas can state is written: a declaration of each class, object property and data property, `SubClassOf`, the domain and the range of a property, and
 * the annotations `rdfs:label`, `rdfs:comment` and `skos:definition` (and, of the ontology, its label, description, version information and version IRI). The classes and the
 * datatypes that a class or a property names and the ontology does not define (`dcterms:Standard`) are declared too, as OWL 2 asks of every entity an axiom uses; the datatypes of
 * OWL 2's datatype map (`xsd:string`, `xsd:integer`, `xsd:boolean`) are not. Entities and axioms are in the order of their IRIs, so the same ontology gives the same bytes.
 * What the ontology states and OWL cannot hold in this form, a datatype property whose range is a class or an object property whose range is a datatype, is a finding.
 *
 * @limits
 * No restriction, disjointness, equivalence, cardinality or property characteristic: the typed schemas do not state them (the fields of `OwlClass`, `ObjectProperty` and
 * `DatatypeProperty` are the label, comment, definition, superclasses, domain and range). The individuals (rungs, authorities) are data, exported as RDF, not as OWL axioms.
 * No independent reader of functional syntax is a pinned dependency of the suite; the form is held to the OWL 2 functional-syntax grammar by hand and by a reader of its axioms in the root test (`commons-mizan-ontology.test.ts`), which compares them with the Turtle graph.
 *
 * @example
 * ```ts
 * import { exportOwl } from "./export-owl.ts";
 * exportOwl({ iri: "https://x/o", prefixes: [], classes: [{ iri: "https://x/o#A", subClassOf: [] }], properties: [] }); // { kind: "ok", value: "Prefix(...)...Ontology(<https://x/o>...)" }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/result.ts";

/** A text with its language, as an annotation's value. */
export type OwlText = { readonly value: string; readonly language?: string };

/** A class the ontology defines. */
export type OwlClassInput = {
  readonly iri: string;
  readonly label?: OwlText;
  readonly comment?: OwlText;
  readonly definition?: OwlText;
  readonly subClassOf: readonly string[];
};

/** A property the ontology defines: of objects (its range is a class) or of data (its range is a datatype). */
export type OwlPropertyInput = {
  readonly iri: string;
  readonly kind: "object" | "datatype";
  readonly label?: OwlText;
  readonly comment?: OwlText;
  readonly definition?: OwlText;
  readonly domain?: string;
  readonly range?: string;
};

/** Everything the document is made from. */
export type OwlOntologyInput = {
  readonly iri: string;
  readonly versionIri?: string;
  readonly label?: OwlText;
  readonly description?: OwlText;
  readonly versionInfo?: string;
  /** Prefixes to declare, besides `owl`, `rdf`, `rdfs`, `xsd`, `skos` and `dcterms`, which are always declared as their standard IRIs. */
  readonly prefixes: readonly { readonly prefix: string; readonly iri: string }[];
  readonly classes: readonly OwlClassInput[];
  readonly properties: readonly OwlPropertyInput[];
  /** A comment for the head of the file, one line each. */
  readonly comments?: readonly string[];
};

const XSD = "http://www.w3.org/2001/XMLSchema#";
const BASE = [
  { prefix: "dcterms", iri: "http://purl.org/dc/terms/" },
  { prefix: "owl", iri: "http://www.w3.org/2002/07/owl#" },
  { prefix: "rdf", iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
  { prefix: "rdfs", iri: "http://www.w3.org/2000/01/rdf-schema#" },
  { prefix: "skos", iri: "http://www.w3.org/2004/02/skos/core#" },
  { prefix: "xsd", iri: XSD },
] as const;
/** The datatypes of OWL 2's datatype map in the XSD namespace, which an ontology does not declare. */
const BUILT_IN = new Set(
  [
    "string",
    "normalizedString",
    "token",
    "language",
    "Name",
    "NCName",
    "NMTOKEN",
    "boolean",
    "decimal",
    "integer",
    "nonNegativeInteger",
    "nonPositiveInteger",
    "positiveInteger",
    "negativeInteger",
    "long",
    "int",
    "short",
    "byte",
    "unsignedLong",
    "unsignedInt",
    "unsignedShort",
    "unsignedByte",
    "double",
    "float",
    "dateTime",
    "dateTimeStamp",
    "hexBinary",
    "base64Binary",
    "anyURI",
  ].map((n) => `${XSD}${n}`),
);
const LOCAL = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The text of a literal of functional syntax: its quotes and backslashes escaped. */
function quote(s: string): string {
  return `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** The ontology as OWL 2 functional syntax, or what it states that OWL cannot hold in this form, one sentence each. */
export function exportOwl(o: OwlOntologyInput): Result<string, readonly string[]> {
  const prefixes = [...new Map([...o.prefixes, ...BASE].map((p) => [p.prefix, p])).values()].sort((a, b) => compare(a.prefix, b.prefix));
  const name = (iri: string): string => {
    let best: (typeof prefixes)[number] | undefined;
    for (const p of prefixes) {
      if (iri.startsWith(p.iri) && LOCAL.test(iri.slice(p.iri.length)) && (best === undefined || p.iri.length > best.iri.length)) best = p;
    }
    return best === undefined ? `<${iri}>` : `${best.prefix}:${iri.slice(best.iri.length)}`;
  };
  const text = (t: OwlText): string => `${quote(t.value)}${t.language === undefined ? "" : `@${t.language}`}`;
  const classes = [...o.classes].sort((a, b) => compare(a.iri, b.iri));
  const properties = [...o.properties].sort((a, b) => compare(a.iri, b.iri));
  const defined = new Set(o.classes.map((c) => c.iri));
  const findings: string[] = [];
  const external = new Set<string>();
  const datatypes = new Set<string>();
  const needClass = (iri: string | undefined): void => {
    if (iri !== undefined && !defined.has(iri)) external.add(iri);
  };
  for (const c of classes) c.subClassOf.forEach(needClass);
  for (const p of properties) {
    needClass(p.domain);
    if (p.range === undefined) continue;
    if (p.kind === "object") {
      if (p.range.startsWith(XSD)) findings.push(`${p.iri} is an object property whose range ${p.range} is a datatype`);
      else needClass(p.range);
    } else if (defined.has(p.range)) findings.push(`${p.iri} is a datatype property whose range ${p.range} is a class`);
    else if (!BUILT_IN.has(p.range)) datatypes.add(p.range);
  }
  for (const c of external) if (datatypes.has(c)) findings.push(`${c} is used both as a class and as a datatype`);
  if (findings.length > 0) return err(findings);
  const declarations = [
    ...[...defined, ...external].sort(compare).map((i) => `Declaration(Class(${name(i)}))`),
    ...[...datatypes].sort(compare).map((i) => `Declaration(Datatype(${name(i)}))`),
    ...properties.map((p) => `Declaration(${p.kind === "object" ? "ObjectProperty" : "DataProperty"}(${name(p.iri)}))`),
    // the annotation properties that OWL 2 does not build in (`rdfs:label`, `rdfs:comment` and `owl:versionInfo` it does) are declared where they are used
    ...(o.description === undefined ? [] : [`Declaration(AnnotationProperty(${name("http://purl.org/dc/terms/description")}))`]),
    ...(o.classes.some((c) => c.definition !== undefined) || o.properties.some((p) => p.definition !== undefined)
      ? [`Declaration(AnnotationProperty(${name("http://www.w3.org/2004/02/skos/core#definition")}))`]
      : []),
  ];
  const annotations = (
    iri: string,
    e: { readonly label?: OwlText; readonly comment?: OwlText; readonly definition?: OwlText },
  ): string[] => [
    ...(e.label === undefined
      ? []
      : [`AnnotationAssertion(${name("http://www.w3.org/2000/01/rdf-schema#label")} ${name(iri)} ${text(e.label)})`]),
    ...(e.comment === undefined
      ? []
      : [`AnnotationAssertion(${name("http://www.w3.org/2000/01/rdf-schema#comment")} ${name(iri)} ${text(e.comment)})`]),
    ...(e.definition === undefined
      ? []
      : [`AnnotationAssertion(${name("http://www.w3.org/2004/02/skos/core#definition")} ${name(iri)} ${text(e.definition)})`]),
  ];
  const axioms = [
    ...classes.flatMap((c) => [
      ...annotations(c.iri, c),
      ...[...c.subClassOf].sort(compare).map((s) => `SubClassOf(${name(c.iri)} ${name(s)})`),
    ]),
    ...properties.flatMap((p) => {
      const kind = p.kind === "object" ? "Object" : "Data";
      return [
        ...annotations(p.iri, p),
        ...(p.domain === undefined ? [] : [`${kind}PropertyDomain(${name(p.iri)} ${name(p.domain)})`]),
        ...(p.range === undefined ? [] : [`${kind}PropertyRange(${name(p.iri)} ${name(p.range)})`]),
      ];
    }),
  ];
  const head = [
    ...(o.label === undefined ? [] : [`Annotation(rdfs:label ${text(o.label)})`]),
    ...(o.description === undefined ? [] : [`Annotation(${name("http://purl.org/dc/terms/description")} ${text(o.description)})`]),
    ...(o.versionInfo === undefined ? [] : [`Annotation(owl:versionInfo ${quote(o.versionInfo)})`]),
  ];
  const comments = (o.comments ?? []).map((c) => `# ${c}\n`).join("");
  const declared = prefixes.map((p) => `Prefix(${p.prefix}:=<${p.iri}>)\n`).join("");
  const iris = `<${o.iri}>${o.versionIri === undefined ? "" : ` <${o.versionIri}>`}`;
  return ok(`${comments}${declared}\nOntology(${iris}\n\n${[...head, ...declarations, ...axioms].join("\n")}\n\n)\n`);
}
