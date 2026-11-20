// Spec: 0001-system FR-001
/**
 * The errors the runtime throws (commons 0005-typescript-runtime FR-019): one class for each kind a caller acts on, by plain names (`errors.NotFound`), each made from the `code` Node gives
 * (`ENOENT`, `EEXIST`, `EACCES`, ...), keeping that code, the path or address where there is one, and the original error as its `cause`.
 * The runtime throws; `Result` belongs to the layers above, which turn these into their own errors.
 *
 * @example
 * ```ts
 * import { errors } from "./errors.ts";
 * import { readTextFile } from "./fs.ts";
 * try {
 *   await readTextFile("/no/such/file");
 * } catch (e) {
 *   if (e instanceof errors.NotFound) console.log("not there");
 *   else throw e;
 * }
 * ```
 *
 * @module
 */

/** What every error of the runtime carries: the code the host gave and, for a file or an address, where. */
export class RuntimeError extends Error {
  /** The host's error code (`ENOENT`, `EACCES`, ...), or `""` where it gave none. */
  readonly code: string;
  /** The path, or the address, the failed call was about, where there was one. */
  readonly path: string | undefined;
  /** Make one from a message, the host's code, the path and the error it stands for. */
  constructor(message: string, code: string, path?: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.code = code;
    this.path = path;
  }
  /** The class's own name, so a stack trace says `NotFound` and not `Error`. */
  override get name(): string {
    return this.constructor.name;
  }
}

/** Nothing is at the path, or no such program (`ENOENT`). */
export class NotFound extends RuntimeError {}
/** Something is already at the path (`EEXIST`). */
export class AlreadyExists extends RuntimeError {}
/** The account may not do this (`EACCES`, `EPERM`). */
export class PermissionDenied extends RuntimeError {}
/** A folder was given where a file was needed (`EISDIR`). */
export class IsADirectory extends RuntimeError {}
/** A file was given where a folder was needed (`ENOTDIR`). */
export class NotADirectory extends RuntimeError {}
/** A folder that must be empty is not (`ENOTEMPTY`). */
export class DirectoryNotEmpty extends RuntimeError {}
/** Links point at each other with no end (`ELOOP`). */
export class FilesystemLoop extends RuntimeError {}
/** The resource is in use (`EBUSY`, `ETXTBSY`). */
export class Busy extends RuntimeError {}
/** The address is already in use (`EADDRINUSE`). */
export class AddrInUse extends RuntimeError {}
/** The address cannot be used on this computer (`EADDRNOTAVAIL`). */
export class AddrNotAvailable extends RuntimeError {}
/** Nothing listens at the address (`ECONNREFUSED`). */
export class ConnectionRefused extends RuntimeError {}
/** The other end reset the connection (`ECONNRESET`). */
export class ConnectionReset extends RuntimeError {}
/** The connection was aborted (`ECONNABORTED`). */
export class ConnectionAborted extends RuntimeError {}
/** The other end of a pipe was closed (`EPIPE`). */
export class BrokenPipe extends RuntimeError {}
/** The call took too long (`ETIMEDOUT`). */
export class TimedOut extends RuntimeError {}
/** A signal interrupted the call (`EINTR`). */
export class Interrupted extends RuntimeError {}
/** The network cannot be reached (`ENETUNREACH`, `EHOSTUNREACH`). */
export class NetworkUnreachable extends RuntimeError {}
/** The data was not what was expected (`EINVAL` on data, a bad archive or encoding). */
export class InvalidData extends RuntimeError {}
/** This platform or file system cannot do it (`ENOSYS`, `ENOTSUP`, `EXDEV` across devices). */
export class NotSupported extends RuntimeError {}
/** The end of the data came before what was needed. */
export class UnexpectedEof extends RuntimeError {}

/** The error classes by name. */
export const errors = {
  RuntimeError,
  NotFound,
  AlreadyExists,
  PermissionDenied,
  IsADirectory,
  NotADirectory,
  DirectoryNotEmpty,
  FilesystemLoop,
  Busy,
  AddrInUse,
  AddrNotAvailable,
  ConnectionRefused,
  ConnectionReset,
  ConnectionAborted,
  BrokenPipe,
  TimedOut,
  Interrupted,
  NetworkUnreachable,
  InvalidData,
  NotSupported,
  UnexpectedEof,
} as const;

type ErrorClass = new (message: string, code: string, path?: string, cause?: unknown) => RuntimeError;

/** The class each Node error code becomes. */
export const BY_CODE: Readonly<Record<string, ErrorClass>> = {
  ENOENT: NotFound,
  EEXIST: AlreadyExists,
  EACCES: PermissionDenied,
  EPERM: PermissionDenied,
  EISDIR: IsADirectory,
  ENOTDIR: NotADirectory,
  ENOTEMPTY: DirectoryNotEmpty,
  ELOOP: FilesystemLoop,
  EBUSY: Busy,
  ETXTBSY: Busy,
  EADDRINUSE: AddrInUse,
  EADDRNOTAVAIL: AddrNotAvailable,
  ECONNREFUSED: ConnectionRefused,
  ECONNRESET: ConnectionReset,
  ECONNABORTED: ConnectionAborted,
  EPIPE: BrokenPipe,
  ETIMEDOUT: TimedOut,
  EINTR: Interrupted,
  ENETUNREACH: NetworkUnreachable,
  EHOSTUNREACH: NetworkUnreachable,
  EINVAL: InvalidData,
  ENOSYS: NotSupported,
  ENOTSUP: NotSupported,
  EXDEV: NotSupported,
};

const field = (e: object, key: string): string | undefined => {
  const v: unknown = Reflect.get(e, key);
  return typeof v === "string" ? v : undefined;
};

/** What was thrown or rejected, as an `Error`: an `Error` as it is, anything else wrapped, kept as the cause. */
export function toError(thrown: unknown, message = "a value that is not an Error was thrown"): Error {
  return thrown instanceof Error ? thrown : new Error(message, { cause: thrown });
}

/**
 * What the host threw, as an error of the runtime: an error that carries a known `code` becomes its class (keeping the message, code,
 * path and the original as its cause); any other `Error`, a runtime error among them, is returned as it is; anything else is wrapped by
 * {@link toError}.
 */
export function mapError(thrown: unknown, path?: string): Error {
  if (thrown instanceof RuntimeError || typeof thrown !== "object" || thrown === null) return toError(thrown);
  const code = field(thrown, "code");
  const Class = code === undefined ? undefined : BY_CODE[code];
  if (code === undefined || Class === undefined) return toError(thrown);
  const message = thrown instanceof Error ? thrown.message : (field(thrown, "message") ?? code);
  return new Class(message, code, field(thrown, "path") ?? field(thrown, "address") ?? path, thrown);
}

/** Run a call on the host and throw what it throws as an error of the runtime. */
export async function hostCall<T>(path: string | undefined, f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw mapError(e, path);
  }
}

/** The same, for a call that does not wait. */
export function hostCallSync<T>(path: string | undefined, f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw mapError(e, path);
  }
}
