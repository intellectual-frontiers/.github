// Spec: 0001-core FR-005
/**
 * Graphs of work: an order in which each node comes after the nodes it needs (or the cycle that makes one impossible), and a schedule
 * that runs each node the moment the nodes it needs are done, as many at once as asked, skipping what depends on a failure and holding
 * back nothing else (0001-core FR-005). Taken from erga's `lib/ts/graph` (the build graph), with nodes of any string
 * type.
 *
 * @example
 * ```ts
 * import { order } from "./graph.ts";
 * order(new Map([["test", ["build"]], ["build", ["fetch"]], ["fetch", []]])); // { kind: "ok", value: ["fetch", "build", "test"] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "./result.ts";

/** A graph: each node and the nodes it needs. A needed node that is not a key of the graph is outside it, and ignored. */
export type Graph<N extends string> = ReadonlyMap<N, readonly N[]>;

/** A cycle among nodes: the nodes in it, in order, the first repeated at the end. */
export type Cycle<N extends string> = { readonly kind: "cycle"; readonly nodes: readonly N[] };

/** The nodes in an order where each comes after every node it needs; ties broken by name, so the order is the same every time. Or the first cycle found. */
export function order<N extends string>(graph: Graph<N>): Result<readonly N[], Cycle<N>> {
  const out: N[] = [];
  const state = new Map<N, "visiting" | "done">();
  const path: N[] = [];
  const visit = (n: N): Cycle<N> | undefined => {
    const s = state.get(n);
    if (s === "done") return undefined;
    if (s === "visiting") return { kind: "cycle", nodes: [...path.slice(path.indexOf(n)), n] };
    state.set(n, "visiting");
    path.push(n);
    for (const m of [...(graph.get(n) ?? [])].sort()) {
      if (!graph.has(m)) continue;
      const c = visit(m);
      if (c !== undefined) return c;
    }
    path.pop();
    state.set(n, "done");
    out.push(n);
    return undefined;
  };
  for (const n of [...graph.keys()].sort()) {
    const c = visit(n);
    if (c !== undefined) return err(c);
  }
  return ok(out);
}

/** How one node of a scheduled run ended. */
export type Ran = "done" | "failed" | "skipped";

/**
 * Every node of an acyclic graph run, each after the nodes it needs, at most `jobs` at once: `start` runs a node and says whether it
 * succeeded; a node whose needed node failed or was skipped is skipped, and `skip` is told which node it waited for. How each node ended.
 * A cycle, or a `start` that rejects, rejects the schedule.
 */
export async function schedule<N extends string>(
  graph: Graph<N>,
  jobs: number,
  start: (n: N) => Promise<boolean>,
  skip: (n: N, because: N) => void = () => {},
): Promise<ReadonlyMap<N, Ran>> {
  const ran = new Map<N, Ran>();
  const waiting = new Set(graph.keys());
  const inside = (n: N): readonly N[] => (graph.get(n) ?? []).filter((m) => graph.has(m));
  const limit = Math.max(1, Math.floor(jobs));
  let running = 0;
  let stopped = false;
  return await new Promise<ReadonlyMap<N, Ran>>((resolve, reject) => {
    const pump = (): void => {
      if (stopped) return;
      for (let changed = true; changed;) {
        changed = false;
        for (const n of [...waiting].sort()) {
          const before = inside(n);
          const bad = before.find((m) => ran.get(m) === "failed" || ran.get(m) === "skipped");
          if (bad !== undefined) {
            waiting.delete(n);
            ran.set(n, "skipped");
            skip(n, bad);
            changed = true;
            continue;
          }
          if (running >= limit || !before.every((m) => ran.get(m) === "done")) continue;
          waiting.delete(n);
          running++;
          start(n).then(
            (good) => {
              running--;
              ran.set(n, good ? "done" : "failed");
              pump();
            },
            (e: unknown) => {
              stopped = true;
              reject(e instanceof Error ? e : new Error(`the node ${n} failed to start`, { cause: e }));
            },
          );
        }
      }
      if (waiting.size === 0 && running === 0) resolve(ran);
      else if (running === 0) reject(new Error(`the graph has a cycle among ${[...waiting].sort().join(", ")}`));
    };
    pump();
  });
}
