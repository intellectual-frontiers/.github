// Spec: 0003-planning-reconcile FR-002
// Spec: 0003-planning-reconcile FR-003
// Spec: 0003-planning-reconcile FR-004
// Spec: 0003-planning-reconcile FR-005
// Spec: 0003-planning-reconcile FR-006
/**
 * `reconcile` (0037-planning FR-016 to FR-018): what a source read, brought together with the store. Each observation is matched to an item (the anchor it carries, an external id, its fingerprint, its locator), classed
 * against the trace last taken (new, unchanged, updated, absent: the `baselineState` of SARIF 2.1.0 section 3.27.24), and each difference of the place from its base becomes an event whose actor is the source, a tool,
 * so that the authority of a field decides in `fold`; where the place, its base and the store all differ and the policy names no authority, the result is a conflict value and nothing is chosen. A thing no longer
 * found is closed by a derived close and reopened if it is found again, unless a person closed it. The result is data (events, traces, conflicts, classes) and nothing is written. Async only because an id made of
 * an external id takes a SHA-256.
 *
 * @example
 * ```ts
 * import { reconcile } from "./reconcile.ts";
 * // const r = await reconcile({ source: "markdown", observations, items, traces, policy, now, wallMs, clock, actor });
 * ```
 *
 * @module
 */
import { compact, err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type BaselineClass,
  type EventData,
  type EventId,
  type EventProblem,
  type ExternalId,
  type IdProblem,
  type Instant,
  type Item,
  type ItemEvent,
  type ItemId,
  type Link,
  makeEvent,
  type ObservedItem,
  type ObservedState,
  type Observation,
  type Policy,
  sameLocator,
  type State,
  type TimeProblem,
  type ToolActor,
  type Trace,
  type OpenedData,
  type AuthorityField,
  msOfInstant,
} from "@intellectual-frontiers/planning/governance";
import { canonical } from "./canonical.ts";
import { type Clock, type ClockProblem, mintEventId, mintItemId, seeId } from "./clock.ts";
import { eventIdOfExternal, itemIdOfExternal } from "./legacy-id.ts";

/** The fields of a place that are merged three ways. */
export type MergedField = "title" | "body" | "severity" | "state";

/** A difference that nothing decides: it names the item, the field, the three values and the source (0037-planning FR-017). */
export type Conflict =
  | { readonly kind: "field"; readonly item: ItemId; readonly field: MergedField; readonly base: string; readonly now: string; readonly store: string; readonly source: string }
  | { readonly kind: "event-id"; readonly item: ItemId; readonly id: EventId; readonly source: string };

/** What `reconcile` is given. */
export type ReconcileInput = {
  readonly source: string;
  readonly observations: readonly Observation[];
  readonly items: readonly Item[];
  readonly traces: readonly Trace[];
  readonly policy: Policy;
  /** The instant the read was made, which the events made of it carry. */
  readonly now: Instant;
  /** The wall time in milliseconds, for the clock. */
  readonly wallMs: number;
  readonly clock: Clock;
  /** The source as an actor. */
  readonly actor: ToolActor;
};

/** How an observation ended, for the report. */
export type Classed = { readonly fingerprint: string; readonly class: BaselineClass; readonly item: ItemId | undefined };

/** What `reconcile` gives: data, and the clock after the ids it made. */
export type Reconciled = {
  readonly events: readonly ItemEvent[];
  /** The traces to write: new, changed or made absent. */
  readonly traces: readonly Trace[];
  readonly links: readonly Link[];
  readonly conflicts: readonly Conflict[];
  readonly classes: readonly Classed[];
  readonly clock: Clock;
};

/** Why `reconcile` cannot go on. */
export type ReconcileProblem =
  | { readonly kind: "id"; readonly problem: IdProblem }
  | { readonly kind: "clock"; readonly problem: ClockProblem }
  | { readonly kind: "event"; readonly problem: EventProblem }
  | { readonly kind: "time"; readonly problem: TimeProblem };

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort(byText).every((x, i) => x === [...b].sort(byText)[i]);

