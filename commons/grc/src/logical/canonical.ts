// Spec: 0004-grc-documents FR-003, FR-004
/**
 * The canonical form of a document and what is made from it: RFC 8785's JSON Canonicalization Scheme (members sorted by the UTF-16 code units of their names, numbers as ECMAScript writes them,
 * no white space), the SHA-256 of it as a document's digest, and the version 5 UUID that gives a derived thing the same id every time.
 *
 * @example
 * ```ts
 * import { canonicalize } from "./canonical.ts";
 * canonicalize({ b: 1, a: 2.0 }); // '{"a":2,"b":1}'
 * ```
 *
 * @module
 */
import { sha256, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { NAMESPACE_URL, type Uuid, uuidUrn, uuidV5, uuidV5Of } from "@intellectual-frontiers/crypto/uuid";

/** JSON's canonical form (RFC 8785); a value that JSON cannot hold (`undefined` members are dropped, as JSON drops them). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(Number.isFinite(value) ? value : null);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => Reflect.get(value, k) !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(Reflect.get(value, k))}`).join(",")}}`;
  }
  return "null";
}

/** The digest of a value: the SHA-256 of its canonical form, the same on every runtime. */
export function digestOf(value: unknown): Promise<Sha256> {
  return sha256(canonicalize(value));
}

let namespace: Promise<Uuid> | undefined;

/** The namespace of GRC's derived ids: the version 5 UUID of the URL namespace and `urn:grc`. */
export function grcNamespace(): Promise<Uuid> {
  namespace ??= uuidV5(NAMESPACE_URL, "urn:grc");
  return namespace;
}

/** The URN (`urn:uuid:...`) of a derived id: the same parts give the same id. */
export async function idOf(parts: readonly string[]): Promise<string> {
  return uuidUrn(await uuidV5Of(await grcNamespace(), parts));
}

/** The bare UUID of a derived id (OSCAL writes it without `urn:uuid:`). */
export async function uuidOf(parts: readonly string[]): Promise<string> {
  return uuidV5Of(await grcNamespace(), parts);
}
