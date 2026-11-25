// Spec: 0013-form-graph FR-004, FR-005
/**
 * The order of a graph: the jobs in an order in which each comes after the jobs it names (a stable topological order: of the jobs that may come next, the one written first goes first, so the same graph gives the same order), the
 * cycle among the jobs where there is one, and the jobs a set of nodes comes after, directly or not. An edge to an id that is no job is left out here and found by the check. Pure.
 *
 * @example
 * ```ts
 * import { orderOf } from "./order.ts";
 * // orderOf(graph).map((n) => n.id): the ids in the order a runner that has no jobs carries them
 * ```
 *
 * @module
 */
import { isJob, type Graph, type JobNode } from "./node.ts";

/** The jobs of a graph, in the order they are written. */
export const jobsOf = (graph: Graph): readonly JobNode[] => graph.nodes.filter(isJob);

/** The jobs of a graph in a stable topological order; the jobs of a cycle, and those after them, are not in it. */
export function orderOf(graph: Graph): readonly JobNode[] {
  const jobs = jobsOf(graph);
  const ids = new Set(jobs.map((j) => String(j.id)));
  const done = new Set<string>();
  const out: JobNode[] = [];
  for (let progressed = true; progressed; ) {
    progressed = false;
    const next = jobs.find((j) => !done.has(j.id) && j.after.every((a) => !ids.has(a) || done.has(a)));
    if (next !== undefined) {
      done.add(next.id);
      out.push(next);
      progressed = true;
    }
  }
  return out;
}

/** The ids of one cycle among the jobs, the first id repeated at the end, or nothing where there is none. */
export function cycleOf(graph: Graph): readonly string[] | undefined {
  const jobs = new Map(jobsOf(graph).map((j) => [String(j.id), j]));
  const state = new Map<string, "open" | "closed">();
  const path: string[] = [];
  const visit = (id: string): readonly string[] | undefined => {
    state.set(id, "open");
    path.push(id);
    for (const a of jobs.get(id)?.after ?? []) {
      if (!jobs.has(a)) continue;
      if (state.get(a) === "open") return [...path.slice(path.indexOf(a)), a];
      if (state.get(a) === undefined) {
        const found = visit(a);
        if (found !== undefined) return found;
      }
    }
    path.pop();
    state.set(id, "closed");
    return undefined;
  };
  for (const id of jobs.keys()) {
    if (state.get(id) !== undefined) continue;
    const found = visit(id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The ids of the jobs that `ids` come after, directly or not, with `ids` themselves. */
export function upstreamOf(graph: Graph, ids: readonly string[]): ReadonlySet<string> {
  const jobs = new Map(jobsOf(graph).map((j) => [String(j.id), j]));
  const seen = new Set<string>();
  const stack = [...ids];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    if (seen.has(id) || !jobs.has(id)) continue;
    seen.add(id);
    stack.push(...(jobs.get(id)?.after ?? []));
  }
  return seen;
}
