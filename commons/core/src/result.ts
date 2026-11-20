// Spec: 0001-core FR-001
/**
 * Errors as values: a step that can fail returns a `Result` whose error is a type of its own, usually a union told apart by `kind`
 * (0001-core FR-001). Taken from erga's kernel and the machine setup's `result.ts`, which wrote the same thing twice.
 *
 * @example
 * ```ts
 * import { andThen, err, ok, type Result } from "./result.ts";
 * const half = (n: number): Result<number, string> => n % 2 === 0 ? ok(n / 2) : err(`${n} is odd`);
 * andThen(half(8), half); // { kind: "ok", value: 2 }
 * ```
 *
 * @module
 */

/** A step's success, with its value. */
export type Ok<T> = { readonly kind: "ok"; readonly value: T };
/** A step's failure, with its typed error. */
export type Err<E> = { readonly kind: "err"; readonly error: E };
/** What a step that can fail returns. */
export type Result<T, E> = Ok<T> | Err<E>;

/** A success. */
export function ok<T>(value: T): Ok<T> {
  return { kind: "ok", value };
}

/** A failure. */
export function err<E>(error: E): Err<E> {
  return { kind: "err", error };
}

/** The success that carries nothing: a step that only had to happen. */
export const done: Ok<void> = ok(undefined);

/** Whether a result is a success (a type guard). */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.kind === "ok";
}

/** Whether a result is a failure (a type guard). */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.kind === "err";
}

/** The value of a success transformed; a failure unchanged. */
export function map<T, U, E>(result: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return result.kind === "ok" ? ok(f(result.value)) : result;
}

/** The error of a failure transformed; a success unchanged. */
export function mapErr<T, E, F>(result: Result<T, E>, f: (error: E) => F): Result<T, F> {
  return result.kind === "err" ? err(f(result.error)) : result;
}

/** A second step run on the value of a success; a failure unchanged. */
export function andThen<T, U, E>(result: Result<T, E>, f: (value: T) => Result<U, E>): Result<U, E> {
  return result.kind === "ok" ? f(result.value) : result;
}

/** A second step run on the error of a failure, which may recover; a success unchanged. */
export function orElse<T, E, F>(result: Result<T, E>, f: (error: E) => Result<T, F>): Result<T, F> {
  return result.kind === "err" ? f(result.error) : result;
}

/** Every result's value in order, or the first failure. */
export function all<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];
  for (const r of results) {
    if (r.kind === "err") return r;
    values.push(r.value);
  }
  return ok(values);
}

/** The value of a success, or `fallback` for a failure. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.kind === "ok" ? result.value : fallback;
}

/** One function for each alternative, and what the one that applies returns. */
export function match<T, E, R>(result: Result<T, E>, on: { readonly ok: (value: T) => R; readonly err: (error: E) => R }): R {
  return result.kind === "ok" ? on.ok(result.value) : on.err(result.error);
}

/** What a function that throws returns, as a result: its value, or what it threw turned into an error by `onThrow`. */
export function attempt<T, E>(f: () => T, onThrow: (thrown: unknown) => E): Result<T, E> {
  try {
    return ok(f());
  } catch (thrown) {
    return err(onThrow(thrown));
  }
}

/** What a promise settles to, as a result: its value, or its rejection turned into an error by `onReject`. */
export async function settle<T, E>(promise: PromiseLike<T>, onReject: (reason: unknown) => E): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (reason) {
    return err(onReject(reason));
  }
}
