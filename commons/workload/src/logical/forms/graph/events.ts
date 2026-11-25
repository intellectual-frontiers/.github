// Spec: 0013-form-graph FR-013
/**
 * The events of a run of a graph, in the envelope of the core (`workload.event/1`, the form `graph`), and the state that is their fold with the fold of the hand-off, never stored. The native runner records `started`, one fact
 * for each node (`done`, `failed`, `parked` at a gate that a person has not yet answered, and `answered` by a person: only a person approves a gate, an answer by an agent is refused) and `finished`. An integration runner
 * records the `handoff` and the `receipt` of the core instead, and the outcome of the run is the receipt's exit status. The same events in any arrival order give the same state.
 *
 * @example
 * ```ts
 * import { decodeGraphEvent, encodeGraphEvent } from "./events.ts";
 * decodeGraphEvent(encodeGraphEvent({ kind: "started", graph: "synthetic-graph-01", version: "0.1.0" })).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, formatDecodeError, literal, object, ok, type Decoder, type Result, string, tagged } from "@intellectual-frontiers/core";
import type { EventHead, EventProblem, ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import { decodeEnvelope, encodeEnvelope, makeWorkloadEvent, type Outcome } from "@intellectual-frontiers/workload/governance";
import { foldHandoff, type HandoffState, type Refusal, takeEvents } from "@intellectual-frontiers/workload/logical";

/** One fact of a run of a graph. */
export type GraphEvent =
  | { readonly kind: "started"; readonly graph: string; readonly version: string }
  | { readonly kind: "done"; readonly node: string }
  | { readonly kind: "failed"; readonly node: string; readonly reason: string }
  | { readonly kind: "parked"; readonly node: string; readonly gate: string; readonly approver: string }
  | { readonly kind: "answered"; readonly gate: string; readonly answer: "approved" | "declined" }
  | { readonly kind: "finished"; readonly outcome: "succeeded" | "failed" | "parked" };

const event: Decoder<GraphEvent> = tagged({
  started: object({ kind: literal("started"), graph: string, version: string }),
  done: object({ kind: literal("done"), node: string }),
  failed: object({ kind: literal("failed"), node: string, reason: string }),
  parked: object({ kind: literal("parked"), node: string, gate: string, approver: string }),
  answered: object({ kind: literal("answered"), gate: string, answer: literal("approved", "declined") }),
  finished: object({ kind: literal("finished"), outcome: literal("succeeded", "failed", "parked") }),
});

/** The body of a planning event that carries an event of a graph: the envelope of the core, the same bytes for the same event. */
export const encodeGraphEvent = (e: GraphEvent): string => encodeEnvelope("graph", e);

/** An event of a graph from the body of a comment, or why it is none. */
export function decodeGraphEvent(body: string): Result<GraphEvent, string> {
  const env = decodeEnvelope(body);
  if (env.kind === "err") return env;
  if (env.value.form !== "graph") return err(`the event is of the form ${env.value.form}, not a graph`);
  const r = event(env.value.payload);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The planning event that records an event of a graph on the work order. */
export const makeGraphEvent = (head: EventHead, e: GraphEvent): Result<ItemEvent, EventProblem> => makeWorkloadEvent(head, "graph", e);

/** The state of a run of a graph: a fold of its events, never stored. */
export type GraphState = {
  readonly run: ItemId;
  readonly graph: string | undefined;
  /** The nodes that are done, sorted. */
  readonly done: readonly string[];
  /** The nodes that failed, with why. */
  readonly failed: Readonly<Record<string, string>>;
  /** The gates a node waits at, by node. */
  readonly parked: Readonly<Record<string, string>>;
  /** The gates a person approved, sorted. */
  readonly approved: readonly string[];
  /** The gates a person declined, sorted. */
  readonly declined: readonly string[];
  /** How the native run finished, if it did. */
  readonly finished: "succeeded" | "failed" | "parked" | undefined;
  /** What an integration runner did with the plan: the hand-offs and the receipts. */
  readonly handoff: HandoffState;
  readonly refused: readonly Refusal[];
};

/** The state of the run `run` from the events of its work order: those of other items, other kinds and other forms and a repeat of an event are left out, the rest are taken in the order of their ids. */
export function foldGraph(run: ItemId, events: readonly ItemEvent[]): GraphState {
  const { taken, refused: envelopeRefused } = takeEvents("graph", run, events);
  let graph: string | undefined;
  const done = new Set<string>();
  const failed = new Map<string, string>();
  const parked = new Map<string, string>();
  const approved = new Set<string>();
  const declined = new Set<string>();
  let finished: GraphState["finished"];
  const refused: Refusal[] = [...envelopeRefused];
  for (const { event: ev, payload } of taken) {
    const decoded = event(payload);
    if (decoded.kind === "err") {
      refused.push({ event: ev.id, reason: formatDecodeError(decoded.error) });
      continue;
    }
    const e = decoded.value;
    switch (e.kind) {
      case "started":
        graph = e.graph;
        done.clear();
        failed.clear();
        parked.clear();
        finished = undefined;
        break;
      case "done":
        done.add(e.node);
        failed.delete(e.node);
        parked.delete(e.node);
        break;
      case "failed":
        failed.set(e.node, e.reason);
        break;
      case "parked":
        parked.set(e.node, e.gate);
        break;
      case "answered":
        if (ev.actor.kind !== "person") refused.push({ event: ev.id, reason: `the answer to ${e.gate} is by ${ev.actor.kind} ${ev.actor.id}: only a person approves a gate` });
        else {
          (e.answer === "approved" ? approved : declined).add(e.gate);
          (e.answer === "approved" ? declined : approved).delete(e.gate);
        }
        break;
      case "finished":
        finished = e.outcome;
        break;
      default:
        return e satisfies never;
    }
  }
  const handoff = foldHandoff("graph", run, events);
  const seen = new Set(refused.map((r) => `${r.event}|${r.reason}`));
  refused.push(...handoff.refused.filter((r) => !seen.has(`${r.event}|${r.reason}`)));
  return {
    run,
    graph,
    done: [...done].sort(),
    failed: Object.fromEntries([...failed].sort(([a], [b]) => (a < b ? -1 : 1))),
    parked: Object.fromEntries([...parked].sort(([a], [b]) => (a < b ? -1 : 1))),
    approved: [...approved].sort(),
    declined: [...declined].sort(),
    finished,
    handoff,
    refused,
  };
}

/** What a run finished with, in the words every form shares: the native run's finish, or else the receipt of an integration runner; nothing while it is not finished. */
export const outcomeOf = (state: GraphState): Outcome | undefined => (state.finished === undefined ? state.handoff.outcome : state.finished === "succeeded" ? "completes" : state.finished === "parked" ? "parks" : "fails");
