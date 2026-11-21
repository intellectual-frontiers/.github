/**
 * The documented declarations of a script (commons data 0068-sql-docs FR-002, FR-006): each table with its columns and named constraints, view, index, common table expression and column added by `ALTER TABLE`, and
 * every other statement, with the documentation that its attached comments make.
 *
 * @example
 * ```ts
 * const decls = documentScript(parse("-- The people.\nCREATE TABLE person (\n  id INT -- the key\n)"));
 * decls[0]?.doc?.summary; // "The people."
 * decls[0]?.members[0]?.doc?.summary; // "the key"
 * ```
 *
 * Spec: 0068-sql-docs FR-002, FR-006
 *
 * @module
 */
import { type Comment, commentsOf, type Name, type Node, type Parsed, type Statement } from "../../mod.ts";
import { type Doc, type DocOptions, parseDoc } from "./doc.ts";
import { docText } from "./text.ts";

/** What a declaration declares. */
export type DeclarationKind = "table" | "column" | "constraint" | "view" | "index" | "cte" | "statement";

/** A documented part of a script. */
export interface Declaration {
  readonly kind: DeclarationKind;
  /** Its name as written, a qualified name's parts joined by a dot; the statement's kind for a statement that declares nothing. */
  readonly name: string;
  readonly node: Node;
  /** Its documentation, or none where no comment is attached as the specification says. */
  readonly doc: Doc | undefined;
  /** The comments the documentation is read from. */
  readonly comments: readonly Comment[];
  /** What it holds: a table's columns and constraints, a statement's common table expressions and added columns. */
  readonly members: readonly Declaration[];
}

const qualified = (n: Name): string => n.parts.map((p) => p.name).join(".");

/** The comments that document a node: those before it, then those after it on its line, and those after its name's. */
function commentsFor(p: Parsed, node: Node, name: Node | undefined): readonly Comment[] {
  const own = commentsOf(p.attachments, node);
  const named = name === undefined ? [] : commentsOf(p.attachments, name).trailing;
  return [...own.leading, ...own.trailing, ...named];
}

function make(
  p: Parsed,
  kind: DeclarationKind,
  name: string,
  node: Node,
  nameNode: Node | undefined,
  members: readonly Declaration[],
  options: DocOptions,
): Declaration {
  const comments = commentsFor(p, node, nameNode);
  const text = docText(comments);
  return { kind, name, node, doc: comments.length === 0 ? undefined : parseDoc(text, options), comments, members };
}

function statement(p: Parsed, s: Statement, options: DocOptions): Declaration {
  // eslint-disable-next-line ifc/switch-absurd, @typescript-eslint/switch-exhaustiveness-check -- a few kinds declare something; every other statement is documented as a statement
  switch (s.kind) {
    case "create-table": {
      const members: Declaration[] = [];
      for (const el of s.elements) {
        if (el.kind === "column-def") members.push(make(p, "column", el.name.name, el, undefined, [], options));
        else if (el.name !== undefined) members.push(make(p, "constraint", el.name.name, el, undefined, [], options));
      }
      return make(p, "table", qualified(s.name), s, s.name, members, options);
    }
    case "create-view":
      return make(p, "view", qualified(s.name), s, s.name, [], options);
    case "create-index":
      return make(p, "index", s.name === undefined ? qualified(s.table) : qualified(s.name), s, s.name, [], options);
    case "alter-table": {
      const members: Declaration[] = [];
      for (const a of s.actions)
        if (a.kind === "add-column") members.push(make(p, "column", a.column.name.name, a, undefined, [], options));
      return make(p, "statement", s.kind, s, s.table, members, options);
    }
    case "with":
      return make(
        p,
        "statement",
        s.kind,
        s,
        undefined,
        s.ctes.map((c) => make(p, "cte", c.name.name, c, undefined, [], options)),
        options,
      );
    default:
      return make(p, "statement", s.kind, s, undefined, [], options);
  }
}

/**
 * The documented declarations of a parse, in the order of the text.
 *
 * @param p - what `parse` gave
 * @param options - the dialect for the examples, and readers for a project's tags
 * @returns a declaration for each statement, with its members
 */
export function documentScript(p: Parsed, options: DocOptions = {}): readonly Declaration[] {
  return p.script.statements.map((s) => statement(p, s, options));
}
