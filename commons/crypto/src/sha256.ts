// Spec: 0001-crypto FR-001
/**
 * SHA-256 through Web Crypto (`crypto.subtle`, in every runtime and browser), and a typed `Sha256`: 64 lower-case hexadecimal digits that
 * the compiler keeps apart from any other string, so a checksum is never confused with a version or a path (commons 0001-crypto FR-001). Taken from the machine setup's `result.ts` and `net.ts`, and the many call sites that write the hex loop by hand.
 *
 * @example
 * ```ts
 * import { sha256, sha256Of } from "./sha256.ts";
 * const sum = await sha256(new TextEncoder().encode("abc"));
 * sum === sha256Of("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"); // true
 * ```
 *
 * @module
 */
import type { Brand } from "@intellectual-frontiers/core";
import { toHex } from "@intellectual-frontiers/formats/hex";

/** 64 lower-case hexadecimal digits: a SHA-256 checksum. */
export type Sha256 = Brand<string, "Sha256">;

const SHA256 = /^[0-9a-f]{64}$/;

/** The text as a checksum where it is one (upper-case digits are lowered), else undefined. */
export function sha256Of(text: string): Sha256 | undefined {
  const t = text.trim().toLowerCase();
  return SHA256.test(t) ? (t as Sha256) : undefined;
}

/** The SHA-256 of bytes, or of text as UTF-8. */
export async function sha256(data: Uint8Array | string): Promise<Sha256> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return toHex(new Uint8Array(digest)) as Sha256;
}

/** Whether two checksums are the same, compared in constant time for their length. */
export function sameSha256(a: Sha256, b: Sha256): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** The lines of a `sha256sum` or `SHASUMS256.txt` file, as file name to checksum; lines that are not a checksum and a name are skipped. */
export function parseSha256Sums(text: string): ReadonlyMap<string, Sha256> {
  const out = new Map<string, Sha256>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim());
    const sum = m?.[1] === undefined ? undefined : sha256Of(m[1]);
    const name = m?.[2];
    if (sum !== undefined && name !== undefined) out.set(name, sum);
  }
  return out;
}
