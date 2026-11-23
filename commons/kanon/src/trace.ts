// Spec: 0002-kanon-content-checks FR-002, FR-003
/**
 * Trace edges are valid only between adjacent layers in projection order.
 * The same graph supports model validation and disposition accounting.
 *
 * @module
 */
import type { ElementId, LayeredModel, ModelElement, TraceEdge } from "./model.ts";
import { RANK } from "./table.ts";

export type TraceGraph = {
  readonly invalid: readonly TraceEdge[];
  readonly downstreamOf: (sources: readonly ElementId[]) => ReadonlySet<ElementId>;
};

export function traceGraph(model: LayeredModel, byId: ReadonlyMap<ElementId, ModelElement>): TraceGraph {
  const next = new Map<ElementId, ElementId[]>();
  const invalid: TraceEdge[] = [];
  for (const edge of model.trace) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined || RANK[to.layer] !== RANK[from.layer] + 1) {
      invalid.push(edge);
      continue;
    }
    const targets = next.get(edge.from) ?? [];
    targets.push(edge.to);
    next.set(edge.from, targets);
  }
  return {
    invalid,
    downstreamOf(sources) {
      const pending = [...sources];
      const reached = new Set<ElementId>();
      for (const from of pending) {
        for (const to of next.get(from) ?? []) {
          if (reached.has(to)) continue;
          reached.add(to);
          pending.push(to);
        }
      }
      return reached;
    },
  };
}
