// Spec: 0003-planning-reconcile FR-004
/**
 * The items of a set of events: each item's events folded under a policy, with the events whose histories are not one item named. Pure; the store of events and the tests both read items so.
 *
 * @example
 * ```ts
 * import { foldAll } from "./items.ts";
 * // foldAll(events, policy).items
 * ```
 *
 * @module
 */
import { DEFAULT_POLICY, type Item, type ItemEvent, type ItemId, type Policy } from "@intellectual-frontiers/planning/governance";
import { describeFoldProblem, fold } from "./fold.ts";

/** The items of the events, in the order of their ids, and a sentence for each item whose events are not one history. */
export function foldAll(events: readonly ItemEvent[], policy: Policy = DEFAULT_POLICY): { readonly items: readonly Item[]; readonly problems: readonly { readonly item: ItemId; readonly message: string }[] } {
  const by = new Map<ItemId, ItemEvent[]>();
  for (const e of events) by.set(e.item, [...(by.get(e.item) ?? []), e]);
  const items: Item[] = [];
  const problems: { item: ItemId; message: string }[] = [];
  for (const [id, list] of [...by.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const f = fold(list, policy);
    if (f.kind === "ok") items.push(f.value);
    else problems.push({ item: id, message: describeFoldProblem(f.error) });
  }
  return { items, problems };
}
