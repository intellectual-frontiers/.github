/**
 * The vocabulary of Intellectual Frontiers Releases, IFR (commons 0026-works-versioning): a work and what it is published as, the kind of work and the one scheme of version its kind
 * uses, the release that is a signed Git tag, what a release keeps (its retention and, where bytes are gone, its tombstone), the approval record of a controlled document and the citation.
 *
 * @remarks
 * IFR keeps five things apart that a version number is too often asked to carry: the identity of a work (`ifr:Work`, a slug and an IRI that never change), a state of its content
 * (`ifr:Expression`, whose version or edition is `ifr:version`), a rendition of it (`ifr:Manifestation`: a PDF, an EPUB, a print run), and a release (`ifr:Release`: a version that was published,
 * named by a tag, immutable). It stands on schema.org's `CreativeWork` (`version`, `isPartOf`, `position`, `identifier`), IFLA LRM (work, expression, manifestation: the IRIs are to verify),
 * Dublin Core (`replaces`, `isReplacedBy`), PROV-O (`wasRevisionOf`, `wasDerivedFrom`), OWL (`versionInfo`, `versionIRI`), SPDX 3 (`software_packageVersion`) and SemVer 2.0.0. The code lists carry
 * the facts the tools branch on: which scheme each kind of work uses, the pattern of each scheme's versions and what each impact is.
 *
 * @limits
 * Properties are not audited (the audit holds the classes and code-list classes). The vocabulary has no individuals but the code lists: a work's own record is `<work>/release.ts`
 * (0026-works-versioning FR-008), not ontology. No DOI is minted here: `ifr:identifier` only records one.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  en,
  iriIn,
  namespace,
  named,
  ObjectProperty,
  one,
  ontologyOf,
  optional,
  OwlClass,
  OwlOntology,
  prov,
  range,
  rdfs,
  skos,
  vocabulary,
  xsd,
} from "../../rdf/src/mod.ts";
import { ifqs } from "../ifqs/ifqs.ts";
import { mz } from "../mizan/mizan.ts";
import { SCHEMA } from "../supply-chain/packaging/schema.auto.ts";

/** The namespace of IFR's terms. */
export const IFR = namespace("ifr", "https://www.intellectualfrontiers.com/ontology/ifr#");
/** The namespace of the versions of IFR's ontology: `owl:versionIRI` names one of them. */
export const IFRV = namespace("ifrv", "https://www.intellectualfrontiers.com/ontology/ifr/");
/** The terms of schema.org that IFR specializes and the imported slice does not hold yet. */
export const schemaWork = vocabulary(SCHEMA, { CreativeWork: "rdfs:Class" });

/** The classes of the vocabulary, by local name: each has a record of its basis in `audit.ts`. */
export const CLASS_NAMES = [
  "Work",
  "Expression",
  "Manifestation",
  "Release",
  "Edition",
  "VersionScheme",
  "WorkKind",
  "Impact",
  "ReleaseTag",
  "ReleaseRecord",
  "Retention",
  "Tombstone",
  "ApprovalRecord",
  "Citation",
] as const;

