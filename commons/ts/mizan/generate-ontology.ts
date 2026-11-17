/**
 * Generate the Mizan ontology's Turtle from its TypeScript (commons 0012-ontology FR-011, 0016-ladder).
 *
 *     bun commons/ts/mizan/generate-ontology.ts           write commons/generated/mizan.auto.ttl
 *     bun commons/ts/mizan/generate-ontology.ts --check   exit 1, writing nothing, where the file is not what the ontology makes
 *
 * The ontology (commons/ontology/mizan/*.ts) is the source, read as the typed values it is; the Turtle is never edited by hand. The ontology is checked first: a rule
 * it breaks stops the run (exit 2) with every finding named.
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { files as auditFiles, packagingTerms } from "../../ontology/audit/mod.ts";
import {
  Authority,
  bases,
  classes,
  Decision,
  files,
  integrationDirections,
  Jurisdiction,
  jurisdictionLevels,
  MZ,
  MZID,
  OntologyTerm,
  mizanOntology,
  properties,
  Rung,
  Standard,
  terms,
} from "../../ontology/mizan/mod.ts";
import { formatRdfFinding, nTriples, owl, type OntologyFile, triplesOf, turtle, validate } from "../kernel/rdf.ts";
import { stdio } from "../runtime/mod.ts";
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
import { exportDcat } from "./integrations/pure/export-dcat.ts";
import { exportOwl, type OwlText } from "./integrations/pure/export-owl.ts";
import { exportRdfXml } from "./integrations/pure/export-rdfxml.ts";

/** The command that writes the file again. */
export const RUN = "bun commons/ts/mizan/generate-ontology.ts";

/** Where the Turtle is written, from commons' folder. */
export const TURTLE_PATH = "generated/mizan.auto.ttl";

const PREFIXES = [
  ["mz", MZ.iri],
  ["xsd", "http://www.w3.org/2001/XMLSchema#"],
  ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
  ["skos", "http://www.w3.org/2004/02/skos/core#"],
  ["dcterms", "http://purl.org/dc/terms/"],
  ["pm", "https://www.intellectualfrontiers.com/ontology/packaging#"],
  ["schema", "https://schema.org/"],
] as const;

/** An IRI as a CURIE where a prefix of the ontology's shortens it. */
function compact(iri: string): string {
  for (const [p, ns] of PREFIXES) if (iri.startsWith(ns)) return `${p}:${iri.slice(ns.length)}`;
  return iri;
}

