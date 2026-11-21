// Spec: 0002-planning-core FR-002
/**
 * An item and what is folded from its events (0037-planning FR-001, FR-004): a sum of the kinds of item over one shared core, a state that is never stored as a fact, the links, the comments, the decisions
 * and the changes that wait. A kind MAY add fields of its own and none removes a field of the core; today every kind is the core.
 *
 * @example
 * ```ts
 * import type { Item } from "./item.ts";
 * const open = (i: Item) => i.state.kind === "open";
 * ```
 *
 * @module
 */
import type { Actor } from "./actor.ts";
import type { Carried, ItemEvent } from "./event.ts";
import type { Day, Instant } from "./time.ts";
import type { EventId, ExternalId, ItemId } from "./ids.ts";
import type { AuthorityField, CloseReason, FieldAuthority, ItemKind, LinkKind, Origin, Severity, Verdict } from "./vocab.ts";

/** The state of an item: a fold of its events, never stored. */
export type State =
  | { readonly kind: "proposed" }
  | { readonly kind: "open" }
  | { readonly kind: "in-progress" }
  | { readonly kind: "deferred"; readonly until: Day }
  | { readonly kind: "closed"; readonly reason: CloseReason; readonly at: Instant; readonly by: Actor };

/** A link of one item to another: the first blocks, is the same as, relates to or is the parent of the second. */
export type Link = { readonly kind: LinkKind; readonly from: ItemId; readonly to: ItemId };

/** A remark on an item. */
export type Comment = { readonly id: EventId; readonly at: Instant; readonly actor: Actor; readonly body: string };

/** A verdict given on an item. */
export type Decision = { readonly id: EventId; readonly at: Instant; readonly actor: Actor; readonly verdict: Verdict; readonly note: string };

/** A change that an agent or a tool made to a field whose authority is `person-only`: it waits, and changes nothing, until a person makes the change. */
export type Waiting = { readonly event: EventId; readonly field: AuthorityField; readonly by: Actor };

/** What every item has, whatever its kind: the shared core, with what its source carried. */
export type Core = {
  readonly id: ItemId;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly severity?: Severity;
  readonly origin: Origin;
  readonly state: State;
  readonly external: readonly ExternalId[];
  readonly links: readonly Link[];
  readonly comments: readonly Comment[];
  readonly decisions: readonly Decision[];
  readonly waiting: readonly Waiting[];
  readonly openedBy: Actor;
  readonly openedAt: Instant;
  readonly updatedAt: Instant;
  /** Its events, in the order they are folded. */
  readonly events: readonly ItemEvent[];
} & Carried;

/** An item of one kind. */
export type ItemOf<K extends ItemKind> = Core & { readonly kind: K };

/** An item: a sum of the kinds over the shared core. */
export type Item = { readonly [K in ItemKind]: ItemOf<K> }[ItemKind];

/** The authority over each field that a configuration sets, and who may confirm a proposal (0037-planning FR-006, FR-012). A field with no authority is `latest-wins`. */
export type Policy = {
  readonly authority: { readonly [F in AuthorityField]?: FieldAuthority };
  /** `any-person`: any person confirms a proposal; `principal`: only the principal of the event that proposed it. */
  readonly confirmers: "any-person" | "principal";
};

/** The policy where a configuration says nothing. */
export const DEFAULT_POLICY: Policy = { authority: {}, confirmers: "any-person" };

/** Whether an item is counted by a view or a query that is not told to include proposals (0037-planning FR-006). */
export function isCounted(item: Item): boolean {
  return item.state.kind !== "proposed";
}
