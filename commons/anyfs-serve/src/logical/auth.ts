// Spec: 0003-anyfs-serve-logical FR-009
/**
 * Who may ask. The credentials of a request are read from `Authorization` (a bearer token, or HTTP Basic whose password is the token, which is what a desktop sends), and a token is compared in constant time
 * over the digests of both, so that the time of an answer says nothing of how much of a guess was right. A token is made from 32 random bytes.
 *
 * @example
 * ```ts
 * import { tokenAuthenticator, newToken } from "./auth.ts";
 * const token = newToken();
 * const may = tokenAuthenticator(token);
 * await may({ scheme: "bearer", secret: token }); // true
 * await may(undefined); // false
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Authenticator, Credentials } from "@intellectual-frontiers/anyfs-serve/governance";

/** The credentials of a request, or nothing where it sent none or sent a form that is not read. */
export function credentialsOf(header: string | null): Credentials | undefined {
  if (header === null) return undefined;
  const space = header.indexOf(" ");
  if (space < 0) return undefined;
  const scheme = header.slice(0, space).toLowerCase();
  const rest = header.slice(space + 1).trim();
  if (scheme === "bearer") return rest === "" ? undefined : { scheme: "bearer", secret: rest };
  if (scheme === "basic") {
    let decoded: string;
    try {
      decoded = new TextDecoder().decode(Uint8Array.from(atob(rest), (c) => c.charCodeAt(0)));
    } catch {
      return undefined;
    }
    const colon = decoded.indexOf(":");
    return colon < 0 ? undefined : { scheme: "basic", user: decoded.slice(0, colon), secret: decoded.slice(colon + 1) };
  }
  return undefined;
}

/** A random token: 32 bytes as 64 hex digits. */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether two texts are equal, in a time that does not depend on where they differ: it compares the digests. */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = da.length ^ db.length;
  for (let i = 0; i < Math.max(da.length, db.length); i++) diff |= (da.charCodeAt(i) || 0) ^ (db.charCodeAt(i) || 0);
  return diff === 0;
}

/** Who may ask where the token is a given text: whoever sends it, as a bearer token or as the password of Basic, with any user name. */
export function tokenAuthenticator(token: string): Authenticator {
  return async (credentials) => (credentials === undefined ? false : await sameSecret(credentials.secret, token));
}

/** Nobody is asked: for a server that only the loopback reaches and that the program starts on purpose. */
export const noAuthentication: Authenticator = async () => true;
