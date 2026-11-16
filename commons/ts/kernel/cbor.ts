/**
 * CBOR (RFC 8949), read and written with no outside package (commons 0014-webauthn FR-001): what WebAuthn's attestation objects and COSE
 * keys are made of. The reader takes the definite-length forms of every major type (unsigned and negative integers, byte and text
 * strings, arrays, maps, tags, the simple values `false`, `true`, `null` and `undefined`, and half, single and double floats) and returns a
 * `Result` whose error says what and at which byte: an indefinite length, a reserved additional value, text that is not UTF-8, a map key
 * that is neither an integer nor a text string, a key given twice, nesting deeper than 64 levels, or bytes left over. An integer beyond
 * `Number.MAX_SAFE_INTEGER` is a `bigint`. The writer gives the core deterministic encoding (RFC 8949 §4.2.1): the shortest heads, definite
 * lengths and map keys sorted by their encoded bytes, so the same value is the same bytes every time.
 *
 * @example
 * ```ts
 * import { type CborValue, decodeCbor, encodeCbor } from "./cbor.ts";
 * const bytes = encodeCbor(new Map<number | string, CborValue>([[1, 2], ["a", [true, null]]]));
 * decodeCbor(bytes); // { kind: "ok", value: Map { 1 => 2, "a" => [true, null] } }
 * ```
 *
 * @limits
 * Indefinite-length strings, arrays and maps are refused (WebAuthn and COSE never use them); simple values other than the four named are
 * refused; a float is written only as a double, and a map key may only be an integer or a text string.
 *
 * @module
 */
import { concat } from "./archive.ts";
import { compareBytes } from "./der.ts";
import { err, ok, type Result } from "./result.ts";

/** A map key this module reads and writes: an integer or a text string. */
export type CborKey = number | bigint | string;

/** A tagged value (major type 6): its tag number and the value it tags. */
export type CborTagged = { readonly tag: number | bigint; readonly value: CborValue };

/** A CBOR data item as a value: integers (a `bigint` beyond the safe range), floats, strings, bytes, arrays, maps, tags and simple values. */
export type CborValue =
  number | bigint | string | Uint8Array | boolean | null | undefined | readonly CborValue[] | ReadonlyMap<CborKey, CborValue> | CborTagged;

/** Why bytes are not CBOR this reader takes: what, and at which byte. */
export type CborError = { readonly kind: "cbor"; readonly at: number; readonly message: string };

/** One data item read from a longer input: its value and the offset just after it. */
export type CborItem = { readonly value: CborValue; readonly end: number };

/** The deepest nesting of arrays, maps and tags read. */
export const MAX_DEPTH = 64;

/** A CBOR error as one line. */
export function formatCborError(e: CborError): string {
  return `CBOR at byte ${e.at}: ${e.message}`;
}

/** Whether a value is a tagged value (rather than a map, an array or bytes). */
export function isTagged(value: CborValue): value is CborTagged {
  return typeof value === "object" && value !== null && !(value instanceof Uint8Array) && !(value instanceof Map) && !Array.isArray(value);
}

/** Whether a value is a map. */
export function isMap(value: CborValue): value is ReadonlyMap<CborKey, CborValue> {
  return value instanceof Map;
}

const UTF8 = new TextDecoder("utf-8", { fatal: true });

type Head = { readonly major: number; readonly info: number; readonly arg: number | bigint; readonly end: number };

function readHead(bytes: Uint8Array, at: number): Result<Head, CborError> {
  const fail = (where: number, message: string): Result<never, CborError> => err({ kind: "cbor", at: where, message });
  const first = bytes[at];
  if (first === undefined) return fail(at, "no data item (the bytes end)");
  const major = first >> 5;
  const info = first & 0x1f;
  if (info < 24) return ok({ major, info, arg: info, end: at + 1 });
  if (info === 31) return fail(at, "an indefinite length (not read)");
  if (info > 27) return fail(at, `the reserved additional information ${info}`);
  const size = 1 << (info - 24);
  if (at + 1 + size > bytes.length) return fail(at + 1, `${size} bytes of argument (only ${bytes.length - at - 1} are left)`);
  let n = 0n;
  for (let k = 0; k < size; k++) n = (n << 8n) | BigInt(bytes[at + 1 + k] ?? 0);
  const arg = n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n;
  return ok({ major, info, arg, end: at + 1 + size });
}

