/**
 * Check a Mizan folder against the rules Mizan adds to the format (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009).
 *
 *     bun commons/libraries/src/check.ts                       check commons/spec-kit against commons/spec-kit/mizan.baseline.txt
 *     bun commons/libraries/src/check.ts --root DIR            check DIR (a folder holding specs/)
 *     bun commons/libraries/src/check.ts --register DIR        the folder of the registers (and of the baseline, `mizan.baseline.txt` beside `registry.tsv`) where it is not the root
 *     bun commons/libraries/src/check.ts --defined-by          also hold commons' own terms to the requirement-to-term stage (0003-mizan FR-044), which a harness turns on with `specTerms.definitions`
 *     bun commons/libraries/src/check.ts --baseline FILE       hold the findings against FILE
 *     bun commons/libraries/src/check.ts --write-baseline      write the baseline from today's findings (to start it, or to shrink it: never to add a line to pass)
 *     bun commons/libraries/src/check.ts --level L0|L1|L2|L3   hold the folder to the rules of that conformance level only (commons 0028-conformance-levels; L3, every rule, where it is not given)
 *     bun commons/libraries/src/check.ts --all [--repo DIR]     also run the `verify` of every library a manifest declares, each from its folder (the libraries of DIR, this repository by default); without it nothing inside a library is read
 *     bun commons/libraries/src/check.ts --today YYYY-MM-DD    count the 90 days of a decision from that day (for a test); commons' own folder also holds its ontologies' terms to 0018-standards-first FR-003 to FR-005
 *
 * It prints every new finding and every stale baseline line on standard error, writes nothing without `--write-baseline`, and exits 1 where a finding is new or a baseline
 * line no longer occurs, so that the baseline only shrinks (0003-mizan FR-015). The rules are plugins (`rules.ts`); this file only reads the folder and judges.
 *
 * Spec: 0001-libraries FR-008
 *
 * @module
 */
import { fileURLToPath } from "node:url";
import process from "node:process";
import { stdio } from "@intellectual-frontiers/system";
import { packagingTerms } from "@intellectual-frontiers/ontology/audit";
import {
  audienceModels,
  bases,
  classes,
  conformanceLevels,
  conformanceRequirements,
  jurisdictionLevels,
  integrationDirections,
  rungKinds,
  subjectKinds,
  mz,
  terms,
} from "@intellectual-frontiers/ontology/mizan";
import * as ifccmOntology from "@intellectual-frontiers/ontology/ifccm";
import * as ifrOntology from "@intellectual-frontiers/ontology/ifr";
import * as ifqsOntology from "@intellectual-frontiers/ontology/ifqs";
import * as otoOntology from "@intellectual-frontiers/ontology/oto";
import * as planningOntology from "@intellectual-frontiers/ontology/planning";
import { pm } from "@intellectual-frontiers/ontology/supply-chain/packaging";
import { type RulePlugin, rulePlugins } from "@intellectual-frontiers/mizan/rules";
import { holdHarness } from "@intellectual-frontiers/mizan/harness";
import { DEFAULT_LEVEL, LEVELS, levelOf } from "@intellectual-frontiers/mizan/levels";
import { verifyAll } from "./libraries.ts";
import { readWorks } from "@intellectual-frontiers/mizan/versions/scan";
import { BASELINE_COMMENTS, readSpecTexts } from "@intellectual-frontiers/mizan/spec-files";
import { definitionsOf } from "@intellectual-frontiers/mizan/spec-terms";
import type { BasisKind, TermRecord } from "@intellectual-frontiers/mizan/standards";

export { BASELINE_COMMENTS, readSpecTexts };

