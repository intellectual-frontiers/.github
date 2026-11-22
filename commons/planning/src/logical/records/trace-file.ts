// Spec: 0004-planning-sources FR-001
/**
 * The files of a store that are not events: a trace of an item in a source (the content last taken, the base of a three-way merge) and an entry of the outbox (a patch no source could apply, and why), in JSON5
 * with the order of keys of RFC 8785 (0037-planning FR-033, FR-038). Decoding is total: a text that is not one of them is an error value.
 *
 * @example
 * ```ts
 * import { decodeTrace, encodeTrace } from "./trace-file.ts";
 * // decodeTrace(encodeTrace(trace)) is the trace
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { formatJson5Error, isJsonObject, type Json, type JsonObject, parseJson5, toJson5 } from "@intellectual-frontiers/formats/json5";
import {
  capability,
  externalId,
  type ExternalId,
  type Locator,
  makePatch,
  type ObservedItem,
  type ObservedState,
  type OutboxEntry,
  type OutboxReason,
  parseDay,
  parseInstant,
  parseItemId,
  closeReason,
  type Trace,
} from "@intellectual-frontiers/planning/governance";
import { type CodecProblem, eventDataOfJson, eventOfJson, eventToJson, jsonOf } from "./store.ts";

/** The schema of a trace file. */
export const TRACE_SCHEMA = "planning/trace@1";
/** The schema of an outbox file. */
export const OUTBOX_SCHEMA = "planning/outbox@1";

const bad = (message: string): { readonly kind: "err"; readonly error: CodecProblem } => err({ kind: "codec", message });

function parse(source: string): Result<JsonObject, CodecProblem> {
  const parsed = parseJson5(source);
  if (parsed.kind === "err") return bad(`it is not JSON5: ${formatJson5Error(parsed.error)}`);
  return isJsonObject(parsed.value) ? ok(parsed.value) : bad("it is not an object");
}

/** The JSON of an observed item: what an opening holds, its state and the ids it was read with. The history a place keeps is not kept in a trace. */
export function observedToJson(o: ObservedItem): Json {
  const { history: _history, state, external, anchor, parent, at, ...opening } = o;
  return jsonOf({ ...opening, type: "opened", state, external, anchor, parent, at });
}

function stateOf(v: Json | undefined): Result<ObservedState, CodecProblem> {
  if (v === undefined || !isJsonObject(v)) return bad("a state is an object");
  switch (v["kind"]) {
    case "open":
      return ok({ kind: "open" });
    case "in-progress":
      return ok({ kind: "in-progress" });
    case "deferred": {
      const day = typeof v["until"] === "string" ? parseDay(v["until"]) : undefined;
      return day?.kind === "ok" ? ok({ kind: "deferred", until: day.value }) : bad("a deferred state has an until day");
    }
    case "closed": {
      const r = closeReason.parse(v["reason"]);
      return r.kind === "ok" ? ok({ kind: "closed", reason: r.value }) : bad("a closed state has a reason");
    }
    default:
      return bad("a state is open, in progress, deferred or closed");
  }
}

/** An observed item from its JSON, or why it is not one. */
export function observedOfJson(j: Json | undefined): Result<ObservedItem, CodecProblem> {
  if (j === undefined || !isJsonObject(j)) return bad("an observed item is an object");
  const data = eventDataOfJson("opened", j);
  if (data.kind === "err") return data;
  if (data.value.type !== "opened") return bad("an observed item is an opening");
  const state = stateOf(j["state"]);
  if (state.kind === "err") return state;
  const external: ExternalId[] = [];
  const list = j["external"];
  if (!Array.isArray(list)) return bad("external is a list");
  for (const x of list) {
    if (!isJsonObject(x) || typeof x["source"] !== "string" || typeof x["value"] !== "string") return bad("an external id is a source and a value");
    const e = externalId(x["source"], x["value"]);
    if (e.kind === "err") return bad("an external id is a source name and a value");
    external.push(e.value);
  }
  const anchorText = j["anchor"];
  const anchor = typeof anchorText === "string" ? parseItemId(anchorText) : undefined;
  if (anchor?.kind === "err") return bad("an anchor is an item id");
  const atText = j["at"];
  const at = typeof atText === "string" ? parseInstant(atText) : undefined;
  if (at?.kind === "err") return bad("at is a time");
  const parentFp = j["parent"];
  const { type: _type, ...opening } = data.value;
  return ok({
    ...opening,
    state: state.value,
    external,
    ...(anchor?.kind === "ok" ? { anchor: anchor.value } : {}),
    ...(typeof parentFp === "string" ? { parent: parentFp } : {}),
    ...(at?.kind === "ok" ? { at: at.value } : {}),
  });
}

