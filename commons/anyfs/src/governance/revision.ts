// Spec: 0002-anyfs-governance FR-003
/**
 * The revision of an object and the cursor of a list, each a branded text made only by its parser. A revision is `scheme:value`: the scheme says what the value is (`sha256` the digest of the bytes,
 * `etag` an entity tag, `git` an object id, `ver` a version a service gave), and two revisions are equal when their texts are, so that a write which expects one can be decided by any backend.
 *
 * @example
 * ```ts
 * import { parseRevision, schemeOf } from "./revision.ts";
 * const r = parseRevision("sha256:ab12");
 * r.kind === "ok" && schemeOf(r.value); // "sha256"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** The identity of one state of an object: `scheme:value`. Made only by `parseRevision`. */
export type Revision = Brand<string, "anyfs revision">;
/** Where a list resumes: opaque to the caller. Made only by `parseCursor`. */
export type Cursor = Brand<string, "anyfs cursor">;

const REVISION = /^[a-z][a-z0-9]*:[!-~]+$/u;
const CURSOR = /^[!-~]+$/u;

/** A revision from text, or the reason it is not one: a lower case scheme, a colon and printable ASCII with no space, at most 256 characters. */
export function parseRevision(text: string): Result<Revision, string> {
  return text.length <= 256 && REVISION.test(text)
    ? ok(text as Revision)
    : err(`${JSON.stringify(text.slice(0, 40))} is not a revision: a lower case scheme, a colon and printable ASCII with no space, at most 256 characters`);
}

/** A cursor from text, or the reason it is not one: printable ASCII with no space, at most 1024 characters. */
export function parseCursor(text: string): Result<Cursor, string> {
  return text.length <= 1024 && CURSOR.test(text) ? ok(text as Cursor) : err(`${JSON.stringify(text.slice(0, 40))} is not a cursor: printable ASCII with no space, at most 1024 characters`);
}

/** The scheme of a revision: what its value is. */
export function schemeOf(revision: Revision): string {
  return revision.slice(0, revision.indexOf(":"));
}