/** The records of an audit of terms as the rules read them: each term of a vocabulary and the basis it rests on (0018-standards-first FR-003 to FR-005). */
export function termRecordsOf(audit: readonly (typeof terms)[number][]): readonly TermRecord[] {
  const kinds = new Map<string, BasisKind>([
    [bases.Adopts.iri, "adopts"],
    [bases.Specializes.iri, "specializes"],
    [bases.Maps.iri, "maps"],
    [bases.Unaligned.iri, "unaligned"],
  ]);
  return audit.map((t) => ({
    iri: t.values.termIri,
    basis: kinds.get(t.values.basis.iri) ?? "unaligned",
    ...(t.values.standardTerm === undefined ? {} : { standardTerm: t.values.standardTerm }),
    ...(t.values.justification === undefined ? {} : { justification: t.values.justification }),
    ...(t.values.addedOn === undefined ? {} : { addedOn: t.values.addedOn }),
    decision: t.values.decision !== undefined,
    ...(t.values.deprecatedOn === undefined ? {} : { deprecatedOn: t.values.deprecatedOn }),
    ...(t.values.replacedBy === undefined ? {} : { replacedBy: t.values.replacedBy }),
    ...(t.values.definedBy === undefined ? {} : { definedBy: t.values.definedBy }),
  }));
}

/** Mizan's own terms and the packaging ontology's as the rules read them. */
export function mizanTermRecords(): readonly TermRecord[] {
  return termRecordsOf([...terms, ...packagingTerms, ...ifccmOntology.terms, ...ifqsOntology.terms, ...otoOntology.terms, ...planningOntology.terms, ...ifrOntology.terms]);
}

/** The prefixes of commons' own ontologies and their namespaces. */
const PREFIXES = {
  mz: "https://www.intellectualfrontiers.com/ontology/mizan#",
  pm: "https://www.intellectualfrontiers.com/ontology/packaging#",
  ifccm: ifccmOntology.IFCCM.iri,
  ifqs: ifqsOntology.IFQS.iri,
  oto: otoOntology.OTO.iri,
  plan: planningOntology.PLANNING.iri,
  ifr: ifrOntology.IFR.iri,
} as const;

/** The CURIE of a term of commons' own ontologies: `mz:` or `pm:` and its local name, or the IRI where it is of neither. */
function curieOf(iri: string): string {
  for (const [prefix, ns] of Object.entries(PREFIXES)) if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  return iri;
}

/** The deprecated terms of commons' own ontologies, by CURIE, with what replaces each (0018-standards-first): a specification that names one is found. */
export function deprecatedTerms(): ReadonlyMap<string, string> {
  return new Map(
    [...terms, ...packagingTerms, ...ifccmOntology.terms, ...ifqsOntology.terms, ...otoOntology.terms, ...planningOntology.terms, ...ifrOntology.terms].flatMap((t) =>
      t.values.deprecatedOn === undefined ? [] : [[curieOf(t.values.termIri), curieOf(t.values.replacedBy ?? "")] as const],
    ),
  );
}