function halfToNumber(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;
  if (exp === 0) return sign * mant * 2 ** -24;
  if (exp === 31) return mant === 0 ? sign * Infinity : NaN;
  return sign * (1 + mant / 1024) * 2 ** (exp - 15);
}

function readItem(bytes: Uint8Array, at: number, depth: number): Result<CborItem, CborError> {
  const fail = (where: number, message: string): Result<never, CborError> => err({ kind: "cbor", at: where, message });
  if (depth > MAX_DEPTH) return fail(at, `nesting deeper than ${MAX_DEPTH} levels`);
  const h = readHead(bytes, at);
  if (h.kind === "err") return h;
  const { major, info, arg, end } = h.value;
  const length = (): Result<number, CborError> =>
    typeof arg === "bigint" || end + arg > bytes.length
      ? fail(end, `${String(arg)} bytes of content (only ${bytes.length - end} are left)`)
      : ok(arg);
  switch (major) {
    case 0:
      return ok({ value: arg, end });
    case 1:
      return ok({ value: typeof arg === "bigint" || arg === Number.MAX_SAFE_INTEGER ? -1n - BigInt(arg) : -1 - arg, end });
    case 2: {
      const n = length();
      if (n.kind === "err") return n;
      return ok({ value: bytes.slice(end, end + n.value), end: end + n.value });
    }
    case 3: {
      const n = length();
      if (n.kind === "err") return n;
      try {
        return ok({ value: UTF8.decode(bytes.subarray(end, end + n.value)), end: end + n.value });
      } catch {
        return fail(end, "a text string that is not UTF-8");
      }
    }
    case 4: {
      // each element takes at least one byte, so a count beyond what is left cannot be met
      if (typeof arg === "bigint" || arg > bytes.length - end) return fail(at, `an array of ${String(arg)} elements (the bytes end first)`);
      const out: CborValue[] = [];
      let i = end;
      for (let k = 0; k < arg; k++) {
        const e = readItem(bytes, i, depth + 1);
        if (e.kind === "err") return e;
        out.push(e.value.value);
        i = e.value.end;
      }
      return ok({ value: out, end: i });
    }
    case 5: {
      if (typeof arg === "bigint" || arg * 2 > bytes.length - end) return fail(at, `a map of ${String(arg)} pairs (the bytes end first)`);
      const out = new Map<CborKey, CborValue>();
      let i = end;
      for (let k = 0; k < arg; k++) {
        const key = readItem(bytes, i, depth + 1);
        if (key.kind === "err") return key;
        const kv = key.value.value;
        if (typeof kv !== "number" && typeof kv !== "bigint" && typeof kv !== "string")
          return fail(i, "a map key that is neither an integer nor a text string");
        if (typeof kv === "number" && !Number.isInteger(kv)) return fail(i, "a map key that is a float");
        if (out.has(kv)) return fail(i, `the map key ${String(kv)} given twice`);
        const value = readItem(bytes, key.value.end, depth + 1);
        if (value.kind === "err") return value;
        out.set(kv, value.value.value);
        i = value.value.end;
      }
      return ok({ value: out, end: i });
    }
    case 6: {
      const inner = readItem(bytes, end, depth + 1);
      if (inner.kind === "err") return inner;
      return ok({ value: { tag: arg, value: inner.value.value }, end: inner.value.end });
    }
    case 7: {
      if (info === 20) return ok({ value: false, end });
      if (info === 21) return ok({ value: true, end });
      if (info === 22) return ok({ value: null, end });
      if (info === 23) return ok({ value: undefined, end });
      const view = new DataView(bytes.buffer, bytes.byteOffset + at + 1);
      if (info === 25) return ok({ value: halfToNumber(view.getUint16(0)), end });
      if (info === 26) return ok({ value: view.getFloat32(0), end });
      if (info === 27) return ok({ value: view.getFloat64(0), end });
      return fail(at, `the simple value ${String(arg)} (not read)`);
    }
    default:
      return fail(at, `the major type ${major}`);
  }
}

