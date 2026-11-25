// Spec: 0009-form-reconcile FR-007, FR-008, FR-010
/**
 * The events of a pass of a reconcile, in the envelope of the core (`workload.event/1`, the form `reconcile`): each fact is decoded at the boundary into a closed union or refused. The state is the fold of the events in the
 * order of their ids, the same for the same events in any arrival order and never stored. A pass starts from what is observed now (level-triggered): `pass-started` begins a new pass and clears what belonged to the last. A plan
 * is approved by its hash: the answer of a person carries the hash as its evidence, and an approval counts only for a plan whose hash it names, so a plan that changed is not approved. Only a person answers.
 *
 * @example
 * ```ts
 * import { decodeReconcileEvent, encodeReconcileEvent } from "./events.ts";
 * decodeReconcileEvent(encodeReconcileEvent({ kind: "pass-started", loop: "converge", version: "0.1.0" })).kind; // "ok"
 * ```
 *
 * @module
 */
import { array, boolean, err, formatDecodeError, integer, literal, object, ok, type Decoder, type Result, refine, string, tagged } from "@intellectual-frontiers/core";
import type { EventHead, EventProblem, ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import { decodeEnvelope, encodeEnvelope, makeWorkloadEvent, openWorkOrder as openWorkloadOrder } from "@intellectual-frontiers/workload/governance";
import { type Refusal, takeEvents } from "@intellectual-frontiers/workload/logical";
import { isPlanHash } from "./diff.ts";
import type { Reconcile } from "./node.ts";

/** The evidence an approval carries: the digest of the plan that was approved. */
export type ApprovalEvidence = { readonly kind: "digest"; readonly digest: string };

/** One fact of a pass. */
export type ReconcileEvent =
  | { readonly kind: "pass-started"; readonly loop: string; readonly version: string }
  | { readonly kind: "observed"; readonly node: string; readonly digest: string }
  | { readonly kind: "diffed"; readonly node: string; readonly changes: number }
  | { readonly kind: "planned"; readonly node: string; readonly hash: string; readonly changes: number }
  | { readonly kind: "parked"; readonly node: string; readonly approver: string; readonly deadline: string; readonly plan: string }
  | { readonly kind: "answered"; readonly node: string; readonly answer: "approved" | "declined"; readonly evidence: ApprovalEvidence }
  | { readonly kind: "applied"; readonly node: string; readonly plan: string; readonly digests: readonly string[] }
  | { readonly kind: "verified"; readonly node: string; readonly holds: boolean }
  | { readonly kind: "failed"; readonly node: string; readonly reason: string }
  | { readonly kind: "expired"; readonly node: string }
  | { readonly kind: "finished"; readonly outcome: "converged" | "failed" | "parked" };

const hash: Decoder<string> = refine(string, "a plan hash: 64 lower case hexadecimal digits", isPlanHash);

const event: Decoder<ReconcileEvent> = tagged({
  "pass-started": object({ kind: literal("pass-started"), loop: string, version: string }),
  observed: object({ kind: literal("observed"), node: string, digest: string }),
  diffed: object({ kind: literal("diffed"), node: string, changes: integer }),
  planned: object({ kind: literal("planned"), node: string, hash, changes: integer }),
  parked: object({ kind: literal("parked"), node: string, approver: string, deadline: string, plan: hash }),
  answered: object({ kind: literal("answered"), node: string, answer: literal("approved", "declined"), evidence: object({ kind: literal("digest"), digest: hash }) }),
  applied: object({ kind: literal("applied"), node: string, plan: hash, digests: array(string) }),
  verified: object({ kind: literal("verified"), node: string, holds: boolean }),
  failed: object({ kind: literal("failed"), node: string, reason: string }),
  expired: object({ kind: literal("expired"), node: string }),
  finished: object({ kind: literal("finished"), outcome: literal("converged", "failed", "parked") }),
});

/** The body of a planning event that carries an event of a reconcile: the envelope of the core, the same bytes for the same event. */
export const encodeReconcileEvent = (e: ReconcileEvent): string => encodeEnvelope("reconcile", e);

/** An event of a reconcile from the body of a comment, or why it is none. */
export function decodeReconcileEvent(body: string): Result<ReconcileEvent, string> {
  const env = decodeEnvelope(body);
  if (env.kind === "err") return env;
  if (env.value.form !== "reconcile") return err(`the event is of the form ${env.value.form}, not a reconcile`);
  const r = event(env.value.payload);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The planning event that records an event of a reconcile on the work order. */
export const makeReconcileEvent = (head: EventHead, e: ReconcileEvent): Result<ItemEvent, EventProblem> => makeWorkloadEvent(head, "reconcile", e);

/** The planning event that opens the work order of a run: an item of the kind `task`, not a new kind. */
export const openWorkOrder = (head: EventHead, loop: Reconcile): Result<ItemEvent, EventProblem> => openWorkloadOrder(head, loop);

/** How a node stands in a pass. */
export type NodeStatus = "observed" | "diffed" | "planned" | "parked" | "answered" | "applied" | "verified" | "failed" | "expired";

/** What the fold knows of one node. */
export type NodeRecord = {
  readonly status: NodeStatus;
  readonly digest?: string;
  readonly approver?: string;
  readonly deadline?: string;
  /** The plan a parked node waits to have approved. */
  readonly parkedFor?: string;
  /** For a verify: whether the state converged. */
  readonly holds?: boolean;
};

/** The state of a loop: a fold of its events, never stored. */
export type ReconcileState = {
  readonly run: ItemId;
  readonly loop: string | undefined;
  /** How many passes were started. */
  readonly passes: number;
  /** The nodes of the pass in hand. */
  readonly nodes: Readonly<Record<string, NodeRecord>>;
  /** The plan of the pass in hand: its hash and how many changes. */
  readonly plan: { readonly hash: string; readonly changes: number } | undefined;
  /** The hashes a person approved in this pass. */
  readonly approved: readonly string[];
  /** The hashes a person declined in this pass. */
  readonly declined: readonly string[];
  /** The hashes applied in this pass. */
  readonly applied: readonly string[];
  /** Whether the plan in hand is the one a person approved: an approval of another hash does not count. */
  readonly planApproved: boolean;
  readonly parked: readonly string[];
  readonly finished: "converged" | "failed" | "parked" | undefined;
  readonly refused: readonly Refusal[];
};

/** The state of the run `run` from the events of its work order: those of other items, other kinds and other forms and a repeat of an event are left out, the rest are taken in the order of their ids. */
export function foldReconcile(run: ItemId, events: readonly ItemEvent[]): ReconcileState {
  const { taken, refused: envelopeRefused } = takeEvents("reconcile", run, events);
  let loop: string | undefined;
  let passes = 0;
  let nodes = new Map<string, NodeRecord>();
  let plan: ReconcileState["plan"];
  let approved = new Set<string>();
  let declined = new Set<string>();
  let applied = new Set<string>();
  let finished: ReconcileState["finished"];
  const refused: Refusal[] = [...envelopeRefused];
  const set = (id: string, status: NodeStatus, over: Omit<NodeRecord, "status"> = {}): void => void nodes.set(id, { ...nodes.get(id), status, ...over });
  const parked = (): readonly string[] => [...nodes].filter(([, r]) => r.status === "parked").map(([id]) => id).sort();
  for (const { event: ev, payload } of taken) {
    const decoded = event(payload);
    if (decoded.kind === "err") {
      refused.push({ event: ev.id, reason: formatDecodeError(decoded.error) });
      continue;
    }
    const e = decoded.value;
    switch (e.kind) {
      case "pass-started":
        loop = e.loop;
        passes += 1;
        nodes = new Map();
        plan = undefined;
        approved = new Set();
        declined = new Set();
        applied = new Set();
        finished = undefined;
        break;
      case "observed":
        set(e.node, "observed", { digest: e.digest });
        break;
      case "diffed":
        set(e.node, "diffed");
        break;
      case "planned":
        plan = { hash: e.hash, changes: e.changes };
        set(e.node, "planned", { digest: e.hash });
        break;
      case "parked":
        set(e.node, "parked", { approver: e.approver, deadline: e.deadline, parkedFor: e.plan });
        break;
      case "answered":
        if (ev.actor.kind !== "person") refused.push({ event: ev.id, reason: `the answer to ${e.node} is by ${ev.actor.kind} ${ev.actor.id}: only a person approves a plan` });
        else {
          if (e.answer === "approved") approved.add(e.evidence.digest);
          else declined.add(e.evidence.digest);
          set(e.node, "answered", { digest: e.evidence.digest });
        }
        break;
      case "applied":
        applied.add(e.plan);
        set(e.node, "applied", { digest: e.plan });
        break;
      case "verified":
        set(e.node, "verified", { holds: e.holds });
        break;
      case "failed":
        set(e.node, "failed");
        break;
      case "expired":
        set(e.node, "expired");
        break;
      case "finished":
        if (parked().length > 0) refused.push({ event: ev.id, reason: "the pass is not finished: a node is parked" });
        else finished = e.outcome;
        break;
      default:
        return e satisfies never;
    }
  }
  return {
    run,
    loop,
    passes,
    nodes: Object.fromEntries([...nodes].sort(([a], [b]) => (a < b ? -1 : 1))),
    plan,
    approved: [...approved].sort(),
    declined: [...declined].sort(),
    applied: [...applied].sort(),
    planApproved: plan !== undefined && approved.has(plan.hash),
    parked: parked(),
    finished,
    refused,
  };
}
