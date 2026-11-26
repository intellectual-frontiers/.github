// Spec: 0002-dossier-core FR-009
/**
 * The difference of two dossiers by meaning (0046-dossiers FR-064): the sources added, removed or changed (by id and hash), the plates added, removed or changed (by slug and the hash of their blocks), written as a value and as a plate (the `since` plate), never as a diff of text.
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import { type Built, type DisclosureClass, type Plate } from "@intellectual-frontiers/dossier/governance";
import { digestOf } from "@intellectual-frontiers/grc/logical";
import { plateOf, text } from "./lens.ts";

/** What changed between two dossiers. */
export interface DossierDiff {
  readonly from: string;
  readonly to: string;
  readonly sources: { readonly added: readonly string[]; readonly removed: readonly string[]; readonly changed: readonly string[] };
  readonly plates: { readonly added: readonly string[]; readonly removed: readonly string[]; readonly changed: readonly string[] };
}

const hashes = async (b: Built): Promise<{ sources: Map<string, string>; plates: Map<string, string> }> => {
  const plates = new Map<string, string>();
  for (const p of b.plates) plates.set(p.slug, await digestOf({ title: p.title, blocks: p.blocks, cites: p.cites }));
  return { sources: new Map(b.sources.map((s) => [s.id, s.hash])), plates };
};

const compare = (a: Map<string, string>, b: Map<string, string>): { added: string[]; removed: string[]; changed: string[] } => ({
  added: [...b.keys()].filter((k) => !a.has(k)).sort(),
  removed: [...a.keys()].filter((k) => !b.has(k)).sort(),
  changed: [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k)).sort(),
});

/** The difference between an earlier dossier and a later one. */
export async function diffDossiers(earlier: Built, later: Built): Promise<Result<DossierDiff, never>> {
  const a = await hashes(earlier);
  const b = await hashes(later);
  return ok({ from: earlier.asOf, to: later.asOf, sources: compare(a.sources, b.sources), plates: compare(a.plates, b.plates) });
}

/** The difference as a plate (the `since` lens): what changed, in the words of the dossier. */
export function sincePlate(d: DossierDiff, ceiling: DisclosureClass = "internal"): Plate {
  const list = (title: string, xs: readonly string[]) => ({ term: title, inlines: [text(xs.length === 0 ? "none" : xs.join(", "))] });
  return plateOf({
    lens: { id: "since", ceiling },
    title: `Since ${d.from}`,
    blocks: [
      { t: "defs", items: [list("Sources added", d.sources.added), list("Sources removed", d.sources.removed), list("Sources changed", d.sources.changed), list("Plates added", d.plates.added), list("Plates removed", d.plates.removed), list("Plates changed", d.plates.changed)] },
    ],
  });
}
