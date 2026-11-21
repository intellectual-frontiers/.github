/**
 * The nodes of PL/pgSQL (commons lang-sql 0006-sql-routines FR-005, FR-006): the blocks, declarations and statements of the language a PostgreSQL routine is written in, as a closed union like the core's. The SQL they
 * hold (expressions, queries, types) is made of the core's nodes, so a tree of this extension holds both, and `plChildren` gives the children of both.
 *
 * Spec: 0006-sql-routines FR-005, FR-006
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { children, type DataType, type Expr, type Ident, type Node, type Statement } from "../../mod.ts";

/** What every node of PL/pgSQL has: where its text is, in the whole text. */
export interface PlBase {
  readonly start: number;
  readonly end: number;
}

/** A variable: `name [CONSTANT] type [NOT NULL] [DEFAULT expr]`. */
export interface PlVariable extends PlBase {
  readonly kind: "pl-variable";
  readonly name: Ident;
  readonly constant: boolean;
  readonly type: DataType | undefined;
  readonly notNull: boolean;
  readonly default: Expr | undefined;
}

/** `name ALIAS FOR target`. */
export interface PlAlias extends PlBase {
  readonly kind: "pl-alias";
  readonly name: Ident;
  /** What it is an alias for, as written (`$1`, a name). */
  readonly target: string;
}

/** `name [[NO] SCROLL] CURSOR [(arguments)] FOR query`. */
export interface PlCursor extends PlBase {
  readonly kind: "pl-cursor";
  readonly name: Ident;
  readonly scroll: "scroll" | "no-scroll" | undefined;
  /** The arguments as written, `name type` each. */
  readonly params: readonly string[];
  readonly query: Statement | undefined;
}

/** A declaration. */
export type PlDeclaration = PlVariable | PlAlias | PlCursor;

/** `WHEN condition [OR condition] THEN statements` of an `EXCEPTION` section. */
export interface PlHandler extends PlBase {
  readonly kind: "pl-handler";
  /** The conditions as written, upper case (`OTHERS`, `NO_DATA_FOUND`, `SQLSTATE '22012'`). */
  readonly conditions: readonly string[];
  readonly statements: readonly PlStatement[];
}

/** `[<<label>>] [DECLARE declarations] BEGIN statements [EXCEPTION handlers] END [label]`. */
export interface PlBlock extends PlBase {
  readonly kind: "pl-block";
  readonly label: Ident | undefined;
  readonly declarations: readonly PlDeclaration[];
  readonly statements: readonly PlStatement[];
  readonly handlers: readonly PlHandler[];
  readonly endLabel: Ident | undefined;
}

/** `target := value`. */
export interface PlAssign extends PlBase {
  readonly kind: "pl-assign";
  readonly target: Expr;
  readonly value: Expr;
}

/** `ELSIF condition THEN statements`. */
export interface PlElsif extends PlBase {
  readonly kind: "pl-elsif";
  readonly cond: Expr;
  readonly body: readonly PlStatement[];
}

/** `IF condition THEN statements [ELSIF ...] [ELSE statements] END IF`. */
export interface PlIf extends PlBase {
  readonly kind: "pl-if";
  readonly cond: Expr;
  readonly then: readonly PlStatement[];
  readonly elsifs: readonly PlElsif[];
  readonly otherwise: readonly PlStatement[] | undefined;
}

/** `WHEN conditions THEN statements` of a `CASE`. */
export interface PlWhen extends PlBase {
  readonly kind: "pl-when";
  readonly conds: readonly Expr[];
  readonly body: readonly PlStatement[];
}

/** `CASE [operand] WHEN ... THEN ... [ELSE statements] END CASE`. */
export interface PlCase extends PlBase {
  readonly kind: "pl-case";
  readonly operand: Expr | undefined;
  readonly whens: readonly PlWhen[];
  readonly otherwise: readonly PlStatement[] | undefined;
}

/** `[<<label>>] LOOP statements END LOOP`. */
export interface PlLoop extends PlBase {
  readonly kind: "pl-loop";
  readonly label: Ident | undefined;
  readonly body: readonly PlStatement[];
}

/** `[<<label>>] WHILE condition LOOP statements END LOOP`. */
export interface PlWhile extends PlBase {
  readonly kind: "pl-while";
  readonly label: Ident | undefined;
  readonly cond: Expr;
  readonly body: readonly PlStatement[];
}

/** `[<<label>>] FOR variable IN [REVERSE] from .. to [BY step] LOOP statements END LOOP`. */
export interface PlForRange extends PlBase {
  readonly kind: "pl-for-range";
  readonly label: Ident | undefined;
  readonly variable: Ident;
  readonly reverse: boolean;
  readonly from: Expr;
  readonly to: Expr;
  readonly by: Expr | undefined;
  readonly body: readonly PlStatement[];
}

