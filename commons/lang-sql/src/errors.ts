/**
 * What the parser finds that it cannot read (commons lang-sql 0002-sql-ast-parser FR-012): errors are values, each with a span and one sentence, and the lexer's errors are among them.
 *
 * Spec: 0002-sql-ast-parser FR-012
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { describeLexError, type LexError } from "./lexer.ts";
import type { Span } from "./span.ts";

/** An error of the parser. */
export type ParseError =
  | { readonly kind: "expected"; readonly expected: string; readonly found: string; readonly span: Span }
  | { readonly kind: "unsupported"; readonly what: string; readonly span: Span }
  | { readonly kind: "too-deep"; readonly span: Span }
  | { readonly kind: "lex"; readonly error: LexError };

/** One sentence for a parse error. */
export function describeParseError(e: ParseError): string {
  switch (e.kind) {
    case "expected":
      return `expected ${e.expected} at ${e.span.start}, found ${e.found}`;
    case "unsupported":
      return `${e.what} at ${e.span.start} is not supported`;
    case "too-deep":
      return `the text is nested too deeply at ${e.span.start}`;
    case "lex":
      return describeLexError(e.error);
    default:
      return absurd(e);
  }
}

/** Where an error is. */
export function spanOf(e: ParseError): Span {
  return e.kind === "lex" ? e.error.span : e.span;
}
