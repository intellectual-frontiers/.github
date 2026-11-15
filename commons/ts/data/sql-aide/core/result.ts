/**
 * Errors as values, nominal types and the exhaustiveness check: the conventions of `bin/setup/result.ts`, kept here because the library
 * imports nothing outside its own folder (commons 0005-sql-aide FR-002, FR-003).
 *
 * @module
 */

/** A success that carries a value. */
export type Ok<T> = { readonly ok: true; readonly value: T };
/** A failure that carries what went wrong. */
export type Err<E> = { readonly ok: false; readonly error: E };
/** What a step that can fail returns: it never throws for a failure it expects. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Makes a success. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
/** Makes a failure. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** A nominal type: a value that has been checked to be what its brand says. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** The one cast of the library: gives a checked value its brand. */
export const brand = <T, B extends string>(value: T): Brand<T, B> => value as Brand<T, B>;

/**
 * The exhaustiveness check of a `switch` over a tagged union: a case left out is a type error here.
 *
 * @param x - what is left of the union after every case; `never` when none is left out
 */
export function assertNever(x: never): never {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
}
