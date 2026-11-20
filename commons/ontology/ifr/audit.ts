/**
 * The basis of every class and code-list class of the IFR vocabulary (commons 0018-standards-first FR-003 to FR-005): which standard each rests on, or why none is adopted.
 * Standards were looked for first: schema.org (`CreativeWork` and its `version`, `isPartOf`, `position`, `identifier`), IFLA LRM and FRBR (work, expression, manifestation, item), PROV-O
 * (the release and the records are entities), SKOS (the code lists), Git's own manual (the tag), Dublin Core Terms (`replaces`, `isReplacedBy`), OWL (`versionInfo`, `versionIRI`), SPDX 3
 * (`software_packageVersion`), the Citation File Format 1.2.0 and ISO 9001 and ISO 13485 for the document control of a controlled document. A class no standard names is `unaligned`, with what
 * was examined and the day it was added, from which its decision is due within 90 days.
 *
 * @remarks
 * Every IRI below is one the author is certain of. Where a candidate could not be checked in this environment it is named in the justification with `(to verify)` and is not an IRI of a
 * record: IFLA LRM publishes its elements in the IFLA Namespace for the LRM (`lrmer`), whose IRIs are to verify, so the three levels of the work rest on schema.org's `CreativeWork`, which
 * names no level. No decision is recorded yet for the classes that are `unaligned`: they are pending (0018-standards-first FR-005), held by the baseline of Mizan's check.
 *
 * @limits
 * Properties are not audited (the audit holds classes and code-list classes, like the audit of the other ontologies). `closeMatch` is a judgement a person reviews.
 *
 * @module
 */
import { absurd } from "../../core/src/mod.ts";
import { en, type Named, prov, skos, term } from "../../rdf/src/mod.ts";
import { bases, type Decision, type MAPPING_RELATIONS, MZID, OntologyTerm } from "../mizan/mizan.ts";
import { CLASS_NAMES, ifr, schemaWork } from "./ifr.ts";

/** The day the audit was made, from which the decision of each `unaligned` term is due (0018-standards-first FR-005). */
export const AUDITED_ON = "2026-11-17";

type ClassName = (typeof CLASS_NAMES)[number];
type Relation = (typeof MAPPING_RELATIONS)[number];

/** What a class rests on: a standard's term and how they relate, or what was examined and why nothing fits. */
type Basis =
  | { readonly kind: "specializes"; readonly standard: Named; readonly spec: string; readonly note?: string }
  | { readonly kind: "maps"; readonly standard: string; readonly relation: Relation; readonly spec: string; readonly note?: string }
  | { readonly kind: "unaligned"; readonly examined: string; readonly spec: string };

const LEVELS =
  "schema.org's CreativeWork names no level of a work, and IFLA LRM (Work, Expression, Manifestation, Item; its namespace and IRIs are to verify) and FRBR do, so the class is a CreativeWork and the level is kept by the properties that join them";

