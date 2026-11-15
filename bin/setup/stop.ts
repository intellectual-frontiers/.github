// How a run ends early, and the exit status of each end (erga 009-machine-bootstrap FR-067). A step returns a Result of commons' kernel, never throws for a failure
// it expects; what ends the run is a Stop, which main turns into the exit status.
import type { Brand } from "../../commons/ts/kernel/brand.ts";
import { absurd } from "../../commons/ts/kernel/absurd.ts";
import { type Err, err, type Result } from "../../commons/ts/kernel/result.ts";

/** An absolute path (POSIX or Windows). */
export type AbsPath = Brand<string, "AbsPath">;

/** The path where it is absolute, else null. The one cast of the setup: the check is what makes it an AbsPath. */
export function absPath(p: string): AbsPath | null {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) ? p as AbsPath : null;
}

/**
 * Why a run ends early. Each is one exit status: 2 usage, 3 the computer cannot be set up yet, 4 a step failed, 5 the GitHub sign-in did not finish (or this
 * account cannot open erga), 130 interrupted.
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
      return absurd(stop);
  }
}

/** A phase of the run: it goes on (ok) or ends the run with a Stop. */
export type Phase = Result<void, Stop>;
export const stop = (s: Stop): Err<Stop> => err(s);
/** The computer cannot be set up yet: what is wrong, and the fix. */
export const cannot = (reason: string, fix: string): Err<Stop> => err({ kind: "cannot-set-up", reason, fix });
