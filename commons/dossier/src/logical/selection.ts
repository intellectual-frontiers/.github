// Spec: 0002-dossier-core FR-002
/**
 * Selection (0046-dossiers FR-010, FR-011): a filter over sources that is a value, compared, combined by intersection and written into the manifest, and that gives one list in one order for the same sources; and the instants a build reads
 * (0046-dossiers FR-006): a source observed after the instant of the dossier is not read, and `latest` is the instant of the newest source selected, never the clock.
 *
 * @module
 */
import type { Selection, Source } from "@intellectual-frontiers/dossier/governance";

/** The instants a dossier uses: `2026-11-26T12:00:00Z`. */
export const INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

/** The epoch, the instant of a dossier with nothing in it. */
export const EPOCH = "1970-01-01T00:00:00Z";

const uniq = (xs: readonly string[] | undefined): readonly string[] | undefined => (xs === undefined ? undefined : [...new Set(xs)].sort());

/** A selection in its one canonical form: each list sorted and without a repeat. */
export function canonicalSelection(s: Selection): Selection {
  const out: { -readonly [K in keyof Selection]: Selection[K] } = {};
  for (const k of ["kinds", "about", "tags", "ids"] as const) {
    const v = uniq(s[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Whether a source meets a selection: every field that is there narrows (a source with no boundary is about none, and so meets no selection of a boundary). */
export function meets(s: Selection, src: Source): boolean {
  if (s.kinds !== undefined && !s.kinds.includes(src.kind)) return false;
  if (s.ids !== undefined && !s.ids.includes(src.id)) return false;
  if (s.about !== undefined && !s.about.some((b) => src.about.includes(b))) return false;
  if (s.tags !== undefined && !s.tags.every((t) => src.tags.includes(t))) return false;
  return true;
}

const both = (a: readonly string[] | undefined, b: readonly string[] | undefined): readonly string[] | undefined => (a === undefined ? b : b === undefined ? a : a.filter((x) => b.includes(x)));

/** The selection that a source meets only if it meets both (the intersection: kinds, boundaries and ids are narrowed to what both allow, and tags are joined). */
export function intersect(a: Selection, b: Selection): Selection {
  const out: { -readonly [K in keyof Selection]: Selection[K] } = {};
  const kinds = both(a.kinds, b.kinds);
  const about = both(a.about, b.about);
  const ids = both(a.ids, b.ids);
  const tags = a.tags === undefined ? b.tags : b.tags === undefined ? a.tags : [...a.tags, ...b.tags];
  if (kinds !== undefined) out.kinds = kinds;
  if (about !== undefined) out.about = about;
  if (ids !== undefined) out.ids = ids;
  if (tags !== undefined) out.tags = tags;
  return canonicalSelection(out);
}

/** The order of sources: by id, and where one id is in the list twice with the same hash, once. */
export const bySourceId = (a: Source, b: Source): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);

/** The sources that meet a selection and were observed at or before `asOf`, in the order of their ids; the same selection over the same sources always gives the same list. */
export function select(s: Selection, sources: readonly Source[], asOf: string): readonly Source[] {
  return sources.filter((x) => x.observedAt <= asOf && meets(s, x)).sort(bySourceId);
}

/** The sources that meet any of the selections, once each. */
export function selectAny(ss: readonly Selection[], sources: readonly Source[], asOf: string): readonly Source[] {
  return sources.filter((x) => x.observedAt <= asOf && ss.some((s) => meets(s, x))).sort(bySourceId);
}

/** The instant a dossier is as of: its own, or for `latest` the newest instant among the sources it selects (the epoch where it selects none). */
export function instantOf(asOf: "latest" | string, selected: readonly Source[]): string {
  if (asOf !== "latest") return asOf;
  return selected.reduce((m, s) => (s.observedAt > m ? s.observedAt : m), EPOCH);
}

/** Whole days from one instant to a later one, rounded down; none for an earlier one. */
export function ageDays(observedAt: string, asOf: string): number {
  const d = Date.parse(asOf) - Date.parse(observedAt);
  return d <= 0 ? 0 : Math.floor(d / 86_400_000);
}
