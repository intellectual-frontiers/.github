// Spec: 0005-workload-runs FR-001, FR-002
/**
 * A run is recorded as planning events, in every form. The work order is a planning item of the kind `task` (no kind of item is added) labelled `workload:<id>`; each fact of a run is a planning `commented` event whose
 * body is the line `workload.event/1 ` and a canonical JSON object that names its form and carries the form's own event, which the form decodes at the boundary into its closed union or refuses. This module is the
 * envelope only: it knows no event of any form.
 *
 * @example
 * ```ts
 * import { decodeEnvelope, encodeEnvelope } from "./events.ts";
 * decodeEnvelope(encodeEnvelope("runbook", { kind: "step-started", step: "claim-order" })).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type EventHead, type EventProblem, type ItemEvent, makeEvent } from "@intellectual-frontiers/planning/governance";
import type { WorkloadHead } from "./node.ts";
import { type BuiltFormId, isBuiltForm } from "./terms.ts";

/** The line a run event's body starts with. */
export const EVENT_PREFIX = "workload.event/1 ";

/** The prefix of the label a work order carries: `workload:<id>`. */
export const WORKLOAD_LABEL = "workload:";

/** A run event as the envelope holds it: the form it is of and the event of that form, still to be decoded by the form. */
export type Envelope = { readonly form: BuiltFormId; readonly payload: Readonly<Record<string, unknown>> };

const canonical = (v: unknown): unknown => (Array.isArray(v) ? v.map(canonical) : typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canonical(x)])) : v);

/** The body of a planning event that carries an event of a form: the prefix and the canonical JSON, the same bytes for the same event. */
export const encodeEnvelope = (form: BuiltFormId, payload: object): string => `${EVENT_PREFIX}${JSON.stringify(canonical({ ...payload, form }))}`;

/** The envelope of the body of a comment, or why it is none. */
export function decodeEnvelope(body: string): Result<Envelope, string> {
  if (!body.startsWith(EVENT_PREFIX)) return err("the body is not a run event: it does not start with the prefix of run events");
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(EVENT_PREFIX.length));
  } catch {
    return err("the body of a run event is JSON and this is not");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return err("a run event is a JSON object");
  const form: unknown = Reflect.get(raw, "form");
  if (typeof form !== "string" || !isBuiltForm(form)) return err("a run event names the form it is of, one that has code");
  const payload = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "form"));
  return ok({ form, payload });
}

/** The planning event that records an event of a form on the work order. */
export const makeWorkloadEvent = (head: EventHead, form: BuiltFormId, payload: object): Result<ItemEvent, EventProblem> => makeEvent(head, { type: "commented", body: encodeEnvelope(form, payload) });

/** The planning event that opens the work order of a run: an item of the kind `task`, not a new kind. */
export const openWorkOrder = (head: EventHead, workload: Pick<WorkloadHead, "id" | "version" | "summary">): Result<ItemEvent, EventProblem> =>
  makeEvent(head, { type: "opened", kind: "task", title: `Run ${workload.id} ${workload.version}`, body: workload.summary, labels: [`${WORKLOAD_LABEL}${workload.id}`], assignees: [], origin: "declared" });
