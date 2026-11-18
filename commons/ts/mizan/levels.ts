/**
 * The conformance levels as the check reads them (commons 0028-conformance-levels): L0 registered, L1 core, L2 standards and L3 governed, which Mizan's ontology states as typed data
 * (`mz:ConformanceLevel`, `mz:ConformanceRequirement`), and the rule of which of Mizan's rules a level runs.
 *
 * @remarks
 * Pure functions over the ontology's individuals. A level entails the requirements it adds and those of every level of a lower rank. A rule is run at a level when a requirement the level
 * entails names it with `mz:rule` (an id, or a family such as `changes/*`); a rule that no requirement of any level names runs at L1 and above, and at L0 no rule runs. The default level of
 * a harness is L3, which runs every rule, so that a harness that declares none sees what it saw before levels existed (FR-008).
 *
 * @limits
 * It does not read a harness's declaration or a library's manifest (`libraries.ts`), and it does not run a rule: `holdHarness` asks it which rules to run.
 *
 * @example
 * ```ts
 * import { levelOf, ruleRunsAt } from "./levels.ts";
 * ruleRunsAt("mizan/requirement-ears", "L1"); // true
 * ruleRunsAt("mizan/decision-missing", "L1"); // false: the audit of terms is L2
 * levelOf("L9"); // undefined
 * ```
 *
 * @module
 */
import { conformanceLevels, conformanceRequirements } from "../../ontology/mizan/mod.ts";

/** The notation of a level: `L` and its rank. */
export type LevelKey = "L0" | "L1" | "L2" | "L3";

/** The four levels, lowest first. */
export const LEVELS: readonly LevelKey[] = ["L0", "L1", "L2", "L3"];

/** The level a harness is at where it declares none (0028-conformance-levels FR-008). */
export const DEFAULT_LEVEL: LevelKey = "L3";

/** The level a library is at where its manifest declares none (0027-commons-libraries FR-012). */
export const DEFAULT_LIBRARY_LEVEL: LevelKey = "L1";

/** Text as a level, or `undefined` where it is not one of the four (`L0` to `L3`). */
export function levelOf(text: string): LevelKey | undefined {
  return LEVELS.find((l) => l === text);
}

/** The rank of a level: 0 to 3. */
export function rankOf(level: LevelKey): number {
  return LEVELS.indexOf(level);
}

/** A requirement of a level and the level that adds it. */
export type Entailed = {
  readonly key: string;
  readonly addedBy: LevelKey;
  readonly rules: readonly string[];
  readonly enforcedBy: readonly string[];
};

/** The requirement individuals by IRI, for reading what a level's `entails` points at. */
const REQUIREMENTS = new Map(
  Object.entries(conformanceRequirements).map(
    ([key, r]) => [r.iri, { key, rules: r.values.rule ?? [], enforcedBy: r.values.enforcedBy ?? [] }] as const,
  ),
);

/** The levels' individuals by notation: the key of each is its name, its rank is `mz:levelRank`. */
function individualOf(level: LevelKey): (typeof conformanceLevels)[keyof typeof conformanceLevels] | undefined {
  return Object.values(conformanceLevels).find((l) => l.values.levelRank === rankOf(level));
}

/** The requirements a level entails: those it adds and those of every level below it, lowest level first. */
export function entailedBy(level: LevelKey): readonly Entailed[] {
  return LEVELS.slice(0, rankOf(level) + 1).flatMap((l) =>
    (individualOf(l)?.values.entails ?? []).flatMap((e) => {
      const r = REQUIREMENTS.get(e.iri);
      return r === undefined ? [] : [{ key: r.key, addedBy: l, rules: r.rules, enforcedBy: r.enforcedBy }];
    }),
  );
}

/** Whether a rule id is named by a pattern: the id itself, or a family `prefix/*`. */
export function ruleMatches(pattern: string, rule: string): boolean {
  return pattern.endsWith("/*") ? rule.startsWith(pattern.slice(0, -1)) : pattern === rule;
}

/** The lowest level whose requirements name the rule, or `undefined` where no requirement of any level does. */
export function levelOfRule(rule: string): LevelKey | undefined {
  return LEVELS.find((l) => entailedBy(l).some((e) => e.addedBy === l && e.rules.some((p) => ruleMatches(p, rule))));
}

/** Whether the check runs a rule at a level (0028-conformance-levels FR-009): the rule is named by a requirement of that level or a lower one; a rule no requirement names runs at L1 and above, and at L0 none runs. */
export function ruleRunsAt(rule: string, level: LevelKey): boolean {
  if (level === "L0") return false;
  const own = levelOfRule(rule);
  return own === undefined ? true : rankOf(own) <= rankOf(level);
}
