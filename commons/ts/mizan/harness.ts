/**
 * The Mizan check of one harness (commons 0003-mizan FR-015, FR-019, FR-020, 0018-standards-first FR-003 to FR-005): the rules of a folder of specifications, the rules about the terms of
 * the harness's ontology (a basis on every term, the 90 days of a Decision, deprecation), and a specification naming only defined terms, held against one baseline that only shrinks. A
 * decision overdue and a term with no record of its basis fail whatever the baseline holds. Commons runs it on itself (`check.ts`); a harness runs it with its own audit.
 *
 * @example
 * ```ts
 * import { holdHarness } from "./harness.ts";
 * // process.exitCode = holdHarness({ root: ".", baselineFile: "tools/mizan.baseline.txt", today: "2026-11-17", terms: [], termsFile: "ontology/audit.ts", completeness: [] });
 * ```
 *
 * @module
 */
import { formatBaseline, judge, parseBaseline, passes, report } from "../kernel/trace.ts";
import { existsSync, readTextFileSync, writeTextFileSync } from "../runtime/fs.ts";
import { stdio } from "../runtime/mod.ts";
import { BASELINE_COMMENTS, readSpecTexts } from "./spec-files.ts";
import { type Declaration } from "./changes/declaration.ts";
import { declarationPlugin } from "./changes/plugin.ts";
import { type MizanFinding, mizanFindings, type RulePlugin, rulePlugins } from "./rules.ts";
import { type KnownTerms, specTermFindings } from "./spec-terms.ts";
import { basisMissing, termFindings, type TermRecord } from "./standards.ts";

/** What a harness gives the check. */
export type HarnessInput = {
  /** The folder that holds `specs/`. */
  readonly root: string;
  /** The baseline file: findings held, which only shrinks. */
  readonly baselineFile: string;
  /** The day the 90 days of a decision are counted to (`YYYY-MM-DD`). */
  readonly today: string;
  /** The rules for a specification, Mizan's by default; a harness may add its own. */
  readonly plugins?: readonly RulePlugin[];
  /** Write the baseline from today's findings, to start it or to shrink it, and not check. */
  readonly writeBaseline?: boolean;
  /** The records of the basis of the harness's terms (the audit), and the file they are in. */
  readonly terms?: readonly TermRecord[];
  readonly termsFile?: string;
  /** For each ontology: its terms' IRIs and the IRIs the audit has a record of; a term with no record fails the check. */
  readonly completeness?: readonly { readonly file: string; readonly ontology: readonly string[]; readonly recorded: readonly string[] }[];
  /** The terms a specification may name by prefix, and the deprecated ones with what replaces each. */
  readonly specTerms?: { readonly known: KnownTerms; readonly deprecated?: ReadonlyMap<string, string> };
  /** The name the report is headed with. */
  readonly name?: string;
  /**
   * The harness's declaration for the `changes` check (commons 0020-ifccm FR-010, FR-032) and the file it is read from, `undefined` for a harness that declares nothing: the rule that a regulated
   * domain needs a production day. The rules that need a range of commits are the command's (`changes.ts`).
   */
  readonly declaration?: { readonly declaration: Declaration | undefined; readonly file: string };
};

/** Run the check: print every new finding and every stale baseline line on standard error; returns 0, or 1 where a finding is new or a baseline line is stale. */
export function holdHarness(i: HarnessInput): number {
  const own = [
    ...termFindings(i.terms ?? [], i.today, i.termsFile ?? "ontology"),
    ...(i.completeness ?? []).flatMap((c) => basisMissing(c.ontology, c.recorded, c.file)),
  ];
  const always = (f: MizanFinding): boolean => f.rule === "mizan/decision-overdue" || f.rule === "mizan/term-basis-missing";
  const gated = (f: MizanFinding): boolean => f.severity === "gate";
  const specs = readSpecTexts(i.root);
  const named = i.specTerms === undefined ? [] : specTermFindings(specs, i.specTerms.known, i.specTerms.deprecated);
  const changes = i.declaration === undefined ? [] : [declarationPlugin(i.declaration.declaration, i.declaration.file, specs[0]?.slug)];
  // a folder with no specification has none for the plugin to be anchored to: it is then asked once, of nothing
  const alone = specs.length === 0 ? changes.flatMap((p) => p.check({ slug: "", spec: "" })) : [];
  const all: readonly MizanFinding[] = [
    ...mizanFindings(specs, [...(i.plugins ?? rulePlugins), ...changes]),
    ...alone,
    ...named,
    ...own.filter((f) => !always(f)),
  ];
  // a finding in the gate phase fails whatever the baseline holds, and is never written to it (0020-ifccm FR-011)
  const found = all.filter((f) => !gated(f));
  if (i.writeBaseline === true) {
    writeTextFileSync(i.baselineFile, formatBaseline(found, BASELINE_COMMENTS));
    stdio.stdout.writeSync(`wrote ${i.baselineFile}: ${new Set(found.map((f) => f.key)).size} findings\n`);
    return 0;
  }
  const held = existsSync(i.baselineFile) ? parseBaseline(readTextFileSync(i.baselineFile)) : [];
  const judged = judge(found, held);
  const verdict = { ...judged, fresh: [...judged.fresh, ...all.filter(gated), ...own.filter(always)] };
  stdio.stderr.writeSync(`${report(verdict, i.name ?? "mizan-rules", i.baselineFile).join("\n")}\n`);
  return passes(verdict) ? 0 : 1;
}
