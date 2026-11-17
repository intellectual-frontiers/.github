/**
 * The rules Mizan adds to the format of a specification (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009), as plugins: each reads the specifications of a
 * folder and gives its findings as data, held against a baseline that only shrinks (`kernel/trace.ts`). A harness adds its own rules by passing more plugins.
 *
 * @remarks
 * Pure functions over text. A requirement is a bullet `- **FR-nnn**: ...` (and the indented lines under it); its wording is read for RFC 2119 keywords (MUST, MUST NOT,
 * SHOULD, SHOULD NOT, MAY) and the EARS patterns: event-driven (`WHEN <event>, ...`), state-driven (`WHILE <state>, ...`), unwanted behaviour (`IF <condition>, THEN ...`),
 * optional feature (`WHERE <feature>, ...`), a combination of them, and ubiquitous (none of these leads the sentence). An acceptance scenario is a line with Given, When and
 * Then in that order that cites a requirement. A `plan.md` has a `## Standards considered` section.
 *
 * @limits
 * It reads words, not meaning: a requirement can be in a pattern and still be vague, which only a person reviews (0017-two-languages FR-007).
 *
 * @example
 * ```ts
 * import { earsPatternOf, mizanFindings } from "./rules.ts";
 * earsPatternOf("WHEN a file has no citation, the check MUST report it."); // "event"
 * mizanFindings([{ slug: "0001-x", spec: "- **FR-001**: It works.\n" }]).map((f) => f.rule); // ["mizan/requirement-keyword"]
 * ```
 *
 * @module
 */
import { type Keyed, parseSpec } from "../kernel/trace.ts";

/** The ids of the rules Mizan adds (0003-mizan FR-013 to FR-015, 0018-standards-first FR-009). */
export type MizanRule =
  | "mizan/requirement-keyword"
  | "mizan/requirement-ears"
  | "mizan/scenario-form"
  | "mizan/standards-considered"
  | "mizan/term-standard"
  | "mizan/unaligned-justification"
  | "mizan/decision-missing"
  | "mizan/decision-overdue"
  | "mizan/term-basis-missing"
  | "mizan/spec-term-unknown";

/** A finding of one of Mizan's rules: the same shape as the trace's, with a rule that is Mizan's. */
export type MizanFinding = Keyed & { readonly rule: MizanRule };

/** One specification of a folder as the rules read it: its slug, the text of `spec.md` and, where it has one, of `plan.md`. */
export type SpecText = { readonly slug: string; readonly spec: string; readonly plan?: string };

/** A rule as a plugin: its id and what it finds in one specification. */
export type RulePlugin = { readonly id: MizanRule; readonly check: (s: SpecText) => readonly MizanFinding[] };

/** The patterns of EARS (Easy Approach to Requirements Syntax). */
export type EarsPattern = "ubiquitous" | "event" | "state" | "unwanted" | "optional" | "complex";

