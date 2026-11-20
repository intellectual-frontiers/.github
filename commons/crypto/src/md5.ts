// Spec: 0001-crypto FR-002
/**
 * MD5 (RFC 1321), which Web Crypto does not give, for the protocols that still ask for it: S3's `Content-MD5` header (the digest in
 * base64), the ETag of an S3 object put in one part, and old checksum files (commons 0001-crypto FR-002).
 *
 * MD5 is NOT for security: collisions are made in seconds, so it MUST NOT check that bytes are the ones expected against anyone who
 * could choose them, sign, or hash a password. Use SHA-256 (`./sha256.ts`) for that; MD5 here only answers a protocol that names it.
 *
 * The digest is given whole (`md5`, `md5Hex`) or a piece at a time (`Md5`, and `md5Stream` for a `ReadableStream`), so a file larger
 * than memory is digested as it is read.
 *
 * @example
 * ```ts
 * import { Md5, md5Hex } from "./md5.ts";
 * md5Hex("abc"); // "900150983cd24fb0d6963f7d28e17f72"
 * new Md5().update("a").update("bc").hex(); // the same
 * ```
 *
 * @module
 */
import { toHex } from "@intellectual-frontiers/formats/hex";

/** The per-round left rotations of RFC 1321 §3.4. */
const SHIFTS: readonly number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/** T[i] = floor(2^32 * |sin(i + 1)|), the table of RFC 1321 §3.4. */
const T: readonly number[] = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

const bytesOf = (data: Uint8Array | string): Uint8Array => (typeof data === "string" ? new TextEncoder().encode(data) : data);

/**
 * An MD5 digest computed a piece at a time: `update` with each piece of the bytes in order (text is taken as UTF-8), then `digest` or
 * `hex`. After the digest is taken, the object takes no more bytes. Not for security (see the module's documentation).
 */
export class Md5 {
  #state = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
  #block = new Uint8Array(64);
  #words = new Uint32Array(16);
  #filled = 0;
  #length = 0;
  #done: Uint8Array | undefined;

  /** Takes the next piece of the bytes; throws where the digest was already taken. */
  update(data: Uint8Array | string): this {
    if (this.#done !== undefined) throw new Error("the MD5 digest was already taken; start a new Md5");
    const bytes = bytesOf(data);
    this.#length += bytes.length;
    let at = 0;
    while (at < bytes.length) {
      const n = Math.min(64 - this.#filled, bytes.length - at);
      this.#block.set(bytes.subarray(at, at + n), this.#filled);
      this.#filled += n;
      at += n;
      if (this.#filled === 64) {
        this.#compress();
        this.#filled = 0;
      }
    }
    return this;
  }

  /** The 16 bytes of the digest of every piece taken; the same each time it is asked. */
  digest(): Uint8Array {
    if (this.#done !== undefined) return this.#done.slice();
    const bits = this.#length * 8;
    const pad = new Uint8Array((this.#filled < 56 ? 56 : 120) - this.#filled + 8);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    view.setUint32(pad.length - 8, bits >>> 0, true);
    view.setUint32(pad.length - 4, Math.floor(bits / 0x100000000) >>> 0, true);
    this.update(pad);
    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    this.#state.forEach((w, i) => outView.setUint32(i * 4, w, true));
    this.#done = out;
    return out.slice();
  }

  /** The digest as 32 lower-case hexadecimal digits. */
  hex(): string {
    return toHex(this.digest());
  }

  #compress(): void {
    const x = this.#words;
    const b64 = this.#block;
    for (let i = 0; i < 16; i++)
      x[i] = ((b64[i * 4] ?? 0) | ((b64[i * 4 + 1] ?? 0) << 8) | ((b64[i * 4 + 2] ?? 0) << 16) | ((b64[i * 4 + 3] ?? 0) << 24)) >>> 0;
    const s = this.#state;
    let a = s[0] ?? 0;
    let b = s[1] ?? 0;
    let c = s[2] ?? 0;
    let d = s[3] ?? 0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + (T[i] ?? 0) + (x[g] ?? 0)) >>> 0;
      const r = SHIFTS[i] ?? 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << r) | (sum >>> (32 - r)))) >>> 0;
    }
    s[0] = ((s[0] ?? 0) + a) >>> 0;
    s[1] = ((s[1] ?? 0) + b) >>> 0;
    s[2] = ((s[2] ?? 0) + c) >>> 0;
    s[3] = ((s[3] ?? 0) + d) >>> 0;
  }
}

/** The 16 bytes of the MD5 of bytes, or of text as UTF-8. Not for security. */
export function md5(data: Uint8Array | string): Uint8Array {
  return new Md5().update(data).digest();
}

/** The MD5 of bytes, or of text as UTF-8, as 32 lower-case hexadecimal digits (`md5("")` is `d41d8cd98f00b204e9800998ecf8427e`). */
export function md5Hex(data: Uint8Array | string): string {
  return toHex(md5(data));
}

/** The 16 bytes of the MD5 of every byte of a stream, read a chunk at a time, so the whole is never held. Not for security. */
export async function md5Stream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const h = new Md5();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return h.digest();
      h.update(value);
    }
  } finally {
    reader.releaseLock();
  }
}
