/**
 * Walks over a tree (commons data 0066-sql-ast-parser FR-016): the children of a node in the order of the text, a depth-first walk with `enter` and `leave`, the nodes of one kind typed as that kind, and a fold
 * from the leaves. `children` is one `switch` on `kind` that ends with `absurd`, so a kind added to the tree does not compile until it says what its children are.
 *
 * @example
 * ```ts
 * const tables = findAll(script, "table").map((t) => t.name.parts.map((p) => p.name).join("."));
 * ```
 *
 * Spec: 0066-sql-ast-parser FR-016
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Kind, Node, NodeOf } from "./ast.ts";

const opt = (out: Node[], n: Node | undefined): void => {
  if (n !== undefined) out.push(n);
};
const byStart = (a: Node, b: Node): number => a.start - b.start;
const all = (out: Node[], ns: readonly Node[]): void => {
  for (const n of ns) out.push(n);
};

/**
 * The children of a node: every node in one of its fields, in the order of the text.
 *
 * @param n - a node
 * @returns its children
 */
export function children(n: Node): readonly Node[] {
  const out: Node[] = [];
  switch (n.kind) {
    case "ident":
    case "command":
    case "number":
    case "string":
    case "boolean":
    case "null":
    case "param":
    case "unparsed":
      break;
    case "name":
      all(out, n.parts);
      break;
    case "star":
      opt(out, n.qualifier);
      break;
    case "unary":
      out.push(n.arg);
      break;
    case "binary":
    case "operator":
      out.push(n.left, n.right);
      break;
    case "is":
      out.push(n.arg);
      opt(out, n.other);
      break;
    case "between":
      out.push(n.arg, n.low, n.high);
      break;
    case "in":
      out.push(n.arg);
      all(out, n.values);
      break;
    case "in-query":
      out.push(n.arg, n.query);
      break;
    case "like":
      out.push(n.arg, n.pattern);
      opt(out, n.escape);
      break;
    case "when":
      out.push(n.cond, n.result);
      break;
    case "case":
      opt(out, n.operand);
      all(out, n.whens);
      opt(out, n.otherwise);
      break;
    case "cast":
      out.push(n.arg, n.type);
      break;
    case "extract":
      out.push(n.arg);
      break;
    case "interval":
      out.push(n.value);
      break;
    case "named-arg":
      out.push(n.name, n.value);
      break;
    case "call":
      out.push(n.name);
      all(out, n.args);
      opt(out, n.filter);
      opt(out, n.over);
      break;
    case "exists":
    case "scalar-query":
      out.push(n.query);
      break;
    case "tuple":
    case "array":
      all(out, n.items);
      break;
    case "subscript":
      out.push(n.arg, n.index);
      break;
    case "collate":
      out.push(n.arg, n.collation);
      break;
    case "frame-bound":
      opt(out, n.offset);
      break;
    case "frame":
      out.push(n.from);
      opt(out, n.to);
      break;
    case "window-spec":
      opt(out, n.base);
      all(out, n.partitionBy);
      all(out, n.orderBy);
      opt(out, n.frame);
      break;
    case "order-item":
      out.push(n.expr);
      break;
    case "select-item":
      out.push(n.expr);
      opt(out, n.alias);
      break;
    case "select":
      all(out, n.items);
      all(out, n.from);
      opt(out, n.where);
      all(out, n.groupBy);
      opt(out, n.having);
      all(out, n.orderBy);
      opt(out, n.limit);
      opt(out, n.offset);
      out.sort(byStart); // `OFFSET` may come before `FETCH`, `LIMIT` before `OFFSET`
      break;
    case "set-op":
      out.push(n.left, n.right);
      all(out, n.orderBy);
      opt(out, n.limit);
      opt(out, n.offset);
      out.sort(byStart);
      break;
    case "values":
      all(out, n.rows);
      break;
    case "cte":
      out.push(n.name);
      all(out, n.columns);
      out.push(n.query);
      break;
    case "with":
      all(out, n.ctes);
      out.push(n.body);
      break;
    case "alias":
      out.push(n.name);
      all(out, n.columns);
      break;
    case "table":
      out.push(n.name);
      opt(out, n.alias);
      break;
    case "subquery":
      out.push(n.query);
      opt(out, n.alias);
      break;
    case "table-fn":
      out.push(n.call);
      opt(out, n.alias);
      break;
    case "join":
      out.push(n.left, n.right);
      opt(out, n.on);
      all(out, n.using);
      break;
    case "insert":
      out.push(n.table);
      all(out, n.columns);
      opt(out, n.source);
      all(out, n.returning);
      break;
    case "assignment":
      out.push(n.target, n.value);
      break;
    case "update":
      out.push(n.table);
      all(out, n.assignments);
      all(out, n.from);
      opt(out, n.where);
      all(out, n.returning);
      break;
    case "delete":
      out.push(n.table);
      opt(out, n.where);
      all(out, n.returning);
      break;
    case "data-type":
      all(out, n.args);
      break;
    case "not-null":
      opt(out, n.name);
      break;
    case "default":
      opt(out, n.name);
      out.push(n.expr);
      break;
    case "primary-key":
    case "unique":
      opt(out, n.name);
      all(out, n.columns);
      break;
    case "check":
      opt(out, n.name);
      out.push(n.expr);
      break;
    case "reference":
      out.push(n.table);
      all(out, n.columns);
      break;
    case "foreign-key":
      opt(out, n.name);
      all(out, n.columns);
      out.push(n.reference);
      break;
    case "column-def":
      out.push(n.name, n.type);
      all(out, n.constraints);
      break;
    case "create-table":
      out.push(n.name);
      all(out, n.elements);
      opt(out, n.query);
      break;
    case "create-index":
      opt(out, n.name);
      out.push(n.table);
      all(out, n.items);
      opt(out, n.where);
      break;
    case "create-view":
      out.push(n.name);
      all(out, n.columns);
      out.push(n.query);
      break;
    case "add-column":
      out.push(n.column);
      break;
    case "drop-column":
    case "drop-constraint":
      out.push(n.name);
      break;
    case "add-constraint":
      out.push(n.constraint);
      break;
    case "rename-table":
      out.push(n.to);
      break;
    case "rename-column":
      out.push(n.from, n.to);
      break;
    case "alter-table":
      out.push(n.table);
      all(out, n.actions);
      break;
    case "drop":
      all(out, n.names);
      break;
    case "script":
      all(out, n.statements);
      break;
    default:
      return absurd(n);
  }
  return out;
}

