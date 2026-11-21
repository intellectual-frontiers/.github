/**
 * Named analyses of a syntax tree (commons data 0067-sql-ast-tools FR-007, FR-008): the tables a script reads, writes, creates, alters and drops, the functions it calls, and whether it is read-only.
 *
 * @remarks
 * A single name that is the name of a common table expression in scope is not a table. A common table expression is in scope in the body of its `WITH`, in the common table expressions after it, and, where the
 * `WITH` is recursive, in its own and the others'. Names are compared without regard to case where they are not quoted, and as written where they are.
 *
 * @example
 * ```ts
 * readOnlyProblem(parse("DELETE FROM t").script); // "it holds a DELETE"
 * ```
 *
 * Spec: 0067-sql-ast-tools FR-007, FR-008
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Call, children, findAll, type Ident, type Name, type Node, type Script } from "../../mod.ts";

/** What a script does to a table. */
export type TableAccess = "read" | "write" | "create" | "alter" | "drop";

/** One use of a table: its name as written, what is done to it, and the node. */
export interface TableUse {
  readonly name: readonly string[];
  readonly access: TableAccess;
  readonly node: Node;
}

/** One call of a function. */
export interface FunctionCall {
  readonly name: readonly string[];
  readonly node: Call;
}

const parts = (n: Name): readonly string[] => n.parts.map((p) => p.name);
const key = (i: Ident): string => (i.quoted ? `q:${i.name}` : `u:${i.name.toLowerCase()}`);

/**
 * Every use of a table in a tree, in the order of the text.
 *
 * @param root - a script, a statement or any node
 * @returns the uses
 */
export function tableUses(root: Node): readonly TableUse[] {
  const out: TableUse[] = [];
  const kids = (n: Node, scope: ReadonlySet<string>, skip?: Node): void => {
    for (const c of children(n)) if (c !== skip) visit(c, scope);
  };
  const visit = (n: Node, scope: ReadonlySet<string>): void => {
    // eslint-disable-next-line ifc/switch-absurd, @typescript-eslint/switch-exhaustiveness-check -- a few kinds say something about tables; every other kind only has its children visited
    switch (n.kind) {
      case "with": {
        const names = n.ctes.map((c) => key(c.name));
        for (const [i, cte] of n.ctes.entries()) {
          const visible = new Set(scope);
          for (const [j, name] of names.entries()) if (j < i || n.recursive) visible.add(name);
          visit(cte.query, visible);
        }
        visit(n.body, new Set([...scope, ...names]));
        return;
      }
      case "table": {
        const only = n.name.parts.length === 1 ? n.name.parts[0] : undefined;
        if (only === undefined || !scope.has(key(only))) out.push({ name: parts(n.name), access: "read", node: n });
        return;
      }
      case "insert":
        out.push({ name: parts(n.table), access: "write", node: n });
        kids(n, scope, n.table);
        return;
      case "update":
      case "delete":
        out.push({ name: parts(n.table.name), access: "write", node: n });
        kids(n, scope, n.table);
        return;
      case "create-table":
      case "create-view":
        out.push({ name: parts(n.name), access: "create", node: n });
        kids(n, scope);
        return;
      case "create-index":
        out.push({ name: parts(n.table), access: "alter", node: n });
        kids(n, scope);
        return;
      case "alter-table":
        out.push({ name: parts(n.table), access: "alter", node: n });
        kids(n, scope);
        return;
      case "drop":
        for (const name of n.names) out.push({ name: parts(name), access: "drop", node: n });
        return;
      default:
        kids(n, scope);
    }
  };
  visit(root, new Set());
  return out;
}

/**
 * Every call of a function in a tree, in the order of the text.
 *
 * @param root - a script, a statement or any node
 * @returns the calls
 */
export function functionsCalled(root: Node): readonly FunctionCall[] {
  return findAll(root, "call").map((node) => ({ name: parts(node.name), node }));
}

const WORD: Readonly<Record<string, string>> = {
  insert: "INSERT",
  update: "UPDATE",
  delete: "DELETE",
  "create-table": "CREATE TABLE",
  "create-index": "CREATE INDEX",
  "create-view": "CREATE VIEW",
  "alter-table": "ALTER TABLE",
  drop: "DROP",
};

/**
 * Why a script is not read-only, or nothing where it is: it holds one statement, and that is a query.
 *
 * @param script - the script
 * @returns one sentence, or `undefined`
 */
export function readOnlyProblem(script: Script): string | undefined {
  const [only, ...rest] = script.statements;
  if (only === undefined) return "it holds no statement";
  if (rest.length > 0) return "it holds more than one statement";
  switch (only.kind) {
    case "select":
    case "set-op":
    case "values":
    case "with":
      return undefined;
    case "unparsed":
      return "it holds a statement that could not be read";
    case "command":
      return `it holds a ${only.keyword}${only.object === undefined ? "" : ` ${only.object}`} command`;
    case "insert":
    case "update":
    case "delete":
    case "create-table":
    case "create-index":
    case "create-view":
    case "alter-table":
    case "drop": {
      const word = WORD[only.kind] ?? only.kind;
      return `it holds ${"AEIOU".includes(word.charAt(0)) ? "an" : "a"} ${word}`;
    }
    default:
      return absurd(only);
  }
}