/** The command line. Returns the exit status: 0, or 1 where a finding is new or a baseline line is stale. */
export function main(
  argv: readonly string[],
  plugins: readonly RulePlugin[] = rulePlugins,
  today: string = new Date().toISOString().slice(0, 10),
): number {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = arg("--root") ?? fileURLToPath(new URL("../../spec-kit", import.meta.url));
  const own = arg("--root") === undefined;
  const asked = arg("--level");
  const level = asked === undefined ? DEFAULT_LEVEL : levelOf(asked);
  if (level === undefined) {
    stdio.stderr.writeSync(`check: --level ${asked ?? ""} is not a conformance level; the levels are ${LEVELS.join(", ")}\n`);
    return 2;
  }
  return holdHarness({
    level,
    root,
    baselineFile: arg("--baseline") ?? `${(arg("--register") ?? root).replace(/[\\/]$/, "")}/mizan.baseline.txt`,
    today: arg("--today") ?? today,
    plugins,
    writeBaseline: argv.includes("--write-baseline"),
    // commons' own folder (no --root) also holds its ontologies to the standards rules (0018-standards-first FR-001, FR-003, FR-005)
    ...(own
      ? {
          works: readWorks(fileURLToPath(new URL("../../..", import.meta.url))),
          terms: mizanTermRecords(),
          termsFile: "commons/ontology",
          completeness: [
            {
              file: "commons/ontology/src/audit/packaging.ts",
              ontology: Object.values(pm).map((t) => t.iri),
              recorded: packagingTerms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/mizan/mizan.ts",
              ontology: classes.map((c) => c.iri),
              recorded: terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/ifccm/ifccm.ts",
              ontology: ifccmOntology.classes.map((c) => c.iri),
              recorded: ifccmOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/ifqs/ifqs.ts",
              ontology: ifqsOntology.classes.map((c) => c.iri),
              recorded: ifqsOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/oto/oto.ts",
              ontology: otoOntology.classes.map((c) => c.iri),
              recorded: otoOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/planning/planning.ts",
              ontology: planningOntology.classes.map((c) => c.iri),
              recorded: planningOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/src/ifr/ifr.ts",
              ontology: ifrOntology.classes.map((c) => c.iri),
              recorded: ifrOntology.terms.map((t) => t.values.termIri),
            },
          ],
          specTerms: {
            known: {
              mz: new Set([
                ...Object.keys(mz),
                ...Object.keys(bases),
                ...Object.keys(jurisdictionLevels),
                ...Object.keys(integrationDirections),
                ...Object.keys(rungKinds),
                ...Object.keys(conformanceLevels),
                ...Object.keys(conformanceRequirements),
                ...Object.keys(subjectKinds),
                ...Object.keys(audienceModels),
              ]),
              pm: new Set(Object.keys(pm)),
              oto: new Set([
                ...Object.keys(otoOntology.oto),
                ...[
                  otoOntology.domains,
                  otoOntology.invariants,
                  otoOntology.pillars,
                  otoOntology.principles,
                  otoOntology.maturityLevels,
                  otoOntology.dimensions,
                  otoOntology.alignmentStates,
                ].flatMap((l) => Object.keys(l)),
              ]),
              plan: new Set([
                ...Object.keys(planningOntology.plan),
                ...[
                  planningOntology.itemKinds,
                  planningOntology.states,
                  planningOntology.closeReasons,
                  planningOntology.severities,
                  planningOntology.verdicts,
                  planningOntology.linkKinds,
                  planningOntology.capabilities,
                  planningOntology.fieldAuthorities,
                  planningOntology.origins,
                  planningOntology.actorKinds,
                  planningOntology.locatorKinds,
                  planningOntology.eventTypes,
                ].flatMap((l) => Object.keys(l)),
              ]),
              ifr: ifrOntology.termNames,
              ifccm: new Set([
                ...Object.keys(ifccmOntology.ifccm),
                ...[
                  ifccmOntology.changeRequestKinds,
                  ifccmOntology.changeRequestStates,
                  ifccmOntology.issueReferenceKinds,
                  ifccmOntology.enforcementPhases,
                  ifccmOntology.regulatedDomains,
                  ifccmOntology.traceStages,
                  ifccmOntology.authorityFunctions,
                  ifccmOntology.gitCapabilities,
                  ifccmOntology.gitManagerKinds,
                ].flatMap((l) => Object.keys(l)),
              ]),
              ifqs: new Set([
                ...Object.keys(ifqsOntology.ifqs),
                ...[
                  ifqsOntology.evidenceGrades,
                  ifqsOntology.testOutcomes,
                  ifqsOntology.freshnessStates,
                  ifqsOntology.nonconformanceStates,
                  ifqsOntology.capaStates,
                  ifqsOntology.qualityTiers,
                  ifqsOntology.audiences,
                ].flatMap((l) => Object.keys(l)),
              ]),
            },
            deprecated: deprecatedTerms(),
            // the requirement-to-term stage (0003-mizan FR-044) is opt-in for commons' own folder: its findings are not put in the baseline, which only shrinks
            ...(argv.includes("--defined-by") ? { definitions: definitionsOf(mizanTermRecords(), PREFIXES) } : {}),
          },
        }
      : {}),
  });
}

/** The command, with `--all` (0028-conformance-levels FR-012): the check, and then the `verify` of every library a manifest declares, each named with its status. Returns the exit status. */
export async function run(argv: readonly string[]): Promise<number> {
  const checked = main(argv);
  if (!argv.includes("--all")) return checked;
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : fileURLToPath(new URL("../../..", import.meta.url));
  const results = await verifyAll(repo);
  for (const r of results) stdio.stderr.writeSync(`verify ${r.name}: ${r.code === 0 ? "passed" : `FAILED (exit ${r.code})`}\n`);
  return checked === 0 && results.every((r) => r.code === 0) ? 0 : checked === 2 ? 2 : 1;
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2));
