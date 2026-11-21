/**
 * The dialect (commons data 0065-sql-lang FR-016): a name, the dialect it extends and its {@link Lexical}, resolved once. A dialect says only what differs from its parent: it is given a function from
 * its parent's lexical to its own, so that it can add, remove and replace what it inherits, and a chain of dialects (Redshift on PostgreSQL) is one lexical by the time the lexer reads it.
 *
 * @remarks
 * This is the lexical layer of a dialect; the grammar it will contribute to the parser is a later specification of the same folder, and a dialect value will gain it without changing how one is made.
 *
 * @example
 * ```ts
 * const mine = defineDialect({ name: "mine", extends: ansi, lexical: (base) => ({ ...base, comments: [...base.comments, { kind: "line", marker: "#" }] }) });
 * ```
 *
 * Spec: 0065-sql-lang FR-015, FR-016
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type CompiledLexical, compileLexical, describeLexicalError, type Lexical, type LexicalError } from "./lexical.ts";

/** A dialect of SQL. */
export interface Dialect {
  readonly name: string;
  /** The dialect it extends; none for the base. */
  readonly parent: Dialect | undefined;
  /** How it is written, whole. */
  readonly lexical: Lexical;
  /** The tables the lexer reads. */
  readonly compiled: CompiledLexical;
}

/** What a dialect is made from. */
export interface DialectSpec {
  readonly name: string;
  /** The dialect it extends. */
  readonly extends?: Dialect;
  /** Its lexical, from its parent's (the empty lexical where it has no parent). */
  readonly lexical: (parent: Lexical) => Lexical;
}

/** What is wrong with a dialect. */
export type DialectError =
  { readonly kind: "no-name" } | { readonly kind: "lexical"; readonly dialect: string; readonly error: LexicalError };

/** One sentence for a dialect's error. */
export function describeDialectError(e: DialectError): string {
  switch (e.kind) {
    case "no-name":
      return "a dialect needs a name";
    case "lexical":
      return `the lexical of ${e.dialect}: ${describeLexicalError(e.error)}`;
    default:
      return absurd(e);
  }
}

/** The lexical a dialect with no parent starts from: nothing. */
export const EMPTY_LEXICAL: Lexical = {
  comments: [],
  identifiers: [],
  strings: [],
  prefixes: [],
  dollarQuotes: false,
  params: [],
  operators: [],
  keywords: [],
  wordChars: "",
  numbers: { radix: false, underscores: false },
};

/**
 * Makes a dialect.
 *
 * @param spec - its name, its parent and its lexical
 * @returns the dialect, or what is wrong with it
 */
export function defineDialect(spec: DialectSpec): Result<Dialect, DialectError> {
  if (spec.name.length === 0) return err({ kind: "no-name" });
  const lexical = spec.lexical(spec.extends?.lexical ?? EMPTY_LEXICAL);
  const compiled = compileLexical(lexical);
  if (compiled.kind === "err") return err({ kind: "lexical", dialect: spec.name, error: compiled.error });
  return ok({ name: spec.name, parent: spec.extends, lexical, compiled: compiled.value });
}

/**
 * Makes a dialect that a module declares at its top level from data of its own: where that data is wrong, it throws the error's sentence when the module is loaded, which the module's test catches;
 * a dialect made at run time from data that arrives is made with {@link defineDialect}, which returns the error.
 *
 * @param spec - its name, its parent and its lexical
 * @returns the dialect
 */
export function declareDialect(spec: DialectSpec): Dialect {
  const made = defineDialect(spec);
  if (made.kind === "err") throw new Error(describeDialectError(made.error));
  return made.value;
}
