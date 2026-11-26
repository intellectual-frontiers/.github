// Spec: 0010-workload-runners FR-009
/**
 * The two events that a run gains from the integration runners, in the envelope of the core (`workload.event/1`, the form of the workload): a `handoff` says a plan went to a runner (the plan hash and the runner), and a
 * `receipt` says what the external run did (the plan hash, the reference of the external run, its exit status and the digest of its log, and the approvals the platform gave, by the id of the gate). They are decoded at the
 * boundary into one closed union or refused. A receipt is pulled by ingest and written by the library: nothing comes in over a network.
 *
 * @example
 * ```ts
 * import { decodeRunnerEvent, encodeRunnerEvent } from "./runner-events.ts";
 * // decodeRunnerEvent(encodeRunnerEvent("runbook", { kind: "handoff", runner: "bash", plan: hash })).kind // "ok"
 * ```
 *
 * @module
 */
import { array, err, formatDecodeError, integer, literal, object, ok, type Decoder, type Result, refine, string, tagged } from "@intellectual-frontiers/core";
import { type EventHead, type EventProblem, type ItemEvent } from "@intellectual-frontiers/planning/governance";
import { decodeEnvelope, encodeEnvelope, makeWorkloadEvent } from "./events.ts";
import { isDigest } from "./runner.ts";
import type { BuiltFormId } from "./terms.ts";

/** The kinds of the events of a hand-off: a closed list, which no form's own event may use. */
export const RUNNER_EVENT_KINDS = ["handoff", "receipt"] as const;

/** One fact of a hand-off. */
export type RunnerEvent =
  | { readonly kind: "handoff"; readonly runner: string; readonly plan: string }
  | { readonly kind: "receipt"; readonly plan: string; readonly ref: string; readonly status: number; readonly log: string; readonly approvals?: readonly string[] };

const digest: Decoder<string> = refine(string, "a digest: 64 lower case hexadecimal digits", isDigest);
const status: Decoder<number> = refine(integer, "an exit status: an integer from 0 to 255", (n) => n >= 0 && n <= 255);
const ref: Decoder<string> = refine(string, "a reference of an external run: 1 to 200 printable characters", (s) => s.length >= 1 && s.length <= 200 && /^[\x20-\x7e]+$/u.test(s));

const runnerEvent: Decoder<RunnerEvent> = tagged({
  handoff: object({ kind: literal("handoff"), runner: string, plan: digest }),
  receipt: object({ kind: literal("receipt"), plan: digest, ref, status, log: digest }, { approvals: array(string) }),
});

/** Whether a payload of an envelope is an event of a hand-off: the forms leave these to the fold of the hand-off. */
export const isRunnerPayload = (payload: Readonly<Record<string, unknown>>): boolean => (RUNNER_EVENT_KINDS as readonly unknown[]).includes(payload["kind"]);

/** The event of a hand-off in a payload, or why it is none. */
export function decodeRunnerPayload(payload: Readonly<Record<string, unknown>>): Result<RunnerEvent, string> {
  const r = runnerEvent(payload);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The body of a planning event that carries an event of a hand-off: the envelope of the core, the same bytes for the same event. */
export const encodeRunnerEvent = (form: BuiltFormId, e: RunnerEvent): string => encodeEnvelope(form, e);

/** An event of a hand-off from the body of a comment, with the form of the workload it is of, or why it is none. */
export function decodeRunnerEvent(body: string): Result<{ readonly form: BuiltFormId; readonly event: RunnerEvent }, string> {
  const env = decodeEnvelope(body);
  if (env.kind === "err") return env;
  const r = decodeRunnerPayload(env.value.payload);
  return r.kind === "ok" ? ok({ form: env.value.form, event: r.value }) : r;
}

/** The planning event that records an event of a hand-off on the work order. */
export const makeRunnerEvent = (head: EventHead, form: BuiltFormId, e: RunnerEvent): Result<ItemEvent, EventProblem> => makeWorkloadEvent(head, form, e);