/** The RFC 2119 keywords Mizan reads. */
const KEYWORD = /\b(?:MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\b/;
const TRIGGER = /^(WHEN|WHILE|WHERE|IF)\b/;

function finding(rule: MizanRule, file: string, line: number, message: string, about: string): MizanFinding {
  return { file, line, rule, message, key: `${rule} ${file} ${about}` };
}

/** The sentence of a requirement: what follows `**FR-nnn**:`, with the indented lines under it joined. */
function sentenceOf(lines: readonly string[], index: number): string {
  const first = (lines[index] ?? "").replace(/^\s*-\s*\*\*FR-[0-9]+[a-z]?\*\*:?\s*/, "");
  const out = [first.trim()];
  for (let i = index + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (!/^\s+\S/.test(l) || /^\s*-\s/.test(l)) break;
    out.push(l.trim());
  }
  return out.join(" ");
}

/** The EARS pattern of a requirement's sentence, or `undefined` where a trigger leads it in a form EARS does not have (an `IF` with no `THEN`, a trigger with no comma). */
export function earsPatternOf(sentence: string): EarsPattern | undefined {
  const s = sentence.replace(/^[`*_\s]+/, "");
  const lead = TRIGGER.exec(s);
  if (lead === null) return "ubiquitous";
  const clauses = [...s.matchAll(/(?:^|,\s*)(WHEN|WHILE|WHERE|IF)\b/g)].map((m) => m[1] ?? "");
  if (clauses.length > 1 && new Set(clauses).size > 1) return "complex";
  if (!s.includes(",")) return undefined;
  const word = lead[1];
  if (word === "WHEN") return "event";
  if (word === "WHILE") return "state";
  if (word === "WHERE") return "optional";
  if (word === "IF") return /\bTHEN\b/.test(s) ? "unwanted" : undefined;
  return undefined;
}

/** Every requirement of a specification must carry an RFC 2119 keyword (0003-mizan FR-013). */
export const requirementKeyword: RulePlugin = {
  id: "mizan/requirement-keyword",
  check(s) {
    const lines = s.spec.split("\n");
    return parseSpec(s.slug, s.spec).requirements.flatMap((r) =>
      KEYWORD.test(sentenceOf(lines, r.line - 1))
        ? []
        : [
            finding(
              "mizan/requirement-keyword",
              `specs/${s.slug}/spec.md`,
              r.line,
              `${r.id} has none of MUST, MUST NOT, SHOULD, SHOULD NOT, MAY`,
              r.id,
            ),
          ],
    );
  },
};

/** A requirement whose sentence a trigger leads must be in the form of its EARS pattern (0003-mizan FR-013). */
export const requirementEars: RulePlugin = {
  id: "mizan/requirement-ears",
  check(s) {
    const lines = s.spec.split("\n");
    return parseSpec(s.slug, s.spec).requirements.flatMap((r) =>
      earsPatternOf(sentenceOf(lines, r.line - 1)) !== undefined
        ? []
        : [
            finding(
              "mizan/requirement-ears",
              `specs/${s.slug}/spec.md`,
              r.line,
              `${r.id} starts with WHEN, WHILE, WHERE or IF but is not in the form of an EARS pattern (a comma after the condition, and THEN after IF)`,
              r.id,
            ),
          ],
    );
  },
};

/** A line that holds Given must hold When and Then after it, and cite a requirement (0003-mizan FR-014). */
export const scenarioForm: RulePlugin = {
  id: "mizan/scenario-form",
  check(s) {
    const file = `specs/${s.slug}/spec.md`;
    const out: MizanFinding[] = [];
    for (const [i, line] of s.spec.split("\n").entries()) {
      const given = line.search(/\bGiven\b/);
      if (given < 0 || !/\*\*Given\*\*/.test(line)) continue;
      const rest = line.slice(given);
      const when = rest.search(/\*\*When\*\*/);
      const then = rest.search(/\*\*Then\*\*/);
      if (when < 0 || then < 0 || then < when)
        out.push(finding("mizan/scenario-form", file, i + 1, "a scenario has Given, When, Then in that order", `line-${i + 1}`));
      else if (!/\bFR-[0-9]+/.test(rest))
        out.push(finding("mizan/scenario-form", file, i + 1, "a scenario cites no requirement (per FR-nnn)", `line-${i + 1}`));
    }
    return out;
  },
};

/** A feature's `plan.md` names the standards considered (0018-standards-first FR-009). */
export const standardsConsidered: RulePlugin = {
  id: "mizan/standards-considered",
  check(s) {
    if (s.plan === undefined || /^#{2,3}\s+Standards considered\b/m.test(s.plan)) return [];
    return [finding("mizan/standards-considered", `specs/${s.slug}/plan.md`, 1, "the plan has no Standards considered section", "plan")];
  },
};

/** Mizan's own rules, as plugins, in the order they run. */
export const rulePlugins: readonly RulePlugin[] = [requirementKeyword, requirementEars, scenarioForm, standardsConsidered];

/** The findings of every plugin over every specification, in the order of the specifications and of the plugins. */
export function mizanFindings(specs: readonly SpecText[], plugins: readonly RulePlugin[] = rulePlugins): readonly MizanFinding[] {
  return specs.flatMap((s) => plugins.flatMap((p) => p.check(s)));
}
