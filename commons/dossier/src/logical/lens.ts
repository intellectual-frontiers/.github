// Spec: 0002-dossier-core FR-004, FR-005
/**
 * Lenses (0046-dossiers FR-020 to FR-022): making one, the plates a lens writes, and the compositions that give a lens from lenses: `restrict` (narrowed by a selection), `redact` (a lower ceiling), `unionOf` (the plates of many as one, in order) and `rollup`
 * (a lens run for each group of sources as one plate with counts). A lens reads only what it is given and writes the same plate for the same input.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Block, type DisclosureClass, higher, type Inline, type Lens, type LensInput, mayShow, type Plate, type Refusal, type Selection, type Source } from "@intellectual-frontiers/dossier/governance";
import { ageDays, meets } from "./selection.ts";

/** The words of a text as a slug: lower case letters and digits joined by hyphens; `x` where there are none. */
export function slugOf(text: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s === "" ? "x" : s;
}

/** The anchor of the entry of a source in the evidence of a dossier. */
export const evidenceAnchor = (id: string): string => `ev-${slugOf(id)}`;

/** Text as an inline. */
export const text = (t: string): Inline => ({ t: "text", text: t });

/** Code as an inline. */
export const code = (t: string): Inline => ({ t: "code", text: t });

/** A citation of a source, with the words to show (the id where none). */
export const cite = (source: string, words?: string): Inline => (words === undefined ? { t: "cite", source } : { t: "cite", source, children: [text(words)] });

/** A paragraph of one run of text. */
export const para = (t: string): Block => ({ t: "para", inlines: [text(t)] });

/** What a lens needs to write a plate. */
export interface PlateParts {
  readonly lens: Lens<never> | { readonly id: string; readonly ceiling: DisclosureClass };
  readonly title: string;
  readonly slug?: string;
  readonly blocks: readonly Block[];
  readonly cites?: readonly string[];
  readonly ceiling?: DisclosureClass;
}

/** A plate: its slug is the words of its title unless one is given, and its citations are sorted and without a repeat. */
export function plateOf(p: PlateParts): Plate {
  return { lens: p.lens.id, slug: p.slug ?? slugOf(p.title), title: p.title, blocks: p.blocks, cites: [...new Set(p.cites ?? [])].sort(), ceiling: p.ceiling ?? p.lens.ceiling };
}

/** The plate of a lens whose inputs are empty (0046-dossiers FR-022): it says what is absent and never reads as if the evidence were there. */
export function emptyPlate(lens: { readonly id: string; readonly ceiling: DisclosureClass }, title: string, absent: string): Plate {
  return plateOf({ lens, title, blocks: [{ t: "note", tone: "warning", inlines: [text(`There is no evidence of ${absent}.`)] }] });
}

/** How old a source is as of the instant, in words (a plate shows the freshness of what it states, 0046-dossiers FR-032). */
export function freshness(observedAt: string, asOf: string): string {
  const d = ageDays(observedAt, asOf);
  return `observed ${observedAt}, ${d === 0 ? "on" : d === 1 ? "1 day before" : `${d} days before`} the date of the dossier`;
}

/** A lens, made from its parts; what it is given is checked by the build. */
export function defineLens<P>(l: Lens<P>): Lens<P> {
  return l;
}

/** A lens held with the type of its parameters forgotten: the build decodes them itself, so what a registry holds is a lens of parameters it does not know. */
export function erase<P>(l: Lens<P>): Lens<unknown> {
  return l as unknown as Lens<unknown>;
}

/** The lens that reads only the sources that meet a selection (0046-dossiers FR-021: a selection that no source meets gives no plate and no error). */
export function restrict<P>(lens: Lens<P>, selection: Selection): Lens<P> {
  return { ...lens, id: `${lens.id}/restricted`, plate: (i) => lens.plate({ ...i, sources: i.sources.filter((s) => meets(selection, s)) }) };
}

/** The lens whose ceiling is lowered (0046-dossiers FR-021): it is given only the sources of a class at most the new ceiling. */
export function redact<P>(lens: Lens<P>, ceiling: DisclosureClass): Lens<P> {
  const c = mayShow(lens.ceiling, ceiling) ? ceiling : lens.ceiling;
  return { ...lens, id: `${lens.id}/${c}`, ceiling: c, plate: (i) => lens.plate({ ...i, sources: i.sources.filter((s) => mayShow(c, s.class)) }) };
}

/** The lens that gives the plates of many as one, in the order given, each plate's blocks following the one before it: the plate of `unionOf([unionOf([a, b]), c])` and that of `unionOf([a, unionOf([b, c])])` hold the same blocks. */
export function unionOf(id: string, title: string, lenses: readonly Lens<unknown>[]): Lens<readonly unknown[]> {
  return {
    id,
    version: lenses.map((l) => `${l.id}@${l.version}`).join("+"),
    title,
    inputs: [...new Set(lenses.flatMap((l) => l.inputs))].sort(),
    ceiling: lenses.reduce<DisclosureClass>((m, l) => higher(m, l.ceiling), "public"),
    decode: (raw) => (Array.isArray(raw) && raw.length === lenses.length ? ok(raw) : err(`a union of ${lenses.length} lenses takes a list of ${lenses.length} parameters`)),
    plate: (i): Result<Plate, Refusal> => {
      const plates: Plate[] = [];
      for (const [n, l] of lenses.entries()) {
        const r = l.plate({ sources: i.sources.filter((s) => l.inputs.includes(s.kind)), params: i.params[n], asOf: i.asOf, withheld: i.withheld });
        if (r.kind === "err") return r;
        plates.push(r.value);
      }
      return ok(plateOf({ lens: { id, ceiling: lenses.reduce<DisclosureClass>((m, l) => higher(m, l.ceiling), "public") }, title, blocks: plates.flatMap((p) => p.blocks), cites: plates.flatMap((p) => p.cites) }));
    },
  };
}

/** The lens that runs a lens for each group of sources (the key says which group a source is in) and gives one plate: a table of the counts, then the plate of each group under a section of its own, in the order of the keys. */
export function rollup<P>(lens: Lens<P>, keyOf: (s: Source) => string, title: string): Lens<P> {
  return {
    ...lens,
    id: `${lens.id}/rollup`,
    title,
    plate: (i): Result<Plate, Refusal> => {
      const groups = new Map<string, Source[]>();
      for (const s of i.sources) groups.set(keyOf(s), [...(groups.get(keyOf(s)) ?? []), s]);
      const keys = [...groups.keys()].sort();
      const plates: { readonly key: string; readonly plate: Plate }[] = [];
      for (const k of keys) {
        const r = lens.plate({ ...i, sources: groups.get(k) ?? [] });
        if (r.kind === "err") return r;
        plates.push({ key: k, plate: r.value });
      }
      const counts: Block = { t: "table", head: ["Group", "Sources"], rows: keys.map((k) => [[text(k)], [text(String(groups.get(k)?.length ?? 0))]]) };
      const parts: Block[] = plates.map(({ key, plate }) => ({ t: "section", level: 2, id: `${slugOf(title)}-${slugOf(key)}`, title: key, blocks: plate.blocks }));
      return ok(plateOf({ lens, title, blocks: [counts, ...parts], cites: plates.flatMap((p) => p.plate.cites) }));
    },
  };
}

/** The input of a lens as the build gives it, for a test: the sources, the parameters and the instant. */
export const inputOf = <P>(sources: readonly Source[], params: P, asOf: string, withheld = 0): LensInput<P> => ({ sources, params, asOf, withheld });
