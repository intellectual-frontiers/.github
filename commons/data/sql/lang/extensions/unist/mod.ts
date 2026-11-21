/**
 * The syntax tree as a `unist` tree (commons data 0067-sql-ast-tools FR-009 to FR-013): `toUnist` projects a parse, its comments included, to nodes that carry a `type` (the kind), `children` or a `value`, a
 * `position` of `unist` points and a `data` of the fields that are not nodes, so that `unist-util-visit`, `unist-util-select` and the rest of the `unist` utilities read SQL as they read Markdown. An extension of
 * the SQL language core: it imports the core and nothing else, and the types are structural, so that nothing here depends on `@types/unist`.
 *
 * @remarks
 * A node with children has `children`, in the order of the text with the comments among them; an identifier, a number, a string, a boolean, `NULL` and a parameter have a `value`. A child says in its `data`
 * which field of its parent it is (`field`) and its place in a list (`index`), so nothing of the structure is lost. The children's types are the same for every kind (spec OQ-1).
 *
 * @limits
 * One way: a `unist` tree is not turned back into a syntax tree.
 *
 * @example
 * ```ts
 * import { visit } from "unist-util-visit";
 * const tree = toUnist(parse("SELECT a FROM t"));
 * visit(tree, "table", (t) => console.log(t.position?.start.line)); // 1
 * ```
 *
 * Spec: 0067-sql-ast-tools FR-009, FR-010, FR-011, FR-012, FR-013
 *
 * @module
 */
import { type Attachment, type Kind, type Node, type Parsed, lineIndex, positionAt } from "../../mod.ts";

/** A point of a `unist` position. */
export interface UnistPoint {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

/** The position of a `unist` node. */
export interface UnistPosition {
  readonly start: UnistPoint;
  readonly end: UnistPoint;
}

/** A node with children. */
export interface SqlParent {
  type: Kind;
  children: SqlChild[];
  data: Record<string, unknown>;
  position?: UnistPosition;
}

/** A node with a value. */
export interface SqlLiteral {
  type: Kind;
  value: string | boolean | null;
  data: Record<string, unknown>;
  position?: UnistPosition;
}

/** A comment. */
export interface SqlComment {
  type: "comment";
  value: string;
  data: Record<string, unknown>;
  position?: UnistPosition;
}

/** A child of a node. */
export type SqlChild = SqlParent | SqlLiteral | SqlComment;

/** What `toUnist` may be asked. */
export interface UnistOptions {
  /** Whether the comments are nodes of the tree (the default). */
  readonly comments?: boolean;
  /** Whether each node has a position (the default). */
  readonly positions?: boolean;
}

const LEAVES: ReadonlySet<string> = new Set(["ident", "number", "string", "boolean", "null", "param"]);

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string" && "start" in v;

function leafValue(n: Node): string | boolean | null {
  // eslint-disable-next-line ifc/switch-absurd, @typescript-eslint/switch-exhaustiveness-check -- only the kinds that have a value say it; every other kind has children and no value
  switch (n.kind) {
    case "ident":
      return n.name;
    case "number":
      return n.text;
    case "string":
      return n.value;
    case "boolean":
      return n.value;
    case "param":
      return n.text;
    default:
      return null;
  }
}

/** The scalar field that a leaf's `value` is made from, so that `data` does not say it twice. */
const VALUE_FIELD: Readonly<Record<string, string>> = { ident: "name", number: "text", string: "value", boolean: "value", param: "text" };

interface Context {
  readonly text: string;
  readonly index: ReturnType<typeof lineIndex>;
  readonly positions: boolean;
  readonly byEnclosing: ReadonlyMap<Node, readonly Attachment[]>;
}

function position(ctx: Context, start: number, end: number): UnistPosition | undefined {
  if (!ctx.positions) return undefined;
  return { start: positionAt(ctx.index, start), end: positionAt(ctx.index, end) };
}

const at = (pos: UnistPosition | undefined): { readonly position?: UnistPosition } => (pos === undefined ? {} : { position: pos });

function project(n: Node, ctx: Context, field: string | undefined, index: number | undefined): SqlParent | SqlLiteral {
  const data: Record<string, unknown> = {};
  if (field !== undefined) data["field"] = field;
  if (index !== undefined) data["index"] = index;
  const entries: [string, unknown][] = Object.entries(n);
  const leaf = LEAVES.has(n.kind);
  const items: { readonly start: number; readonly node: SqlChild }[] = [];
  for (const [key, v] of entries) {
    if (key === "kind" || key === "start" || key === "end" || v === undefined) continue;
    if (isNode(v)) {
      items.push({ start: v.start, node: project(v, ctx, key, undefined) });
    } else if (Array.isArray(v) && v.some(isNode)) {
      for (const [i, x] of v.entries()) if (isNode(x)) items.push({ start: x.start, node: project(x, ctx, key, i) });
    } else if (!(leaf && key === VALUE_FIELD[n.kind])) data[key] = v;
  }
  const pos = position(ctx, n.start, n.end);
  if (leaf) return { type: n.kind, value: leafValue(n), data, ...at(pos) };
  if (n.kind === "unparsed") data["source"] = ctx.text.slice(n.start, n.end);
  for (const a of ctx.byEnclosing.get(n) ?? []) items.push({ start: a.comment.span.start, node: commentNode(a, ctx) });
  items.sort((x, y) => x.start - y.start);
  return { type: n.kind, children: items.map((i) => i.node), data, ...at(pos) };
}

function commentNode(a: Attachment, ctx: Context): SqlComment {
  const c = a.comment;
  return {
    type: "comment",
    value: c.text,
    data: {
      style: c.style,
      marker: c.marker,
      placement: a.placement,
      ownLine: c.ownLine,
      blankAfter: c.blankAfter,
      terminated: c.terminated,
      attachedTo: { type: a.node.kind, start: a.node.start, end: a.node.end },
    },
    ...at(position(ctx, c.span.start, c.span.end)),
  };
}

/**
 * Projects a parse to a `unist` tree.
 *
 * @param parsed - what `parse` gave
 * @param options - whether to include comments and positions
 * @returns the tree, whose root is the `script` node
 */
export function toUnist(parsed: Parsed, options: UnistOptions = {}): SqlParent {
  const by = new Map<Node, Attachment[]>();
  if (options.comments !== false) {
    for (const a of parsed.attachments.all) {
      const list = by.get(a.enclosing);
      if (list === undefined) by.set(a.enclosing, [a]);
      else list.push(a);
    }
  }
  const ctx: Context = { text: parsed.text, index: lineIndex(parsed.text), positions: options.positions !== false, byEnclosing: by };
  const root = project(parsed.script, ctx, undefined, undefined);
  return "children" in root ? root : { type: "script", children: [], data: {} };
}
