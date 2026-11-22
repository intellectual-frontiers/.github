// Spec: 0005-planning-surfaces FR-003
/**
 * Collecting (0037-planning FR-016, FR-034): each source of the configuration is read, reconciled with what the store holds and, where the run is to write, the events and traces are written. A source that cannot be read
 * is reported and is not reconciled (a place that could not be read is not a place that is empty, so nothing is closed for it). Sources are taken one after the other so that what one makes is what the next reconciles with.
 *
 * @example
 * ```ts
 * import { collect } from "./collect.ts";
 * // const r = await collect({ store, sources, policy, now, context, write: false });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type BaselineClass, type ItemEvent, instantOfMs, type Policy, type RunContext, type Trace, actorFor } from "@intellectual-frontiers/planning/governance";
import { type Clock, type Conflict, foldAll, newClock, reconcile } from "@intellectual-frontiers/planning/logical";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import type { Source, SourceFinding } from "./source.ts";
import { loadStore, type PlanningStoreBackend, writeEvents, writeTraces } from "./store.ts";

/** What one source came to. */
export type SourceReport = {
  readonly name: string;
  readonly place: string;
  readonly observations: number;
  readonly classes: { readonly [C in BaselineClass]: number };
  readonly events: number;
  readonly conflicts: readonly Conflict[];
  readonly findings: readonly SourceFinding[];
  /** Why the place was not read, where it was not. */
  readonly unread?: string;
};

/** What a collection came to. */
export type Collected = {
  readonly reports: readonly SourceReport[];
  readonly events: readonly ItemEvent[];
  readonly traces: readonly Trace[];
  readonly conflicts: readonly Conflict[];
  /** Whether anything would be written. */
  readonly changes: boolean;
  readonly clock: Clock;
};

/** What a collection is given. */
export type CollectInput = {
  readonly store: PlanningStoreBackend;
  readonly sources: readonly Source[];
  readonly policy: Policy;
  readonly wallMs: number;
  readonly context: RunContext;
  readonly maxDriftMs?: number;
  readonly write: boolean;
};

/** A replica for the clock of a run: the same for the same folder is not needed, a run makes ids after every id it sees. */
export function runClock(maxDriftMs: number | undefined, seed: Uint8Array): Clock {
  const hex = [...seed].map((b) => b.toString(16).padStart(2, "0")).join("").padEnd(32, "0").slice(0, 32);
  const replica = parseReplicaId(hex);
  if (replica.kind === "err") throw new Error("a replica of 16 bytes");
  return newClock(replica.value, maxDriftMs);
}

/** Reads each source, reconciles it with the store, and writes the result where the run is to write. */
export async function collect(input: CollectInput, clock0: Clock): Promise<Result<Collected, string>> {
  const loaded = await loadStore(input.store, { clock: clock0, wallMs: input.wallMs, policy: input.policy });
  if (loaded.kind === "err") return err(loaded.error.message);
  const now = instantOfMs(input.wallMs);
  if (now.kind === "err") return err("the wall time is not a time");
  let events: ItemEvent[] = [...loaded.value.events];
  let traces: Trace[] = [...loaded.value.traces];
  let clock = loaded.value.clock;
  const made: ItemEvent[] = [];
  const madeTraces: Trace[] = [];
  const conflicts: Conflict[] = [];
  const reports: SourceReport[] = [];
  for (const source of input.sources) {
    const read = await source.acquire();
    const empty = { new: 0, unchanged: 0, updated: 0, absent: 0 };
    if (read.kind === "err") {
      reports.push({ name: source.name, place: source.place, observations: 0, classes: empty, events: 0, conflicts: [], findings: [], unread: read.error.kind === "unexpressed" ? read.error.reason : read.error.message });
      continue;
    }
    const actor = actorFor(input.context, { kind: "tool", id: source.name, name: source.name });
    if (actor.kind === "err" || actor.value.kind !== "tool") return err("a source acts as a tool");
    const r = await reconcile({ source: source.name, observations: read.value.observations, items: foldAll(events, input.policy).items, traces, policy: input.policy, now: now.value, wallMs: input.wallMs, clock, actor: actor.value });
    if (r.kind === "err") return err(`reconciling ${source.name}: ${r.error.kind}`);
    clock = r.value.clock;
    events = [...events, ...r.value.events];
    made.push(...r.value.events);
    const keys = new Set(r.value.traces.map((t) => `${t.source}\u0000${t.fingerprint}`));
    traces = [...traces.filter((t) => !keys.has(`${t.source}\u0000${t.fingerprint}`)), ...r.value.traces];
    madeTraces.push(...r.value.traces);
    conflicts.push(...r.value.conflicts);
    const classes = { ...empty };
    for (const c of r.value.classes) classes[c.class]++;
    reports.push({ name: source.name, place: source.place, observations: read.value.observations.length, classes, events: r.value.events.length, conflicts: r.value.conflicts, findings: read.value.findings });
  }
  if (input.write) {
    const e = await writeEvents(input.store, made);
    if (e.kind === "err") return err(e.error.message);
    const t = await writeTraces(input.store, madeTraces);
    if (t.kind === "err") return err(t.error.message);
  }
  return ok({ reports, events: made, traces: madeTraces, conflicts, changes: made.length > 0 || madeTraces.length > 0, clock });
}
