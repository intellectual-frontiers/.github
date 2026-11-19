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

/** What an event's hash is made of, in this order. */
export interface HashedFields {
  readonly previous: string;
  readonly id: string;
  readonly at: string;
  readonly actorKind: string;
  readonly actor?: string | null | undefined;
  readonly onBehalfOf?: string | null | undefined;
  readonly tenant?: string | null | undefined;
  readonly action: string;
  readonly outcome: string;
  readonly decision?: string | null | undefined;
  readonly targetConcept?: string | null | undefined;
  readonly targetKey?: string | null | undefined;
  readonly reason?: string | null | undefined;
  readonly policyRefs?: unknown;
  readonly chain?: unknown;
}

/** The hash of an event: of its fields and of the hash of the event before it, so that a change to any field, or to the order, shows. */
export const eventHashOf = (f: HashedFields): string =>
  sha256Hex(canonical([f.previous, f.id, f.at, f.actorKind, f.actor ?? null, f.onBehalfOf ?? null, f.tenant ?? null, f.action, f.outcome, f.decision ?? null, f.targetConcept ?? null, f.targetKey ?? null, f.reason ?? null, f.policyRefs ?? null, f.chain ?? null]));

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
    const hash = eventHashOf({ previous, id, at, actorKind: e.actorKind, actor: e.actor, onBehalfOf: e.onBehalfOf, tenant: e.tenant, action: e.action, outcome: e.outcome, decision: e.decision, targetConcept: e.targetConcept, targetKey: e.targetKey, reason: e.reason, policyRefs: e.policyRefs, chain: e.chain });
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
export type ChainProblem = { readonly kind: "broken"; readonly at: string } | { readonly kind: "forked"; readonly at: string } | { readonly kind: "hash-mismatch"; readonly at: string };

/**
 * Walks the chain from its start and says where it is broken or forked.
 *
 * @param tx - a transaction
 * @returns how many events the chain holds, and what is wrong with it
 */
export async function verifyAuditChain(tx: Tx): Promise<{ readonly length: number; readonly problems: readonly ChainProblem[] }> {
  const rows = await tx.select("audit event", {
    columns: ["auditEventId", "occurredAt", "actorKind", "actor", "onBehalfOf", "tenant", "action", "outcome", "decision", "targetConcept", "targetKey", "reason", "policyRefs", "chain", "previousHash", "eventHash"],
  });
  const next = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) next.set(String(r["previousHash"]), [...(next.get(String(r["previousHash"])) ?? []), r]);
  const parsed = (v: unknown): unknown => {
    if (typeof v !== "string") return v ?? null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };
  const text = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  const problems: ChainProblem[] = [];
  let walked = 0;
  let at = GENESIS;
  for (;;) {
    const following = next.get(at) ?? [];
    if (following.length === 0) break;
    if (following.length > 1) problems.push({ kind: "forked", at });
    const e = following[0] as Record<string, unknown>;
    // the hash is made again from what the event holds: an event changed in place does not match its own hash
    const again = eventHashOf({
      previous: String(e["previousHash"]),
      id: String(e["auditEventId"]),
      at: e["occurredAt"] instanceof Date ? e["occurredAt"].toISOString() : new Date(String(e["occurredAt"])).toISOString(),
      actorKind: String(e["actorKind"]),
      actor: text(e["actor"]),
      onBehalfOf: text(e["onBehalfOf"]),
      tenant: text(e["tenant"]),
      action: String(e["action"]),
      outcome: String(e["outcome"]),
      decision: text(e["decision"]),
      targetConcept: text(e["targetConcept"]),
      targetKey: text(e["targetKey"]),
      reason: text(e["reason"]),
      policyRefs: parsed(e["policyRefs"]),
      chain: parsed(e["chain"]),
    });
    if (again !== String(e["eventHash"])) problems.push({ kind: "hash-mismatch", at: String(e["auditEventId"]) });
    walked++;
    at = String(e["eventHash"]);
  }
  if (walked !== rows.length) problems.push({ kind: "broken", at });
  return { length: walked, problems };
}
