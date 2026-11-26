/**
 * Generate the Mizan ontology's Turtle from its TypeScript (commons 0012-ontology FR-011, 0016-ladder).
 *
 *     bun commons/libraries/src/generate-ontology.ts           write commons/generated/mizan.auto.ttl
 *     bun commons/libraries/src/generate-ontology.ts --check   exit 1, writing nothing, where the file is not what the ontology makes
 *
 * The ontology (commons/ontology/src/mizan/*.ts) is the source, read as the typed values it is; the Turtle is never edited by hand. The ontology is checked first: a rule
 * it breaks stops the run (exit 2) with every finding named.
 *
 * Spec: 0001-libraries FR-008
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { files as auditFiles, packagingTerms } from "@intellectual-frontiers/ontology/audit";
import {
  Authority,
  bases,
  classes,
  Decision,
  files,
  integrationDirections,
  rungKinds,
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
} from "@intellectual-frontiers/ontology/mizan";
import * as ifccmOntology from "@intellectual-frontiers/ontology/ifccm";
import * as ifrOntology from "@intellectual-frontiers/ontology/ifr";
import * as ifqsOntology from "@intellectual-frontiers/ontology/ifqs";
import * as otoOntology from "@intellectual-frontiers/ontology/oto";
import * as planningOntology from "@intellectual-frontiers/ontology/planning";
import * as workloadOntology from "@intellectual-frontiers/ontology/workload";
import * as boundaryOntology from "@intellectual-frontiers/ontology/boundary";
import * as kanonOntology from "@intellectual-frontiers/ontology/kanon";
import { formatRdfFinding, type OntologyFile, validate } from "@intellectual-frontiers/rdf";
import { stdio } from "@intellectual-frontiers/system";
import { exportDcat } from "@intellectual-frontiers/mizan/integrations/pure/export-dcat";
import {
  CC0,
  digestOf as digestOfFiles,
  distributionsOf,
  ExportRefused,
  listsOf,
  membersOf,
  type OntologyPublication,
  publishedFiles,
  textOf as textOfResult,
  turtleOf as turtleOfFiles,
} from "./publish-ontology.ts";

export { ExportRefused };

/** The command that writes the file again. */
export const RUN = "bun commons/libraries/src/generate-ontology.ts";

/** Where the Turtle is written, from commons' folder. */
export const TURTLE_PATH = "generated/mizan.auto.ttl";

