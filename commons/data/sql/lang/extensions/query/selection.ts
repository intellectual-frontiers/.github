/**
 * Lazy typed selections of nodes (commons data 0067-sql-ast-tools FR-006): `select(root)` begins one, each method makes another over what the last gives, and the kind a method is given types the result.
 *
 * Spec: 0067-sql-ast-tools FR-006
 *
 * @module
 */
import { children, type Kind, type Node, type NodeOf, walk } from "../../mod.ts";
import { ancestors, type ParentIndex, parentIndex } from "./parents.ts";

/** A lazy set of nodes of one type, in the order they were found; it can be read again. */
export class Selection<T extends Node> implements Iterable<T> {
  private readonly run: () => Iterable<T>;
  private readonly parents: () => ParentIndex;

  constructor(run: () => Iterable<T>, parents: () => ParentIndex) {
    this.run = run;
    this.parents = parents;
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this.run();
  }

  /** The children of each node. */
  children(): Selection<Node> {
    const run = this.run;
    return new Selection<Node>(function* () {
      for (const n of run()) yield* children(n);
    }, this.parents);
  }

  /** Every node below each node, in the order of the text. */
  descendants(): Selection<Node> {
    const run = this.run;
    return new Selection<Node>(function* () {
      for (const n of run()) {
        const found: Node[] = [];
        walk(n, {
          enter: (d) => {
            if (d !== n) found.push(d);
            return undefined;
          },
        });
        yield* found;
      }
    }, this.parents);
  }

  /** The nodes of a kind below each node, typed as that kind. */
  find<K extends Kind>(kind: K): Selection<NodeOf<K>> {
    return this.descendants().ofKind(kind);
  }

  /** The nodes of a kind among these, typed as that kind. */
  ofKind<K extends Kind>(kind: K): Selection<NodeOf<K>> {
    const run = this.run;
    return new Selection<NodeOf<K>>(function* () {
      for (const n of run()) if (isKind(n, kind)) yield n;
    }, this.parents);
  }

  /** The nodes for which a test holds; a type guard types the result. */
  where<U extends T>(test: (n: T) => n is U): Selection<U>;
  where(test: (n: T) => boolean): Selection<T>;
  where(test: (n: T) => boolean): Selection<T> {
    const run = this.run;
    return new Selection<T>(function* () {
      for (const n of run()) if (test(n)) yield n;
    }, this.parents);
  }

  /** What `f` makes of each node; a node it makes nothing of (`undefined`) is left out. */
  map<U extends Node>(f: (n: T) => U | undefined): Selection<U> {
    const run = this.run;
    return new Selection<U>(function* () {
      for (const n of run()) {
        const u = f(n);
        if (u !== undefined) yield u;
      }
    }, this.parents);
  }

  /** The nodes `f` makes of each node, one after the other. */
  flatMap<U extends Node>(f: (n: T) => Iterable<U>): Selection<U> {
    const run = this.run;
    return new Selection<U>(function* () {
      for (const n of run()) yield* f(n);
    }, this.parents);
  }

  /** The parent of each node. */
  parent(): Selection<Node> {
    const run = this.run;
    const parents = this.parents;
    return new Selection<Node>(function* () {
      const index = parents();
      for (const n of run()) {
        const p = index.get(n);
        if (p !== undefined) yield p;
      }
    }, parents);
  }

  /** The ancestors of each node, nearest first. */
  ancestors(): Selection<Node> {
    const run = this.run;
    const parents = this.parents;
    return new Selection<Node>(function* () {
      const index = parents();
      for (const n of run()) yield* ancestors(index, n);
    }, parents);
  }

  /** For each node, the nearest of it and its ancestors that is of the kind. */
  closest<K extends Kind>(kind: K): Selection<NodeOf<K>> {
    const run = this.run;
    const parents = this.parents;
    return new Selection<NodeOf<K>>(function* () {
      const index = parents();
      for (const n of run()) {
        if (isKind(n, kind)) {
          yield n;
          continue;
        }
        for (const a of ancestors(index, n)) {
          if (isKind(a, kind)) {
            yield a;
            break;
          }
        }
      }
    }, parents);
  }

  /** The nodes with the repeats left out. */
  unique(): Selection<T> {
    const run = this.run;
    return new Selection<T>(function* () {
      const seen = new Set<T>();
      for (const n of run())
        if (!seen.has(n)) {
          seen.add(n);
          yield n;
        }
    }, this.parents);
  }

  /** The nodes, in an array. */
  toArray(): T[] {
    return [...this.run()];
  }

  /** The first node, or `undefined`. */
  first(): T | undefined {
    for (const n of this.run()) return n;
    return undefined;
  }

  /** How many nodes. */
  count(): number {
    let n = 0;
    for (const _ of this.run()) n++;
    return n;
  }

  /** Whether a test holds for some node. */
  some(test: (n: T) => boolean): boolean {
    for (const n of this.run()) if (test(n)) return true;
    return false;
  }

  /** Whether a test holds for every node. */
  every(test: (n: T) => boolean): boolean {
    for (const n of this.run()) if (!test(n)) return false;
    return true;
  }
}

const isKind = <K extends Kind>(n: Node, kind: K): n is NodeOf<K> => n.kind === kind;

/**
 * Begins a selection with one node.
 *
 * @param root - the node, usually a script
 * @returns a selection of it; its parents are found once, when one is first asked for
 */
export function select(root: Node): Selection<Node> {
  let index: ParentIndex | undefined;
  const parents = (): ParentIndex => (index ??= parentIndex(root));
  return new Selection<Node>(() => [root], parents);
}
