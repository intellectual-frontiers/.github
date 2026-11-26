/**
 * The shared vocabulary of Mizan, the IF Spec Profile (commons 0003-mizan, 0016-ladder, 0017-two-languages, 0018-standards-first, 0019-mizan-integrations, 0028-conformance-levels, 0029-subject-profiles): the ladder's
 * rungs, a specification and its requirements, the standards and the laws a term or a requirement rests on, the basis of every term, the decisions and exceptions that
 * justify what no standard names, and the integrations that bring standards in and put ours out.
 *
 * @remarks
 * A harness states its own homes, checks and rely-on edges as individuals of `mz:Rung` in its own ontology, and keeps its own namespace for its own terms; it imports
 * these classes and does not copy them. The first individuals are the nine rungs (0 to 7 required, 8 the optional lifecycle), whose rely-on edges are those the harnesses
 * of Intellectual Frontiers already keep, and the laws the first domains rest on. Every class below also has an `mz:OntologyTerm` individual saying its basis
 * (0018-standards-first FR-003): the first baseline of Mizan's own vocabulary.
 *
 * @limits
 * It does not yet carry the basis on every property, nor on the kernel's own class schemas (0012-ontology FR-014); the properties are held in the baseline until the
 * schemas require it.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  DCTERMS,
  iriIn,
  dcterms,
  en,
  many,
  namespace,
  named,
  type Named,
  ObjectProperty,
  one,
  type OntologyFile,
  ontologyOf,
  optional,
  OWL,
  OwlClass,
  OwlOntology,
  range,
  RDFS,
  rdfs,
  SKOS,
  skos,
  term,
  vocabulary,
  XSD,
  xsd,
} from "@intellectual-frontiers/rdf";

/** The namespace of Mizan's terms. */
export const MZ = namespace("mz", "https://www.intellectualfrontiers.com/ontology/mizan#");
/** The namespace of the versions of Mizan's ontology: `owl:versionIRI` names one of them, so that a consumer outside TypeScript can pin the version it read. */
export const MZV = namespace("mzv", "https://www.intellectualfrontiers.com/ontology/mizan/");
/** The namespace of Mizan's individuals: the rungs, the jurisdictions, the authorities and the terms' bases. */
export const MZID = namespace("mzid", "https://www.intellectualfrontiers.com/id/mizan/");

/** The terms of Mizan's vocabulary: its classes and properties. */
export const mz = vocabulary(MZ, {
  Rung: "owl:Class",
  RungKind: "owl:Class",
  Spec: "owl:Class",
  Requirement: "owl:Class",
  OntologyTerm: "owl:Class",
  Basis: "owl:Class",
  Standard: "owl:Class",
  Authority: "owl:Class",
  Jurisdiction: "owl:Class",
  JurisdictionLevel: "owl:Class",
  Decision: "owl:Class",
  Exception: "owl:Class",
  Integration: "owl:Class",
  IntegrationDirection: "owl:Class",
  ImportRecord: "owl:Class",
  ConformanceLevel: "owl:Class",
  ConformanceRequirement: "owl:Class",
  SubjectKind: "owl:Class",
  AudienceModel: "owl:Class",
  rungNumber: "owl:DatatypeProperty",
  kind: "owl:ObjectProperty",
  mayRelyOn: "owl:ObjectProperty",
  home: "owl:DatatypeProperty",
  provedBy: "owl:DatatypeProperty",
  spec: "owl:DatatypeProperty",
  specId: "owl:DatatypeProperty",
  specStatus: "owl:DatatypeProperty",
  ofSpec: "owl:ObjectProperty",
  requirementId: "owl:DatatypeProperty",
  authority: "owl:ObjectProperty",
  termIri: "owl:DatatypeProperty",
  basis: "owl:ObjectProperty",
  standardTerm: "owl:DatatypeProperty",
  mappingRelation: "owl:DatatypeProperty",
  deprecatedOn: "owl:DatatypeProperty",
  replacedBy: "owl:DatatypeProperty",
  justification: "owl:DatatypeProperty",
  decision: "owl:ObjectProperty",
  addedOn: "owl:DatatypeProperty",
  definedBy: "owl:DatatypeProperty",
  issuer: "owl:DatatypeProperty",
  standardVersion: "owl:DatatypeProperty",
  location: "owl:DatatypeProperty",
  license: "owl:DatatypeProperty",
  redistributable: "owl:DatatypeProperty",
  sourceSha256: "owl:DatatypeProperty",
  citation: "owl:DatatypeProperty",
  jurisdiction: "owl:ObjectProperty",
  level: "owl:ObjectProperty",
  effective: "owl:DatatypeProperty",
  incorporates: "owl:DatatypeProperty",
  decisionOf: "owl:ObjectProperty",
  decidedOn: "owl:DatatypeProperty",
  record: "owl:DatatypeProperty",
  tool: "owl:DatatypeProperty",
  whyNotTypeScript: "owl:DatatypeProperty",
  pinnedVersion: "owl:DatatypeProperty",
  isolation: "owl:DatatypeProperty",
  platform: "owl:DatatypeProperty",
  direction: "owl:ObjectProperty",
  fromFormat: "owl:DatatypeProperty",
  toFormat: "owl:DatatypeProperty",
  handles: "owl:ObjectProperty",
  importOf: "owl:ObjectProperty",
  importedOn: "owl:DatatypeProperty",
  generator: "owl:DatatypeProperty",
  levelRank: "owl:DatatypeProperty",
  entails: "owl:ObjectProperty",
  rule: "owl:DatatypeProperty",
  enforcedBy: "owl:DatatypeProperty",
  workKind: "owl:DatatypeProperty",
  requiresSection: "owl:DatatypeProperty",
  requirementTemplate: "owl:DatatypeProperty",
  proofForm: "owl:DatatypeProperty",
  profileStandard: "owl:DatatypeProperty",
  profileAuthority: "owl:ObjectProperty",
});

// ---- the words a field may hold, each list the union of its field's type

/** How a term relates to its standard's term, in the words SSSOM publishes mappings with (commons 0019-mizan-integrations FR-010). */
export const MAPPING_RELATIONS = ["exactMatch", "closeMatch", "narrowMatch", "broadMatch", "subClassOf", "subPropertyOf"] as const;
/** The platforms an exception's tool may support (commons 0017-two-languages FR-004). */
export const PLATFORMS = ["linux", "macos", "windows"] as const;

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/** How a term relates to a standard (commons 0018-standards-first FR-003): a code list, whose keys are the union the tools branch on. */
export const bases = codes(classSchema(mz.Basis, CODE), MZ, {
  Adopts: { label: en("adopts"), definition: en("The term is the standard's own, by its IRI.") },
  Specializes: { label: en("specializes"), definition: en("The term is a subclass or a subproperty of a standard's term.") },
  Maps: { label: en("maps"), definition: en("The term has a mapping, such as skos:exactMatch, to a standard's term.") },
  Unaligned: {
    label: en("unaligned"),
    definition: en("No standard names the term: it carries a justification and a decision, is counted, and is drift to be reduced."),
  },
});

/** The levels of government a law belongs to (commons 0018-standards-first FR-002). */
export const jurisdictionLevels = codes(classSchema(mz.JurisdictionLevel, CODE), MZ, {
  Federal: { label: en("federal") },
  State: { label: en("state") },
  Local: { label: en("local") },
  International: { label: en("international") },
});

