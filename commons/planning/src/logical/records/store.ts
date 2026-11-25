// Spec: 0002-planning-core FR-011
/**
 * The files of a store and of a published edition (0037-planning FR-038), in JSON5, which the library encodes and decodes at its boundary with the codec of `formats`. The store has one file for each event,
 * `<item>/<event>.json5`, so that two stores merge by the union of their files; the edition has one file for each item that holds its events in the order of `fold`. Each file has an order of keys that does not
 * change, the order of RFC 8785 section 3.2.3 (by property name, recursively), so that a diff of two stores is a diff of events. Decoding is total: a text that is not an event or an item of the schema is an
 * error value, and an event that breaks a rule of the actors (an agent with no principal, a person that names an agent) is refused when it is read.
 *
 * @example
 * ```ts
 * import { decodeEvent, encodeEvent, eventPath } from "./store.ts";
 * // decodeEvent(encodeEvent(event)) is the event, and eventPath(event) is "<item>/<event>.json5"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { formatJson5Error, isJsonObject, type Json, type JsonObject, parseJson5, toJson5 } from "@intellectual-frontiers/formats/json5";
import {
  type Day,
  type EventData,
  externalId,
  type ExternalId,
  closeReason,
  checkActor,
  describeActorProblem,
  type FindingSource,
  type Item,
  type ItemEvent,
  itemKind,
  linkKind,
  makeEvent,
  origin,
  parseDay,
  parseEventId,
  parseInstant,
  parseItemId,
  severity,
  type Target,
  verdict,
  describeEventProblem,
} from "@intellectual-frontiers/planning/governance";
import { orderEvents } from "@intellectual-frontiers/planning/logical";

/** The schema of an event file. */
export const EVENT_FILE_SCHEMA = "planning/event@1";
/** The schema of an item file of the published edition. */
export const ITEM_FILE_SCHEMA = "planning/item@1";

/** Why a text is not an event or an item of the schema. */
export type CodecProblem = { readonly kind: "codec"; readonly message: string };

const bad = (message: string): { readonly kind: "err"; readonly error: CodecProblem } => err({ kind: "codec", message });

/** A value as JSON with its properties in the order of their names, recursively, and a property that is `undefined` left out. */
export function jsonOf(value: unknown): Json {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : jsonOf(v)));
  if (typeof value === "object" && value !== null) {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const v: unknown = Reflect.get(value, key);
      if (v !== undefined) out[key] = jsonOf(v);
    }
    return out;
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : null;
}

/** The place of an event's file in a store: the item's folder and the event's name. */
export function eventPath(e: Pick<ItemEvent, "item" | "id">): string {
  return `${e.item}/${e.id}.json5`;
}

/** The place of an item's file in a published edition. */
export function itemPath(item: Item["id"]): string {
  return `${item}.json5`;
}

/** An event as a JSON value: its head, its type and the data of the type, keys in order. */
export function eventToJson(e: ItemEvent): Json {
  const { type, ...data } = e.data;
  return jsonOf({ schema: EVENT_FILE_SCHEMA, id: e.id, item: e.item, at: e.at, actor: e.actor, external: e.external, type, data });
}

/** The text of an event's file. */
export function encodeEvent(e: ItemEvent): string {
  return toJson5(eventToJson(e));
}

/** The text of an item's file in a published edition: its events in the order of `fold`, which is the order of their id. */
export function encodeItem(events: readonly ItemEvent[]): Result<string, CodecProblem> {
  const ordered = orderEvents(events);
  if (ordered.kind === "err") return bad("the events of an item are not one history: two with one id differ");
  const first = ordered.value[0];
  if (first === undefined) return bad("an item file has events");
  return ok(toJson5(jsonOf({ schema: ITEM_FILE_SCHEMA, id: first.item, events: ordered.value.map(eventToJson) })));
}

// ---- decoding

const field = (o: JsonObject, key: string): Json | undefined => o[key];