/** The terms of IFR's vocabulary: its classes and properties. */
export const ifr = vocabulary(IFR, {
  Work: "owl:Class",
  Expression: "owl:Class",
  Manifestation: "owl:Class",
  Release: "owl:Class",
  Edition: "owl:Class",
  VersionScheme: "owl:Class",
  WorkKind: "owl:Class",
  Impact: "owl:Class",
  ReleaseTag: "owl:Class",
  ReleaseRecord: "owl:Class",
  Retention: "owl:Class",
  Tombstone: "owl:Class",
  ApprovalRecord: "owl:Class",
  Citation: "owl:Class",
  // Work: its identity and its place
  slug: "owl:DatatypeProperty",
  workIri: "owl:DatatypeProperty",
  kind: "owl:ObjectProperty",
  isPartOf: "owl:ObjectProperty",
  position: "owl:DatatypeProperty",
  identifier: "owl:DatatypeProperty",
  hasExpression: "owl:ObjectProperty",
  hasRelease: "owl:ObjectProperty",
  hasCitation: "owl:ObjectProperty",
  // Expression and manifestation
  hasRendition: "owl:ObjectProperty",
  renditionFormat: "owl:DatatypeProperty",
  printing: "owl:DatatypeProperty",
  // Kind and scheme
  usesScheme: "owl:ObjectProperty",
  companionScheme: "owl:ObjectProperty",
  versionPattern: "owl:DatatypeProperty",
  precedenceRule: "owl:DatatypeProperty",
  impactRank: "owl:DatatypeProperty",
  // Release
  releaseOf: "owl:ObjectProperty",
  realizes: "owl:ObjectProperty",
  version: "owl:DatatypeProperty",
  releaseScheme: "owl:ObjectProperty",
  declaredImpact: "owl:ObjectProperty",
  releaseCommit: "owl:DatatypeProperty",
  treeHash: "owl:DatatypeProperty",
  releasedOn: "owl:DatatypeProperty",
  releaseTag: "owl:ObjectProperty",
  replaces: "owl:ObjectProperty",
  isReplacedBy: "owl:ObjectProperty",
  revisionOf: "owl:ObjectProperty",
  retiredOn: "owl:DatatypeProperty",
  archivedOn: "owl:DatatypeProperty",
  releaseIdentifier: "owl:DatatypeProperty",
  bookEditionNumber: "owl:DatatypeProperty",
  snapshotDigest: "owl:DatatypeProperty",
  provenance: "owl:DatatypeProperty",
  sbom: "owl:DatatypeProperty",
  checksum: "owl:DatatypeProperty",
  releasedOnTier: "owl:ObjectProperty",
  hasRetention: "owl:ObjectProperty",
  hasApproval: "owl:ObjectProperty",
  // Release tag
  tagName: "owl:DatatypeProperty",
  tagSigned: "owl:DatatypeProperty",
  tagCommit: "owl:DatatypeProperty",
  // Release record
  recordPath: "owl:DatatypeProperty",
  recordOf: "owl:ObjectProperty",
  // Retention and tombstone
  retentionPeriod: "owl:DatatypeProperty",
  tombstoneOf: "owl:ObjectProperty",
  bytesRemovedOn: "owl:DatatypeProperty",
  digestKept: "owl:DatatypeProperty",
  // Approval record
  approvalOf: "owl:ObjectProperty",
  approvedBy: "owl:DatatypeProperty",
  approverRole: "owl:DatatypeProperty",
  approvedOn: "owl:DatatypeProperty",
  approvalDecision: "owl:ObjectProperty",
  // Citation
  citationOf: "owl:ObjectProperty",
  citationFormat: "owl:DatatypeProperty",
});

/** The local names of the terms the vocabulary holds, as a specification may name them: the classes and properties, then every key of a code list (see `termNames`). */
export const VOCABULARY_NAMES: readonly string[] = Object.keys(ifr);

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/**
 * The schemes of version (0026-works-versioning FR-005, FR-006): the pattern each scheme's versions have (`NoVersion` has none) and how two of them are ordered.
 * The patterns use no backslash so that every generated form carries them as they are.
 */
