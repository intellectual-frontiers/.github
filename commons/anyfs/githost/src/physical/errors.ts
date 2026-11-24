// Spec: 0002-anyfs-githost-store FR-005, FR-013
/**
 * The table from what a host's API failed with to a problem of AnyFS: total over the seven kinds, one sentence each, and never holding a token. A throttle is `unavailable` and worth a try, with how
 * long to wait; a refusal of a token to write is `read-only` with the host's reason; an object too large is `too-large`; a missing object is `missing` where the call was about one object and
 * `unavailable` where it was about the repository or the branch (a store that cannot find its repository is not an object that is missing).
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { missing, type Path, type Problem, refused, unavailable } from "@intellectual-frontiers/anyfs/governance";
import type { ApiProblem } from "./api.ts";

/** What a failed call was about: an object of the store, or the store itself. */
export type Subject = { readonly path?: Path };

/** The words of a failure of the API. */
export function describeApiProblem(p: ApiProblem): string {
  switch (p.kind) {
    case "not-found":
      return `${p.what} was not found`;
    case "conflict":
      return `the host reported a conflict: ${p.message}`;
    case "denied":
      return p.reason === "unauthorized" ? `the host did not accept the token: ${p.message}` : p.reason === "protected" ? `the branch is protected: ${p.message}` : `the token may not do it: ${p.message}`;
    case "rate-limited":
      return p.retryAfterSeconds === undefined ? `the host asks for a wait: ${p.message}` : `the host asks for a wait of ${p.retryAfterSeconds} s: ${p.message}`;
    case "too-large":
      return `the host will not hold it: ${p.message}`;
    case "unavailable":
      return p.message;
    case "unexpected":
      return `the host answered ${p.status}: ${p.message}`;
    default:
      return absurd(p);
  }
}

/** The problem of AnyFS a failure of the API is. */
export function problemOf(p: ApiProblem, subject: Subject = {}): Problem {
  const path = subject.path;
  switch (p.kind) {
    case "not-found":
      return path === undefined ? unavailable(describeApiProblem(p), false) : missing(path);
    case "conflict":
      return unavailable(describeApiProblem(p), true, path);
    case "denied":
      return p.reason === "unauthorized" ? unavailable(describeApiProblem(p), false, path) : refused("read-only", describeApiProblem(p), path);
    case "rate-limited":
      return unavailable(describeApiProblem(p), true, path);
    case "too-large":
      return refused("too-large", describeApiProblem(p), path);
    case "unavailable":
      return unavailable(describeApiProblem(p), p.retryable, path);
    case "unexpected":
      return unavailable(describeApiProblem(p), p.status >= 500, path);
    default:
      return absurd(p);
  }
}
