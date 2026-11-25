// Spec: 0001-crypto FR-003
/**
 * SHA-512 crypt (`$6$`), the password hash of glibc's `crypt(3)` that Linux accounts and Ubuntu's installer accept, on Web Crypto alone
 * (commons 0001-crypto FR-003). The algorithm is Ulrich Drepper's "Unix crypt using SHA-256 and SHA-512". The salt is given,
 * so the kernel stays free of effects: a caller makes one from random bytes with `cryptSalt(crypto.getRandomValues(new Uint8Array(16)))`.
 *
 * @example
 * ```ts
 * import { sha512Crypt } from "./crypt.ts";
 * await sha512Crypt("Hello world!", "saltstring");
 * // "$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1"
 * ```
 *
 * @module
 */

const B64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The rounds glibc uses when none are named, and the least and most it accepts. */
export const CRYPT_ROUNDS = { default: 5000, min: 1000, max: 999_999_999 } as const;

async function sha512(parts: readonly Uint8Array[]): Promise<Uint8Array> {
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    buf.set(p, at);
    at += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-512", buf));
}

function repeatTo(src: Uint8Array, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = src[i % src.length] ?? 0;
  return out;
}

/** A salt of crypt's alphabet (`./0-9A-Za-z`) made from bytes, one character each, at most 16. */
export function cryptSalt(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 16), (b) => B64[b % 64] ?? ".").join("");
}

const ORDER: readonly (readonly [number, number, number])[] = [
  [0, 21, 42],
  [22, 43, 1],
  [44, 2, 23],
  [3, 24, 45],
  [25, 46, 4],
  [47, 5, 26],
  [6, 27, 48],
  [28, 49, 7],
  [50, 8, 29],
  [9, 30, 51],
  [31, 52, 10],
  [53, 11, 32],
  [12, 33, 54],
  [34, 55, 13],
  [56, 14, 35],
  [15, 36, 57],
  [37, 58, 16],
  [59, 17, 38],
  [18, 39, 60],
  [40, 61, 19],
  [62, 20, 41],
];

/**
 * A password hashed as SHA-512 crypt: `$6$<salt>$<hash>`, with `rounds=<n>$` after `$6$` where rounds are given (5000 where they are
 * not). Only the first 16 characters of the salt count, and given rounds are clamped to what glibc accepts, as glibc does.
 */
export async function sha512Crypt(password: string, salt: string, rounds?: number): Promise<string> {
  const enc = new TextEncoder();
  const named = rounds !== undefined;
  const r = rounds === undefined ? CRYPT_ROUNDS.default : Math.min(CRYPT_ROUNDS.max, Math.max(CRYPT_ROUNDS.min, Math.floor(rounds)));
  const s = salt.slice(0, 16);
  const P = enc.encode(password);
  const S = enc.encode(s);
  const B = await sha512([P, S, P]);
  const aParts: Uint8Array[] = [P, S, repeatTo(B, P.length)];
  for (let n = P.length; n > 0; n >>= 1) aParts.push(n & 1 ? B : P);
  const A = await sha512(aParts);
  const DP = await sha512(Array.from({ length: P.length }, () => P));
  const Pbytes = repeatTo(DP, P.length);
  const DS = await sha512(Array.from({ length: 16 + (A[0] ?? 0) }, () => S));
  const Sbytes = repeatTo(DS, S.length);
  let C = A;
  for (let i = 0; i < r; i++) {
    const parts: Uint8Array[] = [i & 1 ? Pbytes : C];
    if (i % 3) parts.push(Sbytes);
    if (i % 7) parts.push(Pbytes);
    parts.push(i & 1 ? C : Pbytes);
    C = await sha512(parts);
  }
  let out = "";
  const b64 = (value: number, n: number): void => {
    let v = value;
    for (let i = 0; i < n; i++) {
      out += B64[v & 63] ?? ".";
      v >>= 6;
    }
  };
  for (const [a, b, c] of ORDER) b64(((C[a] ?? 0) << 16) | ((C[b] ?? 0) << 8) | (C[c] ?? 0), 4);
  b64(C[63] ?? 0, 2);
  return `$6$${named ? `rounds=${r}$` : ""}${s}$${out}`;
}

/** Whether a password matches a `$6$` hash, by hashing it again with the hash's own salt and rounds. */
export async function verifySha512Crypt(password: string, hash: string): Promise<boolean> {
  const m = /^\$6\$(?:rounds=(\d+)\$)?([^$]{0,16})\$[./0-9A-Za-z]{86}$/.exec(hash);
  if (m === null) return false;
  const again = await sha512Crypt(password, m[2] ?? "", m[1] === undefined ? undefined : Number(m[1]));
  if (again.length !== hash.length) return false;
  let d = 0;
  for (let i = 0; i < hash.length; i++) d |= again.charCodeAt(i) ^ hash.charCodeAt(i);
  return d === 0;
}
