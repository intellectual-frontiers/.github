/**
 * Publish a typed ontology (commons 0019-mizan-integrations FR-010 to FR-019): one function that makes every file an ontology of Intellectual Frontiers is published as, from
 * the typed values it is written in, so that Mizan's own ontology and each ontology a specification of commons defines (IFCCM, IFQS, IFR) are published the same way.
 *
 * An ontology is described once, as an {@link OntologyPublication}; {@link publishedFiles} returns its files by path from commons' folder: canonical Turtle, RDF/XML, OWL 2
 * functional syntax, SHACL shapes, a JSON Schema, SKOS concept schemes and SQL tables for its code lists, SSSOM mappings to the standards it maps to, and an HTML view. Nothing
 * here reads or writes a file: `generate-ontology.ts` does.
 *
 * @module
 */
import { nTriples, type OntologyFile, owl, triplesOf, turtle } from "../kernel/rdf.ts";
import {
  type AnySchema,
  type CodeMember,
  exportJsonSchemaDefs,
  exportShacl,
  exportSkos,
  exportSqlCodeList,
  exportSssom,
  type Mapping,
} from "./integrations/pure/export.ts";
import { exportHtmlView, type ViewBasis, type ViewTerm } from "./integrations/pure/export-html.ts";
import { exportOwl, type OwlText } from "./integrations/pure/export-owl.ts";
import { describeFinding } from "./integrations/pure/types.ts";
import { exportRdfXml } from "./integrations/pure/export-rdfxml.ts";

type Lang = { readonly value: string; readonly language: string };

/** A class or a property as the exporters read it: its IRI and the annotations it carries. */
type EntityLike = {
  readonly iri: string;
  readonly values: {
    readonly label?: Lang | undefined;
    readonly comment?: Lang | undefined;
    readonly definition?: Lang | undefined;
    readonly subClassOf?: readonly { readonly iri: string }[] | undefined;
    readonly domain?: { readonly iri: string } | undefined;
    readonly range?: { readonly iri: string } | undefined;
  };
};

/** A property: an entity with the class it is an individual of (`owl:ObjectProperty` or `owl:DatatypeProperty`). */
type PropertyLike = EntityLike & { readonly class: { readonly iri: string } };

/** The record of what a term rests on, as the exporters read it. */
type TermLike = {
  readonly values: {
    readonly termIri: string;
    readonly basis: { readonly iri: string };
    readonly standardTerm?: string | undefined;
    readonly mappingRelation?: Mapping["relation"] | undefined;
    readonly justification?: string | undefined;
  };
};

/** The members of a code list as the exporters read them: its keys, with each individual's label and definition. */
export function membersOf(
  list: Readonly<
    Record<
      string,
      { readonly values: { readonly label: { readonly value: string }; readonly definition?: { readonly value: string } | undefined } }
    >
  >,
): readonly CodeMember[] {
  return Object.entries(list).map(([code, i]) => ({
    code,
    label: i.values.label.value,
    ...(i.values.definition === undefined ? {} : { definition: i.values.definition.value }),
  }));
}

/** A code list as `membersOf` reads it. */
export type CodeListLike = Parameters<typeof membersOf>[0];

/** The code lists of an ontology, each by the name of its class, as the publication reads them: its SKOS scheme and its SQL table are named after it. */
export function listsOf(prefix: string, lists: readonly (readonly [string, CodeListLike])[]): readonly CodeListPublication[] {
  return lists.map(([name, list]) => ({
    name,
    table: `${prefix}_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}`,
    members: membersOf(list),
  }));
}

/** One code list of an ontology, with the name its SKOS scheme and its SQL table go by. */
export type CodeListPublication = { readonly name: string; readonly table: string; readonly members: readonly CodeMember[] };

