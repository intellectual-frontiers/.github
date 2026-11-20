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

/** The ontologies of commons that are published, each from its own typed modules: Mizan's, then the ones its specifications define. */
export const publications: readonly OntologyPublication[] = [MIZAN, IFCCM, IFQS, IFR];

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
