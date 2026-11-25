// Spec: 0010-workload-runners FR-009, FR-010
/**
 * The state of a hand-off, a fold of its events and never stored. The events are the `handoff` and the `receipt` of the envelope of the core, taken in the order of their ids, once each, whatever order they arrived in. A
 * receipt counts where a hand-off of the same plan hash exists (a receipt that comes first waits for it, because the fold orders by id and then matches); one that matches none is refused. The outcome is said in the
 * three words every form shares: an exit status of 0 completes, any other fails, and while there is no receipt there is none. An approval that a receipt carries counts only where the actor who recorded it is a person.
 * Pure.
 *
 * @example
 * ```ts
 * import { foldHandoff } from "./handoff.ts";
 * // foldHandoff("runbook", item, events).outcome: "completes", "fails" or undefined
 * ```
 *
 * @module
 */
import type { EventId, ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import { type BuiltFormId, decodeRunnerPayload, finding, type Finding, type Outcome } from "@intellectual-frontiers/workload/governance";
import { type Refusal, takeRunnerEvents } from "./fold.ts";

/** A plan that went to a runner. */
export type HandoffRecord = { readonly event: EventId; readonly runner: string; readonly plan: string };

/** What an external run did, as a receipt says it. */
export type ReceiptRecord = { readonly event: EventId; readonly plan: string; readonly ref: string; readonly status: number; readonly log: string };

/** The state of the hand-offs of a run. */
export type HandoffState = {
  readonly handoffs: readonly HandoffRecord[];
  /** The receipts that name a hand-off, in the order of their ids. */
  readonly receipts: readonly ReceiptRecord[];
  /** The gates a person approved on the platform, once each. */
  readonly approved: readonly string[];
  /** Where it stands: nothing handed off, handed off and waiting for a receipt, or received. */
  readonly state: "none" | "handed-off" | "received";
  /** What the last receipt says the run finished with, in the three words of every form; nothing while there is none. */
  readonly outcome: Outcome | undefined;
  readonly refused: readonly Refusal[];
};

const said = (f: Finding): string => `${f.code}: ${f.message}`;

/** The state of the hand-offs of the run `item` from the events of its work order: those of other items, other forms and other kinds, and a repeat, are left out. */
export function foldHandoff(form: BuiltFormId, item: ItemId, events: readonly ItemEvent[]): HandoffState {
  const { taken, refused: envelopeRefused } = takeRunnerEvents(form, item, events);
  const refused: Refusal[] = [...envelopeRefused];
  const handoffs: HandoffRecord[] = [];
  const pending: { readonly record: ReceiptRecord; readonly approvals: readonly string[]; readonly byPerson: boolean }[] = [];
  for (const { event, payload } of taken) {
    const decoded = decodeRunnerPayload(payload);
    if (decoded.kind === "err") {
      refused.push({ event: event.id, reason: decoded.error });
      continue;
    }
    const e = decoded.value;
    if (e.kind === "handoff") handoffs.push({ event: event.id, runner: e.runner, plan: e.plan });
    else pending.push({ record: { event: event.id, plan: e.plan, ref: e.ref, status: e.status, log: e.log }, approvals: e.approvals ?? [], byPerson: event.actor.kind === "person" });
  }
  const receipts: ReceiptRecord[] = [];
  const approved = new Set<string>();
  for (const p of pending) {
    if (!handoffs.some((h) => h.plan === p.record.plan)) {
      refused.push({ event: p.record.event, reason: said(finding("E-WL-RUNNER-RECEIPT-UNMATCHED", "", `the receipt ${p.record.event} names the plan ${p.record.plan}, which no hand-off of this run has`)) });
      continue;
    }
    receipts.push(p.record);
    if (p.approvals.length === 0) continue;
    if (!p.byPerson) refused.push({ event: p.record.event, reason: said(finding("E-WL-RUNNER-APPROVAL-NOT-PERSON", "", `the approval of ${p.approvals.join(", ")} in the receipt ${p.record.event} was recorded by an agent or a tool: only a person approves`)) });
    else for (const g of p.approvals) approved.add(g);
  }
  const last = receipts.at(-1);
  return {
    handoffs,
    receipts,
    approved: [...approved].sort(),
    state: last !== undefined ? "received" : handoffs.length > 0 ? "handed-off" : "none",
    outcome: last === undefined ? undefined : last.status === 0 ? "completes" : "fails",
    refused,
  };
}
