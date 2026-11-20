// Spec: 0001-crypto FR-009
/**
 * Crypto, the digests, signatures and envelopes of Intellectual Frontiers Commons, in pure code on Web Crypto with no outside package (its specification 0001-crypto): SHA-256 as a branded `Sha256`, MD5
 * for the protocols that still ask for it (as `md5`), SHA-512 crypt, UUIDs (as `uuid`), AWS Signature Version 4 (as `sigv4`), CMS encrypted content (as `cms`), in-toto statements in DSSE envelopes
 * (as `dsse`), COSE keys (as `cose`) and WebAuthn for a relying party (as `webauthn`). It depends on `core` and `formats`, names no host global and runs wherever ECMAScript and Web Crypto do: Bun, Node 26, a
 * browser, a Worker.
 *
 * @example
 * ```ts
 * import { sha256 } from "@intellectual-frontiers/crypto";
 * const sum = await sha256("abc");
 * sum; // "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
 * ```
 *
 * @module
 */
export * as cms from "./cms.ts";
export * as cose from "./cose.ts";
export { CRYPT_ROUNDS, cryptSalt, sha512Crypt, verifySha512Crypt } from "./crypt.ts";
export * as dsse from "./dsse.ts";
export * as md5 from "./md5.ts";
export { parseSha256Sums, sameSha256, sha256, sha256Of } from "./sha256.ts";
export type { Sha256 } from "./sha256.ts";
export * as sigv4 from "./sigv4.ts";
export * as uuid from "./uuid.ts";
export * as webauthn from "./webauthn.ts";
