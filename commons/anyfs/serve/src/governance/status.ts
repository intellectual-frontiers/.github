// Spec: 0002-anyfs-serve-governance FR-002, FR-003
/**
 * The statuses the server gives, as a closed list, and the total table from the code of the POSIX view to the status: what a local file system would have said as an `errno` is said here as the status a WebDAV
 * client expects. A few codes mean something else in a few methods (an existing name is `405` for a new collection and `412` for a copy that may not overwrite), so the table takes the context.
 *
 * @example
 * ```ts
 * import { statusOfErrno } from "./status.ts";
 * statusOfErrno("ENOENT", "other"); // 404
 * statusOfErrno("EEXIST", "mkcol"); // 405
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Errno } from "@intellectual-frontiers/anyfs-posix/governance";

/** The statuses the server gives. */
export const STATUSES = [200, 201, 204, 206, 207, 304, 400, 401, 403, 404, 405, 409, 412, 413, 414, 415, 416, 423, 424, 500, 501, 502, 503] as const;
/** One status. */
export type Status = (typeof STATUSES)[number];

/** The words of a status. */
export const STATUS_TEXT: Readonly<Record<Status, string>> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  206: "Partial Content",
  207: "Multi-Status",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  412: "Precondition Failed",
  413: "Content Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  423: "Locked",
  424: "Failed Dependency",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

/** The status line of a multistatus body. */
export function statusLine(status: Status): string {
  return `HTTP/1.1 ${status} ${STATUS_TEXT[status]}`;
}

/** What a request was doing when the view said no: the one thing that changes what a code means. */
export type Context = "mkcol" | "exclusive" | "move-copy" | "other";

/** The status of a code, in a context: a registry with one entry for each code, which the compiler holds. */
export function statusOfErrno(errno: Errno, context: Context): Status {
  switch (errno) {
    case "EACCES":
    case "EROFS":
      return 403;
    case "EBADF":
      return 500;
    case "EEXIST":
      return context === "mkcol" ? 405 : context === "exclusive" || context === "move-copy" ? 412 : 409;
    case "EFBIG":
      return 413;
    case "EINVAL":
      return 400;
    case "EIO":
    case "EXDEV":
      return 502;
    case "EISDIR":
      return 405;
    case "ENAMETOOLONG":
      return 414;
    case "ENOENT":
      return 404;
    case "ENOTDIR":
    case "ENOTEMPTY":
      return 409;
    case "ENOTSUP":
      return 501;
    case "ESTALE":
      return 412;
    default:
      return absurd(errno);
  }
}

/** Whether the status of a store that is not there now is one a client should try again: 503 with a wait. */
export const RETRY_AFTER_SECONDS = 5;
