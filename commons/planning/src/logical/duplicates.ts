// Spec: 0003-planning-reconcile FR-007
/**
 * Likely duplicates (0037-planning FR-019): a similarity of the titles, bodies and places of two counted items (the overlap of their lower-cased words, with a share for the same place), and for each pair at or
 * above the threshold a proposed link of kind same as, with its score. The same items and threshold give the same proposals in the same order, and nothing is merged, closed or hidden.
 *
 * @example
 * ```ts
 * import { similarity } from "./duplicates.ts";
 * similarity("fix the login page", "fix login page now"); // 0.6
 * ```
 *
 * @module
 */
import { isCounted, type Item, type ItemId, type Link } from "@intellectual-frontiers/planning/governance";

/** A link of kind same as that a person confirms, with how alike the two are. */
export type ProposedLink = { readonly link: Link; readonly state: "proposed"; readonly score: number };

const words = (text: string): ReadonlySet<string> => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0));

/** The overlap of the words of two texts: the shared words over the words of either, from 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 && y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

/** The score of two items: the title counts most, the body and the places they were seen in count too. */
export function scoreOf(a: Item, b: Item, placesOf: (id: ItemId) => readonly string[] = () => []): number {
  const title = similarity(a.title, b.title);
  const body = a.body === "" && b.body === "" ? title : similarity(a.body, b.body);
  const pa = placesOf(a.id);
  const pb = placesOf(b.id);
  const place = pa.some((p) => pb.includes(p)) ? 1 : 0;
  return Math.round((0.7 * title + 0.2 * body + 0.1 * place) * 1000) / 1000;
}

/** The proposed links of kind same as between the counted items that are alike at or above the threshold, best first and then by id, for items not already linked as the same. */
export function findDuplicates(items: readonly Item[], threshold: number, placesOf?: (id: ItemId) => readonly string[]): readonly ProposedLink[] {
  const counted = items.filter(isCounted).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: ProposedLink[] = [];
  for (const [i, a] of counted.entries()) {
    for (const b of counted.slice(i + 1)) {
      if (a.links.some((l) => l.kind === "same-as" && l.to === b.id) || b.links.some((l) => l.kind === "same-as" && l.to === a.id)) continue;
      const score = scoreOf(a, b, placesOf);
      if (score >= threshold) out.push({ link: { kind: "same-as", from: a.id, to: b.id }, state: "proposed", score });
    }
  }
  return out.sort((x, y) => y.score - x.score || (x.link.from < y.link.from ? -1 : x.link.from > y.link.from ? 1 : x.link.to < y.link.to ? -1 : 1));
}