function locatorOf(v: Json | undefined): Result<Locator, CodecProblem> {
  if (v === undefined || !isJsonObject(v)) return bad("a locator is an object");
  switch (v["kind"]) {
    case "file-span":
      return typeof v["path"] === "string" && typeof v["startLine"] === "number" && typeof v["endLine"] === "number" ? ok({ kind: "file-span", path: v["path"], startLine: v["startLine"], endLine: v["endLine"] }) : bad("a file span has a path and lines");
    case "url":
      return typeof v["url"] === "string" ? ok({ kind: "url", url: v["url"] }) : bad("a url locator has a url");
    case "commit":
      return typeof v["sha"] === "string" ? ok({ kind: "commit", sha: v["sha"], ...(typeof v["repo"] === "string" ? { repo: v["repo"] } : {}) }) : bad("a commit locator has a sha");
    default:
      return bad("a locator is a file span, a url or a commit");
  }
}

/** The text of a trace's file. */
export function encodeTrace(t: Trace): string {
  return toJson5(jsonOf({ schema: TRACE_SCHEMA, item: t.item, source: t.source, fingerprint: t.fingerprint, locator: t.locator, contentHash: t.contentHash, presence: t.presence, observed: observedToJson(t.observed) }));
}

/** A trace from the text of its file, or why it is not one. */
export function decodeTrace(text: string): Result<Trace, CodecProblem> {
  const j = parse(text);
  if (j.kind === "err") return j;
  if (j.value["schema"] !== TRACE_SCHEMA) return bad(`its schema is not ${TRACE_SCHEMA}`);
  const item = typeof j.value["item"] === "string" ? parseItemId(j.value["item"]) : undefined;
  const { source, fingerprint, contentHash, presence } = j.value;
  if (item === undefined || item.kind === "err" || typeof source !== "string" || typeof fingerprint !== "string" || typeof contentHash !== "string" || (presence !== "present" && presence !== "absent")) return bad("a trace has an item, a source, a fingerprint, a hash and its presence");
  const locator = locatorOf(j.value["locator"]);
  if (locator.kind === "err") return locator;
  const observed = observedOfJson(j.value["observed"]);
  if (observed.kind === "err") return observed;
  return ok({ item: item.value, source, fingerprint, locator: locator.value, contentHash, observed: observed.value, presence });
}

/** The text of an outbox file. */
export function encodeOutbox(e: OutboxEntry): string {
  const { patch, waiting, at } = e;
  return toJson5(jsonOf({ schema: OUTBOX_SCHEMA, source: patch.source, place: patch.place, fingerprint: patch.fingerprint, event: eventToJson(patch.event), waiting, at }));
}

/** An outbox entry from the text of its file, or why it is not one. */
export function decodeOutbox(text: string): Result<OutboxEntry, CodecProblem> {
  const j = parse(text);
  if (j.kind === "err") return j;
  if (j.value["schema"] !== OUTBOX_SCHEMA) return bad(`its schema is not ${OUTBOX_SCHEMA}`);
  const { source, place, fingerprint } = j.value;
  const event = eventOfJson(j.value["event"]);
  if (event.kind === "err") return event;
  if (typeof source !== "string" || typeof place !== "string") return bad("an outbox entry names a source and a place");
  const patch = makePatch(source, place, event.value, typeof fingerprint === "string" ? fingerprint : undefined);
  if (patch.kind === "err") return bad(patch.error.message);
  const at = typeof j.value["at"] === "string" ? parseInstant(j.value["at"]) : undefined;
  if (at === undefined || at.kind === "err") return bad("at is a time");
  const w = j.value["waiting"];
  if (w === undefined || !isJsonObject(w)) return bad("waiting is an object");
  let waiting: OutboxReason;
  if (w["kind"] === "capability") {
    const c = capability.parse(w["capability"]);
    if (c.kind === "err") return bad("a capability is read, create, append-event, edit, close, assign or delete");
    waiting = { kind: "capability", capability: c.value };
  } else if (w["kind"] === "unexpressed" && typeof w["reason"] === "string") waiting = { kind: "unexpressed", reason: w["reason"] };
  else return bad("waiting is a capability or a reason");
  return ok({ patch: patch.value, waiting, at: at.value });
}