/** The state a place says, as the item's state says it, for comparing. */
export function stateKey(s: ObservedState | State): string {
  switch (s.kind) {
    case "closed":
      return `closed:${s.reason}`;
    case "deferred":
      return `deferred:${s.until ?? ""}:${s.untilText ?? ""}`;
    case "open":
    case "in-progress":
    case "proposed":
      return s.kind;
    default: {
      const never: never = s;
      return never;
    }
  }
}

/** The opening an observation makes. */
function openingOf(c: ObservedItem): OpenedData {
  const carried = compact({
    sourceSeverity: c.sourceSeverity,
    motivation: c.motivation,
    blocker: c.blocker,
    target: c.target,
    source: c.source,
    priority: c.priority,
    size: c.size,
    goals: c.goals,
    engines: c.engines,
    cites: c.cites,
    evidence: c.evidence,
    due: c.due,
  });
  return { type: "opened", kind: c.kind, title: c.title, body: c.body, labels: c.labels, assignees: c.assignees, origin: c.origin, ...(c.severity === undefined ? {} : { severity: c.severity }), ...carried };
}

/** The events of a state that is not open, after an opening. */
function stateEvents(s: ObservedState): readonly EventData[] {
  switch (s.kind) {
    case "open":
      return [];
    case "in-progress":
      return [{ type: "started" }];
    case "deferred":
      return [{ type: "deferred", ...(s.until === undefined ? {} : { until: s.until }), ...(s.untilText === undefined ? {} : { untilText: s.untilText }) }];
    case "closed":
      return [{ type: "closed", reason: s.reason }];
    default: {
      const never: never = s;
      return never;
    }
  }
}

type Run = {
  clock: Clock;
  readonly events: ItemEvent[];
  readonly traces: Map<string, Trace>;
  readonly conflicts: Conflict[];
  readonly classes: Classed[];
  readonly links: Link[];
};

