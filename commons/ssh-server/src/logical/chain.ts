// Spec: 0003-server-policy FR-014
/**
 * The hash chain of the audit log, pure over an injected hash function: each event holds its number, the hash of the one before and its own hash over its canonical text, so that a change, a removal or a reordering of any event is found by `verifyChain`.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { GENESIS } from "@intellectual-frontiers/ssh-server/governance";
import type { AuditEvent, ChainedEvent } from "@intellectual-frontiers/ssh-server/governance";

/** A hash function: text to 64 lowercase hex characters (SHA-256). */
export type Hasher = (text: string) => string;

/** The canonical text of an event: JSON with its keys in sorted order, without the chain fields. */
export function canonical(event: AuditEvent): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(event).sort()) {
    if (k === "seq" || k === "prev" || k === "hash") continue;
    const v = (event as unknown as Record<string, unknown>)[k];
    if (v !== undefined) sorted[k] = v;
  }
  return JSON.stringify(sorted);
}

/** Chain an event after the last one of the log (nothing for an empty log). */
export function chainNext(last: Pick<ChainedEvent, "seq" | "hash"> | undefined, event: AuditEvent, hash: Hasher): ChainedEvent {
  const seq = last === undefined ? 0 : last.seq + 1;
  const prev = last === undefined ? GENESIS : last.hash;
  return { ...event, seq, prev, hash: hash(`${seq}\n${prev}\n${canonical(event)}`) };
}

/** Verify a log from its first event: the number of events where the chain holds, or the place where it breaks. */
export function verifyChain(events: readonly ChainedEvent[], hash: Hasher): Result<number, string> {
  let prev = GENESIS;
  for (const [i, e] of events.entries()) {
    if (e.seq !== i) return err(`event ${i}: its number is ${e.seq}`);
    if (e.prev !== prev) return err(`event ${i}: it does not follow the event before it`);
    const want = hash(`${e.seq}\n${e.prev}\n${canonical(e)}`);
    if (e.hash !== want) return err(`event ${i}: its hash does not match its content`);
    prev = e.hash;
  }
  return ok(events.length);
}