/** Whether an integration brings a standard in or puts our ontology out (commons 0019-mizan-integrations FR-002). */
export const integrationDirections = codes(classSchema(mz.IntegrationDirection, CODE), MZ, {
  Import: { label: en("import") },
  Export: { label: en("export") },
});

/** What kind of rung a rung is (commons 0016-ladder FR-008): a code list, whose keys are the union the checks branch on. */
export const rungKinds = codes(classSchema(mz.RungKind, CODE), MZ, {
  Required: { label: en("required"), definition: en("Every harness has the rung and builds on the rungs it names.") },
  Optional: { label: en("optional"), definition: en("A harness may have the rung: it relies on no rung and no rung relies on it.") },
  Observer: {
    label: en("observer"),
    definition: en(
      "The rung records and proves what the other rungs do, and is required of a harness that claims a regulated domain; no rung relies on it.",
    ),
  },
  Environment: {
    label: en("environment"),
    definition: en(
      "The rung is the working environment everything is built in, required of a harness that claims a regulated domain; it relies on no rung and no rung relies on it.",
    ),
  },
});

/**
 * What a conformance level asks of a subject (commons 0028-conformance-levels FR-002): a code list whose keys are the union the check branches on. `rule` names the rules of Mizan's check that
 * prove it (an id such as `mizan/requirement-ears`, or a family such as `changes/*`), and `enforcedBy` says in words what else proves it, where no rule of the check does.
 */
export const conformanceRequirements = codes(
  classSchema(mz.ConformanceRequirement, { ...CODE, rule: many(mz.rule, range.string), enforcedBy: many(mz.enforcedBy, range.string) }),
  MZ,
  {
    Manifest: {
      label: en("manifest"),
      definition: en(
        "The subject declares a manifest: its name, its level, the path of its spec kit, its verify command, its version and its exports.",
      ),
      rule: [],
      enforcedBy: [
        "the manifest check of 0028-conformance-levels, which reads each commons/<name>/library.ts as data (0027-commons-libraries)",
      ],
    },
    VerifyCommand: {
      label: en("verify command"),
      definition: en("The subject names the one command that proves it, and it runs from the subject's folder with no argument."),
      rule: [],
      enforcedBy: ["the manifest check, which finds a verify command that the subject's package does not have"],
    },
    Version: {
      label: en("version"),
      definition: en("The subject declares a version, and it is the version of its package."),
      rule: [],
      enforcedBy: ["the manifest check, which finds a version that is not the package's"],
    },
    SpecKit: {
      label: en("spec kit"),
      definition: en("The subject keeps a spec kit of its own, in the form of 0003-mizan, numbered from 0001 in its own registry."),
      rule: [],
      enforcedBy: ["bun commons/tools/mizan-check.ts --root <spec kit>"],
    },
    OwnVerify: {
      label: en("own verify"),
      definition: en(
        "The subject's verify command runs the compiler, the specification checker, the rules of its level on its own spec kit and its tests, and fails if any fails.",
      ),
      rule: [],
      enforcedBy: ["the manifest check, which reads the verify script of the package (0027-commons-libraries FR-005)"],
    },
    EarsRequirements: {
      label: en("EARS requirements"),
      definition: en("Every requirement is worded with an RFC 2119 keyword in one of the EARS patterns."),
      rule: ["mizan/requirement-keyword", "mizan/requirement-ears"],
      enforcedBy: [],
    },
    GherkinScenarios: {
      label: en("Gherkin scenarios"),
      definition: en("Every acceptance scenario is Given, When, Then and cites the requirements it exercises."),
      rule: ["mizan/scenario-form"],
      enforcedBy: [],
    },
    ProofRows: {
      label: en("proof rows"),
      definition: en(
        "Every requirement has exactly one row in the register of what proves it, and none for a requirement that does not exist.",
      ),
      rule: [],
      enforcedBy: ["bun commons/tools/mizan-check.ts (0003-mizan FR-005)"],
    },
    SourceTrace: {
      label: en("source trace"),
      definition: en(
        "Sources and tests cite the specifications they come from (`Spec:` and `Proves:` lines, `proves(...)` calls), and every citation names a requirement that exists.",
      ),
      rule: [],
      enforcedBy: ["the trace of the subject's sources and tests (0015-trace)"],
    },
    ShrinkOnlyBaselines: {
      label: en("shrink-only baselines"),
      definition: en("A finding is held by a baseline that only shrinks: a new finding fails, and so does a line that no longer occurs."),
      rule: [],
      enforcedBy: ["the judgement of every check against its baseline (0003-mizan FR-015)"],
    },
    Citations: {
      label: en("citations"),
      definition: en(
        "A specification of another folder is cited with its repository, and a bare citation names a specification of the folder that exists.",
      ),
      rule: [],
      enforcedBy: ["bun commons/tools/mizan-check.ts (0003-mizan FR-004)"],
    },
    TermAudit: {
      label: en("term audit"),
      definition: en(
        "Every term of the subject's ontology has a record of the standard it rests on, or of why none does and the decision to keep it unaligned, and a specification names only defined terms.",
      ),
      rule: [
        "mizan/term-standard",
        "mizan/unaligned-justification",
        "mizan/decision-missing",
        "mizan/decision-overdue",
        "mizan/term-basis-missing",
        "mizan/spec-term-unknown",
        "mizan/spec-term-deprecated",
        "mizan/term-not-defined-by",
        "mizan/deprecated-no-replacement",
        "mizan/standards-considered",
        "mizan/standard-newer",
      ],
      enforcedBy: [],
    },
    Ifccm: {
      label: en("IFCCM"),
      definition: en("Every commit names an issue, and a change is judged against its declared phase of enforcement (0020-ifccm)."),
      rule: ["changes/*"],
      enforcedBy: [],
    },
    Ifr: {
      label: en("IFR"),
      definition: en("Every work has a release record, and a version grows by the scheme of its kind (0026-works-versioning)."),
      rule: ["versions/*"],
      enforcedBy: [],
    },
    Ifqs: {
      label: en("IFQS"),
      definition: en("The quality records of the subject are kept and judged (0021-ifqs)."),
      rule: [],
      enforcedBy: ["bun commons/quality/src/quality.ts"],
    },
  },
);

/**
 * The four conformance levels (commons 0028-conformance-levels FR-001): L0 registered, L1 core, L2 standards and L3 governed, each listing the requirements it adds (`entails`) to those of the
 * levels below it, in the order of `levelRank`.
 */
