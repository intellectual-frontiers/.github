/**
 * The attachment of comments to nodes (commons data 0066-sql-ast-parser FR-014, FR-015): one rule, the same in every dialect, gives each comment its node and its placement, so that the comment a person wrote
 * above a table or beside a column is found with that table or column.
 *
 * @remarks
 * The rule: the smallest node that contains the comment is its enclosing node. A comment on a line of its own that is followed by a child of the enclosing node is that child's `leading` comment, unless a blank
 * line follows it, when it is `detached` and the enclosing node's. A comment that shares its line with what precedes it is the `trailing` comment of the nearest child before it, or, where none precedes it, the
 * `leading` comment of the child after it. A comment with no child near it is `dangling` on the enclosing node, and an own-line comment with no child after it is the `trailing` comment of the last child before it.
 *
 * @example
 * ```ts
 * const { script, attachments } = parse("-- the people\nCREATE TABLE person (id INT)");
 * commentsOf(attachments, script.statements[0]!).leading[0]?.text; // " the people"
 * ```
 *
 * Spec: 0066-sql-ast-parser FR-014, FR-015
 *
 * @module
 */
import type { Node, Script } from "./ast.ts";
import type { Comment } from "./comment.ts";
import { children } from "./walk.ts";

/** Where a comment is, relative to its node. */
export type Placement = "leading" | "trailing" | "dangling" | "detached";

/** A comment, its node and its placement. */
export interface Attachment {
  readonly comment: Comment;
  readonly placement: Placement;
  readonly node: Node;
}

/** The comments of one node, by placement, in the order of the text. */
export interface NodeComments {
  readonly leading: readonly Comment[];
  readonly trailing: readonly Comment[];
  readonly dangling: readonly Comment[];
  readonly detached: readonly Comment[];
}

/** Every comment's attachment, and the attachments of each node. */
export interface CommentTable {
  /** One attachment for each comment, in the order of the text. */
  readonly all: readonly Attachment[];
  readonly byNode: ReadonlyMap<Node, readonly Attachment[]>;
}

/** The table of a text with no comments. */
export const NO_COMMENTS: CommentTable = { all: [], byNode: new Map() };

/**
 * The comments of a node by placement.
 *
 * @param table - the table of a parse
 * @param node - a node of that parse's tree
 * @returns its comments; empty where it has none
 */
export function commentsOf(table: CommentTable, node: Node): NodeComments {
  const list = table.byNode.get(node) ?? [];
  const of = (p: Placement): readonly Comment[] => list.filter((a) => a.placement === p).map((a) => a.comment);
  return { leading: of("leading"), trailing: of("trailing"), dangling: of("dangling"), detached: of("detached") };
}

/**
 * Attaches the comments of a text to the nodes of its tree.
 *
 * @param script - the tree, whose range is the whole text
 * @param comments - the comments of the text, in order
 * @returns the table
 */
export function attachComments(script: Script, comments: readonly Comment[]): CommentTable {
  if (comments.length === 0) return NO_COMMENTS;
  const all: Attachment[] = [];
  const byNode = new Map<Node, Attachment[]>();
  // the children of a node are made once, however many comments are inside it, and are in the order of the text
  const cache = new Map<Node, readonly Node[]>();
  const kidsOf = (n: Node): readonly Node[] => {
    const known = cache.get(n);
    if (known !== undefined) return known;
    const made = children(n);
    cache.set(n, made);
    return made;
  };
  for (const comment of comments) {
    const from = comment.span.start;
    const to = comment.span.end;
    let enclosing: Node = script;
    let preceding: Node | undefined;
    let following: Node | undefined;
    for (;;) {
      const kids = kidsOf(enclosing);
      // the first child that begins after the comment does; the child before it is the one that may contain it
      let lo = 0;
      let hi = kids.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if ((kids[mid]?.start ?? 0) <= from) lo = mid + 1;
        else hi = mid;
      }
      const before = lo > 0 ? kids[lo - 1] : undefined;
      if (before !== undefined && to <= before.end && before.start <= from) {
        enclosing = before;
        continue;
      }
      preceding = before !== undefined && before.end <= from ? before : undefined;
      const after = kids[lo];
      following = after !== undefined && after.start >= to ? after : undefined;
      break;
    }
    let placement: Placement;
    let node: Node;
    if (comment.ownLine) {
      if (following !== undefined) [placement, node] = comment.blankAfter ? ["detached", enclosing] : ["leading", following];
      else if (preceding !== undefined) [placement, node] = ["trailing", preceding];
      else [placement, node] = ["dangling", enclosing];
    } else if (preceding !== undefined) [placement, node] = ["trailing", preceding];
    else if (following !== undefined) [placement, node] = ["leading", following];
    else [placement, node] = ["dangling", enclosing];
    const a: Attachment = { comment, placement, node };
    all.push(a);
    const list = byNode.get(node);
    if (list === undefined) byNode.set(node, [a]);
    else list.push(a);
  }
  return { all, byNode };
}