/** The basis of each class, by its local name; the type makes a class with none a compile error. */
const BASIS: Readonly<Record<ClassName, Basis>> = {
  Work: { kind: "specializes", standard: schemaWork.CreativeWork, spec: "0026-works-versioning FR-003", note: `LRM's Work. ${LEVELS}` },
  Expression: { kind: "specializes", standard: schemaWork.CreativeWork, spec: "0026-works-versioning FR-003", note: `LRM's Expression. ${LEVELS}` },
  Manifestation: {
    kind: "specializes",
    standard: schemaWork.CreativeWork,
    spec: "0026-works-versioning FR-003",
    note: `LRM's Manifestation, the rendition. ${LEVELS}`,
  },
  Release: {
    kind: "specializes",
    standard: prov.Entity,
    spec: "0026-works-versioning FR-017",
    note: "A release is the entity a tag names; its lineage is PROV-O's wasRevisionOf and wasDerivedFrom, and SPDX 3 names the version of a package software_packageVersion (its IRI is to verify)",
  },
  Edition: {
    kind: "unaligned",
    spec: "0026-works-versioning FR-011",
    examined:
      "schema.org has bookEdition, a property whose value is text, not a class of what an edition is; the Bibliographic Ontology's edition is a property too (to verify); IFLA LRM has no edition among its entities, only the attribute 'edition statement' of a manifestation (to verify). None defines an edition as a release of published prose",
  },
  VersionScheme: { kind: "specializes", standard: skos.Concept, spec: "0026-works-versioning FR-004" },
  WorkKind: { kind: "specializes", standard: skos.Concept, spec: "0026-works-versioning FR-004" },
  Impact: { kind: "specializes", standard: skos.Concept, spec: "0026-works-versioning FR-004" },
  ReleaseTag: {
    kind: "maps",
    standard: "https://git-scm.com/docs/git-tag",
    relation: "closeMatch",
    spec: "0026-works-versioning FR-018",
    note: "Git defines the annotated and the signed tag in its manual and publishes no RDF vocabulary, so the mapping names the manual page of git-tag",
  },
  ReleaseRecord: {
    kind: "specializes",
    standard: prov.Entity,
    spec: "0026-works-versioning FR-008",
    note: "A file is an entity; its fields follow schema.org's CreativeWork (version, identifier, isPartOf, position) and CodeMeta's software metadata (to verify)",
  },
  Retention: {
    kind: "unaligned",
    spec: "0026-works-versioning FR-027",
    examined:
      "ODRL has the action delete and the constraint elapsedTime, which a policy can say as a duty to delete after a period, but it is a policy language and not a record of how long bytes are kept (to verify); ISO 15489 (records management) and PREMIS (preservation metadata) name retention and disposition without a published RDF class for it (to verify); DCAT has no retention term",
  },
  Tombstone: {
    kind: "unaligned",
    spec: "0026-works-versioning FR-027",
    examined:
      "The DOI and DataCite practice of a tombstone page for a withdrawn record, and HTTP 410 Gone, name the behavior; no standard publishes a class for the record of a version whose bytes are removed but whose digest and metadata remain (to verify DataCite's schema)",
  },
  ApprovalRecord: {
    kind: "specializes",
    standard: prov.Entity,
    spec: "0026-works-versioning FR-013",
    note: "The approving is a PROV-O activity of an agent in a role (prov:Association and prov:hadRole); the record of it is an entity. ISO 9001:2015 clause 7.5.3 and ISO 13485:2016 clause 4.2.4 ask for the approval of a controlled document before its use",
  },
  Citation: {
    kind: "unaligned",
    spec: "0026-works-versioning FR-024",
    examined:
      "The Citation File Format 1.2.0 is a file format with a JSON Schema and no RDF vocabulary; schema.org has the property citation, which points at a work cited and not at how a work is cited; DataCite's metadata schema and CodeMeta (to verify) describe a work's metadata, not the citation of it as a file",
  },
};

/** One audit record for a class. */
function record(local: ClassName) {
  const b = BASIS[local];
  const base = {
    label: en(`ifr:${local}`),
    termIri: ifr[local].iri,
    definedBy: [b.spec],
  };
  const id = term<"mz:OntologyTerm">(MZID, `term-ifr-${local}`);
  switch (b.kind) {
    case "specializes":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Specializes,
        standardTerm: b.standard.iri,
        mappingRelation: "subClassOf",
        ...(b.note === undefined ? {} : { justification: b.note }),
      });
    case "maps":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Maps,
        standardTerm: b.standard,
        mappingRelation: b.relation,
        ...(b.note === undefined ? {} : { justification: b.note }),
      });
    case "unaligned":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Unaligned,
        justification: `No standard adopted yet. Examined: ${b.examined}. Decision pending (0018-standards-first FR-005).`,
        addedOn: AUDITED_ON,
      });
    default:
      return absurd(b);
  }
}

/** One record for every class and code-list class of the IFR vocabulary, in the order of `CLASS_NAMES`. */
export const terms = CLASS_NAMES.map(record);

/** The decisions of the terms kept unaligned: none yet, the four `unaligned` classes are pending (0018-standards-first FR-005). */
export const decisions: readonly ReturnType<typeof Decision.make>[] = [];
