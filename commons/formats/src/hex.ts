// Spec: 0001-formats FR-013
/**
 * Hexadecimal text: bytes as lower-case hexadecimal, two digits each, and hexadecimal text as bytes (commons 0005-typescript-runtime FR-008). Taken from `sha256.ts`, which every digest
 * is written through, so that a format of bytes is in the library of formats and the digests depend on it.
 *
 * @example
 * ```ts
 * import { fromHex, toHex } from "./hex.ts";
 * toHex(new Uint8Array([1, 255])); // "01ff"
 * fromHex("01ff"); // Uint8Array [1, 255]
 * ```
 *
 * @module
 */
/** Bytes as lower-case hexadecimal, two digits each. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Hexadecimal text as bytes, or undefined where it is not an even number of hexadecimal digits. */
export function fromHex(text: string): Uint8Array | undefined {
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) return undefined;
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}
