// Spec: 0003-server-policy FR-007, FR-016
// Spec: 0002-enrollment-protocol FR-009
/**
 * Tokens and pairing codes, pure. A token is single-use and time-limited; its secret is compared in constant time. A pairing code is a short human code of two words and four digits, shown on the controller; it is single use and its lifetime is short.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import type { PairingRecord, TokenRecord } from "@intellectual-frontiers/ssh-server/governance";

/** Compare two strings in time that depends on the longer length only. */
export function constantTimeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** The shape of a token: `tok-` then an id of 8 and a secret of 24 to 48 characters of base32 and hyphen. */
export const TOKEN = /^tok-[a-z2-7]{8}-[a-z2-7]{24,48}$/;
/** The shape of a pairing code: two words and four digits, such as `maple-river-4821`. */
export const PAIRING = /^[a-z]{3,8}-[a-z]{3,8}-[0-9]{4}$/;

/** Words for pairing codes: short, unlike each other, easy to read aloud. */
export const WORDS: readonly string[] = [
  "amber", "anchor", "apple", "arrow", "aspen", "badge", "basil", "beach", "birch", "bison", "bloom", "brick", "cabin", "cedar", "chalk", "cider",
  "cliff", "cloud", "clover", "coral", "crane", "daisy", "delta", "dune", "eagle", "ember", "fable", "falcon", "fern", "field", "flint", "forest",
  "garnet", "glade", "grove", "harbor", "hazel", "heron", "iris", "ivory", "jade", "juniper", "kettle", "lake", "lemon", "lilac", "maple", "marsh",
  "meadow", "mint", "moss", "oak", "olive", "opal", "otter", "pearl", "pine", "plum", "quartz", "raven", "reed", "river", "sage", "willow",
];

/** Make a pairing code from a source of numbers in [0, 1) (the caller supplies randomness: this function has none). */
export function pairingCode(random: () => number): string {
  const word = (): string => WORDS[Math.floor(random() * WORDS.length) % WORDS.length] as string;
  const digits = String(Math.floor(random() * 10000)).padStart(4, "0");
  return `${word()}-${word()}-${digits}`;
}

/** Read the shape of a pairing code. */
export function parsePairing(text: string): Result<string, string> {
  return PAIRING.test(text) ? ok(text) : err("a pairing code is two words and four digits, such as maple-river-4821");
}

/** The id of a presented token: its first part, which is safe to write in an audit event. */
export function tokenId(presented: string): string | undefined {
  return TOKEN.test(presented) ? presented.slice(4, 12) : undefined;
}

/** Why a token or code was not taken. */
export type Refusal = "unknown" | "used" | "expired" | "malformed";

/** Check a presented token against a record at `now`: the hash of what was presented is compared with the stored hash in constant time. */
export function checkToken(record: TokenRecord | undefined, presented: string, now: number, sha256Hex: (text: string) => string): Result<TokenRecord, Refusal> {
  if (!TOKEN.test(presented)) return err("malformed");
  if (record === undefined || !constantTimeEqual(record.secretHash, sha256Hex(presented))) return err("unknown");
  if (record.used) return err("used");
  if (now >= record.expiresAt) return err("expired");
  return ok(record);
}

/** Check a presented pairing code against a record at `now`. */
export function checkPairing(record: PairingRecord | undefined, presented: string, now: number): Result<PairingRecord, Refusal> {
  if (!PAIRING.test(presented)) return err("malformed");
  if (record === undefined || !constantTimeEqual(record.code, presented)) return err("unknown");
  if (record.used) return err("used");
  if (now >= record.expiresAt) return err("expired");
  return ok(record);
}