/** Everything an ontology is published from. */
export type OntologyPublication = {
  /** The name its files go by: `generated/<name>.auto.ttl`, `generated/<name>-shapes.auto.ttl`, and so on. */
  readonly name: string;
  /** The ontology's namespace IRI (ending in `#`) and the prefix it goes by. */
  readonly ns: { readonly prefix: string; readonly iri: string };
  /** The namespace of its individuals, which an SSSOM file declares as a prefix too. */
  readonly idNs: { readonly prefix: string; readonly iri: string };
  /** The prefixes a CURIE is made with in the HTML view, longest namespace first is not required: the first that matches wins. */
  readonly curies: readonly (readonly [string, string])[];
  /** The ontology's files of typed individuals. */
  readonly files: readonly OntologyFile[];
  /** The ontology's own header individual (`owl:Ontology`): its label, description, version information and version IRI. */
  readonly ontology: {
    readonly values: {
      readonly label?: Lang | undefined;
      readonly description?: Lang | undefined;
      readonly versionInfo?: string | undefined;
      readonly versionIri?: { readonly iri: string } | undefined;
    };
  };
  readonly classes: readonly EntityLike[];
  readonly properties: readonly PropertyLike[];
  /** The audit records of the terms (Mizan's own and, for Mizan, the packaging ontology's), which give the HTML view its bases and SSSOM its mappings. */
  readonly terms: readonly TermLike[];
  /** The shapes and schemas: the class schemas of the data the ontology holds. */
  readonly schemas: readonly AnySchema[];
  readonly lists: readonly CodeListPublication[];
  /** Where it is generated from, for the header comment: `commons/ontology/<name>/*.ts`. */
  readonly source: string;
  /** The command that writes the files again. */
  readonly run: string;
  /** The IRI of the SHACL shapes and of the JSON Schema, the SSSOM set and the prefix the shapes use. */
  readonly shapes: { readonly prefix: string; readonly iri: string };
  readonly schemasIri: string;
  readonly sssomSetId: string;
  /** Prefix to namespace pairs the SSSOM file declares besides the ontology's own. */
  readonly sssomCuries: Readonly<Record<string, string>>;
  /** The title of the HTML view. */
  readonly viewTitle: string;
  /** The license of the files: an IRI. */
  readonly license: string;
};

/** The default license of what Intellectual Frontiers publishes as ontologies: CC0. */
export const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

/** The path of a generated file of an ontology, from commons' folder: `generated/<name><suffix>`. */
export function pathOf(name: string, suffix: string): string {
  return `generated/${name}${suffix}`;
}

/** The files of an ontology, with their title, media type and what they conform to: its DCAT distributions (0019-mizan-integrations FR-018). */
export function distributionsOf(
  name: string,
  title: string,
): readonly { readonly file: string; readonly title: string; readonly mediaType: string; readonly conformsTo?: string }[] {
  return [
    { file: pathOf(name, ".auto.ttl"), title: `${title} ontology, Turtle`, mediaType: "text/turtle" },
    { file: pathOf(name, ".auto.rdf"), title: `${title} ontology, RDF/XML`, mediaType: "application/rdf+xml" },
    { file: pathOf(name, ".auto.ofn"), title: `${title} ontology, OWL 2 functional syntax`, mediaType: "text/owl-functional" },
    {
      file: pathOf(name, "-shapes.auto.ttl"),
      title: `${title} SHACL shapes`,
      mediaType: "text/turtle",
      conformsTo: "https://www.w3.org/TR/shacl/",
    },
    {
      file: pathOf(name, "-schemas.auto.json"),
      title: `${title} JSON Schema`,
      mediaType: "application/schema+json",
      conformsTo: "https://json-schema.org/draft/2020-12/schema",
    },
    {
      file: pathOf(name, "-code-lists.auto.skos.ttl"),
      title: `${title} code lists, SKOS`,
      mediaType: "text/turtle",
      conformsTo: "https://www.w3.org/TR/skos-reference/",
    },
    { file: pathOf(name, "-code-lists.auto.sql"), title: `${title} code lists, SQL`, mediaType: "application/sql" },
    {
      file: pathOf(name, "-mappings.auto.sssom.tsv"),
      title: `${title} mappings to standards, SSSOM`,
      mediaType: "text/tab-separated-values",
      conformsTo: "https://mapping-commons.github.io/sssom/spec/",
    },
    { file: pathOf(name, "-ontology.auto.html"), title: `${title} ontology, HTML view`, mediaType: "text/html" },
  ];
}

/** An IRI as a CURIE where a prefix of the publication shortens it. */
function compactWith(p: OntologyPublication, iri: string): string {
  for (const [prefix, ns] of p.curies) if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  return iri;
}