/** Reconciles what a source read with the store: events, traces, links, conflicts and classes, as data. */
export async function reconcile(input: ReconcileInput): Promise<Result<Reconciled, ReconcileProblem>> {
  const run: Run = { clock: input.clock, events: [], traces: new Map(), conflicts: [], classes: [], links: [] };
  const itemsById = new Map(input.items.map((i) => [i.id, i]));
  const own = new Map(input.traces.filter((t) => t.source === input.source).map((t) => [t.fingerprint, t]));
  const claimed = new Set<ItemId>();
  const found = new Map<string, ItemId>();
  const seen = new Set<string>();
  const parents: { readonly fingerprint: string; readonly parent: string }[] = [];

  const mint = (): Result<EventId, ReconcileProblem> => {
    const m = mintEventId(run.clock, input.wallMs);
    if (m.kind === "err") return err({ kind: "id", problem: m.error });
    run.clock = m.value.clock;
    return ok(m.value.id);
  };
  const emit = (item: ItemId, data: EventData, id?: EventId, at?: Instant, external?: readonly ExternalId[]): Result<ItemEvent, ReconcileProblem> => {
    const eventId = id === undefined ? mint() : ok(id);
    if (eventId.kind === "err") return eventId;
    const made = makeEvent({ id: eventId.value, item, at: at ?? input.now, actor: input.actor, ...(external === undefined || external.length === 0 ? {} : { external }) }, data);
    if (made.kind === "err") return err({ kind: "event", problem: made.error });
    run.events.push(made.value);
    return ok(made.value);
  };
  const trace = (item: ItemId, o: Observation, presence: Trace["presence"]): void => {
    run.traces.set(o.fingerprint, { item, source: o.source, fingerprint: o.fingerprint, locator: o.locator, contentHash: o.contentHash, observed: o.content, presence });
  };

  for (const obs of input.observations) {
    seen.add(obs.fingerprint);
    const c = obs.content;
    const base = own.get(obs.fingerprint);

    // history the place keeps itself: taken as it is
    if (c.history !== undefined && c.history.length > 0) {
      const first = c.history[0];
      if (first === undefined) continue;
      const item = itemsById.get(first.item);
      claimed.add(first.item);
      found.set(obs.fingerprint, first.item);
      const have = new Map((item?.events ?? []).map((e) => [e.id, canonical(e)]));
      let taken = 0;
      for (const e of c.history) {
        const text = have.get(e.id);
        if (text === undefined) {
          run.events.push(e);
          const sight = seeId(run.clock, e.id, input.wallMs);
          if (sight.kind === "ok") run.clock = sight.value;
          taken++;
        } else if (text !== canonical(e)) run.conflicts.push({ kind: "event-id", item: first.item, id: e.id, source: input.source });
      }
      run.classes.push({ fingerprint: obs.fingerprint, class: item === undefined ? "new" : base === undefined ? "new" : base.contentHash === obs.contentHash && taken === 0 ? "unchanged" : "updated", item: first.item });
      if (base === undefined || base.contentHash !== obs.contentHash || base.presence !== "present" || !sameLocator(base.locator, obs.locator)) trace(first.item, obs, "present");
      continue;
    }

    // match: the anchor, an external id, the fingerprint, the locator
    let matched: Item | undefined;
    const free = (i: Item | undefined): Item | undefined => (i !== undefined && !claimed.has(i.id) ? i : undefined);
    if (c.anchor !== undefined) matched = free(itemsById.get(c.anchor));
    if (matched === undefined) matched = input.items.find((i) => !claimed.has(i.id) && c.external.some((x) => i.external.some((y) => y.source === x.source && y.value === x.value)));
    if (matched === undefined) {
      const t = base ?? input.traces.find((x) => x.fingerprint === obs.fingerprint && x.source !== input.source);
      if (t !== undefined) matched = free(itemsById.get(t.item));
    }
    if (matched === undefined) {
      const t = input.traces.find((x) => x.source === input.source && sameLocator(x.locator, obs.locator) && !seen.has(x.fingerprint) && !claimed.has(x.item));
      if (t !== undefined) matched = free(itemsById.get(t.item));
    }
    if (matched !== undefined && base !== undefined && base.item !== matched.id) matched = undefined;

    if (matched === undefined) {
      const made = await openNew(obs, run, input, emit);
      if (made.kind === "err") return made;
      claimed.add(made.value);
      found.set(obs.fingerprint, made.value);
      run.classes.push({ fingerprint: obs.fingerprint, class: "new", item: made.value });
      trace(made.value, obs, "present");
      if (c.parent !== undefined) parents.push({ fingerprint: obs.fingerprint, parent: c.parent });
      continue;
    }

    claimed.add(matched.id);
    found.set(obs.fingerprint, matched.id);
    if (c.parent !== undefined) parents.push({ fingerprint: obs.fingerprint, parent: c.parent });
    if (base === undefined) {
      // seen before in no trace of this source: it is new to the source, and nothing of the place is taken over the store
      run.classes.push({ fingerprint: obs.fingerprint, class: "new", item: matched.id });
      trace(matched.id, obs, "present");
      continue;
    }
    if (base.presence === "absent") {
      const closedByTool = matched.state.kind === "closed" && matched.state.by.kind === "tool";
      if (closedByTool) {
        const r = emit(matched.id, { type: "reopened" });
        if (r.kind === "err") return r;
      }
    }
    if (base.contentHash === obs.contentHash) {
      run.classes.push({ fingerprint: obs.fingerprint, class: "unchanged", item: matched.id });
      if (base.presence !== "present" || !sameLocator(base.locator, obs.locator)) trace(matched.id, obs, "present");
      continue;
    }
    run.classes.push({ fingerprint: obs.fingerprint, class: "updated", item: matched.id });
    const merged = merge(matched, base.observed, c, input, run, emit);
    if (merged.kind === "err") return merged;
    trace(matched.id, obs, "present");
  }

  // a thing no longer found: closed as completed, by a tool, unless the item is closed
  for (const t of [...own.values()].sort((a, b) => byText(a.fingerprint, b.fingerprint))) {
    if (seen.has(t.fingerprint)) continue;
    const item = itemsById.get(t.item);
    if (t.presence === "present") {
      if (item !== undefined && item.state.kind !== "closed") {
        const r = emit(item.id, { type: "closed", reason: "completed" });
        if (r.kind === "err") return r;
      }
      run.traces.set(t.fingerprint, { ...t, presence: "absent" });
    }
    run.classes.push({ fingerprint: t.fingerprint, class: "absent", item: t.item });
  }

  // nested things: the parent is linked to the child
  for (const p of parents) {
    const child = found.get(p.fingerprint);
    const parent = found.get(p.parent) ?? own.get(p.parent)?.item;
    if (child === undefined || parent === undefined || child === parent) continue;
    const link: Link = { kind: "parent-of", from: parent, to: child };
    run.links.push(link);
    const existing = itemsById.get(parent)?.links.some((l) => l.kind === "parent-of" && l.to === child) === true;
    const already = run.events.some((e) => e.item === parent && e.data.type === "linked" && e.data.to === child);
    if (!existing && !already) {
      const r = emit(parent, { type: "linked", change: "add", link: "parent-of", to: child });
      if (r.kind === "err") return r;
    }
  }

  return ok({
    events: run.events,
    traces: [...run.traces.values()].sort((a, b) => byText(a.fingerprint, b.fingerprint)),
    links: run.links,
    conflicts: run.conflicts,
    classes: run.classes,
    clock: run.clock,
  });
}

