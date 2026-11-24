// Spec: 0002-anyfs-s3-store FR-004
/**
 * What S3 says when it does not do what it was asked, and what a store makes of it: a failure is a status, a code and a message; its kind is one of thirteen, decided by the code where there is one and by the
 * status where there is not (a `HEAD` has no body); and every kind is a problem of AnyFS by a total table written here, which the compiler holds. A failed condition is a conflict only where the caller can say what the
 * object is at; a throttle or a fault of the server is a problem worth a retry; a refusal of the credentials is not, and says which of the several things it was.
 *
 * @example
 * ```ts
 * import { kindOf } from "./errors.ts";
 * kindOf({ status: 412, code: "PreconditionFailed", message: "" }); // "precondition"
 * kindOf({ status: 503, code: "SlowDown", message: "" }); // "throttled"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { conflict, type Expect, type Found, missing, type Path, type Problem, refused, tampered, unavailable } from "@intellectual-frontiers/anyfs/governance";

/** What a service answered when it failed. */
export type Failure = { readonly status: number; readonly code: string; readonly message: string; readonly requestId?: string };

/** The kinds of failure: a closed list. */
export const FAILURE_KINDS = [
  "not-found",
  "no-bucket",
  "precondition",
  "in-progress",
  "throttled",
  "server",
  "denied",
  "bad-credentials",
  "clock-skew",
  "too-large",
  "bad-digest",
  "redirect",
  "not-implemented",
  "invalid",
] as const;
/** One kind of failure. */
export type FailureKind = (typeof FAILURE_KINDS)[number];

const BY_CODE: Readonly<Record<string, FailureKind>> = {
  NoSuchKey: "not-found",
  NotFound: "not-found",
  NoSuchBucket: "no-bucket",
  PreconditionFailed: "precondition",
  NotModified: "precondition",
  ConditionalRequestConflict: "in-progress",
  OperationAborted: "in-progress",
  SlowDown: "throttled",
  ServiceUnavailable: "throttled",
  TooManyRequests: "throttled",
  RequestLimitExceeded: "throttled",
  InternalError: "server",
  RequestTimeout: "server",
  AccessDenied: "denied",
  AllAccessDisabled: "denied",
  AccountProblem: "denied",
  InvalidAccessKeyId: "bad-credentials",
  SignatureDoesNotMatch: "bad-credentials",
  ExpiredToken: "bad-credentials",
  InvalidToken: "bad-credentials",
  AuthorizationHeaderMalformed: "bad-credentials",
  RequestTimeTooSkewed: "clock-skew",
  EntityTooLarge: "too-large",
  BadDigest: "bad-digest",
  InvalidDigest: "bad-digest",
  XAmzContentSHA256Mismatch: "bad-digest",
  NotImplemented: "not-implemented",
  PermanentRedirect: "redirect",
  TemporaryRedirect: "redirect",
  AuthorizationQueryParametersError: "invalid",
  InvalidArgument: "invalid",
  InvalidRequest: "invalid",
  MalformedXML: "invalid",
};

/** The kind of a failure: by its code where it has one that is known, else by its status. */
export function kindOf(failure: Failure): FailureKind {
  const byCode = BY_CODE[failure.code];
  if (byCode !== undefined) return byCode;
  const s = failure.status;
  if (s === 404) return "not-found";
  if (s === 412 || s === 304) return "precondition";
  if (s === 409) return "in-progress";
  if (s === 429 || s === 503) return "throttled";
  if (s >= 500 && s !== 501) return "server";
  if (s === 501) return "not-implemented";
  if (s === 401) return "bad-credentials";
  if (s === 403) return "denied";
  if (s === 413) return "too-large";
  if (s >= 300 && s < 400) return "redirect";
  return "invalid";
}

/** What the caller knows of the object a failure is about. */
export type Subject = { readonly path?: Path; readonly expect?: Expect; readonly found?: Found; readonly bucket?: string };

const clip = (text: string): string => (text.length > 200 ? `${text.slice(0, 200)}…` : text);

/** The failure in one sentence, which holds no credential. */
export function describeFailure(f: Failure): string {
  return `the service answered ${f.status}${f.code === "" ? "" : ` ${f.code}`}${f.message === "" ? "" : `: ${clip(f.message)}`}`;
}

/** The problem of AnyFS a failure stands for. */
export function problemOf(failure: Failure, subject: Subject = {}): Problem {
  const kind = kindOf(failure);
  const said = describeFailure(failure);
  const path = subject.path;
  switch (kind) {
    case "not-found":
      return path === undefined ? unavailable(said, false) : missing(path);
    case "no-bucket":
      return unavailable(`the bucket${subject.bucket === undefined ? "" : ` ${subject.bucket}`} does not exist (${said})`, false, path);
    case "precondition":
    case "in-progress":
      return path === undefined || subject.expect === undefined || subject.found === undefined ? unavailable(`${said}; what the object is at is not known`, kind === "in-progress", path) : conflict(path, subject.expect, subject.found);
    case "throttled":
    case "server":
      return unavailable(said, true, path);
    case "denied":
      return unavailable(`the credentials may not do this (${said})`, false, path);
    case "bad-credentials":
      return unavailable(`the service did not accept the credentials: ${failure.code === "SignatureDoesNotMatch" ? "the signature does not match the secret key, the region or the endpoint" : said}`, false, path);
    case "clock-skew":
      return unavailable(`the clock of this computer is too far from the service's (${said})`, false, path);
    case "too-large":
      return refused("too-large", said, path);
    case "bad-digest":
      return path === undefined ? unavailable(said, false) : tampered(path, `the service did not receive the bytes that were sent (${said})`);
    case "redirect":
      return unavailable(`the bucket is not at this endpoint or in this region (${said})`, false, path);
    case "not-implemented":
      return unavailable(`the service does not implement this (${said})`, false, path);
    case "invalid":
      return unavailable(said, false, path);
    default:
      return absurd(kind);
  }
}
