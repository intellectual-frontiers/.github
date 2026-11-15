/**
 * UUIDs (RFC 9562): the branded `Uuid`, its text form read and written, the name-based version 5 (SHA-1 of a namespace and a name) and the
 * namespaces RFC 9562 defines (Appendix A.4: DNS, URL, OID, X.500). A version 5 UUID is the same for the same namespace and name on every
 * runtime, so the standard formats name what they describe by it and the same input gives the same document (commons 0007-grc FR-017,
 * FR-018). SHA-1 is Web Crypto's (`crypto.subtle.digest`), so `uuidV5` is asynchronous; it is used here as RFC 9562 uses it, to name, not
 * to protect.
 *
 * @example
 * ```ts
 * import { NAMESPACE_DNS, uuidV5 } from "./uuid.ts";
 * await uuidV5(NAMESPACE_DNS, "www.example.com"); // "2ed6657d-e927-568b-95e1-2665a8aea6a2"
 * ```
 *
 * @module
 */
import type { Brand } from "./brand.ts";
import { type Decoder, describe } from "./decode.ts";
import { err, ok } from "./result.ts";
import { fromHex, toHex } from "./sha256.ts";

/** A UUID in RFC 9562's text form, lower-case: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`; made only by `uuidOf`, `uuidFromBytes` and `uuidV5`. */
export type Uuid = Brand<string, "Uuid">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Text as a `Uuid` (any case, with or without a `urn:uuid:` prefix), lower-cased; undefined where it is not one. */
export function uuidOf(text: string): Uuid | undefined {
  const t = text.trim().toLowerCase();
  const bare = t.startsWith("urn:uuid:") ? t.slice("urn:uuid:".length) : t;
  return UUID.test(bare) ? (bare as Uuid) : undefined; // checked against the text form just above
}

/** Sixteen bytes as a `Uuid`, or undefined where there are not sixteen. */
export function uuidFromBytes(bytes: Uint8Array): Uuid | undefined {
  if (bytes.length !== 16) return undefined;
  const x = toHex(bytes);
  return uuidOf(`${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`);
}

/** A UUID's sixteen bytes. */
export function uuidBytes(u: Uuid): Uint8Array {
  return fromHex(u.replaceAll("-", "")) ?? new Uint8Array(16);
}

/** A UUID's version, the high four bits of its seventh byte (5 for a name-based UUID with SHA-1). */
export function uuidVersion(u: Uuid): number {
  return Number.parseInt(u.charAt(14), 16);
}

/** A UUID as a URN, `urn:uuid:...` (RFC 9562 Section 4). */
export function uuidUrn(u: Uuid): `urn:uuid:${string}` {
  return `urn:uuid:${u}`;
}

function constant(text: string): Uuid {
  const u = uuidOf(text);
  if (u === undefined) throw new Error(`not a UUID: ${text}`);
  return u;
}

/** The Nil UUID, all zeros (RFC 9562 Section 5.9). */
export const NIL_UUID: Uuid = constant("00000000-0000-0000-0000-000000000000");

/** The namespace of fully qualified domain names (RFC 9562 Section 6.6). */
export const NAMESPACE_DNS: Uuid = constant("6ba7b810-9dad-11d1-80b4-00c04fd430c8");

/** The namespace of URLs (RFC 9562 Section 6.6). */
export const NAMESPACE_URL: Uuid = constant("6ba7b811-9dad-11d1-80b4-00c04fd430c8");

/** The namespace of ISO object identifiers (RFC 9562 Section 6.6). */
export const NAMESPACE_OID: Uuid = constant("6ba7b812-9dad-11d1-80b4-00c04fd430c8");

/** The namespace of X.500 distinguished names, in DER or text (RFC 9562 Section 6.6). */
export const NAMESPACE_X500: Uuid = constant("6ba7b814-9dad-11d1-80b4-00c04fd430c8");

const utf8 = new TextEncoder();

/**
 * The version 5 UUID of a name in a namespace (RFC 9562 Section 5.5): the first sixteen bytes of SHA-1 over the namespace's bytes and then
 * the name's (a string is taken as UTF-8), with the version (5) and the variant (`10`) set.
 */
export async function uuidV5(namespace: Uuid, name: string | Uint8Array): Promise<Uuid> {
  const ns = uuidBytes(namespace);
  const n = typeof name === "string" ? utf8.encode(name) : name;
  const input = new Uint8Array(ns.length + n.length);
  input.set(ns);
  input.set(n, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input)).slice(0, 16);
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  return uuidFromBytes(hash) ?? NIL_UUID;
}

/**
 * A stable name made of parts, for `uuidV5`: the parts as a JSON array, so that no two lists of parts give the same name (`["a/b"]` and
 * `["a", "b"]` stay apart).
 */
export function nameOf(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

/** The version 5 UUID of a name made of parts (`nameOf`) in a namespace. */
export function uuidV5Of(namespace: Uuid, parts: readonly string[]): Promise<Uuid> {
  return uuidV5(namespace, nameOf(parts));
}

/** The decoder of a UUID in text (any case, or a `urn:uuid:` URN). */
export const uuidDecoder: Decoder<Uuid> = (input, path = "$") => {
  const u = typeof input === "string" ? uuidOf(input) : undefined;
  return u === undefined ? err({ kind: "decode", path, expected: "a UUID", found: describe(input) }) : ok(u);
};
