/**
 * A small world for the tests of reconcile and the sources: observations made by hand, the events and traces of a store as plain values, and the fold of them into items, so that a test can read a place, reconcile it
 * and read it again (commons planning 0003-planning-reconcile).
 *
 * @module
 */
import {
  type EventData,
  type Instant,
  type Item,
  type ItemEvent,
  type ItemId,
  type ObservedItem,
  type ObservedState,
  type Observation,
  type Policy,
  DEFAULT_POLICY,
  type ToolActor,
  type Trace,
  tool,
  parseInstant,
} from "@intellectual-frontiers/planning/governance";
import { fold, reconcile, type Clock, type Reconciled } from "@intellectual-frontiers/planning/logical";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { must, testClock, WALL } from "./support.ts";

/** The source of the tests as an actor. */
export const SOURCE_ACTOR: ToolActor = must(tool("md", "Markdown"));

/** A time the n-th second after the wall time of the tests. */
export const instant = (n: number): Instant => must(parseInstant(new Date(WALL + n * 1000).toISOString().slice(0, 19) + "Z"));

/** An observation of the source `source`: a made-up thing with a title and a state, at a line of a file. */
export async function observe(source: string, fingerprint: string, title: string, options: { readonly state?: ObservedState; readonly line?: number; readonly body?: string; readonly labels?: readonly string[]; readonly extra?: Partial<ObservedItem> } = {}): Promise<Observation> {
  const content: ObservedItem = {
    kind: "task",
    title,
    body: options.body ?? "",
    labels: options.labels ?? [],
    assignees: [],
    state: options.state ?? { kind: "open" },
    origin: "derived",
    external: [],
    ...options.extra,
  };
  const line = options.line ?? 1;
  return {
    source,
    locator: { kind: "file-span", path: "a.md", startLine: line, endLine: line },
    contentHash: await sha256(JSON.stringify({ title, state: content.state, body: content.body, labels: content.labels, extra: options.extra ?? null })),
    fingerprint,
    content,
    raw: { title },
  };
}

/** The store of a test: events and traces as values. */
export type World = { readonly events: readonly ItemEvent[]; readonly traces: readonly Trace[]; readonly clock: Clock; readonly step: number };

/** An empty world. */
export const emptyWorld = (): World => ({ events: [], traces: [], clock: testClock(), step: 0 });

/** The items of a world, folded under a policy. */
export function itemsOf(w: World, policy: Policy = DEFAULT_POLICY): readonly Item[] {
  const by = new Map<ItemId, ItemEvent[]>();
  for (const e of w.events) by.set(e.item, [...(by.get(e.item) ?? []), e]);
  return [...by.values()].map((es) => must(fold(es, policy)));
}

/** Reconciles a read of one source against a world and takes the result into it, a second later than the last; the result is given too. */
export async function step(w: World, source: string, observations: readonly Observation[], policy: Policy = DEFAULT_POLICY): Promise<{ readonly world: World; readonly result: Reconciled }> {
  const n = w.step + 1;
  const result = must(await reconcile({ source, observations, items: itemsOf(w, policy), traces: w.traces, policy, now: instant(n), wallMs: WALL + n * 1000, clock: w.clock, actor: SOURCE_ACTOR }));
  const keys = new Set(result.traces.map((t) => `${t.source}\u0000${t.fingerprint}`));
  const traces = [...w.traces.filter((t) => !keys.has(`${t.source}\u0000${t.fingerprint}`)), ...result.traces];
  return { world: { events: [...w.events, ...result.events], traces, clock: result.clock, step: n }, result };
}

/** An event of a datum, for a world. */
export type Datum = EventData;
