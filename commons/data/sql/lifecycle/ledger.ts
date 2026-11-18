// Spec: 0011-sql-lifecycle FR-010
/**
 * The ledger (commons data 0011-sql-lifecycle FR-010): the record of what was applied to a database, in order, each entry holding the hash of the entry before it. An entry that is changed,
 * taken out, put in or moved breaks the chain from that entry on, so a ledger that has been touched by hand is found out.
 *
 * @module
 */
import { hashOf } from "./hash.ts";

/** What an entry is of: a step of the plan, or an object that is applied again when its text changes. */
export type EntryKind = "step" | "repeatable";

/** One entry of the ledger. */
export interface LedgerEntry {
  /** Its place in the ledger, from 1. */
  readonly seq: number;
  readonly kind: EntryKind;
  /** The step's identifier, or the repeatable's key. */
  readonly key: string;
  readonly name: string;
  /** The state the database was in, and was left in (empty for a repeatable). */
  readonly from: string;
  readonly to: string;
  /** What was applied: the step's identifier, or the hash of the repeatable's text. */
  readonly hash: string;
  /** The hash of the entry before it and of this one's own content. */
  readonly chain: string;
  readonly appliedAt: string;
  readonly appliedBy: string;
}

/** The chain hash of the first entry's predecessor. */
export const GENESIS = "0".repeat(64);

/**
 * The chain hash of an entry given the hash of the one before it.
 *
 * @param previous - the chain hash of the entry before, or `GENESIS`
 * @param entry - the entry without its chain
 * @returns the chain hash
 */
export const chainOf = (previous: string, entry: Omit<LedgerEntry, "chain">): string =>
  hashOf({
    previous,
    seq: entry.seq,
    kind: entry.kind,
    key: entry.key,
    name: entry.name,
    from: entry.from,
    to: entry.to,
    hash: entry.hash,
    appliedAt: entry.appliedAt,
    appliedBy: entry.appliedBy,
  });

/**
 * The next entry of a ledger.
 *
 * @param entries - the ledger so far
 * @param entry - what is applied
 * @returns the entry, with its place and its chain
 */
export function nextEntry(entries: readonly LedgerEntry[], entry: Omit<LedgerEntry, "seq" | "chain">): LedgerEntry {
  const seq = (entries[entries.length - 1]?.seq ?? 0) + 1;
  const made = { ...entry, seq };
  return { ...made, chain: chainOf(entries[entries.length - 1]?.chain ?? GENESIS, made) };
}

/** Where a ledger is broken. */
export interface ChainBreak {
  /** The place of the first entry that does not follow from the one before. */
  readonly seq: number;
  readonly why: "seq" | "chain";
}

/**
 * Whether a ledger is whole.
 *
 * @param entries - the entries, in order
 * @returns the first break, or none
 */
export function verifyChain(entries: readonly LedgerEntry[]): ChainBreak | undefined {
  let previous = GENESIS;
  for (const [i, e] of entries.entries()) {
    if (e.seq !== i + 1) return { seq: e.seq, why: "seq" };
    const { chain, ...rest } = e;
    if (chain !== chainOf(previous, rest)) return { seq: e.seq, why: "chain" };
    previous = chain;
  }
  return undefined;
}
