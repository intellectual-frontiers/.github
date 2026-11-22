// Spec: 0002-planning-core FR-005
/**
 * The events of an item (0037-planning FR-003): each one case of the closed union of fourteen types, with an id, the item it is of, a time and an actor, and the data its source wrote. An event is immutable
 * once built (it is frozen), and the library has no operation that changes or removes one: the history of an item is the set of its events, and its state is a fold of them. `makeEvent` is the one way to
 * build an event and returns a `Result`: an event of an agent with no principal, a confirmation by anything but a person and a link of an item to itself are refused.
 *
 * @example
 * ```ts
 * import { makeEvent } from "./event.ts";
 * // makeEvent({ id, item, at, actor }, { type: "commented", body: "Seen." }) is a Result of an event
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Actor, type ActorProblem, checkActor } from "./actor.ts";
import type { Day, Instant } from "./time.ts";
import type { EventId, ExternalId, ItemId } from "./ids.ts";
import type { CloseReason, ItemKind, LinkKind, Origin, Severity, Verdict } from "./vocab.ts";

/** What a record is about: a file, a page and a quoted text (a Web Annotation target). */
export type Target = { readonly file?: string; readonly page?: number; readonly quote?: string };

/** What a tool's finding says of where it was found (a SARIF result: the tool, the rule, the file and the line), with any other member the source wrote. */
export type FindingSource = { readonly [key: string]: string | number | boolean | null };

/** The fields a source may carry of an item beyond the core, each as the source wrote it (0037-planning FR-046). */
export type Carried = {
  /** The severity as the source wrote it, where it has more levels than the three of `Severity`. */
  readonly sourceSeverity?: string;
  /** The Web Annotation motivation, as a name. */
  readonly motivation?: string;
  readonly blocker?: boolean;
  readonly target?: Target;
  readonly source?: FindingSource;
  readonly priority?: string;
  readonly size?: string;
  readonly goals?: readonly string[];
  readonly engines?: readonly string[];
  readonly cites?: readonly string[];
  readonly evidence?: readonly string[];
};

/** The opening of an item: its kind, text, labels, assignees and origin, and what the source carried. */
export type OpenedData = {
  readonly type: "opened";
  readonly kind: ItemKind;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly origin: Origin;
  readonly severity?: Severity;
} & Carried;

/** What happened to an item, by its `type`. */
export type EventData =
  | OpenedData
  | { readonly type: "commented"; readonly body: string }
  | { readonly type: "edited"; readonly title?: string; readonly body?: string }
  | { readonly type: "labeled"; readonly add: readonly string[]; readonly remove: readonly string[] }
  | { readonly type: "assigned"; readonly add: readonly string[]; readonly remove: readonly string[] }
  | { readonly type: "severity-set"; readonly severity: Severity }
  | { readonly type: "blocker-set"; readonly blocker: boolean }
  | { readonly type: "started" }
  | { readonly type: "deferred"; readonly until?: Day; readonly untilText?: string; readonly reason?: string }
  | { readonly type: "closed"; readonly reason: CloseReason }
  | { readonly type: "reopened" }
  | { readonly type: "decided"; readonly verdict: Verdict; readonly note: string }
  | { readonly type: "linked"; readonly change: "add" | "remove"; readonly link: LinkKind; readonly to: ItemId }
  | { readonly type: "confirmed" };

/** What every event has: its id, the item it is of, its time, its actor, and the ids it has in the places it was read from. */
export type EventHead = { readonly id: EventId; readonly item: ItemId; readonly at: Instant; readonly actor: Actor; readonly external?: readonly ExternalId[] };

/** One event of an item: immutable. */
export type ItemEvent = EventHead & { readonly data: EventData };

/** Why an event is refused. */
export type EventProblem =
  | { readonly kind: "actor"; readonly problem: ActorProblem }
  | { readonly kind: "confirmed-by-a-non-person"; readonly actor: string }
  | { readonly kind: "link-to-itself"; readonly item: ItemId };

/** One sentence for a refusal. */
export function describeEventProblem(p: EventProblem): string {
  switch (p.kind) {
    case "actor":
      return `the actor is refused: ${p.problem.kind}`;
    case "confirmed-by-a-non-person":
      return `${p.actor} cannot confirm an item: only a person confirms`;
    case "link-to-itself":
      return `the item ${p.item} cannot be linked to itself`;
    default:
      return absurd(p);
  }
}

/** Freezes a value and everything it holds. */
export function freezeDeep<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) freezeDeep(inner);
  }
  return value;
}

/** The event, built, or why it is refused. The actor is checked as a value that came from outside, whatever its type says. */
export function makeEvent(head: EventHead, data: EventData): Result<ItemEvent, EventProblem> {
  const actor = checkActor(head.actor);
  if (actor.kind === "err") return err({ kind: "actor", problem: actor.error });
  if (data.type === "confirmed" && actor.value.kind !== "person") return err({ kind: "confirmed-by-a-non-person", actor: actor.value.id });
  if (data.type === "linked" && data.to === head.item) return err({ kind: "link-to-itself", item: head.item });
  const external = head.external === undefined ? {} : { external: head.external };
  return ok(freezeDeep(structuredClone({ id: head.id, item: head.item, at: head.at, actor: actor.value, ...external, data })));
}