function text(o: JsonObject, key: string): Result<string, CodecProblem> {
  const v = field(o, key);
  return typeof v === "string" ? ok(v) : bad(`${key} is not text`);
}
function optionalText(o: JsonObject, key: string): Result<string | undefined, CodecProblem> {
  const v = field(o, key);
  return v === undefined ? ok(undefined) : typeof v === "string" ? ok(v) : bad(`${key} is not text`);
}
const isTexts = (v: Json | undefined): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
function optionalDay(o: JsonObject, key: string): Result<Day | undefined, CodecProblem> {
  const t = optionalText(o, key);
  if (t.kind === "err" || t.value === undefined) return t.kind === "err" ? t : ok(undefined);
  const day = parseDay(t.value);
  return day.kind === "ok" ? ok(day.value) : bad(`${key} is not a day, YYYY-MM-DD`);
}

function texts(o: JsonObject, key: string): Result<readonly string[], CodecProblem> {
  const v = field(o, key);
  return isTexts(v) ? ok(v) : bad(`${key} is not a list of text`);
}
function optionalTexts(o: JsonObject, key: string): Result<readonly string[] | undefined, CodecProblem> {
  return field(o, key) === undefined ? ok(undefined) : texts(o, key);
}

function targetOf(v: Json | undefined): Result<Target | undefined, CodecProblem> {
  if (v === undefined) return ok(undefined);
  if (!isJsonObject(v)) return bad("target is not an object");
  const file = optionalText(v, "file");
  const quote = optionalText(v, "quote");
  const page = v["page"];
  if (file.kind === "err") return file;
  if (quote.kind === "err") return quote;
  if (page !== undefined && typeof page !== "number") return bad("the page of a target is not a number");
  return ok({ ...(file.value === undefined ? {} : { file: file.value }), ...(page === undefined ? {} : { page }), ...(quote.value === undefined ? {} : { quote: quote.value }) });
}