/** Mizan's own ontology, as it is published (0019-mizan-integrations FR-010 to FR-019). */
export const MIZAN: OntologyPublication = {
  name: "mizan",
  ns: { prefix: "mz", iri: MZ.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["pm", "https://www.intellectualfrontiers.com/ontology/packaging#"],
    ["schema", "https://schema.org/"],
    ["dcat", "http://www.w3.org/ns/dcat#"],
    ["purl", "https://github.com/package-url/purl-spec#"],
    ["spdxrel", "https://spdx.org/rdf/3.0.1/terms/Core/RelationshipType/"],
  ],
  files,
  ontology: mizanOntology,
  classes,
  properties,
  terms: [...terms, ...packagingTerms],
  schemas: [Rung, Jurisdiction, Authority, Standard, Decision, OntologyTerm],
  lists: [
    { name: "Basis", table: "mizan_basis", members: membersOf(bases) },
    { name: "JurisdictionLevel", table: "mizan_jurisdiction_level", members: membersOf(jurisdictionLevels) },
    { name: "RungKind", table: "mizan_rung_kind", members: membersOf(rungKinds) },
    { name: "IntegrationDirection", table: "mizan_integration_direction", members: membersOf(integrationDirections) },
  ],
  source: "commons/ontology/src/mizan/*.ts (commons 0016-ladder, 0018-standards-first, 0012-ontology FR-011)",
  run: RUN,
  shapes: { prefix: "mzsh", iri: "https://www.intellectualfrontiers.com/ontology/mizan-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/mizan-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/mizan-mappings",
  sssomCuries: {
    dcterms: "http://purl.org/dc/terms/",
    pm: "https://www.intellectualfrontiers.com/ontology/packaging#",
    schema: "https://schema.org/",
    dcat: "http://www.w3.org/ns/dcat#",
    purl: "https://github.com/package-url/purl-spec#",
    spdxrel: "https://spdx.org/rdf/3.0.1/terms/Core/RelationshipType/",
  },
  viewTitle: "Mizan: the shared ontology",
  license: CC0,
};

/** The ontology of Intellectual Frontiers Capabilities Configuration Management (commons 0020-ifccm), as it is published. */
export const IFCCM: OntologyPublication = {
  name: "ifccm",
  ns: { prefix: "ifccm", iri: ifccmOntology.IFCCM.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["ifccm", ifccmOntology.IFCCM.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
    ["oslc_cm", "http://open-services.net/ns/cm#"],
  ],
  files: ifccmOntology.files,
  ontology: ifccmOntology.ifccmOntology,
  classes: ifccmOntology.classes,
  properties: ifccmOntology.properties,
  terms: ifccmOntology.terms,
  schemas: [
    ifccmOntology.Capability,
    ifccmOntology.ChangeRequest,
    ifccmOntology.Change,
    ifccmOntology.ConfigurationItem,
    ifccmOntology.Baseline,
    ifccmOntology.HarnessDeclaration,
    ifccmOntology.RegulatedDomain,
    ifccmOntology.TraceStage,
    ifccmOntology.AuthorityFunction,
  ],
  lists: listsOf("ifccm", [
    ["ChangeRequestKind", ifccmOntology.changeRequestKinds],
    ["ChangeRequestState", ifccmOntology.changeRequestStates],
    ["IssueReferenceKind", ifccmOntology.issueReferenceKinds],
    ["EnforcementPhase", ifccmOntology.enforcementPhases],
    ["RegulatedDomain", ifccmOntology.regulatedDomains],
    ["TraceStage", ifccmOntology.traceStages],
    ["AuthorityFunction", ifccmOntology.authorityFunctions],
    ["GitCapability", ifccmOntology.gitCapabilities],
    ["GitManagerKind", ifccmOntology.gitManagerKinds],
  ]),
  source: "commons/ontology/src/ifccm/*.ts",
  run: RUN,
  shapes: { prefix: "ifccmsh", iri: "https://www.intellectualfrontiers.com/ontology/ifccm-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/ifccm-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/ifccm-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#", oslc_cm: "http://open-services.net/ns/cm#" },
  viewTitle: "Intellectual Frontiers Capabilities Configuration Management: the ontology",
  license: CC0,
};

/** The ontology of the Intellectual Frontiers Quality System (commons 0021-ifqs, 0022-trust), as it is published. */
export const IFQS: OntologyPublication = {
  name: "ifqs",
  ns: { prefix: "ifqs", iri: ifqsOntology.IFQS.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["ifqs", ifqsOntology.IFQS.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
    ["dcat", "http://www.w3.org/ns/dcat#"],
  ],
  files: ifqsOntology.files,
  ontology: ifqsOntology.ifqsOntology,
  classes: ifqsOntology.classes,
  properties: ifqsOntology.properties,
  terms: ifqsOntology.terms,
  schemas: [
    ifqsOntology.TestRun,
    ifqsOntology.TestCase,
    ifqsOntology.Evidence,
    ifqsOntology.EvidenceFile,
    ifqsOntology.Nonconformance,
    ifqsOntology.Capa,
    ifqsOntology.QualityObjective,
    ifqsOntology.ReviewDebt,
    ifqsOntology.AssessorPack,
  ],
  lists: listsOf("ifqs", [
    ["EvidenceGrade", ifqsOntology.evidenceGrades],
    ["TestOutcome", ifqsOntology.testOutcomes],
    ["FreshnessState", ifqsOntology.freshnessStates],
    ["NonconformanceState", ifqsOntology.nonconformanceStates],
    ["CapaState", ifqsOntology.capaStates],
    ["QualityTier", ifqsOntology.qualityTiers],
    ["Audience", ifqsOntology.audiences],
  ]),
  source: "commons/ontology/src/ifqs/*.ts",
  run: RUN,
  shapes: { prefix: "ifqssh", iri: "https://www.intellectualfrontiers.com/ontology/ifqs-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/ifqs-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/ifqs-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#", dcat: "http://www.w3.org/ns/dcat#" },
  viewTitle: "Intellectual Frontiers Quality System: the ontology",
  license: CC0,
};

/** The Operational Truth Ontology (commons ontology 0002-oto), as it is published. */
export const OTO: OntologyPublication = {
  name: "oto",
  ns: { prefix: "oto", iri: otoOntology.OTO.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["oto", otoOntology.OTO.iri],
    ["ifqs", ifqsOntology.IFQS.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
  ],
  files: otoOntology.files,
  ontology: otoOntology.otoOntology,
  classes: otoOntology.classes,
  properties: otoOntology.properties,
  terms: otoOntology.terms,
  schemas: [otoOntology.DomainSchema, otoOntology.MaturityLevelSchema, otoOntology.Alignment],
  lists: listsOf("oto", [
    ["Domain", otoOntology.domains],
    ["Invariant", otoOntology.invariants],
    ["Pillar", otoOntology.pillars],
    ["Principle", otoOntology.principles],
    ["MaturityLevel", otoOntology.maturityLevels],
    ["Dimension", otoOntology.dimensions],
    ["AlignmentState", otoOntology.alignmentStates],
  ]),
  source: "commons/ontology/src/oto/*.ts",
  run: RUN,
  shapes: { prefix: "otosh", iri: "https://www.intellectualfrontiers.com/ontology/oto-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/oto-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/oto-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#", ifqs: ifqsOntology.IFQS.iri },
  viewTitle: "Operational Truth Ontology",
  license: CC0,
};

/** The ontology of Planning (commons 0037-planning), as it is published. */
export const PLANNING: OntologyPublication = {
  name: "planning",
  ns: { prefix: "plan", iri: planningOntology.PLANNING.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["plan", planningOntology.PLANNING.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
  ],
  files: planningOntology.files,
  ontology: planningOntology.planningOntology,
  classes: planningOntology.classes,
  properties: planningOntology.properties,
  terms: planningOntology.terms,
  schemas: [planningOntology.ItemKindSchema, planningOntology.StateSchema, planningOntology.CloseReasonSchema, planningOntology.SeveritySchema],
  lists: listsOf("plan", [
    ["ItemKind", planningOntology.itemKinds],
    ["State", planningOntology.states],
    ["CloseReason", planningOntology.closeReasons],
    ["Severity", planningOntology.severities],
    ["Verdict", planningOntology.verdicts],
    ["LinkKind", planningOntology.linkKinds],
    ["Capability", planningOntology.capabilities],
    ["FieldAuthority", planningOntology.fieldAuthorities],
    ["Origin", planningOntology.origins],
    ["ActorKind", planningOntology.actorKinds],
    ["LocatorKind", planningOntology.locatorKinds],
    ["EventType", planningOntology.eventTypes],
    ["PrincipalBasis", planningOntology.principalBases],
  ]),
  source: "commons/ontology/src/planning/*.ts",
  run: RUN,
  shapes: { prefix: "plansh", iri: "https://www.intellectualfrontiers.com/ontology/planning-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/planning-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/planning-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#" },
  viewTitle: "Planning Ontology",
  license: CC0,
};

/** The ontology of Workload (commons 0040-workload-pattern), as it is published. */
export const WORKLOAD: OntologyPublication = {
  name: "workload",
  ns: { prefix: "wl", iri: workloadOntology.WORKLOAD.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["wl", workloadOntology.WORKLOAD.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
  ],
  files: workloadOntology.files,
  ontology: workloadOntology.workloadOntology,
  classes: workloadOntology.classes,
  properties: workloadOntology.properties,
  terms: workloadOntology.terms,
  schemas: [workloadOntology.FormSchema, workloadOntology.TriggerSchema],
  lists: listsOf("wl", [
    ["Form", workloadOntology.forms],
    ["Trigger", workloadOntology.triggers],
  ]),
  source: "commons/ontology/src/workload/*.ts",
  run: RUN,
  shapes: { prefix: "wlsh", iri: "https://www.intellectualfrontiers.com/ontology/workload-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/workload-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/workload-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#" },
  viewTitle: "Workload Ontology",
  license: CC0,
};

/** The ontology of Boundaries (commons 0045-boundaries), as it is published. */
export const BOUNDARY: OntologyPublication = {
  name: "boundary",
  ns: { prefix: "bnd", iri: boundaryOntology.BOUNDARY.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["bnd", boundaryOntology.BOUNDARY.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
  ],
  files: boundaryOntology.files,
  ontology: boundaryOntology.boundaryOntology,
  classes: boundaryOntology.classes,
  properties: boundaryOntology.properties,
  terms: boundaryOntology.terms,
  schemas: [
    boundaryOntology.BoundaryKindSchema,
    boundaryOntology.DispositionSchema,
    boundaryOntology.ImpactSchema,
    boundaryOntology.CmmcAssetCategorySchema,
    boundaryOntology.PartyRoleSchema,
    boundaryOntology.DataClassSchema,
  ],
  lists: listsOf("bnd", [
    ["BoundaryKind", boundaryOntology.boundaryKinds],
    ["Disposition", boundaryOntology.dispositions],
    ["Impact", boundaryOntology.impacts],
    ["CmmcAssetCategory", boundaryOntology.cmmcAssetCategories],
    ["PartyRole", boundaryOntology.partyRoles],
    ["DataClass", boundaryOntology.dataClasses],
  ]),
  source: "commons/ontology/src/boundary/*.ts",
  run: RUN,
  shapes: { prefix: "bndsh", iri: "https://www.intellectualfrontiers.com/ontology/boundary-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/boundary-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/boundary-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#" },
  viewTitle: "Boundary Ontology",
  license: CC0,
};

/** The ontology of Intellectual Frontiers Releases (commons 0026-works-versioning), as it is published. */
export const IFR: OntologyPublication = {
  name: "ifr",
  ns: { prefix: "ifr", iri: ifrOntology.IFR.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["ifr", ifrOntology.IFR.iri],
    ["ifqs", ifqsOntology.IFQS.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
    ["schema", "https://schema.org/"],
  ],
  files: ifrOntology.files,
  ontology: ifrOntology.ifrOntology,
  classes: ifrOntology.classes,
  properties: ifrOntology.properties,
  terms: ifrOntology.terms,
  schemas: [ifrOntology.ReleaseTag, ifrOntology.ApprovalRecord, ifrOntology.Retention],
  lists: listsOf("ifr", Object.entries(ifrOntology.codeLists)),
  source: "commons/ontology/src/ifr/*.ts",
  run: RUN,
  shapes: { prefix: "ifrsh", iri: "https://www.intellectualfrontiers.com/ontology/ifr-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/ifr-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/ifr-mappings",
  sssomCuries: {
    dcterms: "http://purl.org/dc/terms/",
    prov: "http://www.w3.org/ns/prov#",
    schema: "https://schema.org/",
    gitdocs: "https://git-scm.com/docs/",
  },
  viewTitle: "Intellectual Frontiers Releases: the ontology",
  license: CC0,
};

/** The ontology of Kanon (commons 0033-kanon), as it is published. */
export const KANON: OntologyPublication = {
  name: "kanon",
  ns: { prefix: "kanon", iri: kanonOntology.KANON.iri },
  idNs: { prefix: "mzid", iri: MZID.iri },
  curies: [
    ["kanon", kanonOntology.KANON.iri],
    ["mz", MZ.iri],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"],
    ["dcterms", "http://purl.org/dc/terms/"],
    ["prov", "http://www.w3.org/ns/prov#"],
    ["sh", "http://www.w3.org/ns/shacl#"],
  ],
  files: kanonOntology.files,
  ontology: kanonOntology.kanonOntology,
  classes: kanonOntology.classes,
  properties: kanonOntology.properties,
  terms: kanonOntology.terms,
  schemas: [kanonOntology.Layer],
  lists: listsOf("kanon", [["Layer", kanonOntology.layers]]),
  source: "commons/ontology/src/kanon/*.ts",
  run: RUN,
  shapes: { prefix: "kanonsh", iri: "https://www.intellectualfrontiers.com/ontology/kanon-shapes#" },
  schemasIri: "https://www.intellectualfrontiers.com/ontology/kanon-schemas",
  sssomSetId: "https://www.intellectualfrontiers.com/ontology/kanon-mappings",
  sssomCuries: { dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#", sh: "http://www.w3.org/ns/shacl#" },
  viewTitle: "Kanon: the ontology",
  license: CC0,
};

/** The ontologies of commons that are published, each from its own typed modules: Mizan's, then the ones its specifications define. */
export const publications: readonly OntologyPublication[] = [MIZAN, IFCCM, IFQS, OTO, PLANNING, WORKLOAD, BOUNDARY, IFR, KANON];

/** Where the generated files are downloaded from: this repository's `commons/` folder on its default branch. */
const DOWNLOAD_BASE = "https://raw.githubusercontent.com/intellectual-frontiers/.github/main/commons/";

/** The exports of the ontology (0019-mizan-integrations FR-010): everything but its Turtle, by its path from commons' folder. */
export async function exportsOf(auditDigest: string): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  const catalogNote = `AUTO-GENERATED by ${RUN} from commons/ontology/*/*.ts (commons 0019-mizan-integrations FR-018). Do not edit: change the ontologies.`;
  for (const p of publications) {
    for (const [path, text] of await publishedFiles(p)) out.set(path, text);
  }
  out.set(
    "generated/mizan-audit-packaging.auto.ttl",
    turtleOf(auditFiles, auditDigest, "commons/ontology/src/audit/*.ts (commons 0018-standards-first FR-003)"),
  );
  out.set(
    "generated/mizan-catalog.auto.ttl",
    textOf(
      exportDcat({
        iri: "https://www.intellectualfrontiers.com/ontology/mizan-catalog",
        title: "Mizan, the IF Spec Profile: published ontologies",
        description: "The ontologies Intellectual Frontiers publishes with Mizan, each with the files generated from it.",
        license: CC0,
        publisher: { iri: "https://www.intellectualfrontiers.com/", name: "Intellectual Frontiers" },
        downloadBase: DOWNLOAD_BASE,
        comments: [catalogNote],
        datasets: publications.map((p) => ({
          id: p.name,
          ontologyIri: p.ns.iri.replace(/#$/, ""),
          ...(p.ontology.values.versionInfo === undefined ? {} : { versionInfo: p.ontology.values.versionInfo }),
          title: p.ontology.values.label?.value ?? p.name,
          ...(p.ontology.values.description === undefined ? {} : { description: p.ontology.values.description.value }),
          distributions: distributionsOf(p.name, p.ontology.values.label?.value ?? p.name),
        })),
      }),
      "a DCAT catalog",
    ),
  );
  return out;
}

/** Every file the ontologies make, by its path from commons' folder, in the order they are written. */
export async function wanted(): Promise<ReadonlyMap<string, string>> {
  return exportsOf(await digestOf(auditFiles));
}

/** The SHA-256 of the ontology's canonical N-Triples (0012-ontology FR-012): it changes with a fact, never with the layout of a module. */
export const digestOf = digestOfFiles;

/** The text of an exporter's result, or a thrown sentence naming what the ontology states that the form cannot hold (`main` turns it into exit 2). */
export function textOf(
  r: { readonly kind: "ok"; readonly value: string } | { readonly kind: "err"; readonly error: readonly string[] },
  what: string,
): string {
  return textOfResult(r, what, "Mizan");
}

/** The findings a rule of the kernel finds in the ontology, one sentence each; none where it is sound. */
export function findingsOf(of: readonly OntologyFile[]): readonly string[] {
  return validate(of.flatMap((f) => f.individuals)).map(formatRdfFinding);
}

/** The ontology as canonical Turtle: every file's individuals, with every file's prefixes. */
export function turtleOf(
  of: readonly OntologyFile[],
  digest: string,
  source = "commons/ontology/src/mizan/*.ts (commons 0016-ladder, 0018-standards-first, 0012-ontology FR-011)",
): string {
  return turtleOfFiles(of, RUN, digest, source);
}

/** The command line: write the files, or with `--check` say whether they are what the ontology makes. Returns the exit status (0, 1 stale, 2 the ontology breaks a rule). */
export async function main(argv: readonly string[], commons: string = fileURLToPath(new URL("../..", import.meta.url))): Promise<number> {
  for (const p of publications) {
    const found = findingsOf(p.files);
    if (found.length > 0) {
      stdio.stderr.writeSync(`the ${p.name} ontology breaks its own rules:\n${found.map((f) => `  - ${f}\n`).join("")}`);
      return 2;
    }
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