export const versionSchemes = codes(
  classSchema(ifr.VersionScheme, {
    ...CODE,
    versionPattern: optional(ifr.versionPattern, range.string),
    precedenceRule: one(ifr.precedenceRule, range.string),
  }),
  IFR,
  {
    SemVer: {
      label: en("SemVer"),
      definition: en("Semantic Versioning 2.0.0: MAJOR.MINOR.PATCH with an optional pre-release; build metadata after a plus sign is not part of precedence."),
      versionPattern:
        "^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)(-((0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)([.](0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*))?([+][0-9a-zA-Z-]+([.][0-9a-zA-Z-]+)*)?$",
      precedenceRule: "SemVer 2.0.0 section 11: major, minor and patch as numbers, a pre-release before its release, build metadata ignored",
    },
    CommitDateEdition: {
      label: en("commit-date edition"),
      definition: en("The UTC date of the commit the edition is made at, a hyphen and the first eight characters of that commit: YYYY.MM.DD-commit8; never the clock."),
      versionPattern: "^[0-9]{4}[.][0-9]{2}[.][0-9]{2}-[0-9a-f]{8}$",
      precedenceRule: "the date, and where the dates are equal the later commit in the history; two editions of one commit are one edition",
    },
    SnapshotDate: {
      label: en("snapshot date"),
      definition: en("The day a dataset was snapshotted, YYYY-MM-DD, with the SHA-256 of the snapshot kept beside it and a SemVer for the schema of the data."),
      versionPattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      precedenceRule: "the date, later is greater; one date is one snapshot",
    },
    IntegerRevision: {
      label: en("integer revision"),
      definition: en("A whole number from 1 that a controlled document's revision carries, raised only with an approval record."),
      versionPattern: "^[1-9][0-9]*$",
      precedenceRule: "the number, greater is later",
    },
    NoVersion: {
      label: en("no version"),
      definition: en("The scheme of a specification: it has no version, its requirement identifiers are never renumbered and its revision is the commit."),
      precedenceRule: "none: the commit orders the revisions",
    },
  },
);

/** The kinds of work, and the one scheme of version each uses (0026-works-versioning FR-005): Data also carries a SemVer for its schema. */
export const workKinds = codes(
  classSchema(ifr.WorkKind, {
    ...CODE,
    usesScheme: one(ifr.usesScheme, range.ref<"ifr:VersionScheme">()),
    companionScheme: optional(ifr.companionScheme, range.ref<"ifr:VersionScheme">()),
  }),
  IFR,
  {
    Software: { label: en("software"), definition: en("A program or a service."), usesScheme: versionSchemes.SemVer },
    Library: { label: en("library"), definition: en("Code another program imports."), usesScheme: versionSchemes.SemVer },
    CommandLineInterface: {
      label: en("command-line interface"),
      definition: en("A command, its options and its output, which a script depends on."),
      usesScheme: versionSchemes.SemVer,
    },
    Ontology: { label: en("ontology"), definition: en("A published vocabulary: its terms are its interface."), usesScheme: versionSchemes.SemVer },
    Schema: { label: en("schema"), definition: en("A published schema of data or of a message."), usesScheme: versionSchemes.SemVer },
    Prose: { label: en("prose"), definition: en("A book, a manual or a paper: published text."), usesScheme: versionSchemes.CommitDateEdition },
    Data: {
      label: en("data"),
      definition: en("A dataset: a snapshot with its digest, and a SemVer for its schema."),
      usesScheme: versionSchemes.SnapshotDate,
      companionScheme: versionSchemes.SemVer,
    },
    ControlledDocument: {
      label: en("controlled document"),
      definition: en("A policy or a procedure under document control: an integer revision and an approval."),
      usesScheme: versionSchemes.IntegerRevision,
    },
    Specification: { label: en("specification"), definition: en("A specification: it has no version."), usesScheme: versionSchemes.NoVersion },
  },
);

/** The impact of a change on the work's users, from which a version is raised (0026-works-versioning FR-021). */
export const impacts = codes(classSchema(ifr.Impact, { ...CODE, impactRank: one(ifr.impactRank, range.integer) }), IFR, {
  Major: { label: en("major"), definition: en("A change that breaks what a user of the work relied on."), impactRank: 3 },
  Minor: { label: en("minor"), definition: en("A change that adds and breaks nothing."), impactRank: 2 },
  Patch: { label: en("patch"), definition: en("A change that corrects and adds nothing."), impactRank: 1 },
});

// ---- the class schemas the data is made with

/** The schema of a release tag (`ifr:ReleaseTag`): the annotated tag `<slug>-v<version>`, whether it is signed and the commit it names. */
export const ReleaseTag = classSchema(ifr.ReleaseTag, {
  tagName: one(ifr.tagName, range.string),
  tagSigned: one(ifr.tagSigned, range.boolean),
  tagCommit: one(ifr.tagCommit, range.string),
});

