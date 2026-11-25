// Spec: 0016-grc-poam FR-001
/**
 * The planned findings a plan of action and milestones is written from (0016-grc-poam FR-001): a finding that a team plans work for, with its milestones, their owners and the days they are due, and the controls
 * (of any framework) it bears on. This is the shape that the view `poam` of the library Planning gives, stated here as data so that GRC does not import Planning; `plannedFindings` decodes it from a value read from
 * outside and is total: an error value names the member that is wrong. A control reference is accepted only as a control URN of this library (`parseControlUrn`), so that no reference is invented or guessed.
 *
 * @example
 * ```ts
 * import { plannedFindings } from "./planned.ts";
 * plannedFindings([]); // { kind: "ok", value: [] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseControlUrn } from "@intellectual-frontiers/grc/governance";

/** Whether work is open, behind its day or done. */
export type PlannedStatus = "open" | "delayed" | "completed";

/** A milestone of a planned finding. */
export type PlannedMilestone = {
  readonly id: string;
  readonly title: string;
  readonly owners: readonly string[];
  /** The day it is due, YYYY-MM-DD. */
  readonly due?: string;
  readonly state: string;
  /** The instant it was completed, ISO 8601. */
  readonly completedAt?: string;
  readonly status: PlannedStatus;
};

/** A finding with a plan: its milestones and the controls it bears on. */
export type PlannedFinding = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly severity?: string;
  readonly state: string;
  readonly status: PlannedStatus;
  /** Control URNs (`urn:grc:<framework>:<version>:<control>`), of any frameworks. */
  readonly controls: readonly string[];
  readonly owners: readonly string[];
  readonly milestones: readonly PlannedMilestone[];
  /** The day the last milestone is due, YYYY-MM-DD. */
  readonly scheduledCompletion?: string;
};

const STATUSES: readonly string[] = ["open", "delayed", "completed"];
const isObject = (v: unknown): v is { readonly [key: string]: unknown } => typeof v === "object" && v !== null && !Array.isArray(v);
const bad = (path: string, expected: string): Result<never, string> => err(`${path} is not ${expected}`);

function text(o: { readonly [key: string]: unknown }, key: string, path: string): Result<string, string> {
  const v = o[key];
  return typeof v === "string" ? ok(v) : bad(`${path}.${key}`, "a text");
}
function optionalText(o: { readonly [key: string]: unknown }, key: string, path: string): Result<string | undefined, string> {
  const v = o[key];
  return v === undefined ? ok(undefined) : typeof v === "string" ? ok(v) : bad(`${path}.${key}`, "a text");
}
function texts(o: { readonly [key: string]: unknown }, key: string, path: string): Result<readonly string[], string> {
  const v = o[key];
  return Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? ok(v) : bad(`${path}.${key}`, "a list of texts");
}
function day(o: { readonly [key: string]: unknown }, key: string, path: string): Result<string | undefined, string> {
  const t = optionalText(o, key, path);
  if (t.kind === "err" || t.value === undefined) return t;
  const ms = /^\d{4}-\d{2}-\d{2}$/u.test(t.value) ? Date.parse(`${t.value}T00:00:00Z`) : Number.NaN;
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== t.value ? bad(`${path}.${key}`, "a day, YYYY-MM-DD") : ok(t.value);
}
function status(o: { readonly [key: string]: unknown }, path: string): Result<PlannedStatus, string> {
  const v = o["status"];
  return v === "open" || v === "delayed" || v === "completed" ? ok(v) : bad(`${path}.status`, `one of ${STATUSES.join(", ")}`);
}

function milestone(v: unknown, path: string): Result<PlannedMilestone, string> {
  if (!isObject(v)) return bad(path, "an object");
  const id = text(v, "id", path);
  const title = text(v, "title", path);
  const owners = texts(v, "owners", path);
  const due = day(v, "due", path);
  const state = text(v, "state", path);
  const completedAt = optionalText(v, "completedAt", path);
  const st = status(v, path);
  for (const r of [id, title, owners, due, state, completedAt, st]) if (r.kind === "err") return r;
  if (id.kind !== "ok" || title.kind !== "ok" || owners.kind !== "ok" || due.kind !== "ok" || state.kind !== "ok" || completedAt.kind !== "ok" || st.kind !== "ok") return bad(path, "a milestone");
  if (completedAt.value !== undefined && Number.isNaN(Date.parse(completedAt.value))) return bad(`${path}.completedAt`, "an instant");
  return ok({ id: id.value, title: title.value, owners: owners.value, ...(due.value === undefined ? {} : { due: due.value }), state: state.value, ...(completedAt.value === undefined ? {} : { completedAt: completedAt.value }), status: st.value });
}

function planned(v: unknown, path: string): Result<PlannedFinding, string> {
  if (!isObject(v)) return bad(path, "an object");
  const id = text(v, "id", path);
  const title = text(v, "title", path);
  const body = text(v, "body", path);
  const severity = optionalText(v, "severity", path);
  const state = text(v, "state", path);
  const st = status(v, path);
  const controls = texts(v, "controls", path);
  const owners = texts(v, "owners", path);
  const scheduled = day(v, "scheduledCompletion", path);
  for (const r of [id, title, body, severity, state, st, controls, owners, scheduled]) if (r.kind === "err") return r;
  if (id.kind !== "ok" || title.kind !== "ok" || body.kind !== "ok" || severity.kind !== "ok" || state.kind !== "ok" || st.kind !== "ok" || controls.kind !== "ok" || owners.kind !== "ok" || scheduled.kind !== "ok") return bad(path, "a planned finding");
  for (const [i, c] of controls.value.entries()) if (parseControlUrn(c).kind === "err") return bad(`${path}.controls[${i}]`, "a control URN, urn:grc:<framework>:<version>:<control>");
  const raw = v["milestones"];
  if (!Array.isArray(raw)) return bad(`${path}.milestones`, "a list");
  const milestones: PlannedMilestone[] = [];
  for (const [i, m] of raw.entries()) {
    const r = milestone(m, `${path}.milestones[${i}]`);
    if (r.kind === "err") return r;
    milestones.push(r.value);
  }
  return ok({
    id: id.value,
    title: title.value,
    body: body.value,
    ...(severity.value === undefined ? {} : { severity: severity.value }),
    state: state.value,
    status: st.value,
    controls: controls.value,
    owners: owners.value,
    milestones,
    ...(scheduled.value === undefined ? {} : { scheduledCompletion: scheduled.value }),
  });
}

/** The planned findings of a value read from outside, or the member that is wrong. */
export function plannedFindings(value: unknown): Result<readonly PlannedFinding[], string> {
  if (!Array.isArray(value)) return bad("planned", "a list of planned findings");
  const out: PlannedFinding[] = [];
  for (const [i, v] of value.entries()) {
    const r = planned(v, `planned[${i}]`);
    if (r.kind === "err") return r;
    out.push(r.value);
  }
  return ok(out);
}