export const conformanceLevels = codes(
  classSchema(mz.ConformanceLevel, {
    ...CODE,
    levelRank: one(mz.levelRank, range.integer),
    entails: many(mz.entails, range.ref<"mz:ConformanceRequirement">()),
  }),
  MZ,
  {
    Registered: {
      label: en("L0 registered"),
      definition: en("The subject is known: it has a manifest, a verify command and a version."),
      levelRank: 0,
      entails: [conformanceRequirements.Manifest, conformanceRequirements.VerifyCommand, conformanceRequirements.Version],
    },
    Core: {
      label: en("L1 core"),
      definition: en("The subject keeps its own specifications and proves them: its own spec kit and verify, and Mizan's core rules."),
      levelRank: 1,
      entails: [
        conformanceRequirements.SpecKit,
        conformanceRequirements.OwnVerify,
        conformanceRequirements.EarsRequirements,
        conformanceRequirements.GherkinScenarios,
        conformanceRequirements.ProofRows,
        conformanceRequirements.SourceTrace,
        conformanceRequirements.ShrinkOnlyBaselines,
        conformanceRequirements.Citations,
      ],
    },
    Standards: {
      label: en("L2 standards"),
      definition: en("The subject's terms rest on standards first: an audit of every term, with a decision for each that stays unaligned."),
      levelRank: 2,
      entails: [conformanceRequirements.TermAudit],
    },
    Governed: {
      label: en("L3 governed"),
      definition: en(
        "The subject is under change control and release control: every commit names an issue, every work has a release record and the quality records are kept.",
      ),
      levelRank: 3,
      entails: [conformanceRequirements.Ifccm, conformanceRequirements.Ifr, conformanceRequirements.Ifqs],
    },
  },
);

// ---- the class schemas the data is made with

/** The schema of a rung of the ladder (`mz:Rung`). */
export const Rung = classSchema(mz.Rung, {
  label: one(rdfs.label, range.langString),
  rungNumber: one(mz.rungNumber, range.integer),
  purpose: one(skos.definition, range.langString),
  kind: one(mz.kind, range.ref<"mz:RungKind">()),
  mayRelyOn: many(mz.mayRelyOn, range.ref<"mz:Rung">()),
  home: many(mz.home, range.string),
  provedBy: many(mz.provedBy, range.string),
  spec: many(mz.spec, range.string),
});

/** The schema of a jurisdiction (`mz:Jurisdiction`). */
export const Jurisdiction = classSchema(mz.Jurisdiction, {
  label: one(rdfs.label, range.langString),
  level: one(mz.level, range.ref<"mz:JurisdictionLevel">()),
});

/** The schema of the authority of a requirement or a term: a law or a regulation, cited as its jurisdiction cites it (`mz:Authority`). */
export const Authority = classSchema(mz.Authority, {
  label: one(rdfs.label, range.langString),
  citation: one(mz.citation, range.string),
  jurisdiction: one(mz.jurisdiction, range.ref<"mz:Jurisdiction">()),
  effective: optional(mz.effective, range.string),
  incorporates: many(mz.incorporates, range.string),
  definition: optional(skos.definition, range.langString),
});

/** The schema of a standard (`mz:Standard`). */
export const Standard = classSchema(mz.Standard, {
  label: one(rdfs.label, range.langString),
  issuer: one(mz.issuer, range.string),
  standardVersion: one(mz.standardVersion, range.string),
  location: one(mz.location, range.string),
  license: one(mz.license, range.string),
  redistributable: one(mz.redistributable, range.boolean),
  sourceSha256: optional(mz.sourceSha256, range.string),
});

/** The schema of the record of why a term is `unaligned` (`mz:Decision`). */
export const Decision = classSchema(mz.Decision, {
  label: one(rdfs.label, range.langString),
  decisionOf: one(mz.decisionOf, range.ref<"mz:OntologyTerm">()),
  decidedOn: one(mz.decidedOn, range.string),
  record: optional(mz.record, range.string),
});

/** The schema of a term of an ontology and what it rests on (`mz:OntologyTerm`). */
export const OntologyTerm = classSchema(mz.OntologyTerm, {
  label: one(rdfs.label, range.langString),
  termIri: one(mz.termIri, range.string),
  basis: one(mz.basis, range.ref<"mz:Basis">()),
  standardTerm: optional(mz.standardTerm, range.string),
  mappingRelation: optional(mz.mappingRelation, range.oneOf(MAPPING_RELATIONS)),
  deprecatedOn: optional(mz.deprecatedOn, range.string),
  replacedBy: optional(mz.replacedBy, range.string),
  justification: optional(mz.justification, range.string),
  decision: optional(mz.decision, range.ref<"mz:Decision">()),
  addedOn: optional(mz.addedOn, range.string),
  definedBy: many(mz.definedBy, range.string),
});

