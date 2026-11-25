// Spec: 0001-formats FR-009
/**
 * ASN.1 DER (ITU-T X.690), encoded and read with no outside package (commons 0001-formats FR-009): every value a tag, a length
 * and its content, as bytes; enough to build CMS structures (RFC 5652) and read the fields of an X.509 certificate (RFC 5280). Encoders
 * give the one DER form (minimal lengths and integers, a SET OF sorted); a malformed input to an encoder (an OID that is not dotted
 * numbers) is a programming error and throws a `RangeError`. Readers return a `Result`: what is not DER this reader knows is an error
 * saying where. Negative integers and integers are read.
 *
 * @example
 * ```ts
 * import { oid, readOid, readTlv } from "./der.ts";
 * const t = readTlv(oid("1.2.840.113549.1.7.1"));
 * if (t.kind === "ok") readOid(t.value.content); // { kind: "ok", value: "1.2.840.113549.1.7.1" }
 * ```
 *
 * @module
 */
import { concat } from "./archive.ts";
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The universal tags used (class universal, with the constructed bit where it applies). */
export const TAG = {
  boolean: 0x01,
  integer: 0x02,
  bitString: 0x03,
  octetString: 0x04,
  null: 0x05,
  oid: 0x06,
  utf8String: 0x0c,
  printableString: 0x13,
  ia5String: 0x16,
  utcTime: 0x17,
  generalizedTime: 0x18,
  sequence: 0x30,
  set: 0x31,
} as const;

/** Why bytes are not DER this reader knows: what, and at which byte. */
export type DerError = { readonly kind: "der"; readonly at: number; readonly message: string };

/** One element read: its tag byte, its content, and its whole encoding (to copy it into another structure). */
export type Tlv = { readonly tag: number; readonly content: Uint8Array; readonly raw: Uint8Array };

