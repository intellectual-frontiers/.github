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
import { existsSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";
import { BASELINE_COMMENTS, readSpecTexts } from "./spec-files.ts";
import { type Declaration } from "./changes/declaration.ts";
import { declarationPlugin } from "./changes/plugin.ts";
import { versionsPlugin, type WorkFile } from "./versions/plugin.ts";
import { type MizanFinding, mizanFindings, type RulePlugin, rulePlugins } from "./rules.ts";
import { type KnownTerms, specTermFindings, termDefinedByFindings, type TermDefinitions } from "./spec-terms.ts";
import { basisMissing, termFindings, type TermRecord } from "./standards.ts";
import { DEFAULT_LEVEL, type LevelKey, ruleRunsAt } from "./levels.ts";

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
  readonly specTerms?: {
    readonly known: KnownTerms;
    readonly deprecated?: ReadonlyMap<string, string>;
    /**
     * What each term's `mz:definedBy` says, by CURIE (`definitionsOf`): where it is given, a requirement that names a term the term does not cite back is a finding (0003-mizan FR-044), a
     * warning the baseline holds. Where it is not, the stage is not run.
     */
    readonly definitions?: TermDefinitions;
  };
  /** The name the report is headed with. */
  readonly name?: string;
  /**
   * The harness's declaration for the `changes` check (commons 0020-ifccm FR-010, FR-032) and the file it is read from, `undefined` for a harness that declares nothing: the rule that a regulated
   * domain needs a production day. The rules that need a range of commits are the command's (`changes.ts`).
   */
  readonly declaration?: { readonly declaration: Declaration | undefined; readonly file: string };
  /**
   * The records of the works under the root (`release.ts`, commons 0026-works-versioning FR-032), read as text with their paths from the root: that each decodes, that its version matches the pattern
   * of its kind's scheme and that a controlled document's revision has its approval. The comparison with a base is the command's (`versions.ts`).
   */
  readonly works?: readonly WorkFile[];
  /**
   * The conformance level the harness declares (commons 0028-conformance-levels FR-008): the check runs only the rules the level entails. `L3`, which entails every rule, where it is not given, so that a
   * harness that declares none sees what it saw before levels existed.
   */
  readonly level?: LevelKey;
};

/** Run the check: print every new finding and every stale baseline line on standard error; returns 0, or 1 where a finding is new or a baseline line is stale. */
export function holdHarness(i: HarnessInput): number {
  const level = i.level ?? DEFAULT_LEVEL;
  const runs = (rule: string): boolean => ruleRunsAt(rule, level);
  const own = [
    ...termFindings(i.terms ?? [], i.today, i.termsFile ?? "ontology"),
    ...(i.completeness ?? []).flatMap((c) => basisMissing(c.ontology, c.recorded, c.file)),
  ];
  const always = (f: MizanFinding): boolean => f.rule === "mizan/decision-overdue" || f.rule === "mizan/term-basis-missing";
  const gated = (f: MizanFinding): boolean => f.severity === "gate";
  const specs = readSpecTexts(i.root);
  const named =
    i.specTerms === undefined
      ? []
      : [
          ...specTermFindings(specs, i.specTerms.known, i.specTerms.deprecated),
          ...(i.specTerms.definitions === undefined ? [] : termDefinedByFindings(specs, i.specTerms.known, i.specTerms.definitions)),
        ];
  const changes = [
    ...(i.declaration === undefined ? [] : [declarationPlugin(i.declaration.declaration, i.declaration.file, specs[0]?.slug)]),
    ...(i.works === undefined ? [] : [versionsPlugin(i.works, specs[0]?.slug)]),
  ].filter((p) => level === DEFAULT_LEVEL || runs(p.id));
  // a folder with no specification has none for the plugin to be anchored to: it is then asked once, of nothing
  const alone = specs.length === 0 ? changes.flatMap((p) => p.check({ slug: "", spec: "" })) : [];
  const everything: readonly MizanFinding[] = [
    ...mizanFindings(specs, [...(i.plugins ?? rulePlugins), ...changes]),
    ...alone,
    ...named,
    ...own.filter((f) => !always(f)),
  ];
  // below L3 only the rules the level entails are run (0028-conformance-levels FR-009)
  const all = level === DEFAULT_LEVEL ? everything : everything.filter((f) => runs(f.rule));
  const ownRun = level === DEFAULT_LEVEL ? own : own.filter((f) => runs(f.rule));
  // a finding in the gate phase fails whatever the baseline holds, and is never written to it (0020-ifccm FR-011)
  const found = all.filter((f) => !gated(f));
  const heldAll = existsSync(i.baselineFile) ? parseBaseline(readTextFileSync(i.baselineFile)) : [];
  // a line of a rule the level does not run is neither new nor stale, and is kept where the baseline is written (0028-conformance-levels FR-010)
  const ruleOf = (line: string): string => line.split(" ")[0] ?? "";
  const held = heldAll.filter((l) => runs(ruleOf(l)));
  const apart = heldAll.filter((l) => !runs(ruleOf(l)));
  if (i.writeBaseline === true) {
    const keep = apart.map((key) => ({ file: "", line: 0, rule: ruleOf(key), message: "", key }));
    writeTextFileSync(i.baselineFile, formatBaseline([...found, ...keep], BASELINE_COMMENTS));
    stdio.stdout.writeSync(`wrote ${i.baselineFile}: ${new Set([...found, ...keep].map((f) => f.key)).size} findings\n`);
    return 0;
  }
  const judged = judge(found, held);
  const verdict = { ...judged, fresh: [...judged.fresh, ...all.filter(gated), ...ownRun.filter(always)] };
  if (level !== DEFAULT_LEVEL) stdio.stderr.writeSync(`${i.name ?? "mizan-rules"}: level ${level}\n`);
  stdio.stderr.writeSync(`${report(verdict, i.name ?? "mizan-rules", i.baselineFile).join("\n")}\n`);
  return passes(verdict) ? 0 : 1;
}
