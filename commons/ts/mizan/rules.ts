/**
 * The rules Mizan adds to the format of a specification (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009, FR-016), as plugins: each reads the specifications of a
 * folder and gives its findings as data, held against a baseline that only shrinks (`kernel/trace.ts`). A harness adds its own rules by passing more plugins.
 *
 * @remarks
 * Pure functions over text. A requirement is a bullet `- **FR-nnn**: ...` (and the indented lines under it); its wording is read for RFC 2119 keywords (MUST, MUST NOT,
 * SHOULD, SHOULD NOT, MAY) and the EARS patterns: event-driven (`WHEN <event>, ...`), state-driven (`WHILE <state>, ...`), unwanted behaviour (`IF <condition>, THEN ...`),
 * optional feature (`WHERE <feature>, ...`), a combination of them, and ubiquitous (none of these leads the sentence). An acceptance scenario is a line with Given, When and
 * Then in that order that cites a requirement. A `plan.md` has a `## Standards considered` section. A requirement that names a citation of the Code of Federal Regulations or the
 * United States Code carries `Authority:` and the identifiers of the `mz:Authority` individuals that cover it (0018-standards-first FR-015, FR-016).
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
import { authorities, MZID } from "../../ontology/mizan/mod.ts";
import type { ChangesRule } from "./changes/rules.ts";
import type { Phase } from "./changes/declaration.ts";
import type { VersionsRule } from "./versions/rules.ts";

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
  | "mizan/spec-term-unknown"
  | "mizan/spec-term-deprecated"
  | "mizan/deprecated-no-replacement"
  | "mizan/authority-citation"
  | "mizan/standard-newer"
  | ChangesRule
  | VersionsRule;

/**
 * A finding of one of Mizan's rules: the same shape as the trace's, with a rule that is Mizan's. A finding of the `changes` check (commons 0020-ifccm) also carries its phase: a `gate`
 * finding fails whatever the baseline holds, a `warn` finding is held by it.
 */
