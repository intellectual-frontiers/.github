/**
 * The RDF writers (commons 0012-ontology FR-006, FR-007): N-Triples and N-Quads, Turtle in one canonical form, and JSON-LD in its
 * expanded form. Each writes the same bytes for the same statements whatever the order they were stated in, so a generated file changes
 * only where a fact does. There is no reader: what these write is read by RDF tools, and commons' own facts are TypeScript.
 *
 * @example
 * ```ts
 * import { en, named, parseIri } from "./rdf-term.ts";
 * import { nTriples } from "./rdf-write.ts";
 * const s = parseIri("https://example.org/a");
 * const p = parseIri("http://www.w3.org/2000/01/rdf-schema#label");
 * if (s.kind === "ok" && p.kind === "ok") {
 *   nTriples([{ subject: named(s.value), predicate: named(p.value), object: en("a") }]);
 *   // '<https://example.org/a> <http://www.w3.org/2000/01/rdf-schema#label> "a"@en .\n'
 * }
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import {
  type Iri,
  type Namespace,
  nTriplesTerm,
  type Quad,
  quoted,
  RDF_TYPE,
  type Subject,
  type Term,
  type Triple,
  XSD_BOOLEAN,
  XSD_INTEGER,
  XSD_STRING,
} from "./rdf-term.ts";

/** Two strings in the order of their code points (JavaScript's `<` orders UTF-16 units, which differs above U+FFFF). */
export function compareCodePoints(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return unit(x) - unit(y);
  }
  return a.length - b.length;
}
const unit = (c: number): number => (c >= 0xd800 && c <= 0xdfff ? c + 0x2000 : c >= 0xe000 ? c - 0x800 : c);

/** Lines, each once, in the order of their code points. */
function canonicalLines(lines: Iterable<string>): string {
  return [...new Set(lines)].sort(compareCodePoints).join("");
}

/** Triples as N-Triples: each once, one a line, the lines in the order of their code points. */
export function nTriples(triples: readonly Triple[]): string {
  return canonicalLines(triples.map((t) => `${nTriplesTerm(t.subject)} ${nTriplesTerm(t.predicate)} ${nTriplesTerm(t.object)} .\n`));
}

/** Quads as N-Quads: each once, one a line (a triple of the default graph has no fourth term), in the order of their code points. */
export function nQuads(quads: readonly Quad[]): string {
  return canonicalLines(
    quads.map((q) => {
      const g = q.graph.kind === "default" ? "" : ` ${nTriplesTerm(q.graph)}`;
      return `${nTriplesTerm(q.subject)} ${nTriplesTerm(q.predicate)} ${nTriplesTerm(q.object)}${g} .\n`;
    }),
  );
}

/** What a Turtle document is made of: comment lines for its head, the prefixes it may use, and its triples. */
export type TurtleDocument = {
  readonly comments?: readonly string[];
  readonly prefixes: readonly Namespace[];
  readonly triples: readonly Triple[];
};

