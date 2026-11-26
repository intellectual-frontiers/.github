// Spec: 0002-evidence-capture-journal FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The journal and the due assets, pure: where a day's entries are kept (`journal/YYYY/MM/DD.jsonl`), an entry as a line and the lines read back, the digest of a state, which kind of entry a look makes (every look, or only a change and a heartbeat,
 * as the policy says; a failure always), and which assets are due to be looked at, by their cadences.
 *
 * @example
 * ```ts
 * import { journalPath } from "./journal.ts";
 * journalPath("2026-12-01T10:00:00Z"); // "journal/2026/12/01.jsonl"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { cadenceOf, journalOf, type CapturePolicy } from "@intellectual-frontiers/estate/governance";
import { instantMs, parseDuration } from "@intellectual-frontiers/grc/governance";
import { canonicalize, type LedgerEntry } from "@intellectual-frontiers/grc/logical";
import { type CaptureFailure, type JournalType, type Observed } from "@intellectual-frontiers/evidence-capture/governance";

/** The file of a day's entries, by the day of the instant (UTC). */
export function journalPath(at: string): string {
  const ms = instantMs(at);
  if (ms === undefined) throw new Error(`${at} is not an instant`);
  const d = new Date(ms).toISOString();
  return `journal/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}.jsonl`;
}

/** The path of the state of an asset. */
export function statePath(id: string): string {
  return `state/${id}.json`;
}

/** An entry as one line: its canonical form and a line break. */
export function encodeEntry(e: LedgerEntry): string {
  return `${canonicalize(e)}\n`;
}

/** The entries of a text of lines, or the line that is not one. */
export function decodeEntries(text: string): Result<readonly LedgerEntry[], string> {
  const out: LedgerEntry[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    if (line === "") continue;
    try {
      const v = JSON.parse(line) as Partial<LedgerEntry>;
      if (v.kind !== "grc.ledger-entry" || typeof v.seq !== "number" || typeof v.digest !== "string" || typeof v.previous !== "string" || typeof v.type !== "string" || typeof v.subject !== "string" || typeof v.createdAt !== "string") return err(`line ${i + 1} is not an entry of the journal`);
      out.push(v as LedgerEntry);
    } catch {
      return err(`line ${i + 1} is not JSON`);
    }
  }
  return ok(out);
}

/** The digest of a text: the SHA-256 of its bytes, in hexadecimal. */
export async function textDigest(text: string): Promise<string> {
  return sha256(new TextEncoder().encode(text));
}

/** What a look found: the state (its digest), or a failure. */
export type Found = { readonly kind: "state"; readonly digest: string } | { readonly kind: "failure"; readonly failure: CaptureFailure };

/** What is known of an asset before the look: the digest of its kept state and when it was last journaled. */
export type Before = { readonly digest: string | undefined; readonly lastJournaledAt: string | undefined };

/**
 * The kind of entry a look makes, or nothing where it makes none. A state that differs from the kept one is `capture.changed`; one that is the same is `capture.unchanged` where every capture is journaled, and, where only changes and a heartbeat are,
 * only when the asset was last journaled a heartbeat ago or more; a failure is always an entry.
 */
export function entryTypeFor(found: Found, before: Before, policy: CapturePolicy, now: string, asset: { readonly attributes?: Readonly<Record<string, unknown>> } = {}): JournalType | undefined {
  if (found.kind === "failure") return `capture.${found.failure.kind}`;
  if (before.digest !== found.digest) return "capture.changed";
  const journal = journalOf(policy, asset);
  if (journal.granularity === "every-capture") return "capture.unchanged";
  const heartbeat = journal.heartbeat === null ? undefined : parseDuration(journal.heartbeat);
  const last = before.lastJournaledAt === undefined ? undefined : instantMs(before.lastJournaledAt);
  const at = instantMs(now);
  if (heartbeat === undefined || heartbeat.kind === "err" || last === undefined || at === undefined) return "capture.unchanged";
  return at - last >= heartbeat.value - 1000 ? "capture.unchanged" : undefined;
}

/** The ids of the assets that are due to be looked at: the cadence of each (its own, or that of its state) has run since it was last looked at, within a second; an asset never looked at is due. */
export function dueAssets(policy: CapturePolicy, assets: readonly Observed[], lastAttempt: (id: string) => string | undefined, now: string): readonly string[] {
  const at = instantMs(now);
  if (at === undefined) return [];
  return assets
    .filter((a) => {
      const cadence = cadenceOf(policy, a);
      if (cadence === undefined) return false;
      const ms = parseDuration(cadence);
      if (ms.kind === "err") return false;
      const last = lastAttempt(a.id);
      const lastMs = last === undefined ? undefined : instantMs(last);
      return lastMs === undefined || at - lastMs >= ms.value - 1000;
    })
    .map((a) => a.id)
    .sort();
}