/** The SHA-256 of the ontology's canonical N-Triples (0012-ontology FR-012): it changes with a fact, never with the layout of a module. */
export async function digestOf(of: readonly OntologyFile[]): Promise<string> {
  const bytes = new TextEncoder().encode(nTriples(triplesOf(of.flatMap((f) => f.individuals))));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The ontology as canonical Turtle: every file's individuals, with every file's prefixes. */
export function turtleOf(of: readonly OntologyFile[], run: string, digest: string, source: string): string {
  const prefixes = new Map(of.flatMap((f) => f.prefixes).map((p) => [p.prefix, p]));
  return turtle({
    comments: [`AUTO-GENERATED by ${run} from ${source}. Do not edit: change the ontology.`, `source_sha256=${digest}`],
    prefixes: [...prefixes.values()],
    triples: triplesOf(of.flatMap((f) => f.individuals)),
  });
}

/** The text of an exporter's result, or a thrown sentence naming what the ontology states that the form cannot hold. */
export class ExportRefused extends Error {
  /** The refusal, told as a sentence. */
  constructor(message: string) {
    super(message);
    this.name = "ExportRefused";
  }
}

/** The value of an exporter's result, or a refusal naming what the ontology states that the form cannot hold. */
export function textOf(
  r: { readonly kind: "ok"; readonly value: string } | { readonly kind: "err"; readonly error: readonly string[] },
  what: string,
  name: string,
): string {
  if (r.kind === "ok") return r.value;
  throw new ExportRefused(`the ${name} ontology cannot be written as ${what}: ${r.error.join("; ")}`);
}

/** Stops with a sentence naming what an exporter could not hold: a file that would be empty is never written. */
function refuse(name: string, what: string, findings: readonly string[]): never {
  throw new ExportRefused(`the ${name} ontology cannot be written as ${what}: ${findings.join("; ")}`);
}

const owlText = (x: Lang): OwlText => ({ value: x.value, language: x.language });

/** The ontology's classes and properties as the OWL writer reads them (0019-mizan-integrations FR-017). */
function owlOf(p: OntologyPublication, comments: readonly string[]): Parameters<typeof exportOwl>[0] {
  const o = p.ontology.values;
  const entity = (e: EntityLike["values"]) => ({
    ...(e.label === undefined ? {} : { label: owlText(e.label) }),
    ...(e.comment === undefined ? {} : { comment: owlText(e.comment) }),
    ...(e.definition === undefined ? {} : { definition: owlText(e.definition) }),
  });
  return {
    iri: p.ns.iri.replace(/#$/, ""),
    ...(o.versionIri === undefined ? {} : { versionIri: o.versionIri.iri }),
    ...(o.label === undefined ? {} : { label: owlText(o.label) }),
    ...(o.description === undefined ? {} : { description: owlText(o.description) }),
    ...(o.versionInfo === undefined ? {} : { versionInfo: o.versionInfo }),
    title: o.label?.value ?? p.name,
    license: p.license,
    prefixes: p.files.flatMap((f) => f.prefixes).map((x) => ({ prefix: x.prefix, iri: x.iri })),
    classes: p.classes.map((c) => ({ iri: c.iri, ...entity(c.values), subClassOf: (c.values.subClassOf ?? []).map((s) => s.iri) })),
    properties: p.properties.map((x) => ({
      iri: x.iri,
      kind: x.class.iri === owl.ObjectProperty.iri ? ("object" as const) : ("datatype" as const),
      ...entity(x.values),
      ...(x.values.domain === undefined ? {} : { domain: x.values.domain.iri }),
      ...(x.values.range === undefined ? {} : { range: x.values.range.iri }),
    })),
    comments,
  };
}

/** The ontology as the HTML view reads it: its classes, properties, code lists and the basis of every term. */
function viewOf(p: OntologyPublication): Parameters<typeof exportHtmlView>[0] {
  const text = (x: Lang | undefined): { definition?: string } => (x === undefined ? {} : { definition: x.value });
  const classView: ViewTerm[] = p.classes.map((c) => ({
    curie: compactWith(p, c.iri),
    label: c.values.label?.value ?? "",
    ...text(c.values.definition),
  }));
  const propertyView: ViewTerm[] = p.properties.map((x) => ({
    curie: compactWith(p, x.iri),
    label: compactWith(p, x.iri).replace(new RegExp(`^${p.ns.prefix}:`), ""),
    ...(x.values.domain === undefined ? {} : { domain: compactWith(p, x.values.domain.iri) }),
    ...(x.values.range === undefined ? {} : { range: compactWith(p, x.values.range.iri) }),
    ...text(x.values.definition),
  }));
  const basisView: ViewBasis[] = p.terms.map((t) => ({
    curie: compactWith(p, t.values.termIri),
    basis: t.values.basis.iri.slice(t.values.basis.iri.lastIndexOf("#") + 1).toLowerCase(),
    ...(t.values.standardTerm === undefined ? {} : { standardTerm: compactWith(p, t.values.standardTerm) }),
    ...(t.values.mappingRelation === undefined ? {} : { relation: t.values.mappingRelation }),
    ...(t.values.justification === undefined ? {} : { justification: t.values.justification }),
  }));
  return {
    title: p.viewTitle,
    iri: p.ns.iri.replace(/#$/, ""),
    ...(p.ontology.values.versionIri === undefined ? {} : { versionIri: p.ontology.values.versionIri.iri }),
    classes: classView,
    properties: propertyView,
    codeLists: p.lists.map((l) => ({ name: l.name, members: l.members })),
    terms: basisView,
  };
}

/** Every file of an ontology (but its DCAT catalog entry, which `generate-ontology.ts` writes for them all), by its path from commons' folder. */
export async function publishedFiles(p: OntologyPublication): Promise<ReadonlyMap<string, string>> {
  const digest = await digestOf(p.files);
  const note = `AUTO-GENERATED by ${p.run} from ${p.source} (commons 0019-mizan-integrations FR-010). Do not edit: change the ontology. source_sha256=${digest}`;
  const skos = p.lists
    .map((l, i) => {
      const text = exportSkos({ schemeIri: `${p.ns.iri}${l.name}Scheme`, label: l.name, conceptBase: p.ns.iri, members: l.members });
      return i === 0 ? text : text.split("\n").slice(2).join("\n");
    })
    .join("\n");
  const sql = p.lists
    .map((l) => {
      const r = exportSqlCodeList(l.table, l.members);
      return r.kind === "ok" ? r.value : "";
    })
    .join("\n");
  const mappings: Mapping[] = p.terms.flatMap((t) =>
    t.values.standardTerm === undefined || t.values.mappingRelation === undefined
      ? []
      : [{ subject: t.values.termIri, relation: t.values.mappingRelation, object: t.values.standardTerm }],
  );
  const sssom = exportSssom({
    setId: p.sssomSetId,
    license: p.license,
    comment: note,
    curies: { [p.ns.prefix]: p.ns.iri, [p.idNs.prefix]: p.idNs.iri, ...p.sssomCuries },
    mappings,
  });
  return new Map([
    [pathOf(p.name, ".auto.ttl"), turtleOf(p.files, p.run, digest, p.source)],
    [
      pathOf(p.name, "-ontology.auto.html"),
      exportHtmlView(
        viewOf(p),
        `AUTO-GENERATED by ${p.run} from ${p.source} (commons 0019-mizan-integrations FR-010). Do not edit. source_sha256=${digest}`,
      ),
    ],
    [
      pathOf(p.name, "-mappings.auto.sssom.tsv"),
      sssom.kind === "ok"
        ? sssom.value
        : refuse(
            p.name,
            "SSSOM",
            sssom.error.map((f) => describeFinding(f)),
          ),
    ],
    [pathOf(p.name, "-shapes.auto.ttl"), `# ${note}\n\n${exportShacl(p.schemas, p.shapes)}`],
    [pathOf(p.name, "-schemas.auto.json"), exportJsonSchemaDefs(p.schemas, p.schemasIri, note)],
    [pathOf(p.name, "-code-lists.auto.skos.ttl"), `# ${note}\n\n${skos}`],
    [pathOf(p.name, "-code-lists.auto.sql"), `-- ${note}\n\n${sql}`],
    [
      pathOf(p.name, ".auto.rdf"),
      textOf(
        exportRdfXml({
          comments: [note],
          prefixes: [...new Map(p.files.flatMap((f) => f.prefixes).map((x) => [x.prefix, x])).values()],
          triples: triplesOf(p.files.flatMap((f) => f.individuals)),
        }),
        "RDF/XML",
        p.name,
      ),
    ],
    [pathOf(p.name, ".auto.ofn"), textOf(exportOwl(owlOf(p, [note])), "OWL", p.name)],
  ]);
}
