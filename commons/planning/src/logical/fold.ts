// Spec: 0002-planning-core FR-006
/**
 * The state of an item is the result of `fold`, a pure and total function from the events of the item (0037-planning FR-004): events are taken in the order of their id (a UUID version 7 sorts as text in the
 * order its time and its counter give), the first being the opening, and the same events in any order or with any repeats give the same item. Two events with one id are one event where their content is the
 * same and a conflict value where it is not; nothing is settled by taking either. The authority over each field (FR-012) is applied here, over the events, and not by overwriting a field: where the authority
 * of a field is `person-only`, a change by an agent or a tool waits as a proposal and changes nothing, and an agent that acts for a person is not that person. An item inferred by a heuristic or an agent
 * starts proposed and leaves that state only by a confirmation by a person (FR-006).
 *
 * @example
 * ```ts
 * import { fold } from "./fold.ts";
 * // const item = fold(events); item.kind === "ok" && item.value.state.kind
 * ```
 *
 * @module
 */
import { absurd, compact, err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Actor,
  type AuthorityField,
  type Core,
  DEFAULT_POLICY,
  type EventId,
  type Item,
  type ItemEvent,
  type ItemId,
  type Link,
  type OpenedData,
  type Policy,
  type State,
  type Waiting,
} from "@intellectual-frontiers/planning/governance";
import { canonical } from "./canonical.ts";

/** Why the events of an item are not an item: there are none, they are of two items, two with one id differ, or the first is not an opening. */
export type FoldProblem =
  | { readonly kind: "no-events" }
  | { readonly kind: "mixed-items"; readonly expected: ItemId; readonly found: ItemId }
  | { readonly kind: "conflict"; readonly ids: readonly EventId[] }
  | { readonly kind: "not-opened"; readonly first: EventId };

/** One sentence for a problem. */
export function describeFoldProblem(p: FoldProblem): string {
  switch (p.kind) {
    case "no-events":
      return "an item has no events: its first event is its opening";
    case "mixed-items":
      return `the events are of two items, ${p.expected} and ${p.found}`;
    case "conflict":
      return `the events ${p.ids.join(", ")} each exist with two contents: nothing is settled by taking either`;
    case "not-opened":
      return `the first event, ${p.first}, is not the opening of the item`;
    default:
      return absurd(p);
  }
}

const byId = (a: ItemEvent, b: ItemEvent): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The events with each id once, in the order of their id, or the ids that exist with two contents. */
export function orderEvents(events: readonly ItemEvent[]): Result<readonly ItemEvent[], FoldProblem> {
  const seen = new Map<EventId, { readonly event: ItemEvent; readonly text: string }>();
  const conflicts = new Set<EventId>();
  for (const event of events) {
    const text = canonical(event);
    const have = seen.get(event.id);
    if (have === undefined) seen.set(event.id, { event, text });
    else if (have.text !== text) conflicts.add(event.id);
  }
  if (conflicts.size > 0) return err({ kind: "conflict", ids: [...conflicts].sort(byText) });
  return ok([...seen.values()].map((s) => s.event).sort(byId));
}

type Touch = { readonly event: ItemEvent };

/** The fields an event changes. */
function fieldsOf(event: ItemEvent): readonly AuthorityField[] {
  const d = event.data;
  switch (d.type) {
    case "opened":
    case "commented":
    case "decided":
    case "linked":
    case "confirmed":
      return [];
    case "edited":
      return [...(d.title === undefined ? [] : (["title"] as const)), ...(d.body === undefined ? [] : (["body"] as const))];
    case "labeled":
      return ["labels"];
    case "assigned":
      return ["assignees"];
    case "severity-set":
      return ["severity"];
    case "blocker-set":
      return ["blocker"];
    case "started":
    case "deferred":
    case "closed":
    case "reopened":
      return ["state"];
    default:
      return absurd(d);
  }
}

/** The events of a field that count, and the changes that wait, under the authority over the field. */
function select(authority: Policy["authority"][AuthorityField], touching: readonly Touch[]): { readonly counted: readonly ItemEvent[]; readonly waiting: readonly ItemEvent[] } {
  const events = touching.map((t) => t.event);
  const rule = authority ?? "latest-wins";
  switch (rule) {
    case "latest-wins":
      return { counted: events, waiting: [] };
    case "source-wins": {
      const tools = events.filter((e) => e.actor.kind === "tool");
      return { counted: tools.length > 0 ? tools : events, waiting: [] };
    }
    case "store-wins": {
      const others = events.filter((e) => e.actor.kind !== "tool");
      return { counted: others.length > 0 ? others : events, waiting: [] };
    }
    case "person-only": {
      const persons = events.filter((e) => e.actor.kind === "person");
      const lastPerson = persons.at(-1);
      return { counted: persons, waiting: events.filter((e) => e.actor.kind !== "person" && (lastPerson === undefined || e.id > lastPerson.id)) };
    }
    default:
      return absurd(rule);
  }
}

/** The person an item's proposer acts for: the principal of an agent, or the person who ran a tool. */
function principalOf(actor: Actor): string | undefined {
  return actor.kind === "agent" ? actor.principal.id : actor.kind === "tool" ? actor.ranBy?.id : undefined;
}