/** `[<<label>>] FOR variables IN query | EXECUTE command [USING ...] LOOP statements END LOOP`. */
export interface PlForQuery extends PlBase {
  readonly kind: "pl-for-query";
  readonly label: Ident | undefined;
  readonly variables: readonly Ident[];
  readonly query: Statement | undefined;
  /** The command of `EXECUTE command`. */
  readonly dynamic: Expr | undefined;
  /** The cursor of `FOR variable IN cursor (arguments)`. */
  readonly cursor: Expr | undefined;
  readonly using: readonly Expr[];
  readonly body: readonly PlStatement[];
}

/** `[<<label>>] FOREACH variable [SLICE n] IN ARRAY array LOOP statements END LOOP`. */
export interface PlForeach extends PlBase {
  readonly kind: "pl-foreach";
  readonly label: Ident | undefined;
  readonly variables: readonly Expr[];
  readonly slice: string | undefined;
  readonly array: Expr;
  readonly body: readonly PlStatement[];
}

/** `EXIT | CONTINUE [label] [WHEN condition]`. */
export interface PlExit extends PlBase {
  readonly kind: "pl-exit";
  readonly exit: "exit" | "continue";
  readonly label: Ident | undefined;
  readonly when: Expr | undefined;
}

/** `RETURN [value]`, `RETURN NEXT [value]`, `RETURN QUERY query`, `RETURN QUERY EXECUTE command [USING ...]`. */
export interface PlReturn extends PlBase {
  readonly kind: "pl-return";
  readonly mode: "return" | "next" | "query" | "query-execute";
  readonly value: Expr | undefined;
  readonly query: Statement | undefined;
  readonly using: readonly Expr[];
}

/** `name = value` of a `RAISE ... USING`. */
export interface PlRaiseOption extends PlBase {
  readonly kind: "pl-raise-option";
  readonly name: string;
  readonly value: Expr;
}

/** `RAISE [level] ['format', parameters | condition] [USING options]`. */
export interface PlRaise extends PlBase {
  readonly kind: "pl-raise";
  readonly level: string | undefined;
  /** A condition name or `SQLSTATE 'code'`, as written. */
  readonly condition: string | undefined;
  readonly message: Expr | undefined;
  readonly params: readonly Expr[];
  readonly options: readonly PlRaiseOption[];
}

/** `PERFORM query`. */
export interface PlPerform extends PlBase {
  readonly kind: "pl-perform";
  readonly query: Statement | undefined;
}

/** `EXECUTE command [INTO [STRICT] targets] [USING parameters]`. */
export interface PlExecute extends PlBase {
  readonly kind: "pl-execute";
  readonly command: Expr | undefined;
  readonly into: readonly Expr[];
  readonly strict: boolean;
  readonly using: readonly Expr[];
}

/** `OPEN cursor [[NO] SCROLL] FOR query | EXECUTE command [USING ...]`, `OPEN cursor (arguments)`. */
export interface PlOpen extends PlBase {
  readonly kind: "pl-open";
  readonly cursor: Ident;
  readonly query: Statement | undefined;
  readonly dynamic: Expr | undefined;
  readonly args: readonly Expr[];
  readonly using: readonly Expr[];
}

/** `FETCH | MOVE [direction] [FROM | IN] cursor [INTO targets]`. */
export interface PlFetch extends PlBase {
  readonly kind: "pl-fetch";
  readonly move: boolean;
  /** The direction as written, upper case (`NEXT`, `ABSOLUTE 3`). */
  readonly direction: string | undefined;
  readonly cursor: Ident;
  readonly into: readonly Expr[];
}

/** `CLOSE cursor`. */
export interface PlClose extends PlBase {
  readonly kind: "pl-close";
  readonly cursor: Ident;
}

/** `CALL procedure(arguments)`. */
export interface PlCall extends PlBase {
  readonly kind: "pl-call";
  readonly call: Expr | undefined;
}

/** `NULL`. */
export interface PlNull extends PlBase {
  readonly kind: "pl-null";
}

/** `target = item` of `GET DIAGNOSTICS`. */
export interface PlDiagnosticsItem extends PlBase {
  readonly kind: "pl-diagnostics-item";
  readonly target: Expr;
  readonly item: string;
}

/** `GET [CURRENT | STACKED] DIAGNOSTICS target = item, ...`. */
export interface PlDiagnostics extends PlBase {
  readonly kind: "pl-diagnostics";
  readonly stacked: boolean;
  readonly items: readonly PlDiagnosticsItem[];
}

/** `ASSERT condition [, message]`. */
export interface PlAssert extends PlBase {
  readonly kind: "pl-assert";
  readonly cond: Expr;
  readonly message: Expr | undefined;
}

/** `COMMIT | ROLLBACK [AND [NO] CHAIN]`. */
export interface PlTransaction extends PlBase {
  readonly kind: "pl-transaction";
  readonly action: "commit" | "rollback";
  readonly chain: boolean;
}

/** A SQL statement, with the targets of its `INTO [STRICT]` taken out of it. */
export interface PlSql extends PlBase {
  readonly kind: "pl-sql";
  readonly statement: Statement | undefined;
  readonly into: readonly Expr[];
  readonly strict: boolean;
}

/** A statement that could not be read. */
export interface PlUnparsed extends PlBase {
  readonly kind: "pl-unparsed";
}

