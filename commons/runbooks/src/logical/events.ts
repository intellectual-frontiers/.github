// Spec: 0008-runbooks-runs FR-001, FR-002, FR-003, FR-004, FR-006
/**
 * A run is recorded as planning events. The work order is a planning item of the kind `task` (no kind of item is added); each fact of the run is a planning `commented` event whose body is a run event, the line
 * `runbooks.run-event/1 ` and a canonical JSON object, decoded at the boundary into a closed union or refused. The state of a run is the fold of its events, in the order of their ids, the same for the same events in any
 * arrival order and never stored: the status of each step, the stores attached, whether the workshop is disposable (computed), what is parked and whether the run is finished. A gate is passed only by the answer of a person.
 *
 * @example
 * ```ts
 * import { decodeRunEvent, encodeRunEvent } from "./events.ts";
 * decodeRunEvent(encodeRunEvent({ kind: "step-started", step: "claim-order" })).kind; // "ok"
 * ```
 *
 * @module
 */
import { array, err, formatDecodeError, literal, object, ok, oneOf, record, type Result, string, tagged, boolean, number, type Decoder } from "@intellectual-frontiers/core";
import { type EventHead, type EventId, type EventProblem, type ItemEvent, type ItemId, makeEvent } from "@intellectual-frontiers/planning/governance";
import { STORE_CLASSES, type Runbook, type StoreClass } from "@intellectual-frontiers/runbooks/governance";

/** The line a run event's body starts with. */
export const RUN_EVENT_PREFIX = "runbooks.run-event/1 ";

/** One value a judge proposes. */
export type ProposedValue = string | number | boolean | readonly string[];

/** One fact of a run. */
export type RunEvent =
  | { readonly kind: "started"; readonly runbook: string; readonly version: string }
  | { readonly kind: "step-started"; readonly step: string }
  | { readonly kind: "step-succeeded"; readonly step: string; readonly digests: readonly string[]; readonly outputs?: Readonly<Record<string, string | number | boolean>> }
  | { readonly kind: "step-failed"; readonly step: string; readonly reason: string }
  | { readonly kind: "parked"; readonly step: string; readonly approver: string; readonly deadline: string }
  | { readonly kind: "answered"; readonly step: string; readonly answer: "approved" | "declined" | "answered" }
  | { readonly kind: "proposed"; readonly step: string; readonly output: Readonly<Record<string, ProposedValue>> }
  | { readonly kind: "attached"; readonly store: string; readonly class: StoreClass }
  | { readonly kind: "detached"; readonly store: string }
  | { readonly kind: "compensated"; readonly step: string; readonly for: string }
  | { readonly kind: "expired"; readonly step: string }
  | { readonly kind: "finished"; readonly outcome: "succeeded" | "failed" | "parked" };

const value: Decoder<ProposedValue> = oneOf(string, number, boolean, array(string));

const runEvent: Decoder<RunEvent> = tagged({
  started: object({ kind: literal("started"), runbook: string, version: string }),
  "step-started": object({ kind: literal("step-started"), step: string }),
  "step-succeeded": object({ kind: literal("step-succeeded"), step: string, digests: array(string) }, { outputs: record(oneOf(string, number, boolean)) }),
  "step-failed": object({ kind: literal("step-failed"), step: string, reason: string }),
  parked: object({ kind: literal("parked"), step: string, approver: string, deadline: string }),
  answered: object({ kind: literal("answered"), step: string, answer: literal("approved", "declined", "answered") }),
  proposed: object({ kind: literal("proposed"), step: string, output: record(value) }),
  attached: object({ kind: literal("attached"), store: string, class: literal(...STORE_CLASSES) }),
  detached: object({ kind: literal("detached"), store: string }),
  compensated: object({ kind: literal("compensated"), step: string, for: string }),
  expired: object({ kind: literal("expired"), step: string }),
  finished: object({ kind: literal("finished"), outcome: literal("succeeded", "failed", "parked") }),
});

const canonical = (v: unknown): unknown => (Array.isArray(v) ? v.map(canonical) : typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canonical(x)])) : v);

/** The body of a planning event that carries a run event: the prefix and the canonical JSON, the same bytes for the same event. */
export const encodeRunEvent = (e: RunEvent): string => `${RUN_EVENT_PREFIX}${JSON.stringify(canonical(e))}`;

/** A run event from the body of a comment, or why it is none. */
export function decodeRunEvent(body: string): Result<RunEvent, string> {
  if (!body.startsWith(RUN_EVENT_PREFIX)) return err("the body is not a run event: it does not start with the prefix of run events");
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(RUN_EVENT_PREFIX.length));
  } catch {
    return err("the body of a run event is JSON and this is not");
  }
  const r = runEvent(raw);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The planning event that records a run event on the work order. */
export const makeRunEvent = (head: EventHead, e: RunEvent): Result<ItemEvent, EventProblem> => makeEvent(head, { type: "commented", body: encodeRunEvent(e) });

/** The planning event that opens the work order of a run: an item of the kind `task`, not a new kind. */
export const openWorkOrder = (head: EventHead, runbook: Runbook): Result<ItemEvent, EventProblem> =>
  makeEvent(head, { type: "opened", kind: "task", title: `Run ${runbook.id} ${runbook.version}`, body: runbook.summary, labels: [`runbook:${runbook.id}`], assignees: [], origin: "declared" });

