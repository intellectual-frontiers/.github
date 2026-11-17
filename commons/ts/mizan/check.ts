/**
 * Check a Mizan folder against the rules Mizan adds to the format (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009).
 *
 *     bun commons/ts/mizan/check.ts                       check commons/spec-kit against commons/spec-kit/mizan.baseline.txt
 *     bun commons/ts/mizan/check.ts --root DIR            check DIR (a folder holding specs/)
 *     bun commons/ts/mizan/check.ts --baseline FILE       hold the findings against FILE
 *     bun commons/ts/mizan/check.ts --write-baseline      write the baseline from today's findings (to start it, or to shrink it: never to add a line to pass)
 *     bun commons/ts/mizan/check.ts --today YYYY-MM-DD    count the 90 days of a decision from that day (for a test); commons' own folder also holds Mizan's terms to 0018-standards-first FR-003 to FR-005
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
import { bases, terms } from "../../ontology/mizan/mod.ts";
import { type MizanFinding, mizanFindings, type RulePlugin, rulePlugins, type SpecText } from "./rules.ts";
import { type BasisKind, termFindings, type TermRecord } from "./standards.ts";

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
  return terms.map((t) => ({
    iri: t.values.termIri,
    basis: kinds.get(t.values.basis.iri) ?? "unaligned",
    ...(t.values.standardTerm === undefined ? {} : { standardTerm: t.values.standardTerm }),
    ...(t.values.justification === undefined ? {} : { justification: t.values.justification }),
    ...(t.values.addedOn === undefined ? {} : { addedOn: t.values.addedOn }),
    decision: t.values.decision !== undefined,
  }));
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
  // commons' own folder (no --root) also holds Mizan's own terms to the standards rules; a decision overdue fails whatever the baseline holds (0018-standards-first FR-005)
  const own =
    arg("--root") === undefined ? termFindings(mizanTermRecords(), arg("--today") ?? today, "commons/ontology/mizan/mizan.ts") : [];
  const overdue = own.filter((f) => f.rule === "mizan/decision-overdue");
  const found: readonly MizanFinding[] = [
    ...mizanFindings(readSpecTexts(root), plugins),
    ...own.filter((f) => f.rule !== "mizan/decision-overdue"),
  ];
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
