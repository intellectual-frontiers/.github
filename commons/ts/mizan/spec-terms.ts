/**
 * The rule that a specification names only terms the ontology defines (commons 0018-standards-first FR-001, 0003-mizan FR-019): every prefixed name in code font whose prefix is one
 * of the ontologies given (`mz:Rung`, `pm:PackageManager`) must be a term of that ontology, a class, a property or an individual of a code list. A prefix that is not given (`schema:`,
 * `skos:`, a standard's own) is not read: the standard defines it, and an import that holds it makes its use compile.
 *
 * @remarks
 * Pure over text. Prefixed names are read only inside backticks, so that a sentence's colon, a URL or a `**Status:**` is not one.
 *
 * @example
 * ```ts
 * import { specTermFindings } from "./spec-terms.ts";
 * specTermFindings([{ slug: "0001-x", spec: "Uses `mz:Rung` and `mz:Nothing`." }], { mz: new Set(["Rung"]) }).map((f) => f.key);
 * // ["mizan/spec-term-unknown specs/0001-x/spec.md mz:Nothing"]
 * ```
 *
 * @module
 */
import type { MizanFinding, SpecText } from "./rules.ts";

/** The local names an ontology defines, by its prefix. */
export type KnownTerms = Readonly<Record<string, ReadonlySet<string>>>;

/** The findings: a prefixed name of a given ontology that the ontology does not define, once for each name in each specification. */
export function specTermFindings(specs: readonly SpecText[], known: KnownTerms): readonly MizanFinding[] {
  const out: MizanFinding[] = [];
  for (const s of specs) {
    const file = `specs/${s.slug}/spec.md`;
    const seen = new Set<string>();
    for (const [i, line] of s.spec.split("\n").entries()) {
      for (const m of line.matchAll(/`([a-z][a-z0-9]*):([A-Za-z][A-Za-z0-9_]*)`/g)) {
        const [name, prefix, local] = [m[0].slice(1, -1), m[1] ?? "", m[2] ?? ""];
        const defined = known[prefix];
        if (defined === undefined || defined.has(local) || seen.has(name)) continue;
        seen.add(name);
        out.push({
          file,
          line: i + 1,
          rule: "mizan/spec-term-unknown",
          message: `${name} is named here and the ontology of ${prefix}: does not define it`,
          key: `mizan/spec-term-unknown ${file} ${name}`,
        });
      }
    }
  }
  return out;
}
