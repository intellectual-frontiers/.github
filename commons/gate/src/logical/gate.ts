// Spec: 0002-policy-gate FR-002, FR-003, FR-004, FR-005, FR-007
/**
 * Evaluating a change against rules (0002-policy-gate FR-002 to FR-005, FR-007): only the subjects a change adds or alters are checked (one that is removed or untouched is not), each rule applies to the kinds it names, a violation that has a live waiver for its rule and subject does not
 * block and is listed as waived, a waiver that has expired does not count, and the verdict passes only where nothing blocks. A rule that throws is a violation of its own, never a silent pass. Everything is a pure function of the change, the rules, the waivers and the instant.
 *
 * @example
 * ```ts
 * import { evaluate } from "./gate.ts";
 * evaluate({ before: [], after: [] }, [], [], "2026-11-21T00:00:00Z").pass; // true
 * ```
 *
 * @module
 */
import type { Change, Problem, Rule, Subject, Verdict, Violation, Waiver } from "@intellectual-frontiers/gate/governance";

const same = (a: Subject, b: Subject): boolean => a.kind === b.kind && JSON.stringify(a.attributes, Object.keys(a.attributes).sort()) === JSON.stringify(b.attributes, Object.keys(b.attributes).sort());

/** The subjects a change adds or alters: those in `after` that `before` does not have, or has with other attributes. */
export function touched(change: Change): readonly Subject[] {
  const was = new Map(change.before.map((s) => [s.id, s]));
  return change.after.filter((s) => {
    const old = was.get(s.id);
    return old === undefined || !same(old, s);
  });
}

/** The rules a waiver list problems are refused for: a waiver needs a reason, a person, and an end after which it does not count. */
export function waiverProblems(w: readonly Waiver[]): readonly string[] {
  const out: string[] = [];
  for (const x of w) {
    if (x.reason.trim() === "") out.push(`waiver of ${x.rule} for ${x.subject} gives no reason`);
    if (x.by.trim() === "") out.push(`waiver of ${x.rule} for ${x.subject} names no one who granted it`);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.until)) out.push(`waiver of ${x.rule} for ${x.subject} has no end instant`);
  }
  return out;
}

function violationsOf(subject: Subject, rule: Rule): readonly Violation[] {
  let problems: readonly Problem[];
  try {
    problems = rule.check(subject);
  } catch (e) {
    problems = [{ message: `the rule could not be evaluated: ${e instanceof Error ? e.message : String(e)}` }];
  }
  return problems.map((p) => ({ rule: rule.id, title: rule.title, severity: rule.severity, subject: subject.id, message: p.attribute === undefined ? p.message : `${p.attribute}: ${p.message}`, controls: rule.controls ?? [] }));
}

/** The verdict of a change against rules and waivers at an instant. */
export function evaluate(change: Change, rules: readonly Rule[], waivers: readonly Waiver[], now: string): Verdict {
  const subjects = touched(change);
  const used = new Set<Waiver>();
  const blocking: Violation[] = [];
  const warnings: Violation[] = [];
  const waived: Violation[] = [];
  for (const subject of subjects) {
    for (const rule of rules) {
      if (rule.kinds !== undefined && !rule.kinds.includes(subject.kind)) continue;
      for (const v of violationsOf(subject, rule)) {
        const w = waivers.find((x) => x.rule === v.rule && x.subject === v.subject && x.until > now && waiverProblems([x]).length === 0);
        if (w !== undefined) {
          used.add(w);
          waived.push({ ...v, waived: w });
        } else (v.severity === "block" ? blocking : warnings).push(v);
      }
    }
  }
  const order = (a: Violation, b: Violation): number => (a.subject + a.rule + a.message < b.subject + b.rule + b.message ? -1 : 1);
  return { pass: blocking.length === 0, blocking: blocking.sort(order), warnings: warnings.sort(order), waived: waived.sort(order), unusedWaivers: waivers.filter((w) => !used.has(w)), checked: subjects.length };
}
