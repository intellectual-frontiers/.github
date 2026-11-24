// Spec: 0002-anyfs-gdrive-store FR-008
/**
 * What the Drive API says when it does not do what it was asked, and what a store makes of it: a failure is a status and an error object (`{ "error": { "code", "message", "errors": [{ "reason" }] } }`); its kind is one
 * of a closed list, decided by the reason where there is one and by the status where there is not (a `403` is a rate limit, a quota or a denial by its reason); and every kind is a problem of AnyFS by a total table
 * written here, which the compiler holds. A rate limit or a fault of the service is a problem worth a retry; a refusal of the token or of the account is not, and says which it was.
 *
 * @example
 * ```ts
 * import { kindOf } from "./errors.ts";
 * kindOf({ status: 403, reason: "userRateLimitExceeded", message: "" }); // "throttled"
 * kindOf({ status: 403, reason: "forbidden", message: "" }); // "denied"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Path, type Problem, refused, unavailable } from "@intellectual-frontiers/anyfs/governance";

/** What the service answered when it failed. */
export type Failure = { readonly status: number; readonly reason: string; readonly message: string; readonly retryAfterMs?: number };

/** The kinds of failure: a closed list. */
export const FAILURE_KINDS = ["not-found", "throttled", "server", "denied", "bad-token", "quota", "too-large", "conflict", "invalid", "redirect"] as const;
/** One kind of failure. */
export type FailureKind = (typeof FAILURE_KINDS)[number];

const BY_REASON: Readonly<Record<string, FailureKind>> = {
  notFound: "not-found",
  rateLimitExceeded: "throttled",
  userRateLimitExceeded: "throttled",
  sharingRateLimitExceeded: "throttled",
  dailyLimitExceeded: "throttled",
  backendError: "server",
  internalError: "server",
  forbidden: "denied",
  insufficientFilePermissions: "denied",
  insufficientPermissions: "denied",
  appNotAuthorizedToFile: "denied",
  authError: "bad-token",
  invalidCredentials: "bad-token",
  storageQuotaExceeded: "quota",
  teamDriveFileLimitExceeded: "quota",
  uploadTooLarge: "too-large",
  conflict: "conflict",
  badRequest: "invalid",
  invalid: "invalid",
  invalidParameter: "invalid",
  invalidQuery: "invalid",
};

/** The kind of a failure: its reason where there is one, else its status. */
export function kindOf(f: Failure): FailureKind {
  const byReason = BY_REASON[f.reason];
  if (byReason !== undefined) return byReason;
  switch (f.status) {
    case 301:
    case 302:
    case 303:
    case 307:
    case 308:
      return "redirect";
    case 401:
      return "bad-token";
    case 403:
      return "denied";
    case 404:
      return "not-found";
    case 409:
      return "conflict";
    case 413:
      return "too-large";
    case 429:
      return "throttled";
    default:
      return f.status >= 500 ? "server" : "invalid";
  }
}

/** The failure of an answer: the status, the reason and the message of its error object, as far as it has them. */
export function failureOf(status: number, headers: Readonly<Record<string, string>>, body: Uint8Array): Failure {
  let reason = "";
  let message = "";
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
    const error = typeof parsed === "object" && parsed !== null ? (parsed as { error?: unknown }).error : undefined;
    if (typeof error === "object" && error !== null) {
      const e = error as { message?: unknown; errors?: unknown; status?: unknown };
      if (typeof e.message === "string") message = e.message;
      if (Array.isArray(e.errors)) {
        const first: unknown = (e.errors as unknown[])[0];
        if (typeof first === "object" && first !== null && typeof (first as { reason?: unknown }).reason === "string") reason = (first as { reason: string }).reason;
      }
    }
  } catch {
    // an answer with no error object: the status says what it was
  }
  const wait = Number.parseInt(headers["retry-after"] ?? "", 10);
  return { status, reason, message, ...(Number.isFinite(wait) && wait >= 0 ? { retryAfterMs: wait * 1000 } : {}) };
}

/** What a problem is about: the path, where there is one. */
export type Subject = { readonly path?: Path };

const sentence = (f: Failure): string => `the Drive API answered ${f.status}${f.reason === "" ? "" : ` ${f.reason}`}${f.message === "" ? "" : `: ${f.message.slice(0, 200)}`}`;

/** The problem a failure is. */
export function problemOf(f: Failure, subject: Subject): Problem {
  const kind = kindOf(f);
  const path = subject.path;
  switch (kind) {
    case "not-found":
      return path === undefined ? unavailable(sentence(f), false) : { kind: "missing", path };
    case "throttled":
      return unavailable(`${sentence(f)}${f.retryAfterMs === undefined ? "" : `; try again in ${Math.ceil(f.retryAfterMs / 1000)} s`}`, true, path);
    case "server":
      return unavailable(sentence(f), true, path);
    case "denied":
      return unavailable(`${sentence(f)}: the account or the app may not do this`, false, path);
    case "bad-token":
      return unavailable(`${sentence(f)}: the token is not accepted (expired, wrong scope or revoked)`, false, path);
    case "quota":
      return refused("too-large", `${sentence(f)}: the storage is full`, path);
    case "too-large":
      return refused("too-large", sentence(f), path);
    case "conflict":
      return unavailable(`${sentence(f)}: another change is in the way`, true, path);
    case "invalid":
      return unavailable(`${sentence(f)}: the request was not understood`, false, path);
    case "redirect":
      return unavailable(`${sentence(f)}: a redirect that was not expected`, false, path);
    default:
      return absurd(kind);
  }
}