/** Opens a new item from an observation: its id from the first external id where there is one, else from the clock. */
async function openNew(
  obs: Observation,
  run: Run,
  input: ReconcileInput,
  emit: Emit,
): Promise<Result<ItemId, ReconcileProblem>> {
  const c = obs.content;
  const ext = c.external[0];
  const at = c.at ?? input.now;
  if (ext === undefined) {
    const m = mintItemId(run.clock, input.wallMs);
    if (m.kind === "err") return err({ kind: "id", problem: m.error });
    run.clock = m.value.clock;
    const opened = emit(m.value.id, openingOf(c), undefined, at, c.external);
    if (opened.kind === "err") return opened;
    for (const d of stateEvents(c.state)) {
      const e = emit(m.value.id, d);
      if (e.kind === "err") return e;
    }
    return ok(m.value.id);
  }
  const atMs = c.at === undefined ? 0 : msOfInstant(c.at);
  const item = await itemIdOfExternal(ext.source, ext.value, atMs);
  if (item.kind === "err") return err({ kind: "id", problem: item.error });
  const openId = await eventIdOfExternal(ext.source, `${ext.value}\u0000opened`, atMs);
  if (openId.kind === "err") return err({ kind: "id", problem: openId.error });
  const opened = emit(item.value, openingOf(c), openId.value, c.at ?? input.now, c.external);
  if (opened.kind === "err") return opened;
  let n = 1;
  for (const d of stateEvents(c.state)) {
    const stateId = await eventIdOfExternal(ext.source, `${ext.value}\u0000${d.type}`, atMs + n);
    if (stateId.kind === "err") return err({ kind: "id", problem: stateId.error });
    const e = emit(item.value, d, stateId.value, c.at ?? input.now);
    if (e.kind === "err") return e;
    n++;
  }
  const sight = seeId(run.clock, openId.value, input.wallMs);
  if (sight.kind === "ok") run.clock = sight.value;
  return ok(item.value);
}

type Emit = (item: ItemId, data: EventData, id?: EventId, at?: Instant, external?: readonly ExternalId[]) => Result<ItemEvent, ReconcileProblem>;