/** The ontology as the HTML view reads it: its classes, properties, code lists and the basis of every term, Mizan's and the packaging ontology's. */
function viewOf(): Parameters<typeof exportHtmlView>[0] {
  const text = (x: { readonly value: string } | undefined): { definition?: string } => (x === undefined ? {} : { definition: x.value });
  const classView: ViewTerm[] = classes.map((c) => ({
    curie: compact(c.iri),
    label: c.values.label?.value ?? "",
    ...text(c.values.definition),
  }));
  const propertyView: ViewTerm[] = properties.map((p) => ({
    curie: compact(p.iri),
    label: compact(p.iri).replace(/^mz:/, ""),
    ...(p.values.domain === undefined ? {} : { domain: compact(p.values.domain.iri) }),
    ...(p.values.range === undefined ? {} : { range: compact(p.values.range.iri) }),
    ...text(p.values.definition),
  }));
  const basisView: ViewBasis[] = [...terms, ...packagingTerms].map((t) => ({
    curie: compact(t.values.termIri),
    basis: t.values.basis.iri.slice(MZ.iri.length).toLowerCase(),
    ...(t.values.standardTerm === undefined ? {} : { standardTerm: compact(t.values.standardTerm) }),
    ...(t.values.mappingRelation === undefined ? {} : { relation: t.values.mappingRelation }),
    ...(t.values.justification === undefined ? {} : { justification: t.values.justification }),
  }));
  return {
    title: "Mizan: the shared ontology",
    iri: MZ.iri.replace(/#$/, ""),
    ...(mizanOntology.values.versionIri === undefined ? {} : { versionIri: mizanOntology.values.versionIri.iri }),
    classes: classView,
    properties: propertyView,
    codeLists: LISTS.map((l) => ({ name: l.name, members: l.members })),
    terms: basisView,
  };
}

const SCHEMAS: readonly AnySchema[] = [Rung, Jurisdiction, Authority, Standard, Decision, OntologyTerm];

/** The members of a code list as the exporters read them: its keys, with each individual's label and definition. */
function membersOf(
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

const LISTS = [
  { name: "Basis", table: "mizan_basis", members: membersOf(bases) },
  { name: "JurisdictionLevel", table: "mizan_jurisdiction_level", members: membersOf(jurisdictionLevels) },
  { name: "IntegrationDirection", table: "mizan_integration_direction", members: membersOf(integrationDirections) },
] as const;

/** The text of an exporter's result, or a thrown sentence naming what the ontology states that the form cannot hold (`main` turns it into exit 2). */
export function textOf(
  r: { readonly kind: "ok"; readonly value: string } | { readonly kind: "err"; readonly error: readonly string[] },
  what: string,
): string {
  if (r.kind === "ok") return r.value;
  throw new ExportRefused(`the Mizan ontology cannot be written as ${what}: ${r.error.join("; ")}`);
}

/** The ontology cannot be written in a form: what it states is something the form cannot hold. */
export class ExportRefused extends Error {
  /** The refusal, told as a sentence. */
  constructor(message: string) {
    super(message);
    this.name = "ExportRefused";
  }
}

type Lang = { readonly value: string; readonly language: string };
const owlText = (x: Lang): OwlText => ({ value: x.value, language: x.language });

/** The ontology's classes and properties as the OWL writer reads them (0019-mizan-integrations FR-017). */
function owlOf(comments: readonly string[]): Parameters<typeof exportOwl>[0] {
  const o = mizanOntology.values;
  const entity = (e: {
    readonly label?: Lang | undefined;
    readonly comment?: Lang | undefined;
    readonly definition?: Lang | undefined;
  }) => ({
    ...(e.label === undefined ? {} : { label: owlText(e.label) }),
    ...(e.comment === undefined ? {} : { comment: owlText(e.comment) }),
    ...(e.definition === undefined ? {} : { definition: owlText(e.definition) }),
  });
  return {
    iri: MZ.iri.replace(/#$/, ""),
    ...(o.versionIri === undefined ? {} : { versionIri: o.versionIri.iri }),
    ...(o.label === undefined ? {} : { label: owlText(o.label) }),
    ...(o.description === undefined ? {} : { description: owlText(o.description) }),
    ...(o.versionInfo === undefined ? {} : { versionInfo: o.versionInfo }),
    prefixes: files.flatMap((f) => f.prefixes).map((p) => ({ prefix: p.prefix, iri: p.iri })),
    classes: classes.map((c) => ({ iri: c.iri, ...entity(c.values), subClassOf: (c.values.subClassOf ?? []).map((s) => s.iri) })),
    properties: properties.map((p) => ({
      iri: p.iri,
      kind: p.class.iri === owl.ObjectProperty.iri ? ("object" as const) : ("datatype" as const),
      ...entity(p.values),
      ...(p.values.domain === undefined ? {} : { domain: p.values.domain.iri }),
      ...(p.values.range === undefined ? {} : { range: p.values.range.iri }),
    })),
    comments,
  };
}

/** The distributions of the ontology (0019-mizan-integrations FR-018): the files generated from it, with the media type of each. */
const DISTRIBUTIONS = [
  { file: "generated/mizan.auto.ttl", title: "Mizan ontology, Turtle", mediaType: "text/turtle" },
  { file: "generated/mizan.auto.rdf", title: "Mizan ontology, RDF/XML", mediaType: "application/rdf+xml" },
  { file: "generated/mizan.auto.ofn", title: "Mizan ontology, OWL 2 functional syntax", mediaType: "text/owl-functional" },
  {
    file: "generated/mizan-shapes.auto.ttl",
    title: "Mizan SHACL shapes",
    mediaType: "text/turtle",
    conformsTo: "https://www.w3.org/TR/shacl/",
  },
  {
    file: "generated/mizan-schemas.auto.json",
    title: "Mizan JSON Schema",
    mediaType: "application/schema+json",
    conformsTo: "https://json-schema.org/draft/2020-12/schema",
  },
  {
    file: "generated/mizan-code-lists.auto.skos.ttl",
    title: "Mizan code lists, SKOS",
    mediaType: "text/turtle",
    conformsTo: "https://www.w3.org/TR/skos-reference/",
  },
  { file: "generated/mizan-code-lists.auto.sql", title: "Mizan code lists, SQL", mediaType: "application/sql" },
  {
    file: "generated/mizan-mappings.auto.sssom.tsv",
    title: "Mizan mappings to standards, SSSOM",
    mediaType: "text/tab-separated-values",
    conformsTo: "https://mapping-commons.github.io/sssom/spec/",
  },
  { file: "generated/mizan-ontology.auto.html", title: "Mizan ontology, HTML view", mediaType: "text/html" },
] as const;

/** Where the generated files are downloaded from: this repository's `commons/` folder on its default branch. */
const DOWNLOAD_BASE = "https://raw.githubusercontent.com/intellectual-frontiers/.github/main/commons/";

/** The exports of the ontology (0019-mizan-integrations FR-010), by their path from commons' folder: SHACL shapes, a JSON Schema, SKOS concept schemes and SQL code-list tables. */
export function exportsOf(digest: string, auditDigest: string): ReadonlyMap<string, string> {
  const note = `AUTO-GENERATED by ${RUN} from commons/ontology/mizan/*.ts (commons 0019-mizan-integrations FR-010). Do not edit: change the ontology. source_sha256=${digest}`;
  const skos = LISTS.map((l, i) => {
    const text = exportSkos({ schemeIri: `${MZ.iri}${l.name}Scheme`, label: l.name, conceptBase: MZ.iri, members: l.members });
    return i === 0 ? text : text.split("\n").slice(2).join("\n");
  }).join("\n");
  const sql = LISTS.map((l) => {
    const r = exportSqlCodeList(l.table, l.members);
    return r.kind === "ok" ? r.value : "";
  }).join("\n");
  const mappings: Mapping[] = [...terms, ...packagingTerms].flatMap((t) =>
    t.values.standardTerm === undefined || t.values.mappingRelation === undefined
      ? []
      : [{ subject: t.values.termIri, relation: t.values.mappingRelation, object: t.values.standardTerm }],
  );
  const sssom = exportSssom({
    setId: "https://www.intellectualfrontiers.com/ontology/mizan-mappings",
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
    comment: note,
    curies: {
      mz: MZ.iri,
      mzid: MZID.iri,
      dcterms: "http://purl.org/dc/terms/",
      pm: "https://www.intellectualfrontiers.com/ontology/packaging#",
      schema: "https://schema.org/",
    },
    mappings,
  });
  return new Map([
    [
      "generated/mizan-ontology.auto.html",
      exportHtmlView(
        viewOf(),
        `AUTO-GENERATED by ${RUN} from commons/ontology/mizan/*.ts and commons/ontology/audit/*.ts (commons 0019-mizan-integrations FR-010). Do not edit. source_sha256=${digest}`,
      ),
    ],
    ["generated/mizan-mappings.auto.sssom.tsv", sssom.kind === "ok" ? sssom.value : ""],
    [
      "generated/mizan-shapes.auto.ttl",
      `# ${note}\n\n${exportShacl(SCHEMAS, { prefix: "mzsh", iri: "https://www.intellectualfrontiers.com/ontology/mizan-shapes#" })}`,
    ],
    [
      "generated/mizan-schemas.auto.json",
      exportJsonSchemaDefs(SCHEMAS, "https://www.intellectualfrontiers.com/ontology/mizan-schemas", note),
    ],
    [
      "generated/mizan-audit-packaging.auto.ttl",
      turtleOf(auditFiles, auditDigest, "commons/ontology/audit/*.ts (commons 0018-standards-first FR-003)"),
    ],
    ["generated/mizan-code-lists.auto.skos.ttl", `# ${note}\n\n${skos}`],
    ["generated/mizan-code-lists.auto.sql", `-- ${note}\n\n${sql}`],
    [
      "generated/mizan.auto.rdf",
      textOf(
        exportRdfXml({
          comments: [note],
          prefixes: [...new Map(files.flatMap((f) => f.prefixes).map((p) => [p.prefix, p])).values()],
          triples: triplesOf(files.flatMap((f) => f.individuals)),
        }),
        "RDF/XML",
      ),
    ],
    ["generated/mizan.auto.ofn", textOf(exportOwl(owlOf([note])), "OWL")],
    [
      "generated/mizan-catalog.auto.ttl",
      textOf(
        exportDcat({
          iri: "https://www.intellectualfrontiers.com/ontology/mizan-catalog",
          title: "Mizan, the IF Spec Profile: published ontologies",
          description: "The ontologies Intellectual Frontiers publishes with Mizan, each with the files generated from it.",
          license: "https://creativecommons.org/publicdomain/zero/1.0/",
          publisher: { iri: "https://www.intellectualfrontiers.com/", name: "Intellectual Frontiers" },
          downloadBase: DOWNLOAD_BASE,
          comments: [note],
          datasets: [
            {
              id: "mizan",
              ontologyIri: MZ.iri.replace(/#$/, ""),
              ...(mizanOntology.values.versionInfo === undefined ? {} : { versionInfo: mizanOntology.values.versionInfo }),
              title: mizanOntology.values.label?.value ?? "Mizan",
              ...(mizanOntology.values.description === undefined ? {} : { description: mizanOntology.values.description.value }),
              distributions: DISTRIBUTIONS,
            },
          ],
        }),
        "a DCAT catalog",
      ),
    ],
  ]);
}

/** Every file the ontology makes, by its path from commons' folder, in the order they are written. */
export async function wanted(): Promise<ReadonlyMap<string, string>> {
  const digest = await digestOf(files);
  return new Map([[TURTLE_PATH, turtleOf(files, digest)], ...exportsOf(digest, await digestOf(auditFiles))]);
}

/** The SHA-256 of the ontology's canonical N-Triples (0012-ontology FR-012): it changes with a fact, never with the layout of a module. */
export async function digestOf(of: readonly OntologyFile[]): Promise<string> {
  const bytes = new TextEncoder().encode(nTriples(triplesOf(of.flatMap((f) => f.individuals))));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The findings a rule of the kernel finds in the ontology, one sentence each; none where it is sound. */
export function findingsOf(of: readonly OntologyFile[]): readonly string[] {
  return validate(of.flatMap((f) => f.individuals)).map(formatRdfFinding);
}

/** The ontology as canonical Turtle: every file's individuals, with every file's prefixes. */
export function turtleOf(
  of: readonly OntologyFile[],
  digest: string,
  source = "commons/ontology/mizan/*.ts (commons 0016-ladder, 0018-standards-first, 0012-ontology FR-011)",
): string {
  const prefixes = new Map(of.flatMap((f) => f.prefixes).map((p) => [p.prefix, p]));
  return turtle({
    comments: [`AUTO-GENERATED by ${RUN} from ${source}. Do not edit: change the ontology.`, `source_sha256=${digest}`],
    prefixes: [...prefixes.values()],
    triples: triplesOf(of.flatMap((f) => f.individuals)),
  });
}

/** The command line: write the files, or with `--check` say whether they are what the ontology makes. Returns the exit status (0, 1 stale, 2 the ontology breaks a rule). */
export async function main(argv: readonly string[], commons: string = fileURLToPath(new URL("../..", import.meta.url))): Promise<number> {
  const found = findingsOf(files);
  if (found.length > 0) {
    stdio.stderr.writeSync(`the Mizan ontology breaks its own rules:\n${found.map((f) => `  - ${f}\n`).join("")}`);
    return 2;
  }
  let want: ReadonlyMap<string, string>;
  try {
    want = await wanted();
  } catch (e) {
    if (!(e instanceof ExportRefused)) throw e;
    stdio.stderr.writeSync(`${e.message}\n`);
    return 2;
  }
  const root = commons.replace(/[\\/]$/, "");
  if (argv.includes("--check")) {
    const stale = [...want]
      .filter(([rel, text]) => !existsSync(`${root}/${rel}`) || readFileSync(`${root}/${rel}`, "utf8").replaceAll("\r\n", "\n") !== text)
      .map(([rel]) => rel);
    for (const rel of stale) stdio.stderr.writeSync(`commons/${rel} is not what the ontology makes; run: ${RUN}\n`);
    return stale.length > 0 ? 1 : 0;
  }
  mkdirSync(`${root}/generated`, { recursive: true });
  for (const [rel, text] of want) {
    writeFileSync(`${root}/${rel}`, text);
    stdio.stdout.writeSync(`wrote commons/${rel}\n`);
  }
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