/** The part of Turtle's `PN_LOCAL` a prefixed name is written with; any other local name is written as a whole IRI. */
const LOCAL = /^(?:[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?)?$/;
const INTEGER = /^(?:0|-?[1-9][0-9]*)$/;

/**
 * Triples as Turtle in its canonical form: the comment lines, then the prefixes sorted by name, then the subjects in the order of their
 * N-Triples terms, each with its `rdf:type` first as `a` and its other predicates by IRI, each predicate's objects in the order of their
 * N-Triples terms, one blank line between subjects. An IRI is a prefixed name where a prefix's IRI starts it and the rest is a plain local
 * name (the longest such prefix), and a whole IRI otherwise; an integer or a boolean of canonical form is written bare.
 */
export function turtle(doc: TurtleDocument): string {
  const prefixes = [...doc.prefixes].sort((a, b) => compareCodePoints(a.prefix, b.prefix));
  const iri = (i: Iri): string => {
    let best: Namespace | undefined;
    for (const ns of prefixes) {
      if (i.startsWith(ns.iri) && LOCAL.test(i.slice(ns.iri.length)) && (best === undefined || ns.iri.length > best.iri.length)) best = ns;
    }
    return best === undefined ? `<${i}>` : `${best.prefix}:${i.slice(best.iri.length)}`;
  };
  const object = (t: Term): string => {
    switch (t.kind) {
      case "named":
        return iri(t.iri);
      case "blank":
        return `_:${t.label}`;
      case "lang":
        return `${quoted(t.value)}@${t.language}`;
      case "typed":
        if (t.datatype === XSD_STRING) return quoted(t.value);
        if (t.datatype === XSD_INTEGER && INTEGER.test(t.value)) return t.value;
        if (t.datatype === XSD_BOOLEAN && (t.value === "true" || t.value === "false")) return t.value;
        return `${quoted(t.value)}^^${iri(t.datatype)}`;
      default:
        return absurd(t);
    }
  };
  const subjects = new Map<string, { readonly subject: Subject; readonly predicates: Map<Iri, Term[]> }>();
  for (const t of doc.triples) {
    const key = nTriplesTerm(t.subject);
    const entry = subjects.get(key) ?? { subject: t.subject, predicates: new Map<Iri, Term[]>() };
    subjects.set(key, entry);
    entry.predicates.set(t.predicate.iri, [...(entry.predicates.get(t.predicate.iri) ?? []), t.object]);
  }
  const blocks: string[] = [];
  for (const key of [...subjects.keys()].sort(compareCodePoints)) {
    const entry = subjects.get(key);
    if (entry === undefined) continue;
    const predicates = [...entry.predicates.keys()].sort((a, b) => (a === RDF_TYPE ? -1 : b === RDF_TYPE ? 1 : compareCodePoints(a, b)));
    const lines = predicates.map((p) => {
      const objects = [...new Map((entry.predicates.get(p) ?? []).map((o) => [nTriplesTerm(o), o]))].sort(([a], [b]) =>
        compareCodePoints(a, b),
      );
      return `${p === RDF_TYPE ? "a" : iri(p)} ${objects.map(([, o]) => object(o)).join(",\n        ")}`;
    });
    blocks.push(`${entry.subject.kind === "named" ? iri(entry.subject.iri) : `_:${entry.subject.label}`} ${lines.join(" ;\n    ")} .\n`);
  }
  const head = (doc.comments ?? []).map((c) => (c === "" ? "#\n" : `# ${c}\n`)).join("");
  const declared = prefixes.map((ns) => `@prefix ${ns.prefix}: <${ns.iri}> .\n`).join("");
  return [head, declared, blocks.join("\n")].filter((part) => part !== "").join("\n");
}

/** A JSON-LD value object, a node reference, or a node object of the expanded form. */
type JsonLdValue = Readonly<Record<string, string>>;

function jsonLdValue(t: Term): JsonLdValue {
  switch (t.kind) {
    case "named":
      return { "@id": t.iri };
    case "blank":
      return { "@id": `_:${t.label}` };
    case "lang":
      return { "@value": t.value, "@language": t.language };
    case "typed":
      return t.datatype === XSD_STRING ? { "@value": t.value } : { "@value": t.value, "@type": t.datatype };
    default:
      return absurd(t);
  }
}

/**
 * Triples as JSON-LD in its expanded form: one node object for each subject, in the order of their N-Triples terms, with its `@id`, its
 * `@type` (the IRIs of its `rdf:type`s, sorted) and then each other predicate by IRI, its values in the order of their N-Triples terms.
 */
export function jsonLd(triples: readonly Triple[]): string {
  const nodes = new Map<
    string,
    { readonly id: string; readonly types: Set<string>; readonly predicates: Map<string, Map<string, Term>> }
  >();
  for (const t of triples) {
    const key = nTriplesTerm(t.subject);
    const node = nodes.get(key) ?? {
      id: t.subject.kind === "named" ? t.subject.iri : `_:${t.subject.label}`,
      types: new Set<string>(),
      predicates: new Map<string, Map<string, Term>>(),
    };
    nodes.set(key, node);
    if (t.predicate.iri === RDF_TYPE && t.object.kind === "named") {
      node.types.add(t.object.iri);
      continue;
    }
    const values = node.predicates.get(t.predicate.iri) ?? new Map<string, Term>();
    node.predicates.set(t.predicate.iri, values);
    values.set(nTriplesTerm(t.object), t.object);
  }
  const out = [...nodes.keys()].sort(compareCodePoints).flatMap((key) => {
    const node = nodes.get(key);
    if (node === undefined) return [];
    const object: Record<string, unknown> = { "@id": node.id };
    if (node.types.size > 0) object["@type"] = [...node.types].sort(compareCodePoints);
    for (const p of [...node.predicates.keys()].sort(compareCodePoints)) {
      const values = node.predicates.get(p) ?? new Map<string, Term>();
      object[p] = [...values.keys()].sort(compareCodePoints).flatMap((k) => {
        const v = values.get(k);
        return v === undefined ? [] : [jsonLdValue(v)];
      });
    }
    return [object];
  });
  return `${JSON.stringify(out, null, 2)}\n`;
}
