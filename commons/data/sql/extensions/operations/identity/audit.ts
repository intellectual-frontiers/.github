// Spec: 0041-identity-authorize FR-006
/**
 * The audit trail of the identity model (commons data 0041-identity-authorize): each event is written in the transaction of what it records, and holds the hash of the event before it, so that a
 * change to one shows in every one after it. The head of the chain is the event that no other names as its predecessor.
 *
 * @module
 */
import { canonical, sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import type { AuditEvent, AuditSink, Context, Tx } from "../tx.ts";

/** What comes before the first event. */
export const GENESIS = "genesis";

/** An audit event, with what the identity trail adds: on whose behalf, through what, and what decided. */
export interface IdentityAuditEvent extends AuditEvent {
  readonly onBehalfOf?: string;
  readonly delegationKey?: string;
  readonly runKey?: string;
  readonly decision?: "allow" | "deny";
  readonly policyRefs?: readonly string[];
  readonly chain?: readonly string[];
}

/** The audit sink of the identity model. */
export const identityAuditSink: AuditSink = {
  table: "audit event",
  async record(tx: Tx, event: AuditEvent, context: Context): Promise<string> {
    const e = event as IdentityAuditEvent;
    const heads = await tx.query(
      (r) => `SELECT ${r.col("audit event", "eventHash")} AS h FROM ${r.table("audit event")} a WHERE NOT EXISTS (SELECT 1 FROM ${r.table("audit event")} b WHERE b.${r.col("audit event", "previousHash")} = a.${r.col("audit event", "eventHash")})`,
    );
    const previous = heads.length === 0 ? GENESIS : String(heads[0]?.["h"]);
    const id = context.newId();
    const at = context.now();
    const hash = sha256Hex(
      canonical([previous, id, at, e.actorKind, e.actor ?? null, e.onBehalfOf ?? null, e.tenant ?? null, e.action, e.outcome, e.decision ?? null, e.targetConcept ?? null, e.targetKey ?? null, e.reason ?? null, e.policyRefs ?? null, e.chain ?? null]),
    );
    await tx.insert("audit event", {
      auditEventId: id,
      occurredAt: at,
      actorKind: e.actorKind,
      action: e.action,
      outcome: e.outcome,
      previousHash: previous,
      eventHash: hash,
      ...(e.decision === undefined ? {} : { decision: e.decision }),
      ...(e.tenant === undefined ? {} : { tenant: e.tenant }),
      ...(e.actor === undefined ? {} : { actor: e.actor }),
      ...(e.onBehalfOf === undefined ? {} : { onBehalfOf: e.onBehalfOf }),
      ...(e.targetConcept === undefined ? {} : { targetConcept: e.targetConcept }),
      ...(e.targetKey === undefined ? {} : { targetKey: e.targetKey }),
      ...(e.reason === undefined ? {} : { reason: e.reason }),
      ...(e.delegationKey === undefined ? {} : { delegationKey: e.delegationKey }),
      ...(e.runKey === undefined ? {} : { runKey: e.runKey }),
      ...(e.policyRefs === undefined ? {} : { policyRefs: JSON.stringify(e.policyRefs) }),
      ...(e.chain === undefined ? {} : { chain: JSON.stringify(e.chain) }),
    });
    return hash;
  },
};

/** What is wrong with a chain, or nothing. */
export type ChainProblem = { readonly kind: "broken"; readonly at: string } | { readonly kind: "forked"; readonly at: string };

/**
 * Walks the chain from its start and says where it is broken or forked.
 *
 * @param tx - a transaction
 * @returns how many events the chain holds, and what is wrong with it
 */
export async function verifyAuditChain(tx: Tx): Promise<{ readonly length: number; readonly problems: readonly ChainProblem[] }> {
  const rows = await tx.select("audit event", { columns: ["auditEventId", "previousHash", "eventHash"] });
  const next = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) next.set(String(r["previousHash"]), [...(next.get(String(r["previousHash"])) ?? []), r]);
  const problems: ChainProblem[] = [];
  let walked = 0;
  let at = GENESIS;
  for (;;) {
    const following = next.get(at) ?? [];
    if (following.length === 0) break;
    if (following.length > 1) problems.push({ kind: "forked", at });
    walked++;
    at = String((following[0] as Record<string, unknown>)["eventHash"]);
  }
  if (walked !== rows.length) problems.push({ kind: "broken", at });
  return { length: walked, problems };
}
