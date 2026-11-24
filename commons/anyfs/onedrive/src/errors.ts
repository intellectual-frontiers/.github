// Spec: 0002-anyfs-onedrive-store FR-008
/**
 * What Microsoft Graph says when it does not do what it was asked, and what a store makes of it: a failure is a status and an error object (`{ "error": { "code", "message" } }`); its kind is one of a closed list,
 * decided by the code where there is one and by the status where there is not; and every kind is a problem of AnyFS by a total table written here, which the compiler holds. A condition that failed is a conflict only
 * where the caller can say what the object is at; a throttle or a fault of the service is a problem worth a retry; a refusal of the token or of the account is not, and says which it was.
 *
 * @example
 * ```ts
 * import { kindOf } from "./errors.ts";
 * kindOf({ status: 412, code: "preconditionFailed", message: "" }); // "precondition"
 * kindOf({ status: 429, code: "activityLimitReached", message: "" }); // "throttled"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Path, type Problem, refused, unavailable } from "@intellectual-frontiers/anyfs/governance";

/** What the service answered when it failed. */
export type Failure = { readonly status: number; readonly code: string; readonly message: string; readonly retryAfterMs?: number };

/** The kinds of failure: a closed list. */
export const FAILURE_KINDS = ["not-found", "name-exists", "precondition", "locked", "throttled", "server", "denied", "bad-token", "too-large", "quota", "invalid", "redirect"] as const;
/** One kind of failure. */
export type FailureKind = (typeof FAILURE_KINDS)[number];

const BY_CODE: Readonly<Record<string, FailureKind>> = {
  itemNotFound: "not-found",
  nameAlreadyExists: "name-exists",
  resourceModified: "precondition",
  preconditionFailed: "precondition",
  resourceLocked: "locked",
  activityLimitReached: "throttled",
  throttledRequest: "throttled",
  tooManyRequests: "throttled",
  generalException: "server",
  serviceNotAvailable: "server",
  timeout: "server",
  accessDenied: "denied",
  notAllowed: "denied",
  InvalidAuthenticationToken: "bad-token",
  unauthenticated: "bad-token",
  quotaLimitReached: "quota",
  invalidRequest: "invalid",
  badRequest: "invalid",
};

/** The kind of a failure: its code where there is one, else its status. */
export function kindOf(f: Failure): FailureKind {
  const byCode = BY_CODE[f.code];
  if (byCode !== undefined) return byCode;
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
      return "name-exists";
    case 412:
      return "precondition";
    case 413:
      return "too-large";
    case 423:
      return "locked";
    case 429:
      return "throttled";
    case 507:
      return "quota";
    default:
      return f.status >= 500 ? "server" : "invalid";
  }
}

/** The failure of an answer: the status, the code and the message of its error object, as far as it has them. */
export function failureOf(status: number, headers: Readonly<Record<string, string>>, body: Uint8Array): Failure {
  let code = "";
  let message = "";
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
    if (typeof parsed === "object" && parsed !== null) {
      const error = (parsed as { error?: unknown }).error;
      if (typeof error === "object" && error !== null) {
        const e = error as { code?: unknown; message?: unknown };
        if (typeof e.code === "string") code = e.code;
        if (typeof e.message === "string") message = e.message;
      }
    }
  } catch {
    // an answer with no error object: the status says what it was
  }
  const wait = Number.parseInt(headers["retry-after"] ?? "", 10);
  return { status, code, message, ...(Number.isFinite(wait) && wait >= 0 ? { retryAfterMs: wait * 1000 } : {}) };
}

/** What a problem is about: the path, where there is one. */
export type Subject = { readonly path?: Path };

const sentence = (f: Failure): string => `Graph answered ${f.status}${f.code === "" ? "" : ` ${f.code}`}${f.message === "" ? "" : `: ${f.message.slice(0, 200)}`}`;

/** The problem a failure is. Missing and conflict are made by the caller, which knows what it asked; here they are the problems a caller that does not know gets. */
export function problemOf(f: Failure, subject: Subject): Problem {
  const kind = kindOf(f);
  const path = subject.path;
  switch (kind) {
    case "not-found":
      return path === undefined ? unavailable(sentence(f), false) : { kind: "missing", path };
    case "name-exists":
      return refused("unportable-path", `${sentence(f)}: a name on the path is already something else (a file where a folder is needed, or a folder where a file is)`, path);
    case "precondition":
      return unavailable(`${sentence(f)}: the object is not as the write expected`, true, path);
    case "locked":
      return unavailable(`${sentence(f)}: the file is locked by another user or a program`, false, path);
    case "throttled":
      return unavailable(`${sentence(f)}${f.retryAfterMs === undefined ? "" : `; try again in ${Math.ceil(f.retryAfterMs / 1000)} s`}`, true, path);
    case "server":
      return unavailable(sentence(f), true, path);
    case "denied":
      return unavailable(`${sentence(f)}: the account or the app may not do this`, false, path);
    case "bad-token":
      return unavailable(`${sentence(f)}: the token is not accepted (expired, wrong audience or revoked)`, false, path);
    case "too-large":
      return refused("too-large", sentence(f), path);
    case "quota":
      return refused("too-large", `${sentence(f)}: the drive is full`, path);
    case "invalid":
      return unavailable(`${sentence(f)}: the request was not understood`, false, path);
    case "redirect":
      return unavailable(`${sentence(f)}: a redirect that was not expected`, false, path);
    default:
      return absurd(kind);
  }
}
