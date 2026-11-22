// Spec: 0007-anyfs-cli-keys FR-003, FR-004, FR-005, FR-006
/**
 * The pure rules of a roster of keys (commons anyfs-cli 0007-anyfs-cli-keys FR-003 to FR-006): what a key is at a time (`active`, `expired` or `future`), how entries from another roster are taken in (a key id that is
 * there already must name the same public key, a new key is taken only where it was accepted by its id, so that a roster that arrives by a channel nobody has checked adds nothing by itself), and how a key is
 * rotated (the old key stops speaking at an instant and the new one starts at the next, so that what the old one signed before still holds). No file is read and nothing is written.
 *
 * @example
 * ```ts
 * import { keyState } from "./roster.ts";
 * // keyState(entry, Date.now()); // "active"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { KeyEntry, KeyRoster } from "@intellectual-frontiers/anyfs/merge";

/** What a key is at a time. */
export type KeyState = "active" | "expired" | "future";

/** What a key is at `at` (milliseconds): its window is closed at both ends. */
export function keyState(entry: KeyEntry, at: number): KeyState {
  if (entry.notBefore !== undefined && at < entry.notBefore) return "future";
  if (entry.notAfter !== undefined && at > entry.notAfter) return "expired";
  return "active";
}

/** The same key: the replica and the key id, which is the digest of the public key. */
const same = (a: KeyEntry, b: KeyEntry): boolean => a.replica === b.replica && a.keyId === b.keyId;

/** What taking in the entries of another roster did. */
export type Taken = {
  readonly roster: KeyRoster;
  /** The entries that were not there and were accepted. */
  readonly added: readonly KeyEntry[];
  /** The entries that were there already, as they are. */
  readonly known: readonly KeyEntry[];
  /** The entries that were not there and were not accepted: what a person has to check before accepting them. */
  readonly pending: readonly KeyEntry[];
};

/**
 * The roster with the entries of another taken in. A key that is there already is kept as it is (its window is never widened by a roster that arrives), and the same key id with another public key is an error, since a
 * key id is the digest of the key. A key that is new is added only where its id is in `accept`; else it is `pending`.
 */
export function takeEntries(base: KeyRoster, incoming: KeyRoster, accept: ReadonlySet<string>): Result<Taken, string> {
  const roster: KeyEntry[] = [...base];
  const added: KeyEntry[] = [];
  const known: KeyEntry[] = [];
  const pending: KeyEntry[] = [];
  for (const e of incoming) {
    const held = roster.find((r) => same(r, e));
    if (held !== undefined) {
      if (held.publicKey !== e.publicKey) return err(`the key ${e.keyId} of ${e.replica} is there with another public key: a key id is the digest of its key, so one of the two is not what it says`);
      if (!known.some((k) => same(k, held))) known.push(held);
    } else if (accept.has(e.keyId)) {
      roster.push(e);
      added.push(e);
    } else if (!pending.some((p) => same(p, e))) pending.push(e);
  }
  return ok({ roster, added, known, pending });
}

/** A roster with a key rotated: the old key ends at `at`, the new one starts at the next millisecond. */
export type Rotated = { readonly roster: KeyRoster; readonly retired: KeyEntry; readonly started: KeyEntry };

/**
 * Rotates the key of a replica: the entry `keyId` of the roster stops speaking at `at` (it is never made to speak longer than it did), and `fresh` is added with a window that begins after it. The new key must be of the
 * same replica and not be in the roster already.
 */
export function rotate(base: KeyRoster, keyId: string, fresh: KeyEntry, at: number): Result<Rotated, string> {
  const old = base.find((e) => e.keyId === keyId);
  if (old === undefined) return err(`the roster has no key ${keyId}`);
  if (old.replica !== fresh.replica) return err(`the new key speaks for ${fresh.replica} and the key ${keyId} for ${old.replica}`);
  if (base.some((e) => same(e, fresh))) return err(`the key ${fresh.keyId} is in the roster already`);
  if (!Number.isInteger(at)) return err("the instant of a rotation is a whole number of milliseconds");
  if (old.notBefore !== undefined && at < old.notBefore) return err(`the key ${keyId} does not begin until ${old.notBefore}`);
  const notAfter = old.notAfter === undefined ? at : Math.min(old.notAfter, at);
  const retired: KeyEntry = { ...old, notAfter };
  const started: KeyEntry = { ...fresh, notBefore: at + 1 };
  const roster = [...base.map((e) => (same(e, old) ? retired : e)), started];
  return ok({ roster, retired, started });
}

/** One line of a roster, for a person. */
export function entryLine(e: KeyEntry, at: number): string {
  const window = e.notBefore === undefined && e.notAfter === undefined ? "always" : `${e.notBefore ?? "..."} to ${e.notAfter ?? "..."}`;
  return `${e.replica}  ${e.keyId}  ${keyState(e, at).padEnd(7)} ${window}`;
}
