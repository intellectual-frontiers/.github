// Spec: 0002-crosswalks FR-001, FR-003, FR-004
/**
 * The conversion of the proposals of this package into the crosswalks it holds (0002-crosswalks FR-001, FR-003, FR-004): pure functions of the proposals. Every mapping is `intersects-with` at the lowest strength and carries the words `person-decision-required` and its reason, because no
 * published mapping was read. The crosswalk of ISO/IEC 27001 to SOC 2 is not written by hand: it is derived through the controls of SP 800-53 that the two sides share, which is weaker than a proposal and says so.
 *
 * @example
 * ```ts
 * import { urnOf } from "./convert.ts";
 * urnOf("soc2-tsc", "2017", "CC6.1"); // "urn:grc:soc2-tsc:2017:CC6.1"
 * ```
 *
 * @module
 */
import type { Proposal, Side } from "@intellectual-frontiers/catalog-crosswalks/governance";

/** A mapping of a crosswalk. */
export type OutMapping = { readonly from: string; readonly to: string; readonly relationship: "intersects-with"; readonly strength: 1; readonly note: string };

/** The URN of a control of a framework of this repository's catalogs. */
export const urnOf = (framework: string, version: string, control: string): string => `urn:grc:${framework}:${version}:${control}`;

const byPair = (a: OutMapping, b: OutMapping): number => {
  const x = `${a.from}\u0000${a.to}`;
  const y = `${b.from}\u0000${b.to}`;
  return x < y ? -1 : x > y ? 1 : 0;
};

/** The mappings of the proposals from one framework to another, with the words that mark a row as undecided. Sorted by source then target, so that the same proposals give the same bytes; a proposal that names the same pair twice is returned in `repeated`. */
export function mappingsOf(proposals: readonly Proposal[], from: Side, to: Side, pending: string): { readonly mappings: readonly OutMapping[]; readonly repeated: readonly string[] } {
  const mappings: OutMapping[] = [];
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const p of proposals) {
    const note = `${pending}: ${p.basis}; the published mapping has not been read, so a person decides whether this pair holds and how strongly`;
    for (const t of p.to) {
      const row: OutMapping = { from: urnOf(from.framework, from.version, p.from), to: urnOf(to.framework, to.version, t), relationship: "intersects-with", strength: 1, note };
      const key = `${row.from}\u0000${row.to}`;
      if (seen.has(key)) repeated.push(key.replace("\u0000", " -> "));
      seen.add(key);
      mappings.push(row);
    }
  }
  mappings.sort(byPair);
  return { mappings, repeated };
}

/** The mappings from the first framework to the third through the controls of the second that the first two crosswalks name: for each control of the first, the controls of the third that share the most controls of the second with it (all that tie), and the shared controls in the note. */
export function composeThrough(ab: readonly OutMapping[], cb: readonly OutMapping[], pending: string): readonly OutMapping[] {
  const viaA = new Map<string, Set<string>>();
  for (const m of ab) viaA.set(m.from, (viaA.get(m.from) ?? new Set<string>()).add(m.to));
  const viaC = new Map<string, Set<string>>();
  for (const m of cb) viaC.set(m.from, (viaC.get(m.from) ?? new Set<string>()).add(m.to));
  const out: OutMapping[] = [];
  for (const [a, via] of viaA) {
    const shares: { readonly c: string; readonly shared: readonly string[] }[] = [];
    for (const [c, cvia] of viaC) {
      const shared = [...via].filter((x) => cvia.has(x)).sort();
      if (shared.length > 0) shares.push({ c, shared });
    }
    const best = Math.max(0, ...shares.map((s) => s.shared.length));
    for (const s of shares.filter((x) => x.shared.length === best && best > 0)) {
      const names = s.shared.map((u) => u.slice(u.lastIndexOf(":") + 1)).join(", ");
      out.push({ from: a, to: s.c, relationship: "intersects-with", strength: 1, note: `${pending}: derived through the controls of NIST SP 800-53 that both sides are proposed to meet (${names}), which is weaker than a proposal; neither side was read against the other, so a person decides whether this pair holds and how strongly` });
    }
  }
  return out.sort(byPair);
}
