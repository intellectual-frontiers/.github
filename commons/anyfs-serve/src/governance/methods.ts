// Spec: 0002-anyfs-serve-governance FR-001
/**
 * The methods the server answers, as a closed union: the twelve of WebDAV class 1 and 2 that an object store can carry. A method that is not one of them is answered `405` with the list in `Allow`.
 *
 * @example
 * ```ts
 * import { parseMethod } from "./methods.ts";
 * parseMethod("PROPFIND"); // "PROPFIND"
 * parseMethod("PATCH"); // undefined
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** The methods, in the order of the `Allow` header. */
export const DAV_METHODS = ["OPTIONS", "GET", "HEAD", "PUT", "DELETE", "MKCOL", "COPY", "MOVE", "PROPFIND", "PROPPATCH", "LOCK", "UNLOCK"] as const;
/** One method. */
export type DavMethod = (typeof DAV_METHODS)[number];

/** The method a text names, or nothing: method names are upper case and exact. */
export function parseMethod(text: string): DavMethod | undefined {
  return (DAV_METHODS as readonly string[]).includes(text) ? (text as DavMethod) : undefined;
}

/** Whether a method changes the store: these need the capability to write and a lock the caller holds. */
export function changesStore(method: DavMethod): boolean {
  switch (method) {
    case "PUT":
    case "DELETE":
    case "MKCOL":
    case "COPY":
    case "MOVE":
    case "PROPPATCH":
    case "LOCK":
      return true;
    case "OPTIONS":
    case "GET":
    case "HEAD":
    case "PROPFIND":
    case "UNLOCK":
      return false;
    default:
      return absurd(method);
  }
}

/** The value of the `Allow` header for a store that can write or one that cannot. */
export function allowedMethods(writable: boolean, locks: boolean): readonly DavMethod[] {
  return DAV_METHODS.filter((m) => (writable || !changesStore(m)) && (locks || (m !== "LOCK" && m !== "UNLOCK")));
}
