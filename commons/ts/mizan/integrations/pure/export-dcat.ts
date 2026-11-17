/**
 * The DCAT writer (commons 0019-mizan-integrations FR-018): a catalog of the ontologies a repository publishes, each a `dcat:Dataset` with the files generated from it as
 * `dcat:Distribution`s (their title, media type and download URL, and the license), as DCAT 3 in canonical Turtle, so that a data portal or a harvester finds the ontology and
 * every form of it without reading the repository.
 *
 * @remarks
 * Written with the kernel's Turtle writer, so the same catalog gives the same bytes. The IRIs of the catalog's entries are made from the catalog's IRI: a dataset
 * `<catalog>#dataset-<id>` and a distribution `<catalog>#distribution-<id>-<file name>`. A media type is written as its IANA URI (`https://www.iana.org/assignments/media-types/text/turtle`)
 * for `dcat:mediaType` and `dcterms:format`, as DCAT 3 recommends, and the media type's text is not repeated. The ontology's own IRI and version are the dataset's `dcterms:identifier`
 * and `dcat:version`. There is no date, as a date would make the same catalog different by the day.
 *
 * @limits
 * No `dcat:byteSize` and no checksum (they would make the catalog depend on the bytes of the files it describes, which are generated in the same run); no `dcat:DataService`, no
 * theme, keyword or spatial and temporal coverage; the publisher is named, not described further. An IRI that does not parse, or a media type with no `/`, is a finding.
 *
 * @example
 * ```ts
 * import { exportDcat } from "./export-dcat.ts";
 * exportDcat({ iri: "https://x/catalog", title: "C", license: "https://x/l", publisher: { iri: "https://x/", name: "X" }, downloadBase: "https://x/files/", datasets: [] }); // { kind: "ok", value: "...a dcat:Catalog..." }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/result.ts";
import { en, formatIriError, named, namespace, parseIri, plain, RDF_TYPE } from "../../../kernel/rdf-term.ts";
import type { Named, Term, Triple } from "../../../kernel/rdf-term.ts";
import { turtle } from "../../../kernel/rdf-write.ts";

/** One file generated from an ontology. */
export type DcatDistributionInput = {
  /** The file's path below the download base (`generated/mizan.auto.ttl`). */
  readonly file: string;
  readonly title: string;
  readonly description?: string;
  /** The IANA media type, `text/turtle`. */
  readonly mediaType: string;
  /** The IRI of a specification the file conforms to (the SHACL recommendation for a shapes file). */
  readonly conformsTo?: string;
};

/** One published ontology and the files generated from it. */
export type DcatDatasetInput = {
  /** What makes the dataset's IRI (`mizan`). */
  readonly id: string;
  /** The ontology's IRI. */
  readonly ontologyIri: string;
  readonly versionInfo?: string;
  readonly title: string;
  readonly description?: string;
  readonly distributions: readonly DcatDistributionInput[];
};

/** A catalog of the ontologies a repository publishes. */
export type DcatCatalogInput = {
  readonly iri: string;
  readonly title: string;
  readonly description?: string;
  /** The IRI of the license of the catalog and of what it lists. */
  readonly license: string;
  readonly publisher: { readonly iri: string; readonly name: string };
  /** The URL a file's path is added to, for its download URL; it ends in `/`. */
  readonly downloadBase: string;
  readonly datasets: readonly DcatDatasetInput[];
  readonly comments?: readonly string[];
};

const dcat = namespace("dcat", "http://www.w3.org/ns/dcat#");
const dcterms = namespace("dcterms", "http://purl.org/dc/terms/");
const foaf = namespace("foaf", "http://xmlns.com/foaf/0.1/");
const IANA = "https://www.iana.org/assignments/media-types/";
const MEDIA_TYPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;

/** The catalog as DCAT 3 Turtle, or what stops it (an IRI that does not parse, a media type that is not one), one sentence each. */
export function exportDcat(c: DcatCatalogInput): Result<string, readonly string[]> {
  const findings: string[] = [];
  const node = (text: string): Named => {
    const r = parseIri(text);
    if (r.kind === "ok") return named(r.value);
    findings.push(formatIriError(r.error));
    return named(RDF_TYPE);
  };
  const triples: Triple[] = [];
  const add = (s: Named, p: Named, o: Term): void => void triples.push({ subject: s, predicate: p, object: o });
  const term = (ns: { readonly iri: string }, local: string): Named => node(`${ns.iri}${local}`);
  const a = named(RDF_TYPE);
  const catalog = node(c.iri);
  add(catalog, a, term(dcat, "Catalog"));
  add(catalog, term(dcterms, "title"), en(c.title));
  if (c.description !== undefined) add(catalog, term(dcterms, "description"), en(c.description));
  add(catalog, term(dcterms, "license"), node(c.license));
  const publisher = node(c.publisher.iri);
  add(catalog, term(dcterms, "publisher"), publisher);
  add(publisher, a, term(foaf, "Agent"));
  add(publisher, term(foaf, "name"), plain(c.publisher.name));
  for (const d of [...c.datasets].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
    const dataset = node(`${c.iri}#dataset-${d.id}`);
    add(catalog, term(dcat, "dataset"), dataset);
    add(dataset, a, term(dcat, "Dataset"));
    add(dataset, term(dcterms, "title"), en(d.title));
    if (d.description !== undefined) add(dataset, term(dcterms, "description"), en(d.description));
    add(dataset, term(dcterms, "identifier"), plain(d.ontologyIri));
    if (d.versionInfo !== undefined) add(dataset, term(dcat, "version"), plain(d.versionInfo));
    add(dataset, term(dcterms, "license"), node(c.license));
    add(dataset, term(dcterms, "publisher"), publisher);
    for (const f of d.distributions) {
      const base = f.file.slice(f.file.lastIndexOf("/") + 1);
      const dist = node(`${c.iri}#distribution-${d.id}-${base}`);
      add(dataset, term(dcat, "distribution"), dist);
      add(dist, a, term(dcat, "Distribution"));
      add(dist, term(dcterms, "title"), en(f.title));
      if (f.description !== undefined) add(dist, term(dcterms, "description"), en(f.description));
      add(dist, term(dcterms, "license"), node(c.license));
      if (!MEDIA_TYPE.test(f.mediaType)) findings.push(`${JSON.stringify(f.mediaType)} is not a media type`);
      else {
        add(dist, term(dcat, "mediaType"), node(`${IANA}${f.mediaType}`));
        add(dist, term(dcterms, "format"), node(`${IANA}${f.mediaType}`));
      }
      add(dist, term(dcat, "downloadURL"), node(`${c.downloadBase}${f.file}`));
      add(dist, term(dcat, "accessURL"), node(`${c.downloadBase}${f.file}`));
      if (f.conformsTo !== undefined) add(dist, term(dcterms, "conformsTo"), node(f.conformsTo));
    }
  }
  if (findings.length > 0) return err([...new Set(findings)]);
  return ok(turtle({ ...(c.comments === undefined ? {} : { comments: c.comments }), prefixes: [dcat, dcterms, foaf], triples }));
}
