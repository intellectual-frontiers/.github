/**
 * The basis of every term of the packaging ontology (commons 0018-standards-first FR-003 to FR-005, 0012-ontology FR-014): which standard each class and property rests on, or
 * that none is adopted yet. It is the first audit of an ontology as data, the baseline of its drift: five classes specialize schema.org, five properties map to a schema.org
 * property, and the rest are `unaligned`, each with the candidates still to examine and the day the audit was made, from which its decision is due within 90 days.
 *
 * @remarks
 * The packaging ontology itself is unchanged: this file describes its terms, and the check (`commons/libraries/src/check.ts`) fails where a term of the ontology has no record here.
 * The standards a term maps to are terms of the pinned schema.org import (`../supply-chain/packaging/schema.auto.ts`), so a mapping to a term that import does not hold does not compile.
 *
 * @limits
 * It is an audit of today's vocabulary, not a verdict: a term that is `unaligned` may still be right, and `closeMatch` is a judgement a person reviews. SPDX 3's `Hash` and
 * `hashValue` are candidates for the checksum terms that were not examined, because the SPDX model could not be fetched from this environment.
 *
 * @module
 */
import { en, type OntologyFile, RDFS, SKOS, term, XSD } from "@intellectual-frontiers/rdf";
import { bases, MZ, MZID, OntologyTerm } from "../mizan/mizan.ts";
import { pm } from "../supply-chain/packaging/packaging.ts";
import { schema } from "../supply-chain/packaging/schema.auto.ts";

/** The day the audit was made, from which the decision of each `unaligned` term is due (0018-standards-first FR-005). */
export const AUDITED_ON = "2026-11-17";

type Standard = { readonly iri: string; readonly relation: "subClassOf" | "closeMatch" | "narrowMatch" };

/** The terms of DCAT 3 (https://www.w3.org/ns/dcat3.ttl, W3C Recommendation) the download terms of a checksum map to: the address of a download, and the format of the package it gives. */
const DCAT = { downloadURL: "http://www.w3.org/ns/dcat#downloadURL", packageFormat: "http://www.w3.org/ns/dcat#packageFormat" } as const;
/** The `subpath` of the Package URL standard (Ecma-427): the path inside a package, relative to its root, with no `.` or `..` segment, which is what the folder of programs inside an unpacked artifact is. */
const PURL_SUBPATH = "https://github.com/package-url/purl-spec#subpath";
/** SKOS's `note`, of which the sentence that says why a platform is unpinned is a narrower kind. */
const SKOS_NOTE = "http://www.w3.org/2004/02/skos/core#note";

/** The terms of the packaging ontology that rest on a schema.org term, with the relation. */
const STANDARD: Readonly<Record<string, Standard>> = {
  PackageManager: { iri: schema.SoftwareApplication.iri, relation: "subClassOf" },
  SystemFamily: { iri: schema.Thing.iri, relation: "subClassOf" },
  Command: { iri: schema.Action.iri, relation: "subClassOf" },
  Program: { iri: schema.SoftwareApplication.iri, relation: "subClassOf" },
  PinnedDownload: { iri: schema.SoftwareApplication.iri, relation: "subClassOf" },
  version: { iri: schema.softwareVersion.iri, relation: "closeMatch" },
  name: { iri: schema.name.iri, relation: "closeMatch" },
  programName: { iri: schema.name.iri, relation: "closeMatch" },
  operatingSystem: { iri: schema.operatingSystem.iri, relation: "closeMatch" },
  processor: { iri: schema.processorRequirements.iri, relation: "closeMatch" },
  downloadUrl: { iri: DCAT.downloadURL, relation: "closeMatch" },
  archiveFormat: { iri: DCAT.packageFormat, relation: "closeMatch" },
  binPath: { iri: PURL_SUBPATH, relation: "closeMatch" },
  unpinnedReason: { iri: SKOS_NOTE, relation: "narrowMatch" },
};

/** What is still to examine for a term no standard is adopted for. */
function candidates(local: string): string {
  if (local === "Checksum" || local === "sha256")
    return "SPDX 3 Hash and hashValue (not examined: the SPDX model could not be fetched here)";
  if (local === "PackageName" || local === "purlType") return "the Package URL (purl) specification";
  if (local === "Platform" || local === "pinSuffix" || local === "pinKey")
    return "none found in schema.org; CycloneDX and SPDX platform terms to examine";
  return "none found in schema.org; SPDX 3 and the Package URL specification to examine";
}

function record(local: string) {
  const std = STANDARD[local];
  const iri = (pm as Readonly<Record<string, { readonly iri: string }>>)[local]?.iri ?? "";
  const base = { label: en(`pm:${local}`), termIri: iri, definedBy: ["0002-packaging"] };
  if (std === undefined) {
    return OntologyTerm.make(term(MZID, `term-pm-${local}`), {
      ...base,
      basis: bases.Unaligned,
      justification: `No standard adopted yet. Candidates to examine: ${candidates(local)}. Decision pending (0018-standards-first FR-005).`,
      addedOn: AUDITED_ON,
    });
  }
  return OntologyTerm.make(term(MZID, `term-pm-${local}`), {
    ...base,
    basis: std.relation === "subClassOf" ? bases.Specializes : bases.Maps,
    standardTerm: std.iri,
    mappingRelation: std.relation,
  });
}

/** One record for every class and property of the packaging ontology, in the order of its vocabulary. */
export const terms = Object.keys(pm).map(record);

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = { name: "audit-packaging", prefixes: [MZ, MZID, RDFS, SKOS, XSD], individuals: terms };