function sourceOf(v: Json | undefined): Result<FindingSource | undefined, CodecProblem> {
  if (v === undefined) return ok(undefined);
  if (!isJsonObject(v)) return bad("source is not an object");
  const out: { [key: string]: string | number | boolean | null } = {};
  for (const [k, x] of Object.entries(v)) {
    if (x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean") out[k] = x;
    else return bad(`the member ${k} of a source is not a plain value`);
  }
  return ok(out);
}

/** The data of an event of a type from its JSON object, or why it is not one. */
export function eventDataOfJson(type: string, d: JsonObject): Result<EventData, CodecProblem> {
  switch (type) {
    case "opened": {
      const kind = itemKind.parse(d["kind"]);
      const title = text(d, "title");
      const body = text(d, "body");
      const labels = texts(d, "labels");
      const assignees = texts(d, "assignees");
      const org = origin.parse(d["origin"]);
      if (kind.kind === "err") return bad("the kind of an item is issue, task, todo or finding");
      if (title.kind === "err") return title;
      if (body.kind === "err") return body;
      if (labels.kind === "err") return labels;
      if (assignees.kind === "err") return assignees;
      if (org.kind === "err") return bad("the origin of an item is declared, derived or inferred");
      const sev = d["severity"] === undefined ? ok(undefined) : severity.parse(d["severity"]);
      if (sev.kind === "err") return bad("a severity is error, warning or note");
      const sourceSeverity = optionalText(d, "sourceSeverity");
      const motivation = optionalText(d, "motivation");
      const priority = optionalText(d, "priority");
      const size = optionalText(d, "size");
      const goals = optionalTexts(d, "goals");
      const engines = optionalTexts(d, "engines");
      const cites = optionalTexts(d, "cites");
      const evidence = optionalTexts(d, "evidence");
      const due = optionalDay(d, "due");
      const target = targetOf(d["target"]);
      const source = sourceOf(d["source"]);
      const blocker = d["blocker"];
      for (const r of [sourceSeverity, motivation, priority, size, goals, engines, cites, evidence, due, target, source]) if (r.kind === "err") return r;
      if (blocker !== undefined && typeof blocker !== "boolean") return bad("blocker is not true or false");
      return ok({
        type: "opened",
        kind: kind.value,
        title: title.value,
        body: body.value,
        labels: labels.value,
        assignees: assignees.value,
        origin: org.value,
        ...(sev.value === undefined ? {} : { severity: sev.value }),
        ...(sourceSeverity.kind === "ok" && sourceSeverity.value !== undefined ? { sourceSeverity: sourceSeverity.value } : {}),
        ...(motivation.kind === "ok" && motivation.value !== undefined ? { motivation: motivation.value } : {}),
        ...(blocker === undefined ? {} : { blocker }),
        ...(target.kind === "ok" && target.value !== undefined ? { target: target.value } : {}),
        ...(source.kind === "ok" && source.value !== undefined ? { source: source.value } : {}),
        ...(priority.kind === "ok" && priority.value !== undefined ? { priority: priority.value } : {}),
        ...(size.kind === "ok" && size.value !== undefined ? { size: size.value } : {}),
        ...(goals.kind === "ok" && goals.value !== undefined ? { goals: goals.value } : {}),
        ...(engines.kind === "ok" && engines.value !== undefined ? { engines: engines.value } : {}),
        ...(cites.kind === "ok" && cites.value !== undefined ? { cites: cites.value } : {}),
        ...(evidence.kind === "ok" && evidence.value !== undefined ? { evidence: evidence.value } : {}),
        ...(due.kind === "ok" && due.value !== undefined ? { due: due.value } : {}),
      });
    }
    case "commented": {
      const body = text(d, "body");
      return body.kind === "ok" ? ok({ type, body: body.value }) : body;
    }
    case "edited": {
      const title = optionalText(d, "title");
      const body = optionalText(d, "body");
      const due = optionalDay(d, "due");
      if (title.kind === "err") return title;
      if (body.kind === "err") return body;
      if (due.kind === "err") return due;
      return ok({ type, ...(title.value === undefined ? {} : { title: title.value }), ...(body.value === undefined ? {} : { body: body.value }), ...(due.value === undefined ? {} : { due: due.value }) });
    }
    case "labeled":
    case "assigned": {
      const add = texts(d, "add");
      const remove = texts(d, "remove");
      if (add.kind === "err") return add;
      if (remove.kind === "err") return remove;
      return ok({ type, add: add.value, remove: remove.value });
    }
    case "severity-set": {
      const s = severity.parse(d["severity"]);
      return s.kind === "ok" ? ok({ type, severity: s.value }) : bad("a severity is error, warning or note");
    }
    case "blocker-set":
      return typeof d["blocker"] === "boolean" ? ok({ type, blocker: d["blocker"] }) : bad("blocker is not true or false");
    case "started":
    case "reopened":
    case "confirmed":
      return ok({ type });
    case "deferred": {
      const until = optionalText(d, "until");
      if (until.kind === "err") return until;
      const untilText = optionalText(d, "untilText");
      if (untilText.kind === "err") return untilText;
      const day = until.value === undefined ? undefined : parseDay(until.value);
      const reason = optionalText(d, "reason");
      if (day?.kind === "err") return bad("until is not a day");
      if (reason.kind === "err") return reason;
      if (day === undefined && untilText.value === undefined) return bad("a deferral has an until day or the text of it");
      return ok({ type, ...(day === undefined ? {} : { until: day.value }), ...(untilText.value === undefined ? {} : { untilText: untilText.value }), ...(reason.value === undefined ? {} : { reason: reason.value }) });
    }
    case "closed": {
      const r = closeReason.parse(d["reason"]);
      return r.kind === "ok" ? ok({ type, reason: r.value }) : bad("a close reason is completed, not-planned or duplicate");
    }
    case "decided": {
      const v = verdict.parse(d["verdict"]);
      const note = text(d, "note");
      if (v.kind === "err") return bad("a verdict is accept, minor-revision, major-revision or reject");
      return note.kind === "ok" ? ok({ type, verdict: v.value, note: note.value }) : note;
    }
    case "linked": {
      const link = linkKind.parse(d["link"]);
      const to = text(d, "to");
      const change = d["change"];
      if (link.kind === "err") return bad("a link is blocks, same-as, relates-to or parent-of");
      if (to.kind === "err") return to;
      const target = parseItemId(to.value);
      if (target.kind === "err") return bad("the item a link goes to is not an item id");
      if (change !== "add" && change !== "remove") return bad("a link change is add or remove");
      return ok({ type, change, link: link.value, to: target.value });
    }
    default:
      return bad(`${type} is not a type of event`);
  }
}

/** One event from a JSON value, or why it is not one of the schema. */
export function eventOfJson(j: Json | undefined): Result<ItemEvent, CodecProblem> {
  if (j === undefined || !isJsonObject(j)) return bad("an event is not an object");
  if (j["schema"] !== EVENT_FILE_SCHEMA) return bad(`its schema is not ${EVENT_FILE_SCHEMA}`);
  const id = text(j, "id");
  const item = text(j, "item");
  const at = text(j, "at");
  const type = text(j, "type");
  if (id.kind === "err") return id;
  if (item.kind === "err") return item;
  if (at.kind === "err") return at;
  if (type.kind === "err") return type;
  const eventId = parseEventId(id.value);
  const itemId = parseItemId(item.value);
  const instant = parseInstant(at.value);
  if (eventId.kind === "err") return bad("the id of an event is a UUID version 7");
  if (itemId.kind === "err") return bad("the item of an event is a UUID version 7");
  if (instant.kind === "err") return bad("the time of an event is YYYY-MM-DDTHH:MM:SSZ");
  const actor = checkActor(j["actor"]);
  if (actor.kind === "err") return bad(describeActorProblem(actor.error));
  const dataJson = j["data"];
  if (dataJson === undefined || !isJsonObject(dataJson)) return bad("the data of an event is an object");
  const data = eventDataOfJson(type.value, dataJson);
  if (data.kind === "err") return data;
  const ext = j["external"];
  const externals: ExternalId[] = [];
  if (ext !== undefined) {
    if (!Array.isArray(ext)) return bad("external is a list");
    for (const x of ext) {
      if (!isJsonObject(x) || typeof x["source"] !== "string" || typeof x["value"] !== "string") return bad("an external id is a source and a value");
      const e = externalId(x["source"], x["value"]);
      if (e.kind === "err") return bad("an external id is a source name and a value");
      externals.push(e.value);
    }
  }
  const made = makeEvent({ id: eventId.value, item: itemId.value, at: instant.value, actor: actor.value, ...(ext === undefined ? {} : { external: externals }) }, data.value);
  return made.kind === "ok" ? made : bad(describeEventProblem(made.error));
}

function parse(source: string): Result<Json, CodecProblem> {
  const parsed = parseJson5(source);
  return parsed.kind === "ok" ? ok(parsed.value) : bad(`it is not JSON5: ${formatJson5Error(parsed.error)}`);
}

/** An event from the text of its file, or why it is not one of the schema. */
export function decodeEvent(source: string): Result<ItemEvent, CodecProblem> {
  const j = parse(source);
  return j.kind === "ok" ? eventOfJson(j.value) : j;
}

/** The events of an item from the text of its file in a published edition, or why it is not an item of the schema. */
export function decodeItem(source: string): Result<readonly ItemEvent[], CodecProblem> {
  const j = parse(source);
  if (j.kind === "err") return j;
  if (!isJsonObject(j.value) || j.value["schema"] !== ITEM_FILE_SCHEMA) return bad(`its schema is not ${ITEM_FILE_SCHEMA}`);
  const list = j.value["events"];
  if (!Array.isArray(list) || list.length === 0) return bad("an item file has events");
  const events: ItemEvent[] = [];
  for (const [i, e] of list.entries()) {
    const d = eventOfJson(e);
    if (d.kind === "err") return bad(`its event ${i + 1}: ${d.error.message}`);
    events.push(d.value);
  }
  const item = j.value["id"];
  return events.every((e) => e.item === item) ? ok(events) : bad("an event of the file is of another item than the file");
}
