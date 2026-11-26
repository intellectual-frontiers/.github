// Spec: 0003-dossier-collectors FR-001
/**
 * Collectors (0003-dossier-collectors FR-001 to FR-006): the one contract by which evidence that already exists becomes the sources of a dossier. A collector is data (an id, a version, the kinds it makes) and one small function of the environment it is given; the environment is a port the product
 * supplies, so this layer reads nothing itself. `collect` runs the collectors in the order of their ids and gives the same sources for the same evidence; a kind a collector declares and finds none of is a gap that it names, and a gap is evidence too.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type BuildError, GAP_KIND, type Source } from "@intellectual-frontiers/dossier/governance";
import { bySourceId } from "./selection.ts";
import { checkSources, sourceOf, type SourceParts } from "./sources.ts";

/** The ids of collectors: lower case words joined by hyphens. */
export const COLLECTOR_ID = /^[a-z][a-z0-9-]*$/;

/** A kind of evidence that a collector looked for and did not find, and why. */
export interface Gap {
  readonly collector: string;
  readonly kind: string;
  readonly reason: string;
}

/** What one collector gives: the parts of the sources it made, and the gaps it found. */
export interface Collection {
  readonly sources: readonly SourceParts[];
  readonly gaps: readonly Gap[];
}

/** A collector over an environment `E` that the product supplies. */
export interface Collector<E> {
  readonly id: string;
  readonly version: string;
  /** The kinds of source it makes. */
  readonly kinds: readonly string[];
  /** Reads evidence through the environment; the instant of each source is the instant of the evidence and never the clock. */
  readonly collect: (env: E) => Promise<Result<Collection, string>>;
}

/** A collector, checked at the place it is made. */
export function defineCollector<E>(c: Collector<E>): Collector<E> {
  if (!COLLECTOR_ID.test(c.id)) throw new Error(`${JSON.stringify(c.id)} is not a collector id: lower case words joined by hyphens`);
  if (c.kinds.length === 0) throw new Error(`collector ${c.id} makes no kind of source`);
  return c;
}

/** What a collector did. */
export interface Ran {
  readonly id: string;
  readonly version: string;
  readonly sources: number;
  readonly gaps: number;
}

/** What `collect` gives. */
export interface Collected {
  readonly sources: readonly Source[];
  readonly gaps: readonly Gap[];
  readonly ran: readonly Ran[];
}

const byGap = (a: Gap, b: Gap): number => (a.collector < b.collector ? -1 : a.collector > b.collector ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0);

const fail = (code: BuildError["code"], message: string) => err({ code, message } as BuildError);

/** Runs collectors in the order of their ids and gives their sources in the order of theirs: an id given twice is refused, a source of a kind its collector does not declare is refused, a declared kind with no source and no gap becomes a gap, and the sources are checked as a set. */
export async function collect<E>(collectors: readonly Collector<E>[], env: E): Promise<Result<Collected, BuildError>> {
  const ordered = [...collectors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = 1; i < ordered.length; i++) if (ordered[i]?.id === ordered[i - 1]?.id) return fail("E-DOSSIER-COLLECTOR-DUPLICATE", `two collectors are named ${ordered[i]?.id}`);
  const sources: Source[] = [];
  const gaps: Gap[] = [];
  const ran: Ran[] = [];
  for (const c of ordered) {
    const got = await c.collect(env);
    if (got.kind === "err") return fail("E-DOSSIER-COLLECTOR", `${c.id}: ${got.error}`);
    const made: Source[] = [];
    for (const p of got.value.sources) {
      if (!c.kinds.includes(p.kind)) return fail("E-DOSSIER-COLLECTOR-KIND", `${c.id} made a source of kind ${p.kind}, which it does not declare (${c.kinds.join(", ")})`);
      const s = await sourceOf(p);
      if (s.kind === "err") return fail("E-DOSSIER-COLLECTOR", `${c.id}: ${s.error}`);
      made.push(s.value);
    }
    const own = [...got.value.gaps];
    for (const k of c.kinds) if (!made.some((s) => s.kind === k) && !own.some((g) => g.kind === k)) own.push({ collector: c.id, kind: k, reason: "none found" });
    sources.push(...made);
    gaps.push(...own.map((g) => ({ collector: c.id, kind: g.kind, reason: g.reason })));
    ran.push({ id: c.id, version: c.version, sources: made.length, gaps: own.length });
  }
  const checked = await checkSources(sources);
  if (checked.kind === "err") return err(checked.error);
  return ok({ sources: [...checked.value].sort(bySourceId), gaps: gaps.sort(byGap), ran });
}

/** The sources of a collection with one more that says what was not found, as of the newest of the others, so that a dossier shows its own negative space: where nothing was collected there is no instant to give it and the collection is refused. */
export async function withGaps(c: Collected): Promise<Result<readonly Source[], BuildError>> {
  if (c.sources.length === 0) return fail("E-DOSSIER-EMPTY", `nothing was collected${c.gaps.length === 0 ? "" : `: ${c.gaps.map((g) => `${g.kind} (${g.reason})`).join("; ")}`}`);
  if (c.gaps.length === 0) return ok(c.sources);
  const newest = c.sources.reduce((m, s) => (s.observedAt > m ? s.observedAt : m), "");
  const made = await sourceOf({ id: "collection-gaps", kind: GAP_KIND, observedAt: newest, body: { gaps: c.gaps.map((g) => ({ collector: g.collector, kind: g.kind, reason: g.reason })) } });
  if (made.kind === "err") return fail("E-DOSSIER-COLLECTOR", made.error);
  return ok([...c.sources, made.value].sort(bySourceId));
}
