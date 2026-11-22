// Spec: 0003-planning-reconcile FR-012
/**
 * The views of Planning (0037-planning FR-021): pure functions of the items. The roadmap puts each counted item after every item that blocks it; the graph of blocks and blocked by is the same relation both ways with
 * its cycle check; the matrix of requirement by item links each item to the requirement it cites (a citation such as `FR-014` or `0037-planning FR-014`) and finds a requirement with no item and an item that cites one
 * that does not exist; responsibility gives, for each person, the events their agents authored and the proposals of those agents that still wait.
 *
 * @example
 * ```ts
 * import { citationsOf } from "./views.ts";
 * citationsOf("see 0037-planning FR-014 and FR-002"); // ["0037-planning FR-014", "FR-002"]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { isCounted, type Item, type ItemId } from "@intellectual-frontiers/planning/governance";
import { findBlocksCycle } from "./links.ts";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Why a view cannot be made. */
export type ViewProblem = { readonly kind: "cycle"; readonly items: readonly ItemId[] };

/** The graph of blocks: for each counted item, what it blocks and what blocks it. */
export type BlockGraph = ReadonlyMap<ItemId, { readonly blocks: readonly ItemId[]; readonly blockedBy: readonly ItemId[] }>;

/** The graph of blocks of the counted items, or the items of a cycle. */
export function blockGraph(items: readonly Item[]): Result<BlockGraph, ViewProblem> {
  const counted = items.filter(isCounted);
  const ids = new Set(counted.map((i) => i.id));
  const edges = counted.flatMap((i) => i.links.filter((l) => l.kind === "blocks" && l.from === i.id && ids.has(l.to)));
  const cycle = findBlocksCycle(edges);
  if (cycle !== undefined) return err({ kind: "cycle", items: cycle });
  const graph = new Map<ItemId, { blocks: ItemId[]; blockedBy: ItemId[] }>(counted.map((i) => [i.id, { blocks: [], blockedBy: [] }]));
  for (const e of edges) {
    graph.get(e.from)?.blocks.push(e.to);
    graph.get(e.to)?.blockedBy.push(e.from);
  }
  for (const v of graph.values()) {
    v.blocks.sort(byText);
    v.blockedBy.sort(byText);
  }
  return ok(graph);
}

/** The counted items that are not closed, in an order that puts each after every item that blocks it (ties by id), or the items of a cycle. */
export function roadmap(items: readonly Item[]): Result<readonly Item[], ViewProblem> {
  const graph = blockGraph(items);
  if (graph.kind === "err") return graph;
  const live = new Map(items.filter((i) => isCounted(i) && i.state.kind !== "closed").map((i) => [i.id, i]));
  const waiting = new Map<ItemId, number>();
  for (const id of live.keys()) waiting.set(id, (graph.value.get(id)?.blockedBy ?? []).filter((b) => live.has(b)).length);
  const out: Item[] = [];
  const ready = [...live.keys()].filter((id) => waiting.get(id) === 0).sort(byText);
  while (ready.length > 0) {
    const id = ready.shift();
    const item = id === undefined ? undefined : live.get(id);
    if (id === undefined || item === undefined) break;
    out.push(item);
    for (const next of graph.value.get(id)?.blocks ?? []) {
      if (!live.has(next)) continue;
      const left = (waiting.get(next) ?? 0) - 1;
      waiting.set(next, left);
      if (left === 0) {
        ready.push(next);
        ready.sort(byText);
      }
    }
  }
  return ok(out);
}

/** The requirements a text cites: `FR-014` or `0037-planning FR-014`, in order of appearance, each once. */
export function citationsOf(text: string): readonly string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/(?:\b(\d{4}-[a-z][a-z0-9-]*)\s+)?\bFR-(\d{3})\b/gu)) {
    const c = m[1] === undefined ? `FR-${m[2]}` : `${m[1]} FR-${m[2]}`;
    if (!found.includes(c)) found.push(c);
  }
  return found;
}

/** A row of the matrix of requirement by item. */
export type RequirementRow = { readonly requirement: string; readonly items: readonly ItemId[] };

/** The matrix: each known requirement with the counted items that cite it, the requirements no item cites and the citations of a requirement that does not exist. */
export type RequirementMatrix = {
  readonly rows: readonly RequirementRow[];
  readonly uncovered: readonly string[];
  readonly unknown: readonly { readonly item: ItemId; readonly citation: string }[];
};

/** Links each item to the requirements it cites (its `cites`, its title and its body) among the requirements given as known. */
export function requirementMatrix(items: readonly Item[], known: readonly string[]): RequirementMatrix {
  const counted = items.filter(isCounted).sort((a, b) => byText(a.id, b.id));
  const cited = (i: Item): readonly string[] => [...new Set([...(i.cites ?? []).flatMap(citationsOf), ...citationsOf(i.title), ...citationsOf(i.body)])];
  const matches = (citation: string, requirement: string): boolean => citation === requirement || (!citation.includes(" ") && requirement.endsWith(` ${citation}`));
  const rows = known.map((requirement) => ({ requirement, items: counted.filter((i) => cited(i).some((c) => matches(c, requirement))).map((i) => i.id) }));
  const unknown = counted.flatMap((i) => cited(i).filter((c) => !known.some((k) => matches(c, k))).map((citation) => ({ item: i.id, citation })));
  return { rows, uncovered: rows.filter((r) => r.items.length === 0).map((r) => r.requirement), unknown };
}

/** What the agents of one person did and what of it waits. */
export type Responsibility = {
  readonly person: string;
  readonly byAgent: readonly { readonly agent: string; readonly events: number }[];
  readonly proposals: readonly { readonly item: ItemId; readonly agent: string }[];
};

/** For each person, the events their agents authored by agent, and the proposals of those agents that still wait (an item proposed, a change waiting for a person). */
export function responsibility(items: readonly Item[]): readonly Responsibility[] {
  const people = new Map<string, { agents: Map<string, number>; proposals: { item: ItemId; agent: string }[] }>();
  const of = (person: string) => {
    const have = people.get(person);
    if (have !== undefined) return have;
    const proposals: { item: ItemId; agent: string }[] = [];
    const fresh = { agents: new Map<string, number>(), proposals };
    people.set(person, fresh);
    return fresh;
  };
  for (const item of items) {
    for (const e of item.events) {
      if (e.actor.kind !== "agent") continue;
      const p = of(e.actor.principal.id);
      p.agents.set(e.actor.id, (p.agents.get(e.actor.id) ?? 0) + 1);
    }
    if (item.state.kind === "proposed" && item.openedBy.kind === "agent") of(item.openedBy.principal.id).proposals.push({ item: item.id, agent: item.openedBy.id });
    for (const w of item.waiting) if (w.by.kind === "agent") of(w.by.principal.id).proposals.push({ item: item.id, agent: w.by.id });
  }
  return [...people.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([person, v]) => ({
      person,
      byAgent: [...v.agents.entries()].sort(([a], [b]) => byText(a, b)).map(([agent, events]) => ({ agent, events })),
      proposals: v.proposals.sort((a, b) => byText(a.item, b.item) || byText(a.agent, b.agent)),
    }));
}