/** A DER length: the short form below 128, else `0x80` with the number of length bytes, then the bytes. */
export function encodeLength(n: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`DER: no length ${n}`);
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 256)) bytes.unshift(x & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

/** One element: the tag byte, the content's length, the content. */
export function tlv(tag: number, content: Uint8Array): Uint8Array {
  if (!Number.isInteger(tag) || tag < 0 || tag > 0xff || (tag & 0x1f) === 0x1f)
    throw new RangeError(`DER: no tag byte ${tag} (high tag numbers are not written)`);
  return concat([Uint8Array.of(tag), encodeLength(content.length), content]);
}

/** A SEQUENCE of these encodings, in order. */
export function sequence(...items: readonly Uint8Array[]): Uint8Array {
  return tlv(TAG.sequence, concat(items));
}

/** Two byte strings compared as DER sorts them: byte by byte, a prefix first. */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/** A SET OF these encodings, sorted as DER requires (X.690 §11.6). */
export function setOf(...items: readonly Uint8Array[]): Uint8Array {
  return tlv(TAG.set, concat([...items].sort(compareBytes)));
}

/** An OCTET STRING. */
export function octetString(b: Uint8Array): Uint8Array {
  return tlv(TAG.octetString, b);
}

/** A BIT STRING of whole bytes (no unused bits). */
export function bitString(b: Uint8Array): Uint8Array {
  return tlv(TAG.bitString, concat([Uint8Array.of(0), b]));
}

/** A UTF8String. */
export function utf8String(s: string): Uint8Array {
  return tlv(TAG.utf8String, new TextEncoder().encode(s));
}

/** A BOOLEAN. */
export function boolean(v: boolean): Uint8Array {
  return tlv(TAG.boolean, Uint8Array.of(v ? 0xff : 0));
}

/** NULL. */
export function derNull(): Uint8Array {
  return Uint8Array.of(TAG.null, 0);
}

/** The minimal two's complement bytes of an integer: no redundant leading `0x00` or `0xff`. */
function twosComplement(v: bigint): number[] {
  const bytes: number[] = [];
  let x = v;
  for (;;) {
    bytes.unshift(Number(BigInt.asUintN(8, x)));
    x >>= 8n;
    const top = bytes[0] ?? 0;
    if ((x === 0n && top < 0x80) || (x === -1n && top >= 0x80)) return bytes;
  }
}

/** An INTEGER: a JavaScript integer or a bigint (negative too), or big-endian unsigned magnitude bytes; always in its minimal form. */
export function integer(v: number | bigint | Uint8Array): Uint8Array {
  if (v instanceof Uint8Array) {
    let n = 0n;
    for (const b of v) n = (n << 8n) | BigInt(b);
    return tlv(TAG.integer, Uint8Array.from(twosComplement(n)));
  }
  if (typeof v === "number" && !Number.isSafeInteger(v)) throw new RangeError(`DER: no integer ${v}`);
  return tlv(TAG.integer, Uint8Array.from(twosComplement(BigInt(v))));
}

/** An OBJECT IDENTIFIER from its dotted form (`1.2.840.113549`). */
export function oid(dotted: string): Uint8Array {
  if (!/^\d+(\.\d+)+$/.test(dotted)) throw new RangeError(`DER: no OID ${dotted}`);
  const arcs = dotted.split(".").map((s) => BigInt(s));
  const [a = 0n, b = 0n] = arcs;
  if (a > 2n || (a < 2n && b > 39n)) throw new RangeError(`DER: no OID ${dotted}`);
  const out: number[] = [];
  const base128 = (n: bigint): void => {
    const g: number[] = [Number(n & 0x7fn)];
    for (let x = n >> 7n; x > 0n; x >>= 7n) g.unshift(Number(x & 0x7fn) | 0x80);
    out.push(...g);
  };
  base128(a * 40n + b);
  for (const arc of arcs.slice(2)) base128(arc);
  return tlv(TAG.oid, Uint8Array.from(out));
}

/** A context-specific EXPLICIT tag `[n]` around one encoding. */
export function explicit(n: number, inner: Uint8Array): Uint8Array {
  return tlv(0xa0 | n, inner);
}

/** A context-specific IMPLICIT tag `[n]`: this content under the tag, constructed where the underlying type is. */
export function implicit(n: number, content: Uint8Array, constructed: boolean): Uint8Array {
  return tlv((constructed ? 0xa0 : 0x80) | n, content);
}

/** An AlgorithmIdentifier: `SEQUENCE { algorithm OID, parameters ANY OPTIONAL }`. */
export function algorithm(id: string, params?: Uint8Array): Uint8Array {
  return params === undefined ? sequence(oid(id)) : sequence(oid(id), params);
}

/** The element that starts at `offset`: its tag, its content and its whole encoding; or why it is not DER this reader knows. */
export function readTlv(bytes: Uint8Array, offset = 0): Result<Tlv, DerError> {
  const fail = (at: number, message: string): Result<never, DerError> => err({ kind: "der", at, message });
  const tag = bytes[offset];
  if (tag === undefined) return fail(offset, "no tag (the bytes end)");
  if ((tag & 0x1f) === 0x1f) return fail(offset, "a high tag number (not read)");
  let i = offset + 1;
  const first = bytes[i++];
  if (first === undefined) return fail(offset + 1, "no length (the bytes end)");
  let length = first;
  if ((first & 0x80) !== 0) {
    const n = first & 0x7f;
    if (n === 0) return fail(offset + 1, "an indefinite length (not DER)");
    if (n > 6) return fail(offset + 1, "a length too long to hold");
    length = 0;
    for (let k = 0; k < n; k++) {
      const b = bytes[i++];
      if (b === undefined) return fail(i - 1, "the rest of the length (the bytes end)");
      length = length * 256 + b;
    }
    if (length < 0x80 || (n > 1 && bytes[offset + 2] === 0)) return fail(offset + 1, "the shortest form of the length (DER)");
  }
  if (i + length > bytes.length) return fail(i, `${length} bytes of content (only ${bytes.length - i} are left)`);
  return ok({ tag, content: bytes.subarray(i, i + length), raw: bytes.subarray(offset, i + length) });
}

/** The elements inside a constructed element's content, in order. */
export function children(content: Uint8Array): Result<readonly Tlv[], DerError> {
  const out: Tlv[] = [];
  for (let i = 0; i < content.length;) {
    const t = readTlv(content, i);
    if (t.kind === "err") return t;
    out.push(t.value);
    i += t.value.raw.length;
  }
  return ok(out);
}

/** The dotted form of an OBJECT IDENTIFIER's content. */
export function readOid(content: Uint8Array): Result<string, DerError> {
  const arcs: bigint[] = [];
  let v = 0n;
  for (const [i, b] of content.entries()) {
    if (v === 0n && b === 0x80) return err({ kind: "der", at: i, message: "an OID arc with no leading 0x80 (DER)" });
    v = (v << 7n) | BigInt(b & 0x7f);
    if ((b & 0x80) === 0) {
      arcs.push(v);
      v = 0n;
    }
  }
  if (arcs.length === 0 || (content.at(-1) ?? 0) & 0x80) return err({ kind: "der", at: content.length, message: "a complete OID" });
  const head = arcs[0] ?? 0n;
  const first = head < 80n ? head / 40n : 2n;
  return ok([first, head - first * 40n, ...arcs.slice(1)].join("."));
}

/** The value of an INTEGER's content, as a bigint (two's complement). */
export function readInteger(content: Uint8Array): Result<bigint, DerError> {
  if (content.length === 0) return err({ kind: "der", at: 0, message: "an integer of at least one byte" });
  if (content.length > 1 && ((content[0] === 0 && (content[1] ?? 0) < 0x80) || (content[0] === 0xff && (content[1] ?? 0) >= 0x80))) {
    return err({ kind: "der", at: 0, message: "the shortest form of the integer (DER)" });
  }
  let n = 0n;
  for (const b of content) n = (n << 8n) | BigInt(b);
  return ok(BigInt.asIntN(content.length * 8, n));
}