// ---- the classes, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(mz.RungKind, { label: en("Rung kind"), definition: en("required, optional, observer or environment.") }),
  OwlClass.make(mz.Rung, {
    label: en("Rung"),
    definition: en("One level of the ladder, with its number, purpose, homes, what it may rely on and what proves it."),
  }),
  OwlClass.make(mz.Spec, {
    label: en("Specification"),
    definition: en("A specification of a spec-kit folder, with its identifier and status."),
  }),
  OwlClass.make(mz.Requirement, {
    label: en("Requirement"),
    definition: en("One numbered requirement of a specification, with the authority it comes from where it comes from law."),
  }),
  OwlClass.make(mz.OntologyTerm, {
    label: en("Ontology term"),
    definition: en("A class, a property, an individual or a code list of an ontology, and the basis it rests on."),
  }),
  OwlClass.make(mz.Basis, {
    label: en("Basis"),
    definition: en("How a term relates to a standard: adopts, specializes, maps or is unaligned."),
  }),
  OwlClass.make(mz.Standard, {
    label: en("Standard"),
    subClassOf: [dcterms.Standard],
    definition: en("A pinned, licensed standard: its issuer, name, version, location, license and the hash of what was imported."),
  }),
  OwlClass.make(mz.Authority, {
    label: en("Authority"),
    definition: en("A law or regulation a requirement or a term comes from, cited by its title, part and section."),
  }),
  OwlClass.make(mz.Jurisdiction, {
    label: en("Jurisdiction"),
    definition: en("The federal, state, local or international body whose law it is."),
  }),
  OwlClass.make(mz.JurisdictionLevel, { label: en("Jurisdiction level"), definition: en("federal, state, local or international.") }),
  OwlClass.make(mz.Decision, {
    label: en("Decision"),
    definition: en("The record of why a term is unaligned, due within 90 days of the term; a harness may link it to its own record."),
  }),
  OwlClass.make(mz.Exception, {
    label: en("Exception"),
    definition: en(
      "A recorded choice of a tool that is not TypeScript, with why TypeScript is not enough, its pinned version, its isolation and its platforms.",
    ),
  }),
  OwlClass.make(mz.Integration, {
    label: en("Integration"),
    definition: en("An import of a standard into typed TypeScript, or an export of an ontology in a well-known form."),
  }),
  OwlClass.make(mz.IntegrationDirection, { label: en("Integration direction"), definition: en("import or export.") }),
  OwlClass.make(mz.ConformanceLevel, {
    label: en("Conformance level"),
    definition: en(
      "L0 registered, L1 core, L2 standards or L3 governed: how much of Mizan a subject is held to, each level adding to the one below.",
    ),
  }),
  OwlClass.make(mz.ConformanceRequirement, {
    label: en("Conformance requirement"),
    definition: en("One thing a conformance level asks of a subject, and the rules or checks that prove it."),
  }),
  OwlClass.make(mz.SubjectKind, {
    label: en("Subject kind"),
    definition: en(
      "library, service, application, integration or platform: what a specification specifies, with the sections, requirement templates, proofs and standards of its profile.",
    ),
  }),
  OwlClass.make(mz.AudienceModel, {
    label: en("Audience model"),
    definition: en(
      "b2b or b2b2c: who a subject is offered to, with the sections, requirement templates, proofs, standards and laws of its profile.",
    ),
  }),
  OwlClass.make(mz.ImportRecord, {
    label: en("Import record"),
    definition: en("The provenance of one import: what, from where, when, by which generator and with which hash."),
  }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(mz.rungNumber, {
    label: en("rungNumber"),
    domain: mz.Rung,
    range: xsd.integer,
    definition: en("The rung's number, 0 to 10."),
  }),
  ObjectProperty.make(mz.kind, {
    label: en("kind"),
    domain: mz.Rung,
    range: mz.RungKind,
    definition: en("required, optional, observer or environment."),
  }),
  ObjectProperty.make(mz.mayRelyOn, {
    label: en("mayRelyOn"),
    domain: mz.Rung,
    range: mz.Rung,
    definition: en("A rung this rung may rely on, and never reach around."),
  }),
  DatatypeProperty.make(mz.home, {
    label: en("home"),
    domain: mz.Rung,
    range: xsd.string,
    definition: en("A path or a glob of a harness's files that is on the rung."),
  }),
  DatatypeProperty.make(mz.spec, {
    label: en("spec"),
    domain: mz.Rung,
    range: xsd.string,
    definition: en("A specification (and its requirement) the rung comes from, as a harness cites it: `NNN-slug FR-nnn`."),
  }),
  DatatypeProperty.make(mz.provedBy, {
    label: en("provedBy"),
    domain: mz.Rung,
    range: xsd.string,
    definition: en("A command of a harness that proves the rung."),
  }),
  DatatypeProperty.make(mz.specId, {
    label: en("specId"),
    domain: mz.Spec,
    range: xsd.string,
    definition: en("The specification's identifier, its folder's name."),
  }),
  DatatypeProperty.make(mz.specStatus, {
    label: en("specStatus"),
    domain: mz.Spec,
    range: xsd.string,
    definition: en("Draft, Active, Deferred or Superseded."),
  }),
  ObjectProperty.make(mz.ofSpec, {
    label: en("ofSpec"),
    domain: mz.Requirement,
    range: mz.Spec,
    definition: en("The specification the requirement is in."),
  }),
  DatatypeProperty.make(mz.requirementId, {
    label: en("requirementId"),
    domain: mz.Requirement,
    range: xsd.string,
    definition: en("The requirement's number in its specification (FR-001)."),
  }),
  ObjectProperty.make(mz.authority, {
    label: en("authority"),
    domain: mz.Requirement,
    range: mz.Authority,
    definition: en("The law or regulation the requirement comes from."),
  }),
  DatatypeProperty.make(mz.termIri, {
    label: en("termIri"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("The IRI of the term the individual describes."),
  }),
  ObjectProperty.make(mz.basis, {
    label: en("basis"),
    domain: mz.OntologyTerm,
    range: mz.Basis,
    definition: en("How the term relates to a standard."),
  }),
  DatatypeProperty.make(mz.standardTerm, {
    label: en("standardTerm"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("The IRI of the standard's term, where there is one."),
  }),
  DatatypeProperty.make(mz.mappingRelation, {
    label: en("mappingRelation"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en(
      "How the term relates to the standard's term, in the words a mapping is published with: exactMatch, closeMatch, narrowMatch, broadMatch, subClassOf or subPropertyOf.",
    ),
  }),
  DatatypeProperty.make(mz.deprecatedOn, {
    label: en("deprecatedOn"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) the term was deprecated: a specification must not name it, and it names its replacement."),
  }),
  DatatypeProperty.make(mz.replacedBy, {
    label: en("replacedBy"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("The IRI of the term that replaces a deprecated term."),
  }),
  DatatypeProperty.make(mz.justification, {
    label: en("justification"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("For an unaligned term: the standards looked at and why none fits."),
  }),
  ObjectProperty.make(mz.decision, {
    label: en("decision"),
    domain: mz.OntologyTerm,
    range: mz.Decision,
    definition: en("The decision that records why the term is unaligned."),
  }),
  DatatypeProperty.make(mz.addedOn, {
    label: en("addedOn"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) the term was added; the decision is due 90 days after it."),
  }),
  DatatypeProperty.make(mz.definedBy, {
    label: en("definedBy"),
    domain: mz.OntologyTerm,
    range: xsd.string,
    definition: en("A specification (and its requirement) that defines the term."),
  }),
  DatatypeProperty.make(mz.issuer, {
    label: en("issuer"),
    domain: mz.Standard,
    range: xsd.string,
    definition: en("Who publishes the standard."),
  }),
  DatatypeProperty.make(mz.standardVersion, {
    label: en("standardVersion"),
    domain: mz.Standard,
    range: xsd.string,
    definition: en("The version that is pinned."),
  }),
  DatatypeProperty.make(mz.location, {
    label: en("location"),
    domain: mz.Standard,
    range: xsd.string,
    definition: en("Where the standard is published."),
  }),
  DatatypeProperty.make(mz.license, {
    label: en("license"),
    domain: mz.Standard,
    range: xsd.string,
    definition: en("The license, as an SPDX identifier."),
  }),
  DatatypeProperty.make(mz.redistributable, {
    label: en("redistributable"),
    domain: mz.Standard,
    range: xsd.boolean,
    definition: en("Whether its text may be copied; false for a standard that is only cited."),
  }),
  DatatypeProperty.make(mz.sourceSha256, {
    label: en("sourceSha256"),
    domain: mz.Standard,
    range: xsd.string,
    definition: en("The SHA-256 of what was imported, in lower-case hexadecimal."),
  }),
  DatatypeProperty.make(mz.citation, {
    label: en("citation"),
    domain: mz.Authority,
    range: xsd.string,
    definition: en("The law's citation, as its jurisdiction writes it (21 CFR Part 11)."),
  }),
  ObjectProperty.make(mz.jurisdiction, {
    label: en("jurisdiction"),
    domain: mz.Authority,
    range: mz.Jurisdiction,
    definition: en("The jurisdiction whose law it is."),
  }),
  ObjectProperty.make(mz.level, {
    label: en("level"),
    domain: mz.Jurisdiction,
    range: mz.JurisdictionLevel,
    definition: en("federal, state, local or international."),
  }),
  DatatypeProperty.make(mz.effective, {
    label: en("effective"),
    domain: mz.Authority,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) the law took effect, where it is known."),
  }),
  DatatypeProperty.make(mz.incorporates, {
    label: en("incorporates"),
    domain: mz.Authority,
    range: xsd.string,
    definition: en("A standard the law incorporates by reference, by its identifier."),
  }),
  ObjectProperty.make(mz.decisionOf, {
    label: en("decisionOf"),
    domain: mz.Decision,
    range: mz.OntologyTerm,
    definition: en("The term the decision is about."),
  }),
  DatatypeProperty.make(mz.decidedOn, {
    label: en("decidedOn"),
    domain: mz.Decision,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) the decision was made."),
  }),
  DatatypeProperty.make(mz.record, {
    label: en("record"),
    domain: mz.Decision,
    range: xsd.string,
    definition: en("Where the decision is recorded in the harness's own system, where it has one."),
  }),
  DatatypeProperty.make(mz.tool, {
    label: en("tool"),
    domain: mz.Exception,
    range: xsd.string,
    definition: en("The tool, its language or its format."),
  }),
  DatatypeProperty.make(mz.whyNotTypeScript, {
    label: en("whyNotTypeScript"),
    domain: mz.Exception,
    range: xsd.string,
    definition: en("Why TypeScript or a hand-written parser is not enough."),
  }),
  DatatypeProperty.make(mz.pinnedVersion, {
    label: en("pinnedVersion"),
    domain: mz.Exception,
    range: xsd.string,
    definition: en("The version of the tool that is pinned (commons 0002-packaging)."),
  }),
  DatatypeProperty.make(mz.isolation, {
    label: en("isolation"),
    domain: mz.Exception,
    range: xsd.string,
    definition: en("How nothing else depends on the tool: a typed TypeScript wrapper, files in and files out."),
  }),
  DatatypeProperty.make(mz.platform, {
    label: en("platform"),
    domain: mz.Exception,
    range: xsd.string,
    definition: en("A platform the tool supports: linux, macos or windows."),
  }),
  ObjectProperty.make(mz.direction, {
    label: en("direction"),
    domain: mz.Integration,
    range: mz.IntegrationDirection,
    definition: en("import or export."),
  }),
  DatatypeProperty.make(mz.fromFormat, {
    label: en("fromFormat"),
    domain: mz.Integration,
    range: xsd.string,
    definition: en("The format the integration reads."),
  }),
  DatatypeProperty.make(mz.toFormat, {
    label: en("toFormat"),
    domain: mz.Integration,
    range: xsd.string,
    definition: en("The format the integration writes."),
  }),
  ObjectProperty.make(mz.handles, {
    label: en("handles"),
    domain: mz.Integration,
    range: mz.Standard,
    definition: en("The standard the integration handles."),
  }),
  ObjectProperty.make(mz.importOf, {
    label: en("importOf"),
    domain: mz.ImportRecord,
    range: mz.Standard,
    definition: en("The standard that was imported."),
  }),
  DatatypeProperty.make(mz.importedOn, {
    label: en("importedOn"),
    domain: mz.ImportRecord,
    range: xsd.string,
    definition: en("The day (YYYY-MM-DD) of the import."),
  }),
  DatatypeProperty.make(mz.levelRank, {
    label: en("levelRank"),
    domain: mz.ConformanceLevel,
    range: xsd.integer,
    definition: en("The level's rank, 0 to 3: a level entails the requirements of every level of a lower rank."),
  }),
  ObjectProperty.make(mz.entails, {
    label: en("entails"),
    domain: mz.ConformanceLevel,
    range: mz.ConformanceRequirement,
    definition: en("A requirement the level adds to those of the levels below it."),
  }),
  DatatypeProperty.make(mz.rule, {
    label: en("rule"),
    domain: mz.ConformanceRequirement,
    range: xsd.string,
    definition: en("The id of a rule of Mizan's check that proves the requirement, or a family of ids ending in `/*`."),
  }),
  DatatypeProperty.make(mz.enforcedBy, {
    label: en("enforcedBy"),
    domain: mz.ConformanceRequirement,
    range: xsd.string,
    definition: en("What else proves the requirement, in words, where no rule of Mizan's check does."),
  }),
  DatatypeProperty.make(mz.workKind, {
    label: en("workKind"),
    domain: mz.SubjectKind,
    range: xsd.string,
    definition: en("The IRI of the kind of work (`ifr:WorkKind`) a subject of the kind is released as."),
  }),
  DatatypeProperty.make(mz.requiresSection, {
    label: en("requiresSection"),
    definition: en(
      "The name of a section a specification of the kind or the audience has: a heading of level two or three that begins with it.",
    ),
  }),
  DatatypeProperty.make(mz.requirementTemplate, {
    label: en("requirementTemplate"),
    definition: en(
      "A template of a requirement of the kind or the audience, in an EARS pattern, with what a specification fills in between angle brackets.",
    ),
  }),
  DatatypeProperty.make(mz.proofForm, {
    label: en("proofForm"),
    definition: en("How the requirements of the kind or the audience are proved."),
  }),
  DatatypeProperty.make(mz.profileStandard, {
    label: en("profileStandard"),
    definition: en(
      "A standard the profile rests on, by the name and edition its issuer gives, with `(to verify)` where either was not checked.",
    ),
  }),
  ObjectProperty.make(mz.profileAuthority, {
    label: en("profileAuthority"),
    domain: mz.AudienceModel,
    range: mz.Authority,
    definition: en("A law the profile cites."),
  }),
  DatatypeProperty.make(mz.generator, {
    label: en("generator"),
    domain: mz.ImportRecord,
    range: xsd.string,
    definition: en("The generator that wrote the imported module."),
  }),
] as const;

/** The ontology itself: its label, description and version. */
export const mizanOntology = OwlOntology.make(ontologyOf(MZ), {
  label: en("Mizan"),
  description: en(
    "The shared vocabulary of Mizan, the IF Spec Profile: the ladder, specifications and requirements, standards, laws and the basis of every term.",
  ),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(MZV, "1.0.0")),
});

// ---- the individuals: the rungs

const CORE = { kind: rungKinds.Required, home: [], provedBy: [] } as const;

/** Rung 0: the ontology. */
export const rung0 = Rung.make(term(MZID, "rung-0"), {
  ...CORE,
  label: en("Ontology"),
  rungNumber: 0,
  purpose: en("Facts, terms and code lists, stated once as typed TypeScript on commons' RDF kernel."),
  mayRelyOn: [],
});
/** Rung 1: the specifications. */
export const rung1 = Rung.make(term(MZID, "rung-1"), {
  ...CORE,
  label: en("Specifications"),
  rungNumber: 1,
  purpose: en("What each part must do, using only terms the ontology defines."),
  mayRelyOn: [rung0],
});
/** Rung 2: governed data. */
export const rung2 = Rung.make(term(MZID, "rung-2"), {
  ...CORE,
  label: en("Governed data"),
  rungNumber: 2,
  purpose: en("Schema, policies, data models and code lists of every subject."),
  mayRelyOn: [rung0, rung1],
});
/** Rung 3: data operations. */
export const rung3 = Rung.make(term(MZID, "rung-3"), {
  ...CORE,
  label: en("Data operations"),
  rungNumber: 3,
  purpose: en("Work as close to the data as possible."),
  mayRelyOn: [rung0, rung1, rung2],
});
/** Rung 4: infrastructure rules. */
export const rung4 = Rung.make(term(MZID, "rung-4"), {
  ...CORE,
  label: en("Infrastructure rules"),
  rungNumber: 4,
  purpose: en("Logic reused across services, neutral to any one service."),
  mayRelyOn: [rung0, rung1, rung3],
});
/** Rung 5: business rules. */
export const rung5 = Rung.make(term(MZID, "rung-5"), {
  ...CORE,
  label: en("Business rules"),
  rungNumber: 5,
  purpose: en("A service's own logic: its operations and rules."),
  mayRelyOn: [rung0, rung1, rung3, rung4],
});
/** Rung 6: the application. */
export const rung6 = Rung.make(term(MZID, "rung-6"), {
  ...CORE,
  label: en("Application"),
  rungNumber: 6,
  purpose: en("The headless hosts (command line, MCP server, HTTP server, container service, daemon), then the windowed hosts."),
  mayRelyOn: [rung0, rung1, rung4, rung5],
});
/** Rung 7: documentation. */
export const rung7 = Rung.make(term(MZID, "rung-7"), {
  ...CORE,
  label: en("Documentation"),
  rungNumber: 7,
  purpose: en("How to operate everything below."),
  mayRelyOn: [rung0, rung1, rung2, rung3, rung4, rung5, rung6],
});
/** Rung 8: the lifecycle, optional. */
export const rung8 = Rung.make(term(MZID, "rung-8"), {
  kind: rungKinds.Optional,
  home: [],
  provedBy: [],
  label: en("Lifecycle: retired, then archived"),
  rungNumber: 8,
  purpose: en(
    "What is retired (alive, not to be used), then what is archived (dead, safe to delete). It relies on nothing and nothing relies on it.",
  ),
  mayRelyOn: [],
});

/** Rung 9: the evidence, an observer. */
export const rung9 = Rung.make(term(MZID, "rung-9"), {
  kind: rungKinds.Observer,
  home: [],
  provedBy: [],
  label: en("Evidence: what the system records about itself"),
  rungNumber: 9,
  purpose: en(
    "The records produced by operating the system, never written by hand: test and check runs, findings, nonconformances, corrective actions, change records and attestations. They are append-only and prove every other rung; no rung relies on them, so that evidence cannot authorize itself.",
  ),
  mayRelyOn: [rung0, rung1, rung2, rung3, rung4, rung5, rung6, rung7],
});

/** Rung 10: the workspace, an environment. */
export const rung10 = Rung.make(term(MZID, "rung-10"), {
  kind: rungKinds.Environment,
  home: [],
  provedBy: [],
  label: en("Workspace: where the work is done"),
  rungNumber: 10,
  purpose: en(
    "The controlled working environment everything else is built in: the layout of the repositories on a machine, the approved tools, the policy and the hooks that hold the work to its rules. It relies on no rung and no rung relies on it; the evidence rung records what it does.",
  ),
  mayRelyOn: [],
});

/** The eleven rungs of the ladder, lowest first. */
export const rungs = [rung0, rung1, rung2, rung3, rung4, rung5, rung6, rung7, rung8, rung9, rung10] as const;

// ---- the individuals: the first jurisdiction and the laws of the first domains

/** The United States, the jurisdiction of the first domains' laws. */
export const unitedStates = Jurisdiction.make(term(MZID, "jurisdiction-us"), {
  label: en("United States"),
  level: jurisdictionLevels.Federal,
});

/** 21 CFR Part 820, the Quality Management System Regulation (QMSR), in effect from 2 February 2026, which incorporates ISO 13485:2016 by reference. */
export const cfr820 = Authority.make(term(MZID, "authority-21-cfr-820"), {
  label: en("21 CFR Part 820, Quality Management System Regulation"),
  citation: "21 CFR Part 820",
  jurisdiction: unitedStates,
  effective: "2026-02-02",
  incorporates: ["ISO 13485:2016"],
  definition: en(
    "The FDA's regulation of the quality management systems of medical-device manufacturers, amended to incorporate ISO 13485:2016 by reference (verified against the FDA and the Federal Register, 2026-11).",
  ),
});

/** 21 CFR Part 11, electronic records and electronic signatures. */
export const cfr11 = Authority.make(term(MZID, "authority-21-cfr-11"), {
  label: en("21 CFR Part 11, electronic records and electronic signatures"),
  citation: "21 CFR Part 11",
  jurisdiction: unitedStates,
  incorporates: [],
});

/** The European Union, the jurisdiction of the General Data Protection Regulation: a body above the states, so its level is international. */
export const europeanUnion = Jurisdiction.make(term(MZID, "jurisdiction-eu"), {
  label: en("European Union"),
  level: jurisdictionLevels.International,
});

/** California, the jurisdiction of the California Consumer Privacy Act. */
export const california = Jurisdiction.make(term(MZID, "jurisdiction-us-ca"), { label: en("California"), level: jurisdictionLevels.State });

/** Regulation (EU) 2016/679, the General Data Protection Regulation, applied from 25 May 2018 (0029-subject-profiles FR-014). */
export const gdpr = Authority.make(term(MZID, "authority-gdpr"), {
  label: en("General Data Protection Regulation"),
  citation: "Regulation (EU) 2016/679",
  jurisdiction: europeanUnion,
  effective: "2018-05-25",
  incorporates: [],
  definition: en(
    "The European Union's regulation of the processing of personal data and of its free movement, which has applied since 25 May 2018.",
  ),
});

/** The California Consumer Privacy Act, California Civil Code section 1798.100 and following, in effect from 1 January 2020 (0029-subject-profiles FR-014). */
export const ccpa = Authority.make(term(MZID, "authority-ccpa"), {
  label: en("California Consumer Privacy Act"),
  citation: "California Civil Code section 1798.100 and following",
  jurisdiction: california,
  effective: "2020-01-01",
  incorporates: [],
  definition: en(
    "California's law on the rights of consumers over the personal information that businesses collect about them, in effect since 1 January 2020 and amended by the California Privacy Rights Act.",
  ),
});

/** The laws of the first domains, and the laws of consumer privacy that the profile of a business-to-business-to-consumer subject cites. */
export const authorities = [cfr820, cfr11, gdpr, ccpa] as const;

const PROFILE = {
  ...CODE,
  requiresSection: many(mz.requiresSection, range.string),
  requirementTemplate: many(mz.requirementTemplate, range.string),
  proofForm: one(mz.proofForm, range.string),
  profileStandard: many(mz.profileStandard, range.string),
} as const;

const CONTRACT_STANDARDS = [
  "OpenAPI Specification 3.1",
  "AsyncAPI Specification 3.0 (to verify the current version)",
  "JSON Schema (draft 2020-12)",
] as const;

/**
 * The kinds of subject a specification may declare (commons 0029-subject-profiles FR-001), each with the kind of work it is released as (`ifr:Library` or `ifr:Software`, as IRIs), the
 * sections of its profile, the templates of its requirements, the form of its proofs and the standards it rests on. The key of a kind, as a specification declares it, is its label.
 */
export const subjectKinds = codes(classSchema(mz.SubjectKind, { ...PROFILE, workKind: one(mz.workKind, range.string) }), MZ, {
  LibrarySubject: {
    label: en("library"),
    definition: en("Code another program imports, proved by its own verify."),
    workKind: "https://www.intellectualfrontiers.com/ontology/ifr#Library",
    requiresSection: [],
    requirementTemplate: ["The <library> MUST <behavior>, proved by a test that cites the requirement."],
    proofForm: "the library's verify: its compiler, its checks and the tests that cite each requirement",
    profileStandard: [],
  },
  ServiceSubject: {
    label: en("service"),
    definition: en(
      "A headless programming interface or event interface, proved by its contract, the tests of the contract and the measurement of its objectives.",
    ),
    workKind: "https://www.intellectualfrontiers.com/ontology/ifr#Software",
    requiresSection: ["Contract", "Contract tests", "Service level objectives", "Quality attributes"],
    requirementTemplate: [
      "The <service> MUST accept a request that conforms to <operation> of its contract and MUST refuse one that does not with the status the contract names.",
      "WHEN <event> happens, the <service> MUST publish a message that validates against <schema> of its contract.",
      "The <service> MUST meet <objective> over <window>, measured by the OpenTelemetry metric <name>.",
      "The <service> MUST hold <ISO/IEC 25010 characteristic> to <measure>, proved by <test or check>.",
    ],
    proofForm:
      "a contract test of each operation or message against its OpenAPI Description, AsyncAPI document or JSON Schema; each objective measured as an OpenTelemetry metric; a proof for each quality attribute",
    profileStandard: [
      ...CONTRACT_STANDARDS,
      "OpenTelemetry metrics",
      "ISO/IEC 25010 (the product quality model of SQuaRE; to verify the edition)",
    ],
  },
  ApplicationSubject: {
    label: en("application"),
    definition: en("A user interface, proved by its user journeys, its accessibility and its conformance to a design system."),
    workKind: "https://www.intellectualfrontiers.com/ontology/ifr#Software",
    requiresSection: ["User journeys", "Accessibility", "Design system"],
    requirementTemplate: [
      "WHEN <a user does something>, the <application> MUST <show or do something>. Given <a state>, When <the user acts>, Then <the result>, per FR-nnn.",
      "The <application> MUST satisfy success criterion <number> of WCAG 2.2 at level <A, AA or AAA>.",
      "The <application> MUST use the components and the tokens of <design system> on <surface>.",
    ],
    proofForm:
      "a Gherkin scenario run as a test for each journey; an automated accessibility check for each criterion of WCAG 2.2 that one can prove, and a `review` row of the register for each that it cannot",
    profileStandard: [
      "Gherkin (Given, When, Then)",
      "Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation of 5 October 2023",
    ],
  },
  IntegrationSubject: {
    label: en("integration"),
    definition: en("What joins two systems, proved by the contract it keeps with each."),
    workKind: "https://www.intellectualfrontiers.com/ontology/ifr#Software",
    requiresSection: ["Contract", "Contract tests"],
    requirementTemplate: [
      "The <integration> MUST send <message> to <system> only in the form its contract names, and MUST <behavior> where <system> refuses it.",
      "WHEN <system> sends <message>, the <integration> MUST accept it only if it validates against <schema>.",
    ],
    proofForm: "a contract test against the contract of each side it joins",
    profileStandard: [...CONTRACT_STANDARDS],
  },
  PlatformSubject: {
    label: en("platform"),
    definition: en("What other subjects are built on, proved by the contract of its interfaces and the measurement of its objectives."),
    workKind: "https://www.intellectualfrontiers.com/ontology/ifr#Software",
    requiresSection: ["Contract", "Contract tests", "Service level objectives"],
    requirementTemplate: [
      "The <platform> MUST keep <interface> as its contract names it for every subject built on it, and MUST NOT change it without a new version.",
      "The <platform> MUST meet <objective> over <window>, measured by the OpenTelemetry metric <name>.",
    ],
    proofForm: "contract tests of its interfaces and its extension points; each objective measured as an OpenTelemetry metric",
    profileStandard: [...CONTRACT_STANDARDS, "OpenTelemetry metrics"],
  },
});

const B2B_SECTIONS = ["Tenant isolation", "Service level agreements", "Audit trail", "Data processing", "Security controls"] as const;
const B2B_TEMPLATES = [
  "The <system> MUST NOT let a request made for tenant <A> read or change what belongs to tenant <B>.",
  "The <system> MUST meet <objective> for each tenant, and MUST <remedy> where it does not.",
  "WHEN <action> is taken on a tenant's data, the <system> MUST record who took it, when and what changed, and MUST keep the record for <period>.",
  "The <system> MUST process <category of personal data> only on the instruction of <the tenant> and only in <place>.",
  "The <system> MUST implement <control> of <SOC 2, ISO/IEC 27001 or NIST SP 800-53>, proved by <evidence>.",
] as const;
const B2B_STANDARDS = ["SOC 2 (the AICPA's Trust Services Criteria)", "ISO/IEC 27001:2022", "NIST SP 800-53 Revision 5"] as const;

/**
 * The audience models a specification may declare (commons 0029-subject-profiles FR-008): the sections, the templates, the form of proof, the standards and the laws of a business-to-business
 * subject (key `b2b`) and of a business-to-business-to-consumer subject (key `b2b2c`), which has those of the first and more.
 */
export const audienceModels = codes(
  classSchema(mz.AudienceModel, { ...PROFILE, profileAuthority: many(mz.profileAuthority, range.ref<"mz:Authority">()) }),
  MZ,
  {
    BusinessToBusiness: {
      label: en("b2b"),
      definition: en(
        "Offered to businesses: each tenant kept apart, what is promised to it, what is recorded for it, what is processed for it and the controls that protect it.",
      ),
      requiresSection: [...B2B_SECTIONS],
      requirementTemplate: [...B2B_TEMPLATES],
      proofForm:
        "a test that tries to cross a tenant boundary, a measurement of each agreement, a record in the audit trail and the evidence of each control as 0007-grc states it",
      profileStandard: [...B2B_STANDARDS],
      profileAuthority: [],
    },
    BusinessToBusinessToConsumer: {
      label: en("b2b2c"),
      definition: en(
        "Offered to businesses whose own customers use it: three actors, the operator, the partner or tenant and the end user, and what each may see of the others.",
      ),
      requiresSection: [...B2B_SECTIONS, "Actor roles", "Consumer privacy and consent", "Data boundaries"],
      requirementTemplate: [
        ...B2B_TEMPLATES,
        "Given <the operator, a partner or an end user>, When <the role acts>, Then <the result>, per FR-nnn.",
        "WHEN an end user withdraws consent to <purpose>, the <system> MUST stop <processing> within <period> and MUST record the withdrawal.",
        "The <system> MUST NOT show a partner what an end user did not consent to share with it, and MUST NOT show an end user what the partner did not publish to it.",
      ],
      proofForm:
        "a Gherkin scenario for each role, a test of consent and of its withdrawal, and a test that neither a partner nor an end user can see across the boundary; the proofs of a business-to-business subject",
      profileStandard: [
        ...B2B_STANDARDS,
        "General Data Protection Regulation, Regulation (EU) 2016/679",
        "California Consumer Privacy Act, California Civil Code section 1798.100 and following",
      ],
      profileAuthority: [gdpr, ccpa],
    },
  },
);

// ---- the individuals: the basis of Mizan's own classes (the first baseline)

/** Mizan's own class `mz:Standard` rests on a standard: DCMI Terms' `dcterms:Standard`. */
export const termStandard = OntologyTerm.make(term(MZID, "term-Standard"), {
  label: en("mz:Standard"),
  termIri: "https://www.intellectualfrontiers.com/ontology/mizan#Standard",
  basis: bases.Specializes,
  standardTerm: "http://purl.org/dc/terms/Standard",
  mappingRelation: "subClassOf",
  definedBy: ["0018-standards-first FR-006"],
});

/** The ladder is Intellectual Frontiers' own architecture: no standard names its rungs. */
export const termRung = OntologyTerm.make(term(MZID, "term-Rung"), {
  label: en("mz:Rung"),
  termIri: "https://www.intellectualfrontiers.com/ontology/mizan#Rung",
  basis: bases.Unaligned,
  justification:
    "No standard names these rungs. ISO/IEC/IEEE 42010 describes architecture descriptions and layered architecture is common practice, but neither defines rungs, their rely-on edges or their checks. Decision pending (0018-standards-first FR-005).",
  addedOn: "2026-11-17",
  definedBy: ["0016-ladder FR-001"],
});

/** The day of the owner's decision to keep six terms unaligned (issue #10), and the day it is reviewed again by. */
export const KEPT_UNALIGNED_ON = "2026-11-17";
/** The day by which a term kept unaligned is looked at again. */
export const KEPT_UNALIGNED_REVIEW_BY = "2027-02-15";

/** The sentence a term kept unaligned carries in place of "Decision pending" (0018-standards-first FR-005). */
export const KEPT_UNALIGNED_SENTENCE = `Kept unaligned by the owner's decision of ${KEPT_UNALIGNED_ON} (issue #10); reviewed again by ${KEPT_UNALIGNED_REVIEW_BY}.`;

/**
 * The `mz:Decision` of a term kept unaligned (0018-standards-first FR-005): the individual `decision-<ontology>-<local>`, which says of the term with the record
 * `term-<ontology>-<local>` (`term-<local>` for Mizan's own) that it stays unaligned; the audit record of the term points to it with `mz:decision`.
 */
export function keptUnalignedDecision(ontology: "mz" | "ifccm" | "ifqs", local: string): ReturnType<typeof Decision.make> {
  return Decision.make(term<"mz:Decision">(MZID, `decision-${ontology}-${local}`), {
    label: en(`Keep ${ontology}:${local} unaligned`),
    decisionOf: term<"mz:OntologyTerm">(MZID, ontology === "mz" ? `term-${local}` : `term-${ontology}-${local}`),
    decidedOn: KEPT_UNALIGNED_ON,
    record: `owner decision of ${KEPT_UNALIGNED_ON} in issue #10: keep the term unaligned; reviewed again by ${KEPT_UNALIGNED_REVIEW_BY}`,
  });
}

/** The identifier of the decision of a term kept unaligned, for the audit record to point to (`mz:decision`). */
export function keptUnalignedDecisionId(ontology: "mz" | "ifccm" | "ifqs", local: string): Named<"mz:Decision"> {
  return term<"mz:Decision">(MZID, `decision-${ontology}-${local}`);
}

/** The classes whose standards, if any, have not been examined yet: unaligned, with the candidates to examine named, until the audit closes; `kept` where the owner decided to keep it so. */
function pending(name: string, candidate: string, spec: string, kept = false) {
  return OntologyTerm.make(term(MZID, `term-${name}`), {
    label: en(`mz:${name}`),
    termIri: `https://www.intellectualfrontiers.com/ontology/mizan#${name}`,
    basis: bases.Unaligned,
    justification: `No standard adopted yet. Candidates to examine: ${candidate}. ${kept ? KEPT_UNALIGNED_SENTENCE : "Decision pending (0018-standards-first FR-005)."}`,
    ...(kept ? { decision: keptUnalignedDecisionId("mz", name) } : {}),
    addedOn: "2026-11-17",
    definedBy: [spec],
  });
}

/** The classes of the vocabulary that are `unaligned` today, each with the candidates to examine. */
export const pendingTerms = [
  pending("Spec", "schema:CreativeWork, dcterms:BibliographicResource", "0003-mizan FR-001"),
  pending("Requirement", "none found for a numbered requirement; OSCAL implemented-requirement for controls", "0003-mizan FR-003"),
  pending("OntologyTerm", "none found", "0018-standards-first FR-003"),
  pending("Basis", "SSSOM mapping relations for maps; none for the rest", "0018-standards-first FR-003"),
  pending("Authority", "legal citation identifiers (the U.S. Code and eCFR identifiers; ELI is European)", "0018-standards-first FR-008"),
  pending("Jurisdiction", "dcterms:Jurisdiction (to verify)", "0018-standards-first FR-002"),
  pending("JurisdictionLevel", "none found", "0018-standards-first FR-002"),
  pending("Decision", "none found; architecture decision records are documents, not a vocabulary", "0018-standards-first FR-005"),
  pending("Exception", "none found", "0017-two-languages FR-004"),
  pending("Integration", "schema:SoftwareApplication (to verify)", "0019-mizan-integrations FR-002"),
  pending("RungKind", "none found", "0016-ladder FR-008", true),
  pending("IntegrationDirection", "none found", "0019-mizan-integrations FR-002"),
  pending("ImportRecord", "prov:Activity (to verify)", "0019-mizan-integrations FR-009"),
] as const;

/** The class of a code list of Mizan's own, which specializes SKOS's `skos:Concept` as the code lists of the other ontologies do (0028-conformance-levels FR-001). */
function codeListTerm(name: string, spec: string, note: string) {
  return OntologyTerm.make(term(MZID, `term-${name}`), {
    label: en(`mz:${name}`),
    termIri: `https://www.intellectualfrontiers.com/ontology/mizan#${name}`,
    basis: bases.Specializes,
    standardTerm: skos.Concept.iri,
    mappingRelation: "subClassOf",
    justification: note,
    definedBy: [spec],
  });
}

/**
 * The classes of the conformance levels (0028-conformance-levels): each is a SKOS concept of a code list. Maturity and capability models were examined (ISO/IEC 33020's process capability
 * levels and CMMI's maturity levels; to verify) and none publishes an IRI for a level, so the levels are Mizan's own concepts and the standards are what they are named after.
 */
export const conformanceTerms = [
  codeListTerm(
    "ConformanceLevel",
    "0028-conformance-levels FR-001",
    "A level is a concept of a code list. ISO/IEC 33020 (process capability levels, to verify) and CMMI's maturity levels (to verify) were examined: they define levels of process capability and publish no IRI for them.",
  ),
  codeListTerm(
    "ConformanceRequirement",
    "0028-conformance-levels FR-002",
    "A requirement of a level is a concept of a code list; the standards the requirements point at (RFC 2119, EARS, Gherkin, OSCAL) are named in their definitions and in their specifications.",
  ),
  codeListTerm(
    "SubjectKind",
    "0029-subject-profiles FR-001",
    "A kind of subject is a concept of a code list. The kinds of work of the IFR vocabulary (ifr:WorkKind) were the model: a library is ifr:Library and the rest are ifr:Software, and mz:workKind says so by IRI. No standard names the kinds of subject a specification specifies (ISO/IEC/IEEE 12207's system elements are processes, not kinds of subject; to verify).",
  ),
  codeListTerm(
    "AudienceModel",
    "0029-subject-profiles FR-008",
    "An audience model is a concept of a code list. Business-to-business and business-to-business-to-consumer are commercial models, not terms of a standard (to verify that none publishes an IRI for them); what each asks of a subject rests on the standards its profile names.",
  ),
] as const;

/** The first baseline of Mizan's own vocabulary: every class and the basis it rests on. */
export const terms = [termStandard, termRung, ...pendingTerms, ...conformanceTerms] as const;

/** The decisions of the terms kept unaligned (the owner's decision of 2026-11-17, issue #10): one `mz:Decision` for each. */
export const decisions = [keptUnalignedDecision("mz", "RungKind")] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "mizan",
  prefixes: [DCTERMS, MZ, MZID, MZV, OWL, RDFS, SKOS, XSD],
  individuals: [
    mizanOntology,
    ...classes,
    ...properties,
    ...Object.values(bases),
    ...Object.values(jurisdictionLevels),
    ...Object.values(integrationDirections),
    ...Object.values(rungKinds),
    ...Object.values(conformanceRequirements),
    ...Object.values(conformanceLevels),
    ...Object.values(subjectKinds),
    ...Object.values(audienceModels),
    ...rungs,
    unitedStates,
    europeanUnion,
    california,
    ...authorities,
    ...terms,
    ...decisions,
  ],
};
