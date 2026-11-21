// Spec: 0002-planning-core FR-007
/**
 * The links between items and the rule that the links of kind blocks make a graph with no cycle (0037-planning FR-009): a link that would close a cycle is refused with the items of the cycle named. The graph
 * is the order of core, `order`, which finds a cycle or an order in which each item comes after the items that block it.
 *
 * @example
 * ```ts
 * import { addLink } from "./links.ts";
 * // addLink(links, { kind: "blocks", from: a, to: b }) is a Result of the links, or of a cycle that names its items
 * ```
 *
 * @module
 */
import { err, ok, order, type Graph, type Result } from "@intellectual-frontiers/core";
import type { ItemId, Link } from "@intellectual-frontiers/planning/governance";

/** Why a link is refused: it would close a cycle of blocks, or it links an item to itself. */
export type LinkProblem = { readonly kind: "cycle"; readonly items: readonly ItemId[] } | { readonly kind: "self-link"; readonly item: ItemId };

/** The cycle of blocks among the links, its items in order, or nothing where there is none. */
export function findBlocksCycle(links: readonly Link[]): readonly ItemId[] | undefined {
  const needs = new Map<ItemId, ItemId[]>();
  for (const l of links) {
    if (l.kind !== "blocks") continue;
    needs.set(l.from, needs.get(l.from) ?? []);
    needs.set(l.to, [...(needs.get(l.to) ?? []), l.from]);
  }
  const graph: Graph<ItemId> = needs;
  const ordered = order(graph);
  return ordered.kind === "ok" ? undefined : ordered.error.nodes.slice(0, -1);
}

/** The links with one more, or why it is refused. Adding a link that is already there changes nothing. */
export function addLink(links: readonly Link[], link: Link): Result<readonly Link[], LinkProblem> {
  if (link.from === link.to) return err({ kind: "self-link", item: link.from });
  if (links.some((l) => l.kind === link.kind && l.from === link.from && l.to === link.to)) return ok(links);
  const next = [...links, link];
  const cycle = link.kind === "blocks" ? findBlocksCycle(next) : undefined;
  return cycle === undefined ? ok(next) : err({ kind: "cycle", items: cycle });
}
