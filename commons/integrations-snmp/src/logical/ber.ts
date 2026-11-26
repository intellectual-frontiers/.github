// Spec: 0002-snmp-connector FR-004
/**
 * The BER encoding of SNMP (ITU-T X.690) as a closed union and two total functions: `encode` from a value to bytes and `decode` from bytes to a value or the reason it is not one. Only what SNMPv3 needs is made: the integer, the octet string, the
 * null, the object identifier, the sequence, a constructed context-specific value (the PDUs), the application types of RFC 2578 and the three exceptions of a variable binding. A length is definite and at most four octets, a message must be read to its end, and a message
 * that is not in the form `encode` makes is refused where a digest is made over it.
 *
 * @example
 * ```ts
 * import { decode, encode } from "./ber.ts";
 * decode(encode({ kind: "int", value: 7n })); // ok
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A value of BER. */
export type Ber =
  | { readonly kind: "int"; readonly value: bigint }
  | { readonly kind: "octets"; readonly value: Uint8Array }
  | { readonly kind: "null" }
  | { readonly kind: "oid"; readonly value: string }
  | { readonly kind: "seq"; readonly items: readonly Ber[] }
  | { readonly kind: "ctx"; readonly tag: number; readonly items: readonly Ber[] }
  | { readonly kind: "app"; readonly tag: number; readonly value: Uint8Array }
  | { readonly kind: "exc"; readonly tag: number };

/** Why bytes are not a value. */
export type BerError = { readonly kind: "truncated" } | { readonly kind: "length" } | { readonly kind: "tag"; readonly tag: number } | { readonly kind: "oid" } | { readonly kind: "trailing" } | { readonly kind: "depth" };

/** The tag numbers this module knows. */
export const TAG = { int: 0x02, octets: 0x04, null: 0x05, oid: 0x06, seq: 0x30 } as const;
const MAX_DEPTH = 16;
const MAX_LENGTH = 0xffff_ffff;

/** An integer of the given value. */
export const int = (value: number | bigint): Ber => ({ kind: "int", value: BigInt(value) });
/** An octet string of the given bytes. */
export const octets = (value: Uint8Array): Ber => ({ kind: "octets", value });
/** A sequence. */
export const seq = (...items: readonly Ber[]): Ber => ({ kind: "seq", items });
/** An object identifier from its dotted text. */
export const oid = (value: string): Ber => ({ kind: "oid", value });
/** The null. */
export const nul: Ber = { kind: "null" };