/** The data item that starts at `offset`, and the offset just after it: for CBOR followed by more bytes (WebAuthn's authenticator data). */
export function decodeCborItem(bytes: Uint8Array, offset = 0): Result<CborItem, CborError> {
  return readItem(bytes, offset, 0);
}

/** The one data item the bytes hold; bytes left after it are an error. */
export function decodeCbor(bytes: Uint8Array): Result<CborValue, CborError> {
  const r = readItem(bytes, 0, 0);
  if (r.kind === "err") return r;
  if (r.value.end !== bytes.length)
    return err({ kind: "cbor", at: r.value.end, message: `${bytes.length - r.value.end} bytes after the data item` });
  return ok(r.value.value);
}

function head(major: number, n: number | bigint): Uint8Array {
  const v = BigInt(n);
  if (v < 0n || v > 0xffffffffffffffffn) throw new RangeError(`CBOR: no argument ${String(n)}`);
  const m = major << 5;
  if (v < 24n) return Uint8Array.of(m | Number(v));
  const size = v <= 0xffn ? 1 : v <= 0xffffn ? 2 : v <= 0xffffffffn ? 4 : 8;
  const out = new Uint8Array(1 + size);
  out[0] = m | (24 + Math.log2(size));
  for (let k = 0; k < size; k++) out[size - k] = Number((v >> BigInt(8 * k)) & 0xffn);
  return out;
}

function encodeInteger(n: number | bigint): Uint8Array {
  const v = BigInt(n);
  return v >= 0n ? head(0, v) : head(1, -1n - v);
}

/**
 * A value as CBOR, in the core deterministic encoding: integers (safe `number`s or `bigint`s) in their shortest head, other numbers as
 * doubles, strings as UTF-8, `Uint8Array` as a byte string, arrays, maps with their keys sorted by their encoding, tags and the four
 * simple values. A value no CBOR item can hold (an integer beyond 64 bits) is a programming error and throws a `RangeError`.
 */
export function encodeCbor(value: CborValue): Uint8Array {
  if (value === false) return Uint8Array.of(0xf4);
  if (value === true) return Uint8Array.of(0xf5);
  if (value === null) return Uint8Array.of(0xf6);
  if (value === undefined) return Uint8Array.of(0xf7);
  if (typeof value === "bigint") return encodeInteger(value);
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && !Object.is(value, -0)) return encodeInteger(value);
    const out = new Uint8Array(9);
    out[0] = 0xfb;
    new DataView(out.buffer).setFloat64(1, value);
    return out;
  }
  if (typeof value === "string") {
    const b = new TextEncoder().encode(value);
    return concat([head(3, b.length), b]);
  }
  if (value instanceof Uint8Array) return concat([head(2, value.length), value]);
  if (Array.isArray(value)) return concat([head(4, value.length), ...value.map((v: CborValue) => encodeCbor(v))]);
  if (isMap(value)) {
    const pairs = [...value].map(([k, v]) => [encodeCbor(k), encodeCbor(v)] as const).sort((a, b) => compareBytes(a[0], b[0]));
    return concat([head(5, pairs.length), ...pairs.flat()]);
  }
  if (isTagged(value)) return concat([head(6, value.tag), encodeCbor(value.value)]);
  throw new RangeError("CBOR: a value that is not a CBOR value");
}
