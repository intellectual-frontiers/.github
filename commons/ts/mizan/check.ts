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
import { formatBaseline, judge, parseBaseline, passes, report } from "../kernel/trace.ts";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync } from "../runtime/fs.ts";
import { stdio } from "../runtime/mod.ts";
import { packagingTerms } from "../../ontology/audit/mod.ts";
import { bases, classes, jurisdictionLevels, integrationDirections, mz, terms } from "../../ontology/mizan/mod.ts";
import { pm } from "../../ontology/supply-chain/packaging/mod.ts";
import { type MizanFinding, mizanFindings, type RulePlugin, rulePlugins, type SpecText } from "./rules.ts";
import { specTermFindings } from "./spec-terms.ts";
import { basisMissing, type BasisKind, termFindings, type TermRecord } from "./standards.ts";

/** The specifications of a folder (`root/specs/NNNN-slug/spec.md`, and `plan.md` where there is one), in the order of their names. */
export function readSpecTexts(root: string): readonly SpecText[] {
  const specs = `${root.replace(/[\\/]$/, "")}/specs`;
  if (!existsSync(specs)) return [];
  const out: SpecText[] = [];
  for (const e of readDirSync(specs).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!e.isDirectory || !existsSync(`${specs}/${e.name}/spec.md`)) continue;
    const plan = existsSync(`${specs}/${e.name}/plan.md`) ? readTextFileSync(`${specs}/${e.name}/plan.md`) : undefined;
    out.push({
      slug: e.name,
      spec: readTextFileSync(`${specs}/${e.name}/spec.md`).replaceAll("\r\n", "\n"),
      ...(plan === undefined ? {} : { plan: plan.replaceAll("\r\n", "\n") }),
    });
  }
  return out;
}

/** The comment lines a baseline file begins with. */
export const BASELINE_COMMENTS = [
  "The findings of the rules Mizan adds (commons 0003-mizan FR-015) that existed when each rule was first held.",
  "A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "Never add a line to make a check pass.",
] as const;

/** Mizan's own terms as the rules read them: each class of its vocabulary and the basis it rests on (0018-standards-first FR-003 to FR-005). */
export function mizanTermRecords(): readonly TermRecord[] {
  const kinds = new Map<string, BasisKind>([
    [bases.Adopts.iri, "adopts"],
    [bases.Specializes.iri, "specializes"],
    [bases.Maps.iri, "maps"],
    [bases.Unaligned.iri, "unaligned"],
  ]);
  return [...terms, ...packagingTerms].map((t) => ({
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

/** The CURIE of a term of commons' own ontologies: `mz:` or `pm:` and its local name, or the IRI where it is of neither. */
function curieOf(iri: string): string {
  for (const [prefix, ns] of [
    ["mz", "https://www.intellectualfrontiers.com/ontology/mizan#"],
    ["pm", "https://www.intellectualfrontiers.com/ontology/packaging#"],
  ] as const)
    if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  return iri;
}

/** The deprecated terms of commons' own ontologies, by CURIE, with what replaces each (0018-standards-first): a specification that names one is found. */
export function deprecatedTerms(): ReadonlyMap<string, string> {
  return new Map(
    [...terms, ...packagingTerms].flatMap((t) =>
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
  const baselineFile = arg("--baseline") ?? `${root.replace(/[\\/]$/, "")}/mizan.baseline.txt`;
  // commons' own folder (no --root) also holds its ontologies to the standards rules; a decision overdue, and a term with no record of its basis, fail whatever the baseline holds
  // (0018-standards-first FR-003, FR-005)
  const own =
    arg("--root") === undefined
      ? [
          ...termFindings(mizanTermRecords(), arg("--today") ?? today, "commons/ontology"),
          ...basisMissing(
            Object.values(pm).map((t) => t.iri),
            packagingTerms.map((t) => t.values.termIri),
            "commons/ontology/audit/packaging.ts",
          ),
          ...basisMissing(
            classes.map((c) => c.iri),
            terms.map((t) => t.values.termIri),
            "commons/ontology/mizan/mizan.ts",
          ),
        ]
      : [];
  const always = (f: MizanFinding): boolean => f.rule === "mizan/decision-overdue" || f.rule === "mizan/term-basis-missing";
  const overdue = own.filter(always);
  const specs = readSpecTexts(root);
  // commons' own specifications name terms of its own ontologies: they must be defined (0018-standards-first FR-001)
  const named =
    arg("--root") === undefined
      ? specTermFindings(
          specs,
          {
            mz: new Set([
              ...Object.keys(mz),
              ...Object.keys(bases),
              ...Object.keys(jurisdictionLevels),
              ...Object.keys(integrationDirections),
            ]),
            pm: new Set(Object.keys(pm)),
          },
          deprecatedTerms(),
        )
      : [];
  const found: readonly MizanFinding[] = [...mizanFindings(specs, plugins), ...named, ...own.filter((f) => !always(f))];
  if (argv.includes("--write-baseline")) {
    writeTextFileSync(baselineFile, formatBaseline(found, BASELINE_COMMENTS));
    stdio.stdout.writeSync(`wrote ${baselineFile}: ${new Set(found.map((f) => f.key)).size} findings\n`);
    return 0;
  }
  const held = existsSync(baselineFile) ? parseBaseline(readTextFileSync(baselineFile)) : [];
  const judged = judge(found, held);
  const verdict = { ...judged, fresh: [...judged.fresh, ...overdue] };
  stdio.stderr.writeSync(`${report(verdict, "mizan-rules", baselineFile).join("\n")}\n`);
  return passes(verdict) ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