/** What a walk calls at each node. */
export interface Visitor {
  /** Called before a node's children; returning `false` skips them (and `leave`). */
  readonly enter?: (node: Node, parent: Node | undefined) => boolean | undefined;
  /** Called after a node's children. */
  readonly leave?: (node: Node, parent: Node | undefined) => void;
}

function visit(node: Node, parent: Node | undefined, v: Visitor): void {
  if (v.enter?.(node, parent) === false) return;
  for (const c of children(node)) visit(c, node, v);
  v.leave?.(node, parent);
}

/**
 * Walks a tree depth first.
 *
 * @param root - where to begin
 * @param visitor - what to call at each node
 */
export function walk(root: Node, visitor: Visitor): void {
  visit(root, undefined, visitor);
}

const isKind = <K extends Kind>(n: Node, kind: K): n is NodeOf<K> => n.kind === kind;

/**
 * Every node of one kind in a tree, in the order of the text, typed as that kind.
 *
 * @param root - the tree
 * @param kind - a kind of node
 * @returns the nodes of that kind
 */
export function findAll<K extends Kind>(root: Node, kind: K): readonly NodeOf<K>[] {
  const out: NodeOf<K>[] = [];
  walk(root, {
    enter: (n) => {
      if (isKind(n, kind)) out.push(n);
      return undefined;
    },
  });
  return out;
}

/**
 * Combines a tree from its leaves: each node's result is made from the node and its children's results.
 *
 * @param root - the tree
 * @param f - the combination
 * @returns the root's result
 */
export function fold<R>(root: Node, f: (node: Node, results: readonly R[]) => R): R {
  return f(
    root,
    children(root).map((c) => fold(c, f)),
  );
}