export type MizanFinding = Keyed & { readonly rule: MizanRule; readonly severity?: Phase };

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
export function sentenceOf(lines: readonly string[], index: number): string {
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
    const lines = s.spec.split("\n");
    for (const [i, line] of lines.entries()) {
      if (!/\*\*Given\*\*/.test(line)) continue;
      // a scenario is a list item and the lines under it, up to a blank line, the next item or a heading
      let item = line;
      for (let k = i + 1; k < lines.length; k++) {
        const next = lines[k] ?? "";
        if (next.trim() === "" || /^\s*(?:\d+\.|-|\*|#)\s/.test(next)) break;
        item += ` ${next.trim()}`;
      }
      const rest = item.slice(item.search(/\*\*Given\*\*/));
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

/** An authority a requirement may name: the CURIE of its `mz:Authority` individual (`mzid:authority-21-cfr-820`) and the citation of the law (`21 CFR Part 820`). */
export type AuthorityRecord = { readonly id: string; readonly citation: string };

/** The authorities of commons' own ontology, as the rule reads them. */
export const commonsAuthorities: readonly AuthorityRecord[] = authorities.map((a) => ({
  id: `mzid:${a.iri.slice(MZID.iri.length)}`,
  citation: a.values.citation,
}));

const CFR = /\b(\d{1,2})\s+C\.?F\.?R\.?\s+(?:Parts?\s+|§§?\s*)?(\d+(?:\.\d+)?)/g;
const USC = /\b(\d{1,2})\s+U\.?\s?S\.?\s?C\.?\s+(?:§§?\s*)?(\d+[a-z]{0,3}(?:-\d+[a-z]{0,3})?)/g;
const MARKER = /\bAuthority:\s*([A-Za-z][A-Za-z0-9]*:[A-Za-z0-9_-]+(?:\s*,\s*[A-Za-z][A-Za-z0-9]*:[A-Za-z0-9_-]+)*)/g;

/** A citation of law as the rule compares it: `21 CFR 820.30` for a section, `42 USC 1320d` for the United States Code, however the text spaced or punctuated it. */
export type LawCitation = { readonly written: string; readonly normal: string };

/** The citations of the Code of Federal Regulations and the United States Code that a text names, in the order it names them (0018-standards-first FR-015). */
export function lawCitationsIn(text: string): readonly LawCitation[] {
  const out: (LawCitation & { readonly at: number })[] = [];
  for (const m of text.matchAll(CFR)) out.push({ at: m.index ?? 0, written: m[0], normal: `${m[1] ?? ""} CFR ${m[2] ?? ""}` });
  for (const m of text.matchAll(USC)) out.push({ at: m.index ?? 0, written: m[0], normal: `${m[1] ?? ""} USC ${m[2] ?? ""}` });
  return out.sort((a, b) => a.at - b.at).map(({ written, normal }) => ({ written, normal }));
}

/** Whether an authority's citation covers a citation a requirement names: the named one starts with it and the next character does not continue its number (0018-standards-first FR-015). */
export function covers(authority: string, named: LawCitation): boolean {
  const own = lawCitationsIn(authority)[0]?.normal;
  if (own === undefined || !named.normal.startsWith(own)) return false;
  return !/^[A-Za-z0-9]/.test(named.normal.slice(own.length));
}

/**
 * The rule that a requirement that comes from law cites its authority (0018-standards-first FR-015, FR-016), for the authorities given: a requirement that names a citation of
 * law and has no `Authority:` followed by identifiers is found, so is one that names an identifier of none of the authorities, and so is a citation of law that no authority it names covers.
 */
export function authorityCitation(known: readonly AuthorityRecord[]): RulePlugin {
  const byId = new Map(known.map((a) => [a.id, a]));
  return {
    id: "mizan/authority-citation",
    check(s) {
      const file = `specs/${s.slug}/spec.md`;
      const lines = s.spec.split("\n");
      return parseSpec(s.slug, s.spec).requirements.flatMap((r) => {
        const sentence = sentenceOf(lines, r.line - 1);
        const cited = lawCitationsIn(sentence);
        const named = [...sentence.matchAll(MARKER)].flatMap((m) => (m[1] ?? "").split(/\s*,\s*/));
        const out: MizanFinding[] = [];
        if (cited.length > 0 && named.length === 0)
          out.push(
            finding(
              "mizan/authority-citation",
              file,
              r.line,
              `${r.id} names ${cited[0]?.written ?? "a law"} and carries no Authority: followed by the identifier of an mz:Authority`,
              r.id,
            ),
          );
        for (const id of new Set(named))
          if (!byId.has(id))
            out.push(
              finding(
                "mizan/authority-citation",
                file,
                r.line,
                `${r.id} names the authority ${id}, which is no mz:Authority individual`,
                `${r.id} ${id}`,
              ),
            );
        const have = named.flatMap((id) => byId.get(id) ?? []);
        if (have.length > 0)
          for (const c of cited)
            if (!have.some((a) => covers(a.citation, c)))
              out.push(
                finding(
                  "mizan/authority-citation",
                  file,
                  r.line,
                  `${r.id} names ${c.written}, which none of the authorities it names (${named.join(", ")}) covers`,
                  `${r.id} ${c.normal}`,
                ),
              );
        return out;
      });
    },
  };
}

/** Mizan's own rules, as plugins, in the order they run: a harness with authorities of its own passes `authorityCitation` with them in place of the last. */
export const rulePlugins: readonly RulePlugin[] = [
  requirementKeyword,
  requirementEars,
  scenarioForm,
  standardsConsidered,
  authorityCitation(commonsAuthorities),
];

/** The findings of every plugin over every specification, in the order of the specifications and of the plugins. */
export function mizanFindings(specs: readonly SpecText[], plugins: readonly RulePlugin[] = rulePlugins): readonly MizanFinding[] {
  return specs.flatMap((s) => plugins.flatMap((p) => p.check(s)));
}
