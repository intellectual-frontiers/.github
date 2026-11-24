// Spec: 0006-anyfs-serve-nfs FR-001
/**
 * XDR (RFC 4506) as far as ONC RPC and NFS version 3 need it: a writer that appends 32 and 64-bit unsigned integers, booleans, fixed and variable opaque data and strings, each padded to four bytes, and a reader that
 * takes them back and refuses everything the standard does not allow (a read past the end, a length that does not fit, padding that is not zero, a boolean that is not 0 or 1, a string that is not UTF-8). The reader
 * throws one error type inside and `decode` turns it into a `Result`, so that the code that decodes a call reads straight and no failure escapes.
 *
 * @example
 * ```ts
 * import { decode, XdrWriter } from "./xdr.ts";
 * const w = new XdrWriter();
 * w.u32(7).string("a.txt");
 * decode(w.bytes(), (r) => [r.u32(), r.string()]); // ok([7, "a.txt"])
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The one error of reading: what was wrong with the bytes. */
export class XdrError extends Error {}

const pad = (n: number): number => (4 - (n % 4)) % 4;

/** Writes XDR. */
export class XdrWriter {
  #buf = new Uint8Array(256);
  #view = new DataView(this.#buf.buffer);
  #at = 0;

  #room(n: number): void {
    if (this.#at + n <= this.#buf.length) return;
    let size = this.#buf.length;
    while (size < this.#at + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.#buf.subarray(0, this.#at));
    this.#buf = next;
    this.#view = new DataView(next.buffer);
  }

  u32(n: number): this {
    this.#room(4);
    this.#view.setUint32(this.#at, n >>> 0);
    this.#at += 4;
    return this;
  }

  /** An unsigned 64-bit integer from a whole number (or a bigint). */
  u64(n: number | bigint): this {
    this.#room(8);
    this.#view.setBigUint64(this.#at, BigInt(n));
    this.#at += 8;
    return this;
  }

  bool(b: boolean): this {
    return this.u32(b ? 1 : 0);
  }

  /** Bytes as they are, padded: the length is not written. */
  fixed(bytes: Uint8Array): this {
    this.#room(bytes.length + 4);
    this.#buf.set(bytes, this.#at);
    this.#at += bytes.length;
    for (let i = pad(bytes.length); i > 0; i--) this.#buf[this.#at++] = 0;
    return this;
  }

  /** Bytes with their length. */
  opaque(bytes: Uint8Array): this {
    return this.u32(bytes.length).fixed(bytes);
  }

  string(text: string): this {
    return this.opaque(new TextEncoder().encode(text));
  }

  /** What was written so far. */
  bytes(): Uint8Array {
    return this.#buf.slice(0, this.#at);
  }

  get length(): number {
    return this.#at;
  }
}

/** Reads XDR. Every read throws `XdrError` where the bytes are not what was asked. */
export class XdrReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  #at = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get left(): number {
    return this.#bytes.length - this.#at;
  }

  #need(n: number): void {
    if (n < 0 || n > this.left) throw new XdrError(`needs ${n} more bytes and ${this.left} are left`);
  }

  u32(): number {
    this.#need(4);
    const n = this.#view.getUint32(this.#at);
    this.#at += 4;
    return n;
  }

  /** An unsigned 64-bit integer as a bigint. */
  u64big(): bigint {
    this.#need(8);
    const n = this.#view.getBigUint64(this.#at);
    this.#at += 8;
    return n;
  }

  /** An unsigned 64-bit integer as a number: refused where it is not a safe integer. */
  u64(): number {
    const n = this.u64big();
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new XdrError("a 64-bit number is larger than a safe integer");
    return Number(n);
  }

  bool(): boolean {
    const n = this.u32();
    if (n > 1) throw new XdrError(`a boolean is 0 or 1, not ${n}`);
    return n === 1;
  }

  /** `length` bytes and their padding, which must be zero. */
  fixed(length: number): Uint8Array {
    this.#need(length + pad(length));
    const out = this.#bytes.slice(this.#at, this.#at + length);
    this.#at += length;
    for (let i = pad(length); i > 0; i--) if (this.#bytes[this.#at++] !== 0) throw new XdrError("padding is zero");
    return out;
  }

  /** Bytes with their length, at most `max`. */
  opaque(max = 0x7fffffff): Uint8Array {
    const length = this.u32();
    if (length > max) throw new XdrError(`${length} bytes are more than the ${max} this takes`);
    return this.fixed(length);
  }

  string(max = 4096): string {
    const bytes = this.opaque(max);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new XdrError("a string is UTF-8");
    }
  }

  /** The rest of the bytes, unread. */
  rest(): Uint8Array {
    const out = this.#bytes.subarray(this.#at);
    this.#at = this.#bytes.length;
    return out;
  }
}

/** Reads a value with a function over a reader: the value, or why the bytes are not what it reads. */
export function decode<T>(bytes: Uint8Array, read: (r: XdrReader) => T): Result<T, string> {
  try {
    return ok(read(new XdrReader(bytes)));
  } catch (e) {
    if (e instanceof XdrError) return err(e.message);
    throw e;
  }
}
