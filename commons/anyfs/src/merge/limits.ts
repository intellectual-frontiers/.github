// Spec: 0007-anyfs-merge-governance FR-006
/**
 * What a merge refuses to hold, as limits and not hopes: how long a path, how large a blob, how many rows and how much text in a delta. Also the order of two texts by their code units, which is the order of ids,
 * sums and paths everywhere in a merge, whatever the language of the machine.
 *
 * @example
 * ```ts
 * import { DEFAULT_LIMITS, compareText } from "./limits.ts";
 * compareText("a", "b"); // -1
 * ```
 *
 * @module
 */

/** What a replica refuses: the characters of a path, the bytes of a blob, the rows of a delta and the characters of a delta. */
export type Limits = { readonly maxPathChars: number; readonly maxBlobBytes: number; readonly maxVersions: number; readonly maxDeltaChars: number };

/** The limits a replica has until it is told otherwise: a path of a kibibyte, a blob of sixty-four mebibytes, a hundred thousand rows in a delta and a delta of 256 mebibytes of text. */
export const DEFAULT_LIMITS: Limits = { maxPathChars: 1024, maxBlobBytes: 67_108_864, maxVersions: 100_000, maxDeltaChars: 268_435_456 };

/** The order of two texts by their code units. */
export function compareText(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Bytes as base64. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

/** Bytes from base64, or nothing where the text is not base64. */
export function fromBase64(text: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(text) || text.length % 4 !== 0) return undefined;
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}
