/**
 * Base64 and base64url (RFC 4648 §4 and §5), both ways, on bytes (commons 0005-typescript-runtime FR-042): what DSSE envelopes, JWTs, data
 * URLs, PEM and signed URLs carry. Decoding refuses what is not base64 of the alphabet asked for, rather than skipping it; base64url is
 * written without padding and read with or without it. Taken from the helpers Stolos wrote in `src/archon/export/intoto.ts` and S/MIME.
 *
 * @example
 * ```ts
 * import { fromBase64, toBase64, toBase64Url } from "./base64.ts";
 * toBase64(new TextEncoder().encode("foobar")); // "Zm9vYmFy"
 * toBase64Url(Uint8Array.of(0xfb, 0xff)); // "-_8"
 * fromBase64("Zm9v"); // { kind: "ok", value: Uint8Array [102, 111, 111] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** Bytes as standard base64, padded. */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Standard base64 as bytes; white space between the characters is ignored, and anything else that is not base64 refused. */
export function fromBase64(text: string): Result<Uint8Array, string> {
  const t = text.replace(/[\t\n\r ]/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t)) return err("the text is not padded standard base64");
  const s = atob(t);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return ok(out);
}

/** Bytes as base64url, without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Base64url (padded or not) as bytes; anything else refused. */
export function fromBase64Url(text: string): Result<Uint8Array, string> {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) return err("the text is not base64url");
  const bare = text.replace(/=+$/, "");
  if (bare.length % 4 === 1) return err("the text is not base64url (its length cannot be)");
  const padded = bare
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(bare.length / 4) * 4, "=");
  return fromBase64(padded);
}
