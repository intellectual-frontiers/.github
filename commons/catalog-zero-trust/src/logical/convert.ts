// Spec: 0002-zero-trust-package FR-001, FR-004, FR-005
/**
 * The conversion of the entries of this package into the documents it holds (0002-zero-trust-package FR-001, FR-004, FR-005): pure functions of the entries. Each entry becomes a control with the identifier it is known by, its title, its statement and its group as family; an identifier that
 * a framework repeats is an error of the source, and the conversion says so rather than choose. The crosswalk is made from the proposals: every mapping is `intersects-with` at the lowest strength and carries the words `person-decision-required` and its reason, because no source of the mappings has been read.
 *
 * @example
 * ```ts
 * import { convert } from "./convert.ts";
 * convert([{ id: "T1", title: "t", statement: "s", family: "tenet" }]).controls.length; // 1
 * ```
 *
 * @module
 */
import type { Entry, Proposal } from "@intellectual-frontiers/catalog-zero-trust/governance";

/** A control of a framework document. */
export type OutControl = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

/** The controls, or the identifiers that the source repeats. */
export type Converted = { readonly controls: readonly OutControl[]; readonly repeated: readonly string[] };

/** The controls of the entries, in the order given. */
export function convert(entries: readonly Entry[]): Converted {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) repeated.push(e.id);
    seen.add(e.id);
  }
  return { controls: entries.map((e) => ({ id: e.id, title: e.title, statement: e.statement, family: e.family })), repeated };
}

/** A mapping of a crosswalk. */
export type OutMapping = { readonly from: string; readonly to: string; readonly relationship: "intersects-with"; readonly strength: 1; readonly note: string };

/** The URN of a control of a framework of this repository's catalogs. */
export const urnOf = (framework: string, version: string, control: string): string => `urn:grc:${framework}:${version}:${control}`;

/** The mappings of the proposals, given the version of each framework a proposal starts from, the words that mark a row as undecided, and the two targets. Sorted by source then target, so that the same proposals give the same bytes. */
export function mappingsOf(
  proposals: readonly Proposal[],
  starts: Readonly<Record<string, string>>,
  pending: string,
  targets: { readonly sp80053: { readonly framework: string; readonly version: string }; readonly sp800171: { readonly framework: string; readonly version: string } },
): { readonly mappings: readonly OutMapping[]; readonly unknown: readonly string[] } {
  const mappings: OutMapping[] = [];
  const unknown: string[] = [];
  for (const p of proposals) {
    const cut = p.from.indexOf(":");
    const framework = p.from.slice(0, cut);
    const control = p.from.slice(cut + 1);
    const version = starts[framework];
    if (version === undefined) {
      unknown.push(p.from);
      continue;
    }
    const from = urnOf(framework, version, control);
    const note = `${pending}: ${p.basis}; the published mapping of the example architecture to the controls has not been read, so a person decides whether this pair holds and how strongly`;
    for (const c of p.sp80053) mappings.push({ from, to: urnOf(targets.sp80053.framework, targets.sp80053.version, c), relationship: "intersects-with", strength: 1, note });
    for (const c of p.sp800171) mappings.push({ from, to: urnOf(targets.sp800171.framework, targets.sp800171.version, c), relationship: "intersects-with", strength: 1, note });
  }
  mappings.sort((a, b) => (a.from + "\u0000" + a.to < b.from + "\u0000" + b.to ? -1 : a.from + "\u0000" + a.to > b.from + "\u0000" + b.to ? 1 : 0));
  return { mappings, unknown };
}