/** The three-way merge of the base, what the place says now and what the store says, as events and conflicts (0037-planning FR-017). */
function merge(item: Item, base: ObservedItem, now: ObservedItem, input: ReconcileInput, run: Run, emit: Emit): Result<true, ReconcileProblem> {
  const decide = <T>(field: MergedField, b: T, n: T, s: T, show: (v: T) => string): "none" | "emit" | "conflict" => {
    const eq = (x: T, y: T): boolean => show(x) === show(y);
    if (eq(n, b) || eq(n, s)) return "none";
    if (eq(s, b)) return "emit";
    if (input.policy.authority[field satisfies AuthorityField] === undefined) {
      run.conflicts.push({ kind: "field", item: item.id, field, base: show(b), now: show(n), store: show(s), source: input.source });
      return "conflict";
    }
    return "emit";
  };
  const text = (v: string): string => v;

  if (decide("title", base.title, now.title, item.title, text) === "emit") {
    const r = emit(item.id, { type: "edited", title: now.title });
    if (r.kind === "err") return r;
  }
  if (decide("body", base.body, now.body, item.body, text) === "emit") {
    const r = emit(item.id, { type: "edited", body: now.body });
    if (r.kind === "err") return r;
  }
  if (now.severity !== undefined && decide("severity", base.severity ?? "", now.severity, item.severity ?? "", text) === "emit") {
    const r = emit(item.id, { type: "severity-set", severity: now.severity });
    if (r.kind === "err") return r;
  }
  if (now.blocker !== undefined && base.blocker !== now.blocker && now.blocker !== (item.blocker ?? false)) {
    const r = emit(item.id, { type: "blocker-set", blocker: now.blocker });
    if (r.kind === "err") return r;
  }
  if (!sameSet(base.labels, now.labels)) {
    const add = now.labels.filter((l) => !base.labels.includes(l) && !item.labels.includes(l));
    const remove = base.labels.filter((l) => !now.labels.includes(l) && item.labels.includes(l));
    if (add.length > 0 || remove.length > 0) {
      const r = emit(item.id, { type: "labeled", add, remove });
      if (r.kind === "err") return r;
    }
  }
  if (!sameSet(base.assignees, now.assignees)) {
    const add = now.assignees.filter((l) => !base.assignees.includes(l) && !item.assignees.includes(l));
    const remove = base.assignees.filter((l) => !now.assignees.includes(l) && item.assignees.includes(l));
    if (add.length > 0 || remove.length > 0) {
      const r = emit(item.id, { type: "assigned", add, remove });
      if (r.kind === "err") return r;
    }
  }
  if (decide("state", base.state, now.state, observedOf(item.state), stateKey) === "emit") {
    const data = stateChange(now.state, item.state);
    if (data !== undefined) {
      const r = emit(item.id, data);
      if (r.kind === "err") return r;
    }
  }
  return ok(true);
}

/** The state of an item as a place would say it (proposed is open to a place). */
function observedOf(s: State): ObservedState {
  return s.kind === "proposed" ? { kind: "open" } : s.kind === "closed" ? { kind: "closed", reason: s.reason } : s.kind === "deferred" ? { kind: "deferred", ...(s.until === undefined ? {} : { until: s.until }), ...(s.untilText === undefined ? {} : { untilText: s.untilText }) } : { kind: s.kind };
}

/** The event that takes an item in the state `from` to the state a place says. */
function stateChange(to: ObservedState, from: State): EventData | undefined {
  switch (to.kind) {
    case "open":
      return from.kind === "closed" || from.kind === "deferred" ? { type: "reopened" } : undefined;
    case "in-progress":
      return from.kind === "in-progress" ? undefined : { type: "started" };
    case "deferred":
      return { type: "deferred", ...(to.until === undefined ? {} : { until: to.until }), ...(to.untilText === undefined ? {} : { untilText: to.untilText }) };
    case "closed":
      return { type: "closed", reason: to.reason };
    default: {
      const never: never = to;
      return never;
    }
  }
}