/** The state after the events that count, from the state the opening gives. */
function stateOf(opening: ItemEvent, opened: OpenedData, counted: ReadonlySet<EventId>, ordered: readonly ItemEvent[], policy: Policy): State {
  let state: State = opened.origin === "inferred" ? { kind: "proposed" } : { kind: "open" };
  const proposer = principalOf(opening.actor);
  for (const e of ordered) {
    const d = e.data;
    switch (d.type) {
      case "confirmed":
        if (state.kind === "proposed" && e.actor.kind === "person" && (policy.confirmers === "any-person" || proposer === undefined || proposer === e.actor.id)) state = { kind: "open" };
        break;
      case "started":
        if (counted.has(e.id) && (state.kind === "open" || state.kind === "in-progress" || state.kind === "deferred")) state = { kind: "in-progress" };
        break;
      case "deferred":
        if (counted.has(e.id) && (state.kind === "open" || state.kind === "in-progress" || state.kind === "deferred")) state = { kind: "deferred", ...(d.until === undefined ? {} : { until: d.until }), ...(d.untilText === undefined ? {} : { untilText: d.untilText }) };
        break;
      case "closed":
        if (counted.has(e.id) && state.kind !== "proposed") state = { kind: "closed", reason: d.reason, at: e.at, by: e.actor };
        break;
      case "reopened":
        if (counted.has(e.id) && (state.kind === "closed" || state.kind === "deferred")) state = { kind: "open" };
        break;
      case "opened":
      case "commented":
      case "edited":
      case "labeled":
      case "assigned":
      case "severity-set":
      case "blocker-set":
      case "decided":
      case "linked":
        break;
      default:
        return absurd(d);
    }
  }
  return state;
}

/** The labels or assignees after the events that count: the opening's set, with each add and remove in order. */
function setOf(start: readonly string[], events: readonly ItemEvent[]): readonly string[] {
  const set = new Set(start);
  for (const e of events) {
    if (e.data.type === "labeled" || e.data.type === "assigned") {
      for (const x of e.data.add) set.add(x);
      for (const x of e.data.remove) set.delete(x);
    }
  }
  return [...set].sort(byText);
}

/** The links after the events: each add and remove in order, as a set sorted by kind and target. */
function linksOf(item: ItemId, ordered: readonly ItemEvent[]): readonly Link[] {
  const links = new Map<string, Link>();
  for (const e of ordered) {
    if (e.data.type !== "linked") continue;
    const key = `${e.data.link} ${e.data.to}`;
    if (e.data.change === "add") links.set(key, { kind: e.data.link, from: item, to: e.data.to });
    else links.delete(key);
  }
  return [...links.entries()].sort(([a], [b]) => byText(a, b)).map(([, l]) => l);
}

/** The item the events of one item make, or why they are not an item. */
export function fold(events: readonly ItemEvent[], policy: Policy = DEFAULT_POLICY): Result<Item, FoldProblem> {
  if (events.length === 0) return err({ kind: "no-events" });
  const ordered = orderEvents(events);
  if (ordered.kind === "err") return ordered;
  const all = ordered.value;
  const opening = all[0];
  if (opening === undefined) return err({ kind: "no-events" });
  const opened = opening.data;
  if (opened.type !== "opened") return err({ kind: "not-opened", first: opening.id });
  const other = all.find((e) => e.item !== opening.item);
  if (other !== undefined) return err({ kind: "mixed-items", expected: opening.item, found: other.item });
  const rest = all.slice(1);

  const touching = (field: AuthorityField): readonly Touch[] => rest.filter((e) => fieldsOf(e).includes(field)).map((event) => ({ event }));
  const chosen = (field: AuthorityField) => select(policy.authority[field], touching(field));
  const title = chosen("title");
  const body = chosen("body");
  const labels = chosen("labels");
  const assignees = chosen("assignees");
  const severity = chosen("severity");
  const blocker = chosen("blocker");
  const state = chosen("state");

  let titleValue = opened.title;
  for (const e of title.counted) if (e.data.type === "edited" && e.data.title !== undefined) titleValue = e.data.title;
  let bodyValue = opened.body;
  for (const e of body.counted) if (e.data.type === "edited" && e.data.body !== undefined) bodyValue = e.data.body;
  let severityValue = opened.severity;
  for (const e of severity.counted) if (e.data.type === "severity-set") severityValue = e.data.severity;
  let blockerValue = opened.blocker;
  for (const e of blocker.counted) if (e.data.type === "blocker-set") blockerValue = e.data.blocker;

  const waiting: Waiting[] = (
    [
      ["title", title],
      ["body", body],
      ["labels", labels],
      ["assignees", assignees],
      ["severity", severity],
      ["blocker", blocker],
      ["state", state],
    ] as const
  ).flatMap(([field, s]) => s.waiting.map((e): Waiting => ({ event: e.id, field, by: e.actor })));
  waiting.sort((a, b) => byText(a.event, b.event) || byText(a.field, b.field));

  const last = all.at(-1) ?? opening;
  const core: Core = compact({
    id: opening.item,
    title: titleValue,
    body: bodyValue,
    labels: setOf(opened.labels, labels.counted),
    assignees: setOf(opened.assignees, assignees.counted),
    severity: severityValue,
    origin: opened.origin,
    state: stateOf(opening, opened, new Set(state.counted.map((e) => e.id)), rest, policy),
    external: opening.external ?? [],
    links: linksOf(opening.item, rest),
    comments: rest.flatMap((e) => (e.data.type === "commented" ? [{ id: e.id, at: e.at, actor: e.actor, body: e.data.body }] : [])),
    decisions: rest.flatMap((e) => (e.data.type === "decided" ? [{ id: e.id, at: e.at, actor: e.actor, verdict: e.data.verdict, note: e.data.note }] : [])),
    waiting,
    openedBy: opening.actor,
    openedAt: opening.at,
    updatedAt: last.at,
    events: all,
    sourceSeverity: opened.sourceSeverity,
    motivation: opened.motivation,
    blocker: blockerValue,
    target: opened.target,
    source: opened.source,
    priority: opened.priority,
    size: opened.size,
    goals: opened.goals,
    engines: opened.engines,
    cites: opened.cites,
    evidence: opened.evidence,
  });
  return ok({ ...core, kind: opened.kind });
}
