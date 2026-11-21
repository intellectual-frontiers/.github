/**
 * Quoting and placeholders (commons lang-sql 0007-sql-emit FR-001 to FR-005): what the lexical of a dialect already knows, as functions, so that a library that builds statements writes no quote and no parameter by hand. An identifier is quoted as
 * the dialect's first quoted-identifier syntax writes it, a string as its first string syntax writes it, and a parameter in the style the dialect reads; each result is read back by the lexer of the same dialect as one token.
 *
 * @example
 * ```ts
 * quoteIdent(postgres, 'a"b');        // ok('"a""b"')
 * identifier(postgres, "user");       // ok('"user"'): a keyword is quoted
 * quoteString(mysql, "it's");         // ok("'it\\'s'")
 * placeholder(postgres, 2);           // ok("$2")
 * placeholder(sqlite, 1, "name");     // ok(":name")
 * ```
 *
 * Spec: 0007-sql-emit FR-001, FR-002, FR-004
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Dialect } from "./dialect.ts";
import type { ParamStyle } from "./lexical.ts";

/** Why a name, a value or a parameter could not be written for a dialect. */
export type EmitError =
  | { readonly kind: "no-quoted-identifier"; readonly dialect: string }
  | { readonly kind: "no-string"; readonly dialect: string }
  | { readonly kind: "cannot-escape"; readonly dialect: string; readonly quote: string }
  | { readonly kind: "no-placeholder"; readonly dialect: string; readonly wanted: "named" | "positional" };

/** One sentence for an emit error. */
export function describeEmitError(e: EmitError): string {
  switch (e.kind) {
    case "no-quoted-identifier":
      return `${e.dialect} has no quoted identifier`;
    case "no-string":
      return `${e.dialect} has no string`;
    case "cannot-escape":
      return `${e.dialect} cannot write ${e.quote} inside a string`;
    case "no-placeholder":
      return `${e.dialect} has no ${e.wanted} parameter`;
  }
}

/** The name written as the dialect's first quoted-identifier syntax writes it; an error value where the dialect has none. */
export function quoteIdent(dialect: Dialect, name: string): Result<string, EmitError> {
  const syntax = dialect.lexical.identifiers[0];
  if (syntax === undefined) return err({ kind: "no-quoted-identifier", dialect: dialect.name });
  return ok(syntax.open + name.split(syntax.close).join(syntax.close + syntax.close) + syntax.close);
}

const PLAIN = /^[a-z_][a-z0-9_]*$/;

/** The name bare where it is a plain lower-case word that is not a keyword of the dialect, and quoted otherwise. */
export function identifier(dialect: Dialect, name: string): Result<string, EmitError> {
  if (PLAIN.test(name) && !dialect.lexical.keywords.some((k) => k.toLowerCase() === name)) return ok(name);
  return quoteIdent(dialect, name);
}

/** The parts joined by `.`, each as {@link identifier} gives it. */
export function qualified(dialect: Dialect, parts: readonly string[]): Result<string, EmitError> {
  const out: string[] = [];
  for (const p of parts) {
    const r = identifier(dialect, p);
    if (r.kind === "err") return r;
    out.push(r.value);
  }
  return ok(out.join("."));
}

/** The value written as the dialect's first string syntax writes it; an error value where the dialect has none, or where the quote cannot be written inside. */
export function quoteString(dialect: Dialect, value: string): Result<string, EmitError> {
  const syntax = dialect.lexical.strings[0];
  if (syntax === undefined) return err({ kind: "no-string", dialect: dialect.name });
  switch (syntax.escape) {
    case "double":
      return ok(syntax.open + value.split(syntax.close).join(syntax.close + syntax.close) + syntax.close);
    case "backslash":
    case "both":
      return ok(syntax.open + value.split("\\").join("\\\\").split(syntax.close).join(`\\${syntax.close}`) + syntax.close);
    case "none":
      return value.includes(syntax.close) ? err({ kind: "cannot-escape", dialect: dialect.name, quote: syntax.close }) : ok(syntax.open + value + syntax.close);
  }
}

/** The styles of parameter the dialect reads, in the order its lexical lists them. */
export function paramStyles(dialect: Dialect): readonly ParamStyle[] {
  return dialect.lexical.params;
}

/** The text of a parameter: for a name, the first of the colon, at and dollar styles the dialect has; for a position (from 1), `$n` or `?`; an error value where none fits. */
export function placeholder(dialect: Dialect, position: number, name?: string): Result<string, EmitError> {
  const styles = dialect.lexical.params;
  if (name !== undefined) {
    if (styles.includes("colon-name")) return ok(`:${name}`);
    if (styles.includes("at-name")) return ok(`@${name}`);
    if (styles.includes("dollar-name")) return ok(`$${name}`);
    return err({ kind: "no-placeholder", dialect: dialect.name, wanted: "named" });
  }
  if (styles.includes("dollar-number")) return ok(`$${position}`);
  if (styles.includes("question")) return ok("?");
  return err({ kind: "no-placeholder", dialect: dialect.name, wanted: "positional" });
}