/** How a step stands in a run. */
export type StepStatus = "started" | "succeeded" | "failed" | "parked" | "answered" | "compensated" | "expired";

/** What the fold knows of one step. */
export type StepRecord = {
  readonly status: StepStatus;
  readonly digests: readonly string[];
  /** What the step gave for later steps to read. */
  readonly outputs?: Readonly<Record<string, string | number | boolean>>;
  readonly proposal?: Readonly<Record<string, ProposedValue>>;
  readonly approver?: string;
  readonly deadline?: string;
  /** Whether a person approved it: only the answer of a person passes a gate. */
  readonly passed: boolean;
};

/** An event the fold did not take, and why. */
export type Refusal = { readonly event: EventId; readonly reason: string };

/** The state of a run: a fold of its events, never stored. */
export type RunState = {
  readonly run: ItemId;
  readonly runbook: string | undefined;
  readonly steps: Readonly<Record<string, StepRecord>>;
  readonly attached: readonly { readonly store: string; readonly class: StoreClass }[];
  /** Computed from what is attached. */
  readonly disposable: boolean;
  readonly parked: readonly string[];
  readonly finished: "succeeded" | "failed" | "parked" | undefined;
  readonly refused: readonly Refusal[];
};

/** Whether a run may be finished: nothing attached and nothing parked. */
export const canFinish = (s: Pick<RunState, "attached" | "parked">): boolean => s.attached.length === 0 && s.parked.length === 0;

/** The state of the run `run` from the events of its work order: those of other items, those of other kinds and a repeat of an event are left out, the rest are taken in the order of their ids. */
export function foldRun(run: ItemId, events: readonly ItemEvent[]): RunState {
  const seen = new Set<string>();
  const ordered = events.filter((e) => e.item === run && !seen.has(e.id) && seen.add(e.id)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let runbook: string | undefined;
  const steps = new Map<string, StepRecord>();
  const attached = new Map<string, StoreClass>();
  const refused: Refusal[] = [];
  let finished: RunState["finished"];
  const set = (id: string, over: Partial<StepRecord> & { readonly status: StepStatus }): void => {
    const prior = steps.get(id);
    steps.set(id, { digests: prior?.digests ?? [], passed: prior?.passed ?? false, ...(prior?.outputs === undefined ? {} : { outputs: prior.outputs }), ...(prior?.proposal === undefined ? {} : { proposal: prior.proposal }), ...(prior?.approver === undefined ? {} : { approver: prior.approver }), ...(prior?.deadline === undefined ? {} : { deadline: prior.deadline }), ...over });
  };
  const parked = (): readonly string[] => [...steps].filter(([, r]) => r.status === "parked").map(([id]) => id).sort();
  for (const ev of ordered) {
    if (ev.data.type !== "commented" || !ev.data.body.startsWith(RUN_EVENT_PREFIX)) continue;
    const decoded = decodeRunEvent(ev.data.body);
    if (decoded.kind === "err") {
      refused.push({ event: ev.id, reason: decoded.error });
      continue;
    }
    const e = decoded.value;
    switch (e.kind) {
      case "started":
        runbook = e.runbook;
        break;
      case "step-started":
        set(e.step, { status: "started" });
        break;
      case "step-succeeded":
        set(e.step, { status: "succeeded", digests: e.digests, ...(e.outputs === undefined ? {} : { outputs: e.outputs }) });
        break;
      case "step-failed":
        set(e.step, { status: "failed" });
        break;
      case "parked":
        set(e.step, { status: "parked", approver: e.approver, deadline: e.deadline });
        break;
      case "answered":
        if (ev.actor.kind !== "person") refused.push({ event: ev.id, reason: `the answer to ${e.step} is by ${ev.actor.kind} ${ev.actor.id}: only a person answers a gate` });
        else set(e.step, { status: "answered", passed: e.answer === "approved" });
        break;
      case "proposed":
        set(e.step, { status: steps.get(e.step)?.status ?? "succeeded", proposal: e.output });
        break;
      case "attached":
        attached.set(e.store, e.class);
        break;
      case "detached":
        attached.delete(e.store);
        break;
      case "compensated":
        set(e.for, { status: "compensated" });
        break;
      case "expired":
        set(e.step, { status: "expired" });
        break;
      case "finished": {
        const list = [...attached].map(([store, class_]) => ({ store, class: class_ }));
        if (!canFinish({ attached: list, parked: parked() })) refused.push({ event: ev.id, reason: "the run is not finished: a store is attached or a step is parked" });
        else finished = e.outcome;
        break;
      }
      default:
        return e satisfies never;
    }
  }
  const list = [...attached].map(([store, class_]) => ({ store, class: class_ })).sort((a, b) => (a.store < b.store ? -1 : 1));
  return { run, runbook, steps: Object.fromEntries([...steps].sort(([a], [b]) => (a < b ? -1 : 1))), attached: list, disposable: list.every((s) => s.class === "ephemeral"), parked: parked(), finished, refused };
}