/** The schema of an approval record (`ifr:ApprovalRecord`): a person, a role, a day and the Decision. */
export const ApprovalRecord = classSchema(ifr.ApprovalRecord, {
  approvedBy: one(ifr.approvedBy, range.string),
  approverRole: one(ifr.approverRole, range.string),
  approvedOn: one(ifr.approvedOn, range.string),
  approvalDecision: one(ifr.approvalDecision, range.ref<"mz:Decision">()),
});

/** The schema of a retention (`ifr:Retention`): the period after which bytes may be deleted. */
export const Retention = classSchema(ifr.Retention, {
  retentionPeriod: one(ifr.retentionPeriod, range.string),
});

// ---- the classes, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(ifr.Work, {
    label: en("Work"),
    subClassOf: [schemaWork.CreativeWork],
    definition: en("A work in its identity: a slug and an IRI that never change, whatever is published of it and however often; a volume's position in a series never changes either."),
  }),
  OwlClass.make(ifr.Expression, {
    label: en("Expression"),
    subClassOf: [schemaWork.CreativeWork],
    definition: en("A state of a work's content, which a version or an edition names: the text or the code as it was at one commit, in no form yet."),
  }),
  OwlClass.make(ifr.Manifestation, {
    label: en("Manifestation"),
    subClassOf: [schemaWork.CreativeWork],
    definition: en("A rendition of an expression: a PDF, an EPUB, a print run, a package; it has a format and, where printed, a printing, and no version of its own."),
  }),
  OwlClass.make(ifr.Release, {
    label: en("Release"),
    subClassOf: [prov.Entity],
    definition: en("A version of a work that was published: it names its commit and its Git tree hash, is named by a signed annotated tag and is immutable."),
  }),
  OwlClass.make(ifr.Edition, {
    label: en("Edition"),
    subClassOf: [ifr.Release],
    definition: en("A release of published prose, whose version is a commit-date edition."),
  }),
  OwlClass.make(ifr.VersionScheme, {
    label: en("Version scheme"),
    definition: en("One way of writing a version and ordering versions: SemVer, commit-date edition, snapshot date, integer revision or none."),
  }),
  OwlClass.make(ifr.WorkKind, { label: en("Work kind"), definition: en("The kind of a work, which fixes the one scheme of version it uses.") }),
  OwlClass.make(ifr.Impact, {
    label: en("Impact"),
    definition: en("Major, minor or patch: what a change does to those who use the work, from which the next version is made."),
  }),
  OwlClass.make(ifr.ReleaseTag, {
    label: en("Release tag"),
    definition: en("The signed annotated Git tag `<slug>-v<version>` that makes a version a release; the ledger of releases is derived from these tags."),
  }),
  OwlClass.make(ifr.ReleaseRecord, {
    label: en("Release record"),
    subClassOf: [prov.Entity],
    definition: en("The typed file `<work>/release.ts` that names a work's kind, its identity and its present version, written by a tool and never by hand."),
  }),
  OwlClass.make(ifr.Retention, {
    label: en("Retention"),
    definition: en("How long the bytes of a published version are kept: digests and metadata are kept forever, bytes only for the period stated."),
  }),
  OwlClass.make(ifr.Tombstone, {
    label: en("Tombstone"),
    definition: en("What an identifier resolves to where the bytes of a version are gone: the version's metadata, its digest and the day the bytes were removed."),
  }),
  OwlClass.make(ifr.ApprovalRecord, {
    label: en("Approval record"),
    subClassOf: [prov.Entity],
    definition: en("The approval of a revision of a controlled document: a person, a role, a day and the Decision."),
  }),
  OwlClass.make(ifr.Citation, {
    label: en("Citation"),
    definition: en("How a work is cited: its `CITATION.cff`, generated from its release record, with a DOI only where the record carries one."),
  }),
] as const;

