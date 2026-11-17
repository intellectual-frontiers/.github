/**
 * Check a Mizan folder against the rules Mizan adds to the format (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009).
 *
 *     bun commons/ts/mizan/check.ts                       check commons/spec-kit against commons/spec-kit/mizan.baseline.txt
 *     bun commons/ts/mizan/check.ts --root DIR            check DIR (a folder holding specs/)
 *     bun commons/ts/mizan/check.ts --baseline FILE       hold the findings against FILE
 *     bun commons/ts/mizan/check.ts --write-baseline      write the baseline from today's findings (to start it, or to shrink it: never to add a line to pass)
 *     bun commons/ts/mizan/check.ts --today YYYY-MM-DD    count the 90 days of a decision from that day (for a test); commons' own folder also holds its ontologies' terms to 0018-standards-first FR-003 to FR-005
 *
 * It prints every new finding and every stale baseline line on standard error, writes nothing without `--write-baseline`, and exits 1 where a finding is new or a baseline
 * line no longer occurs, so that the baseline only shrinks (0003-mizan FR-015). The rules are plugins (`rules.ts`); this file only reads the folder and judges.
 *
 * @module
 */
import { fileURLToPath } from "node:url";
import process from "node:process";
import { packagingTerms } from "../../ontology/audit/mod.ts";
import { bases, classes, jurisdictionLevels, integrationDirections, rungKinds, mz, terms } from "../../ontology/mizan/mod.ts";
import * as ifccmOntology from "../../ontology/ifccm/mod.ts";
import * as ifrOntology from "../../ontology/ifr/mod.ts";
import * as ifqsOntology from "../../ontology/ifqs/mod.ts";
import * as ifwsOntology from "../../ontology/ifws/mod.ts";
import { pm } from "../../ontology/supply-chain/packaging/mod.ts";
import { type RulePlugin, rulePlugins } from "./rules.ts";
import { holdHarness } from "./harness.ts";
import { readWorks } from "./versions/scan.ts";
import { BASELINE_COMMENTS, readSpecTexts } from "./spec-files.ts";
import type { BasisKind, TermRecord } from "./standards.ts";

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
  }));
}

/** Mizan's own terms and the packaging ontology's as the rules read them. */
export function mizanTermRecords(): readonly TermRecord[] {
  return termRecordsOf([
    ...terms,
    ...packagingTerms,
    ...ifccmOntology.terms,
    ...ifqsOntology.terms,
    ...ifwsOntology.terms,
    ...ifrOntology.terms,
  ]);
}

/** The CURIE of a term of commons' own ontologies: `mz:` or `pm:` and its local name, or the IRI where it is of neither. */
function curieOf(iri: string): string {
  for (const [prefix, ns] of [
    ["mz", "https://www.intellectualfrontiers.com/ontology/mizan#"],
    ["pm", "https://www.intellectualfrontiers.com/ontology/packaging#"],
    ["ifws", ifwsOntology.IFWS.iri],
    ["ifccm", ifccmOntology.IFCCM.iri],
    ["ifqs", ifqsOntology.IFQS.iri],
    ["ifr", ifrOntology.IFR.iri],
  ] as const)
    if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  return iri;
}

/** The deprecated terms of commons' own ontologies, by CURIE, with what replaces each (0018-standards-first): a specification that names one is found. */
export function deprecatedTerms(): ReadonlyMap<string, string> {
  return new Map(
    [...terms, ...packagingTerms, ...ifccmOntology.terms, ...ifqsOntology.terms, ...ifwsOntology.terms, ...ifrOntology.terms].flatMap(
      (t) => (t.values.deprecatedOn === undefined ? [] : [[curieOf(t.values.termIri), curieOf(t.values.replacedBy ?? "")] as const]),
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
  return holdHarness({
    root,
    baselineFile: arg("--baseline") ?? `${root.replace(/[\\/]$/, "")}/mizan.baseline.txt`,
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
              file: "commons/ontology/audit/packaging.ts",
              ontology: Object.values(pm).map((t) => t.iri),
              recorded: packagingTerms.map((t) => t.values.termIri),
            },
            { file: "commons/ontology/mizan/mizan.ts", ontology: classes.map((c) => c.iri), recorded: terms.map((t) => t.values.termIri) },
            {
              file: "commons/ontology/ifccm/ifccm.ts",
              ontology: ifccmOntology.classes.map((c) => c.iri),
              recorded: ifccmOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/ifqs/ifqs.ts",
              ontology: ifqsOntology.classes.map((c) => c.iri),
              recorded: ifqsOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/ifws/ifws.ts",
              ontology: ifwsOntology.classes.map((c) => c.iri),
              recorded: ifwsOntology.terms.map((t) => t.values.termIri),
            },
            {
              file: "commons/ontology/ifr/ifr.ts",
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
              ]),
              pm: new Set(Object.keys(pm)),
              ifws: ifwsOntology.termNames,
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
          },
        }
      : {}),
  });
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