function lengthBytes(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const out: number[] = [];
  let v = n;
  while (v > 0) {
    out.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Uint8Array.of(0x80 | out.length, ...out);
}

function tlv(tag: number, body: Uint8Array): Uint8Array {
  const len = lengthBytes(body.length);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

function intBytes(v: bigint): Uint8Array {
  const out: number[] = [];
  let x = v;
  for (;;) {
    out.unshift(Number(x & 0xffn));
    x >>= 8n;
    const last = out[0] ?? 0;
    if ((x === 0n && (last & 0x80) === 0) || (x === -1n && (last & 0x80) !== 0)) break;
  }
  return Uint8Array.from(out);
}

function oidBytes(text: string): Uint8Array {
  const arcs = text.split(".").map(Number);
  const first = (arcs[0] ?? 0) * 40 + (arcs[1] ?? 0);
  const out: number[] = [];
  for (const arc of [first, ...arcs.slice(2)]) {
    const part: number[] = [arc & 0x7f];
    let v = Math.floor(arc / 128);
    while (v > 0) {
      part.unshift((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    out.push(...part);
  }
  return Uint8Array.from(out);
}

/** The bytes of a value. */
export function encode(b: Ber): Uint8Array {
  switch (b.kind) {
    case "int":
      return tlv(TAG.int, intBytes(b.value));
    case "octets":
      return tlv(TAG.octets, b.value);
    case "null":
      return tlv(TAG.null, new Uint8Array());
    case "oid":
      return tlv(TAG.oid, oidBytes(b.value));
    case "seq":
      return tlv(TAG.seq, concat(b.items.map(encode)));
    case "ctx":
      return tlv(0xa0 | b.tag, concat(b.items.map(encode)));
    case "app":
      return tlv(0x40 | b.tag, b.value);
    case "exc":
      return tlv(0x80 | b.tag, new Uint8Array());
  }
}

type Read = { readonly value: Ber; readonly next: number };

function readLength(bytes: Uint8Array, at: number): Result<{ readonly length: number; readonly next: number }, BerError> {
  const first = bytes[at];
  if (first === undefined) return err({ kind: "truncated" });
  if (first < 0x80) return ok({ length: first, next: at + 1 });
  const count = first & 0x7f;
  if (count === 0 || count > 4) return err({ kind: "length" });
  let length = 0;
  for (let i = 0; i < count; i += 1) {
    const b = bytes[at + 1 + i];
    if (b === undefined) return err({ kind: "truncated" });
    length = length * 256 + b;
  }
  if (length > MAX_LENGTH) return err({ kind: "length" });
  return ok({ length, next: at + 1 + count });
}

function oidText(body: Uint8Array): Result<string, BerError> {
  if (body.length === 0) return err({ kind: "oid" });
  const arcs: number[] = [];
  let v = 0;
  let open = false;
  for (const b of body) {
    v = v * 128 + (b & 0x7f);
    open = (b & 0x80) !== 0;
    if (!open) {
      arcs.push(v);
      v = 0;
    }
    if (v > Number.MAX_SAFE_INTEGER / 128) return err({ kind: "oid" });
  }
  if (open) return err({ kind: "oid" });
  const head = arcs[0] ?? 0;
  const first = head < 80 ? [Math.floor(head / 40), head % 40] : [2, head - 80];
  return ok([...first, ...arcs.slice(1)].join("."));
}

function items(bytes: Uint8Array, depth: number): Result<readonly Ber[], BerError> {
  const out: Ber[] = [];
  let at = 0;
  while (at < bytes.length) {
    const r = read(bytes, at, depth);
    if (r.kind === "err") return r;
    out.push(r.value.value);
    at = r.value.next;
  }
  return ok(out);
}

function read(bytes: Uint8Array, at: number, depth: number): Result<Read, BerError> {
  if (depth > MAX_DEPTH) return err({ kind: "depth" });
  const tag = bytes[at];
  if (tag === undefined) return err({ kind: "truncated" });
  const len = readLength(bytes, at + 1);
  if (len.kind === "err") return len;
  const end = len.value.next + len.value.length;
  if (end > bytes.length) return err({ kind: "truncated" });
  const body = bytes.subarray(len.value.next, end);
  const next = end;
  const done = (value: Ber): Result<Read, BerError> => ok({ value, next });
  switch (tag) {
    case TAG.int: {
      if (body.length === 0) return err({ kind: "length" });
      let v = 0n;
      for (const b of body) v = (v << 8n) | BigInt(b);
      if ((body[0] ?? 0) & 0x80) v -= 1n << BigInt(8 * body.length);
      return done({ kind: "int", value: v });
    }
    case TAG.octets:
      return done({ kind: "octets", value: body.slice() });
    case TAG.null:
      return body.length === 0 ? done({ kind: "null" }) : err({ kind: "length" });
    case TAG.oid: {
      const t = oidText(body);
      return t.kind === "err" ? t : done({ kind: "oid", value: t.value });
    }
    case TAG.seq: {
      const inner = items(body, depth + 1);
      return inner.kind === "err" ? inner : done({ kind: "seq", items: inner.value });
    }
    default:
      if ((tag & 0xe0) === 0xa0) {
        const inner = items(body, depth + 1);
        return inner.kind === "err" ? inner : done({ kind: "ctx", tag: tag & 0x1f, items: inner.value });
      }
      if ((tag & 0xe0) === 0x40) return done({ kind: "app", tag: tag & 0x1f, value: body.slice() });
      if ((tag & 0xe0) === 0x80 && body.length === 0) return done({ kind: "exc", tag: tag & 0x1f });
      return err({ kind: "tag", tag });
  }
}

/** The value of bytes that are exactly one value, or why they are not. */
export function decode(bytes: Uint8Array): Result<Ber, BerError> {
  const r = read(bytes, 0, 0);
  if (r.kind === "err") return r;
  return r.value.next === bytes.length ? ok(r.value.value) : err({ kind: "trailing" });
}

/** Whether two byte strings are the same. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return d === 0;
}

/** The bytes as lower case hexadecimal. */
export const hexOf = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** The bytes of lower case hexadecimal text, or `undefined` where it is not even-length hexadecimal. */
export function bytesOfHex(text: string): Uint8Array | undefined {
  if (!/^([0-9a-f]{2})*$/iu.test(text)) return undefined;
  return Uint8Array.from(text.match(/../gu) ?? [], (h) => parseInt(h, 16));
}

/** Two byte strings made one. */
export const join = concat;
