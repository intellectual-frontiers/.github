/**
 * The parent of each node (commons data 0067-sql-ast-tools FR-005): nodes do not hold their parent, so a program that needs it makes this table once for a tree and reads it.
 *
 * Spec: 0067-sql-ast-tools FR-005
 *
 * @module
 */
import { type Node, walk } from "../../mod.ts";

/** The parent of each node of one tree; the root has none. */
export type ParentIndex = ReadonlyMap<Node, Node>;

/**
 * Makes the table from each node of a tree to its parent.
 *
 * @param root - the tree
 * @returns the table
 */
export function parentIndex(root: Node): ParentIndex {
  const index = new Map<Node, Node>();
  walk(root, {
    enter: (n, parent) => {
      if (parent !== undefined) index.set(n, parent);
      return undefined;
    },
  });
  return index;
}

/** The parent of a node, or `undefined` for the root. */
export function parentOf(index: ParentIndex, node: Node): Node | undefined {
  return index.get(node);
}

/** The ancestors of a node, nearest first. */
export function* ancestors(index: ParentIndex, node: Node): Iterable<Node> {
  for (let p = index.get(node); p !== undefined; p = index.get(p)) yield p;
}