/** A statement of PL/pgSQL. */
export type PlStatement =
  | PlBlock
  | PlAssign
  | PlIf
  | PlCase
  | PlLoop
  | PlWhile
  | PlForRange
  | PlForQuery
  | PlForeach
  | PlExit
  | PlReturn
  | PlRaise
  | PlPerform
  | PlExecute
  | PlOpen
  | PlFetch
  | PlClose
  | PlCall
  | PlNull
  | PlDiagnostics
  | PlAssert
  | PlTransaction
  | PlSql
  | PlUnparsed;

/** A node of PL/pgSQL. */
export type PlNode = PlStatement | PlDeclaration | PlHandler | PlElsif | PlWhen | PlRaiseOption | PlDiagnosticsItem;

/** A node of a tree of this extension: PL/pgSQL, or SQL of the core. */
export type PlTree = PlNode | Node;

/** Whether a node of the tree is PL/pgSQL's. */
export function isPl(n: PlTree): n is PlNode {
  return n.kind.startsWith("pl-");
}

const push = (out: PlTree[], n: PlTree | undefined): void => {
  if (n !== undefined) out.push(n);
};
const pushAll = (out: PlTree[], ns: readonly PlTree[] | undefined): void => {
  if (ns !== undefined) for (const n of ns) out.push(n);
};

/**
 * The children of a node of the tree, in the order of the text: PL/pgSQL's and the core's.
 *
 * @param n - a node
 * @returns its children
 */
export function plChildren(n: PlTree): readonly PlTree[] {
  if (!isPl(n)) return children(n);
  const out: PlTree[] = [];
  switch (n.kind) {
    case "pl-variable":
      out.push(n.name);
      push(out, n.type);
      push(out, n.default);
      break;
    case "pl-alias":
      out.push(n.name);
      break;
    case "pl-cursor":
      out.push(n.name);
      push(out, n.query);
      break;
    case "pl-handler":
      pushAll(out, n.statements);
      break;
    case "pl-block":
      push(out, n.label);
      pushAll(out, n.declarations);
      pushAll(out, n.statements);
      pushAll(out, n.handlers);
      push(out, n.endLabel);
      break;
    case "pl-assign":
      out.push(n.target, n.value);
      break;
    case "pl-elsif":
      out.push(n.cond);
      pushAll(out, n.body);
      break;
    case "pl-if":
      out.push(n.cond);
      pushAll(out, n.then);
      pushAll(out, n.elsifs);
      pushAll(out, n.otherwise);
      break;
    case "pl-when":
      pushAll(out, n.conds);
      pushAll(out, n.body);
      break;
    case "pl-case":
      push(out, n.operand);
      pushAll(out, n.whens);
      pushAll(out, n.otherwise);
      break;
    case "pl-loop":
      push(out, n.label);
      pushAll(out, n.body);
      break;
    case "pl-while":
      push(out, n.label);
      out.push(n.cond);
      pushAll(out, n.body);
      break;
    case "pl-for-range":
      push(out, n.label);
      out.push(n.variable, n.from, n.to);
      push(out, n.by);
      pushAll(out, n.body);
      break;
    case "pl-for-query":
      push(out, n.label);
      pushAll(out, n.variables);
      push(out, n.query);
      push(out, n.dynamic);
      push(out, n.cursor);
      pushAll(out, n.using);
      pushAll(out, n.body);
      break;
    case "pl-foreach":
      push(out, n.label);
      pushAll(out, n.variables);
      out.push(n.array);
      pushAll(out, n.body);
      break;
    case "pl-exit":
      push(out, n.label);
      push(out, n.when);
      break;
    case "pl-return":
      push(out, n.value);
      push(out, n.query);
      pushAll(out, n.using);
      break;
    case "pl-raise-option":
      out.push(n.value);
      break;
    case "pl-raise":
      push(out, n.message);
      pushAll(out, n.params);
      pushAll(out, n.options);
      break;
    case "pl-perform":
      push(out, n.query);
      break;
    case "pl-execute":
      push(out, n.command);
      pushAll(out, n.into);
      pushAll(out, n.using);
      break;
    case "pl-open":
      out.push(n.cursor);
      push(out, n.query);
      push(out, n.dynamic);
      pushAll(out, n.args);
      pushAll(out, n.using);
      break;
    case "pl-fetch":
      out.push(n.cursor);
      pushAll(out, n.into);
      break;
    case "pl-close":
      out.push(n.cursor);
      break;
    case "pl-call":
      push(out, n.call);
      break;
    case "pl-diagnostics-item":
      out.push(n.target);
      break;
    case "pl-diagnostics":
      pushAll(out, n.items);
      break;
    case "pl-assert":
      out.push(n.cond);
      push(out, n.message);
      break;
    case "pl-sql":
      push(out, n.statement);
      pushAll(out, n.into);
      break;
    case "pl-null":
    case "pl-transaction":
    case "pl-unparsed":
      break;
    default:
      return absurd(n);
  }
  return out.sort((a, b) => a.start - b.start);
}
