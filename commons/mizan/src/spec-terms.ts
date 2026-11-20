/**
 * The rule that a specification names only terms the ontology defines (commons 0018-standards-first FR-001, 0003-mizan FR-019): every prefixed name in code font whose prefix is one
 * of the ontologies given (`mz:Rung`, `pm:PackageManager`) must be a term of that ontology, a class, a property or an individual of a code list. A prefix that is not given (`schema:`,
 * `skos:`, a standard's own) is not read: the standard defines it, and an import that holds it makes its use compile.
 *
 * A second rule goes the other way (0003-mizan FR-044): a requirement that names a term of the ontology in code font must be cited back by that term's `mz:definedBy`, so that the requirement
 * and the term are two ends of one link (the requirement-to-term stage of the trace chain, 0020-ifccm FR-014).
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
import { parseCitation, parseSpec } from "./trace.ts";
import { type MizanFinding, sentenceOf, type SpecText } from "./rules.ts";
import type { TermRecord } from "./standards.ts";

/** The local names an ontology defines, by its prefix. */
export type KnownTerms = Readonly<Record<string, ReadonlySet<string>>>;

/** The findings: a prefixed name of a given ontology that the ontology does not define, once for each name in each specification. */
export function specTermFindings(
  specs: readonly SpecText[],
  known: KnownTerms,
  deprecated: ReadonlyMap<string, string> = new Map(),
): readonly MizanFinding[] {
  const out: MizanFinding[] = [];
  for (const s of specs) {
    const file = `specs/${s.slug}/spec.md`;
    const seen = new Set<string>();
    for (const [i, line] of s.spec.split("\n").entries()) {
      for (const m of line.matchAll(/`([a-z][a-z0-9]*):([A-Za-z][A-Za-z0-9_]*)`/g)) {
        const [name, prefix, local] = [m[0].slice(1, -1), m[1] ?? "", m[2] ?? ""];
        const defined = known[prefix];
        const replacement = deprecated.get(name);
        if (replacement !== undefined && !seen.has(name)) {
          seen.add(name);
          out.push({
            file,
            line: i + 1,
            rule: "mizan/spec-term-deprecated",
            message: `${name} is deprecated: it is named here, and ${replacement} replaces it`,
            key: `mizan/spec-term-deprecated ${file} ${name}`,
          });
          continue;
        }
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

/** What the ontologies say of the specifications that define each term: the values of `mz:definedBy` by the term's CURIE (`mz:Rung`). */
export type TermDefinitions = ReadonlyMap<string, readonly string[]>;

/**
 * The definitions of the terms of audit records, by CURIE: the IRI of each record is written with the first of `prefixes` (a prefix and its namespace) that begins it, and carries what its
 * `definedBy` says. A term of no given namespace is left out.
 */
export function definitionsOf(records: readonly TermRecord[], prefixes: Readonly<Record<string, string>>): TermDefinitions {
  const out = new Map<string, readonly string[]>();
  for (const r of records)
    for (const [prefix, ns] of Object.entries(prefixes))
      if (r.iri.startsWith(ns)) {
        out.set(`${prefix}:${r.iri.slice(ns.length)}`, r.definedBy ?? []);
        break;
      }
  return out;
}

/** Whether a citation (`0020-ifccm FR-001`, `0020-ifccm FR-001 to FR-003`) names the requirement `fr` of the specification `slug`; a citation of a whole specification does not. */
function citesRequirement(citation: string, slug: string, fr: string): boolean {
  const n = (id: string): number => Number(/(\d+)/.exec(id)?.[1] ?? Number.NaN);
  return parseCitation(citation, 1).some(
    (c) => c.spec === slug && c.requirements.some((r) => (r.kind === "one" ? r.id === fr : n(r.from) <= n(fr) && n(fr) <= n(r.to))),
  );
}

/**
 * The requirement-to-term stage of the trace (0003-mizan FR-044): for each requirement that names a term of a given ontology in code font (`mz:Rung`), the term must say, in `mz:definedBy`,
 * that the requirement defines it. One finding for each requirement and term: where the term states no `definedBy`, and where it states others and not this requirement. A requirement
 * that names a term the ontology does not define is `mizan/spec-term-unknown`'s, and a prefix not given is not read. The findings are warnings a baseline holds.
 */
export function termDefinedByFindings(
  specs: readonly SpecText[],
  known: KnownTerms,
  definitions: TermDefinitions,
): readonly MizanFinding[] {
  const out: MizanFinding[] = [];
  for (const s of specs) {
    const file = `specs/${s.slug}/spec.md`;
    const lines = s.spec.split("\n");
    for (const r of parseSpec(s.slug, s.spec).requirements) {
      const seen = new Set<string>();
      for (const m of sentenceOf(lines, r.line - 1).matchAll(/`([a-z][a-z0-9]*):([A-Za-z][A-Za-z0-9_]*)`/g)) {
        const [name, prefix, local] = [m[0].slice(1, -1), m[1] ?? "", m[2] ?? ""];
        if (seen.has(name) || known[prefix]?.has(local) !== true) continue;
        seen.add(name);
        const cites = definitions.get(name);
        if (cites?.some((c) => citesRequirement(c, s.slug, r.id)) === true) continue;
        out.push({
          file,
          line: r.line,
          rule: "mizan/term-not-defined-by",
          message:
            cites === undefined || cites.length === 0
              ? `${r.id} names ${name}, which states no mz:definedBy: the term should say ${s.slug} ${r.id} defines it`
              : `${r.id} names ${name}, whose mz:definedBy (${cites.join("; ")}) does not name ${s.slug} ${r.id}`,
          key: `mizan/term-not-defined-by ${file} ${r.id} ${name}`,
        });
      }
    }
  }
  return out;
}
