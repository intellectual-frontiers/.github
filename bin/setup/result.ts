// Errors as values: a step returns a Result, never throws for a failure it expects; what ends the run is a Stop, which main turns into the exit status.

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
export const done: Ok<void> = { ok: true, value: undefined };

/** A nominal type: a string that has been checked to be what its brand says. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** An absolute path (POSIX or Windows). */
export type AbsPath = Brand<string, "AbsPath">;
/** 64 lower-case hexadecimal digits. */
export type Sha256 = Brand<string, "Sha256">;

export function absPath(p: string): AbsPath | null {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) ? p as AbsPath : null;
}
export function sha256(s: string): Sha256 | null {
  return /^[0-9a-f]{64}$/.test(s) ? s as Sha256 : null;
}

/** The exhaustiveness check of a switch over a union: a case left out is a type error here. */
export function assertNever(x: never): never {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
}

/**
 * Why a run ends early. Each is one exit status (erga 009-machine-bootstrap): 2 usage, 3 the computer cannot be set up yet, 4 a step failed,
 * 5 the GitHub sign-in did not finish (or this account cannot open erga), 130 interrupted.
 */
export type Stop =
  | { readonly kind: "usage"; readonly message: string }
  | { readonly kind: "cannot-set-up"; readonly reason: string; readonly fix: string }
  | { readonly kind: "step-failed"; readonly label: string }
  | { readonly kind: "unreachable"; readonly hosts: readonly string[] }
  | { readonly kind: "sign-in"; readonly reason: string }
  | { readonly kind: "interrupted" };

export type ExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 130;

export function exitStatusOf(stop: Stop): ExitStatus {
  switch (stop.kind) {
    case "usage":
      return 2;
    case "cannot-set-up":
    case "unreachable":
      return 3;
    case "step-failed":
      return 4;
    case "sign-in":
      return 5;
    case "interrupted":
      return 130;
    default:
      return assertNever(stop);
  }
}

/** A phase of the run: it goes on (ok) or ends the run with a Stop. */
export type Phase = Result<void, Stop>;
export const stop = (s: Stop): Err<Stop> => err(s);
