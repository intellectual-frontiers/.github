// Spec: 0006-grc-evidence FR-004, FR-009
/**
 * The ledger and the manifest of evidence (0006-grc-evidence): an append-only, hash-chained list of what was kept, and the manifest of a bundle that lists its items by digest and the head of the
 * ledger. Pure apart from hashing, which is the same on every runtime.
 *
 * @example
 * ```ts
 * import { appendEntry, verifyLedger } from "./ledger.ts";
 * const e1 = await appendEntry(undefined, { at: "2026-01-01T00:00:00Z", type: "observation", subject: "host-1", evidence: "ab".repeat(32) });
 * (await verifyLedger([e1])).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { provenanceOf } from "@intellectual-frontiers/grc/governance";
import { canonicalize, digestOf } from "./canonical.ts";
import type { EvidenceManifest, LedgerEntry } from "./kinds.ts";

/** The `previous` of the first entry. */
export const GENESIS: string = "0".repeat(64);

async function entryDigest(e: Omit<LedgerEntry, "digest">): Promise<string> {
  return digestOf(e);
}

/** The entry after `previous` (none for the first): its sequence number, the digest of the one before, and its own digest. */
export async function appendEntry(
  previous: LedgerEntry | undefined,
  item: { readonly at: string; readonly type: string; readonly subject: string; readonly evidence: string },
): Promise<LedgerEntry> {
  const seq = previous === undefined ? 1 : previous.seq + 1;
  const rest: Omit<LedgerEntry, "digest"> = {
    kind: "grc.ledger-entry",
    schema: "1",
    id: `ledger:${seq}`,
    createdAt: item.at,
    provenance: provenanceOf(previous === undefined ? [] : [previous.digest]),
    seq,
    previous: previous === undefined ? GENESIS : previous.digest,
    type: item.type,
    subject: item.subject,
    evidence: item.evidence,
  };
  return { ...rest, digest: await entryDigest(rest) };
}

/** The first entry that was changed, removed, inserted or reordered. */
export type LedgerFault = { readonly seq: number; readonly reason: string };

/** Verifies the chain; with `head` (the digest a signature covers) it also finds entries cut off the end. */
export async function verifyLedger(entries: readonly LedgerEntry[], head?: string): Promise<Result<void, LedgerFault>> {
  let previous = GENESIS;
  for (const [i, e] of entries.entries()) {
    const want = i + 1;
    if (e.seq !== want) return err({ seq: want, reason: `entry ${want} is missing or out of order (found ${e.seq})` });
    if (e.previous !== previous) return err({ seq: want, reason: `entry ${want} does not follow the one before it` });
    const { digest, ...rest } = e;
    if ((await entryDigest(rest)) !== digest) return err({ seq: want, reason: `entry ${want} was changed` });
    previous = digest;
  }
  if (head !== undefined && head !== previous) return err({ seq: entries.length + 1, reason: "the ledger ends before the head that was signed" });
  return ok(undefined);
}

/** The manifest of a bundle: the items in the byte order of their digests, and the head of the ledger. */
export function makeManifest(
  items: readonly { readonly digest: string; readonly size: number; readonly mediaType: string }[],
  ledgerHead: string,
  at: string,
): EvidenceManifest {
  const sorted = [...items].sort((a, b) => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0));
  return {
    kind: "grc.evidence-manifest",
    schema: "1",
    id: `manifest:${ledgerHead.slice(0, 16)}`,
    createdAt: at,
    provenance: provenanceOf([ledgerHead]),
    items: sorted,
    ledgerHead,
  };
}

/** What a set of items has that its manifest does not say. */
export type ManifestFaults = { readonly missing: readonly string[]; readonly extra: readonly string[]; readonly different: readonly string[] };

/** Each item the manifest lists that is missing, each present that it does not list, and each whose size differs. */
export function verifyManifest(manifest: EvidenceManifest, present: readonly { readonly digest: string; readonly size: number }[]): ManifestFaults {
  const have = new Map(present.map((p) => [p.digest, p.size]));
  const want = new Map(manifest.items.map((i) => [i.digest, i.size]));
  return {
    missing: [...want.keys()].filter((d) => !have.has(d)).sort(),
    extra: [...have.keys()].filter((d) => !want.has(d)).sort(),
    different: [...want.keys()].filter((d) => have.has(d) && have.get(d) !== want.get(d)).sort(),
  };
}

/** The canonical bytes a manifest is signed over. */
export function manifestBytes(manifest: EvidenceManifest): Uint8Array {
  return new TextEncoder().encode(canonicalize(manifest));
}