const WORK = ifr.Work;
const RELEASE = ifr.Release;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(ifr.slug, {
    label: en("slug"),
    domain: WORK,
    range: xsd.string,
    definition: en("The work's slug, lower-case letters, digits and hyphens: the prefix of its tags. It never changes."),
  }),
  DatatypeProperty.make(ifr.workIri, { label: en("work IRI"), domain: WORK, range: xsd.string, definition: en("The IRI that identifies the work. It never changes.") }),
  ObjectProperty.make(ifr.kind, { label: en("kind"), domain: WORK, range: ifr.WorkKind, definition: en("The kind of the work, which fixes its scheme of version.") }),
  ObjectProperty.make(ifr.isPartOf, {
    label: en("is part of"),
    domain: WORK,
    range: WORK,
    definition: en("The work this one is a part of, such as a series (schema.org `isPartOf`)."),
  }),
  DatatypeProperty.make(ifr.position, {
    label: en("position"),
    domain: WORK,
    range: xsd.integer,
    definition: en("The work's position in the work it is part of, from 1 (schema.org `position`). It never changes."),
  }),
  DatatypeProperty.make(ifr.identifier, {
    label: en("identifier"),
    domain: WORK,
    range: xsd.string,
    definition: en("An external identifier of the work, such as a DOI; recorded where a work has one, never required."),
  }),
  ObjectProperty.make(ifr.hasExpression, { label: en("has expression"), domain: WORK, range: ifr.Expression, definition: en("A state of the work's content.") }),
  ObjectProperty.make(ifr.hasRelease, { label: en("has release"), domain: WORK, range: RELEASE, definition: en("A release of the work.") }),
  ObjectProperty.make(ifr.hasCitation, { label: en("has citation"), domain: WORK, range: ifr.Citation, definition: en("How the work is cited.") }),
  ObjectProperty.make(ifr.hasRendition, {
    label: en("has rendition"),
    domain: ifr.Expression,
    range: ifr.Manifestation,
    definition: en("A form the expression is rendered in."),
  }),
  DatatypeProperty.make(ifr.renditionFormat, {
    label: en("rendition format"),
    domain: ifr.Manifestation,
    range: xsd.string,
    definition: en("The media type of the rendition."),
  }),
  DatatypeProperty.make(ifr.printing, {
    label: en("printing"),
    domain: ifr.Manifestation,
    range: xsd.integer,
    definition: en("The printing of a print rendition, from 1; it is a property of the rendition and not a version."),
  }),
  ObjectProperty.make(ifr.usesScheme, {
    label: en("uses scheme"),
    domain: ifr.WorkKind,
    range: ifr.VersionScheme,
    definition: en("The one scheme of version the kind uses."),
  }),
  ObjectProperty.make(ifr.companionScheme, {
    label: en("companion scheme"),
    domain: ifr.WorkKind,
    range: ifr.VersionScheme,
    definition: en("The scheme of a second version a kind carries beside its own: the schema of a dataset."),
  }),
  DatatypeProperty.make(ifr.versionPattern, {
    label: en("version pattern"),
    domain: ifr.VersionScheme,
    range: xsd.string,
    definition: en("The regular expression a version of the scheme matches."),
  }),
  DatatypeProperty.make(ifr.precedenceRule, {
    label: en("precedence rule"),
    domain: ifr.VersionScheme,
    range: xsd.string,
    definition: en("How two versions of the scheme are ordered."),
  }),
  DatatypeProperty.make(ifr.impactRank, {
    label: en("impact rank"),
    domain: ifr.Impact,
    range: xsd.integer,
    definition: en("The rank of the impact: the greatest of the impacts of the changes is the impact of the release."),
  }),
  ObjectProperty.make(ifr.releaseOf, { label: en("release of"), domain: RELEASE, range: WORK, definition: en("The work the release is of.") }),
  ObjectProperty.make(ifr.realizes, { label: en("realizes"), domain: RELEASE, range: ifr.Expression, definition: en("The expression the release publishes.") }),
  DatatypeProperty.make(ifr.version, {
    label: en("version"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The release's version, written by the scheme of its work's kind (schema.org `version`, OWL `versionInfo`)."),
  }),
  ObjectProperty.make(ifr.releaseScheme, {
    label: en("release scheme"),
    domain: RELEASE,
    range: ifr.VersionScheme,
    definition: en("The scheme the release's version is written in."),
  }),
  ObjectProperty.make(ifr.declaredImpact, {
    label: en("declared impact"),
    domain: RELEASE,
    range: ifr.Impact,
    definition: en("The impact the capability that raised the version declared."),
  }),
  DatatypeProperty.make(ifr.releaseCommit, {
    label: en("release commit"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The commit the release names, as its full object name."),
  }),
  DatatypeProperty.make(ifr.treeHash, {
    label: en("tree hash"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The Git tree hash of that commit: what the release holds."),
  }),
  DatatypeProperty.make(ifr.releasedOn, {
    label: en("released on"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD, UTC) of the release's commit, never the clock's."),
  }),
  ObjectProperty.make(ifr.releaseTag, { label: en("release tag"), domain: RELEASE, range: ifr.ReleaseTag, definition: en("The tag that names the release.") }),
  ObjectProperty.make(ifr.replaces, {
    label: en("replaces"),
    domain: RELEASE,
    range: RELEASE,
    definition: en("The release this one replaces (Dublin Core `replaces`)."),
  }),
  ObjectProperty.make(ifr.isReplacedBy, {
    label: en("is replaced by"),
    domain: RELEASE,
    range: RELEASE,
    definition: en("The release that replaces this one (Dublin Core `isReplacedBy`)."),
  }),
  ObjectProperty.make(ifr.revisionOf, {
    label: en("revision of"),
    domain: RELEASE,
    range: RELEASE,
    definition: en("The release this one revises (PROV-O `wasRevisionOf`)."),
  }),
  DatatypeProperty.make(ifr.retiredOn, {
    label: en("retired on"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The day the release was retired: still resolvable, no longer advised."),
  }),
  DatatypeProperty.make(ifr.archivedOn, { label: en("archived on"), domain: RELEASE, range: xsd.string, definition: en("The day the release was archived.") }),
  DatatypeProperty.make(ifr.releaseIdentifier, {
    label: en("release identifier"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("An external identifier of this release, such as a version DOI; recorded where it has one."),
  }),
  DatatypeProperty.make(ifr.bookEditionNumber, {
    label: en("book edition number"),
    domain: ifr.Edition,
    range: xsd.integer,
    definition: en("The edition number a publisher prints (schema.org `bookEdition`): a label of the edition, never its version."),
  }),
  DatatypeProperty.make(ifr.snapshotDigest, {
    label: en("snapshot digest"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The SHA-256 of a dataset's snapshot, in lower-case hexadecimal."),
  }),
  DatatypeProperty.make(ifr.provenance, {
    label: en("provenance"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The provenance attestation of the release (SLSA, in-toto), by its digest."),
  }),
  DatatypeProperty.make(ifr.sbom, {
    label: en("SBOM"),
    domain: RELEASE,
    range: xsd.string,
    definition: en("The software bill of materials of the release (SPDX 3), by its digest."),
  }),
  DatatypeProperty.make(ifr.checksum, { label: en("checksum"), domain: RELEASE, range: xsd.string, definition: en("The SHA-256 of an artifact of the release.") }),
  ObjectProperty.make(ifr.releasedOnTier, {
    label: en("released on tier"),
    domain: RELEASE,
    range: ifqs.QualityTier,
    definition: en("The evidence tier of the quality system (0021-ifqs) the release was made on."),
  }),
  ObjectProperty.make(ifr.hasRetention, {
    label: en("has retention"),
    domain: RELEASE,
    range: ifr.Retention,
    definition: en("How long the bytes of the release are kept."),
  }),
  ObjectProperty.make(ifr.hasApproval, {
    label: en("has approval"),
    domain: RELEASE,
    range: ifr.ApprovalRecord,
    definition: en("The approval of a revision of a controlled document."),
  }),
  DatatypeProperty.make(ifr.tagName, {
    label: en("tag name"),
    domain: ifr.ReleaseTag,
    range: xsd.string,
    definition: en("The tag's name: the slug, `-v` and the version."),
  }),
  DatatypeProperty.make(ifr.tagSigned, {
    label: en("tag signed"),
    domain: ifr.ReleaseTag,
    range: xsd.boolean,
    definition: en("Whether the tag carries a signature that verifies."),
  }),
  DatatypeProperty.make(ifr.tagCommit, { label: en("tag commit"), domain: ifr.ReleaseTag, range: xsd.string, definition: en("The commit the tag names.") }),
  DatatypeProperty.make(ifr.recordPath, {
    label: en("record path"),
    domain: ifr.ReleaseRecord,
    range: xsd.string,
    definition: en("The path of the record, `<work>/release.ts`."),
  }),
  ObjectProperty.make(ifr.recordOf, { label: en("record of"), domain: ifr.ReleaseRecord, range: WORK, definition: en("The work the record is of.") }),
  DatatypeProperty.make(ifr.retentionPeriod, {
    label: en("retention period"),
    domain: ifr.Retention,
    range: xsd.string,
    definition: en("The period after which bytes may be deleted, as an ISO 8601 duration such as P10Y."),
  }),
  ObjectProperty.make(ifr.tombstoneOf, { label: en("tombstone of"), domain: ifr.Tombstone, range: RELEASE, definition: en("The release whose bytes are gone.") }),
  DatatypeProperty.make(ifr.bytesRemovedOn, {
    label: en("bytes removed on"),
    domain: ifr.Tombstone,
    range: xsd.string,
    definition: en("The day the bytes were removed."),
  }),
  DatatypeProperty.make(ifr.digestKept, {
    label: en("digest kept"),
    domain: ifr.Tombstone,
    range: xsd.string,
    definition: en("The SHA-256 of the bytes that were removed."),
  }),
  ObjectProperty.make(ifr.approvalOf, {
    label: en("approval of"),
    domain: ifr.ApprovalRecord,
    range: RELEASE,
    definition: en("The revision the approval is of."),
  }),
  DatatypeProperty.make(ifr.approvedBy, {
    label: en("approved by"),
    domain: ifr.ApprovalRecord,
    range: xsd.string,
    definition: en("The person who approved: data in the record, never inferred."),
  }),
  DatatypeProperty.make(ifr.approverRole, {
    label: en("approver role"),
    domain: ifr.ApprovalRecord,
    range: xsd.string,
    definition: en("The role in which the person approved."),
  }),
  DatatypeProperty.make(ifr.approvedOn, {
    label: en("approved on"),
    domain: ifr.ApprovalRecord,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) of the approval."),
  }),
  ObjectProperty.make(ifr.approvalDecision, {
    label: en("approval decision"),
    domain: ifr.ApprovalRecord,
    range: mz.Decision,
    definition: en("The Decision that records the approval."),
  }),
  ObjectProperty.make(ifr.citationOf, { label: en("citation of"), domain: ifr.Citation, range: WORK, definition: en("The work the citation is of.") }),
  DatatypeProperty.make(ifr.citationFormat, {
    label: en("citation format"),
    domain: ifr.Citation,
    range: xsd.string,
    definition: en("The format of the citation file: `CITATION.cff` 1.2.0."),
  }),
] as const;

/** The ontology itself: its label, description and version. */
export const ifrOntology = OwlOntology.make(ontologyOf(IFR), {
  label: en("Intellectual Frontiers Releases"),
  description: en(
    "The vocabulary of Intellectual Frontiers Releases: a work and what it is published as, the kind of work and its one scheme of version, the release that is a signed Git tag, its retention, approval and citation.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(IFRV, "1.0.0")),
});

/** The code lists, by the class each is of. */
export const codeLists = {
  VersionScheme: versionSchemes,
  WorkKind: workKinds,
  Impact: impacts,
} as const;

/** The classes whose individuals are a code list: each has a record in the audit like any class. */
export const CODE_LIST_CLASSES = Object.keys(codeLists) as readonly (keyof typeof codeLists)[];

/** Every local name a specification may use after `ifr:`: the vocabulary's terms and the keys of each code list. */
export const termNames: ReadonlySet<string> = new Set([...VOCABULARY_NAMES, ...Object.values(codeLists).flatMap((list) => Object.keys(list))]);
