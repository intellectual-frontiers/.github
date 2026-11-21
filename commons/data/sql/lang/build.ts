/**
 * Builders for the nodes a rewrite makes (commons data 0067-sql-ast-tools FR-003): each takes the range of the node it stands for as its first argument, so that a rewritten tree's ranges are the text's ranges
 * and not made up.
 *
 * @example
 * ```ts
 * // replace each column `a` by `a + 1`
 * rewriteExpr(e, { expr: (n) => (n.kind === "name" ? build.binary(n, "+", n, build.number(n, "1")) : undefined) });
 * ```
 *
 * Spec: 0067-sql-ast-tools FR-003
 *
 * @module
 */
import type { BinaryOp, BoolLit, Binary, Call, Expr, Ident, Name, NullLit, NumberLit, Star, StringLit, Unary, UnaryOp } from "./ast.ts";
import type { Span } from "./span.ts";

/** Builds nodes with the range of the node they stand for. */
export const build = {
  /** An identifier. */
  ident(at: Span, name: string, quoted = false): Ident {
    return { kind: "ident", start: at.start, end: at.end, name, quoted };
  },
  /** A qualified name from its parts. */
  name(at: Span, ...parts: readonly string[]): Name {
    return { kind: "name", start: at.start, end: at.end, parts: parts.map((p) => build.ident(at, p)) };
  },
  /** A number, as written. */
  number(at: Span, text: string): NumberLit {
    return { kind: "number", start: at.start, end: at.end, text };
  },
  /** A string. */
  string(at: Span, value: string, prefix = ""): StringLit {
    return { kind: "string", start: at.start, end: at.end, value, prefix };
  },
  /** `TRUE` or `FALSE`. */
  boolean(at: Span, value: boolean): BoolLit {
    return { kind: "boolean", start: at.start, end: at.end, value };
  },
  /** `NULL`. */
  null(at: Span): NullLit {
    return { kind: "null", start: at.start, end: at.end };
  },
  /** A star, with a qualifier or without. */
  star(at: Span, qualifier?: Name): Star {
    return { kind: "star", start: at.start, end: at.end, qualifier, modifiers: [] };
  },
  /** A unary expression. */
  unary(at: Span, op: UnaryOp, arg: Expr): Unary {
    return { kind: "unary", start: at.start, end: at.end, op, arg };
  },
  /** A binary expression. */
  binary(at: Span, op: BinaryOp, left: Expr, right: Expr): Binary {
    return { kind: "binary", start: at.start, end: at.end, op, left, right };
  },
  /** A call of a function. */
  call(at: Span, name: Name, args: readonly Expr[]): Call {
    return {
      kind: "call",
      start: at.start,
      end: at.end,
      name,
      parameters: [],
      args,
      distinct: false,
      orderBy: [],
      withinGroup: [],
      nullTreatment: undefined,
      filter: undefined,
      over: undefined,
    };
  },
};
