// Spec: 0002-planning-core FR-011
/**
 * The records of the monorepo's issues, read and written as they are (0037-planning FR-025, inventory entries 1 and 2): an issue file, `erga/issue@1`, a JSON5 text of an issue's events with a leading comment; an
 * event object of the store, `erga/issue-event@1`; and the summary of a work's issues, `erga/issues-index@1`. Decoding is total and gives an error value for text that is not one of them. An event keeps its data
 * as written, and encoding writes the bytes the monorepo's own writer writes (two spaces of indent, the events in the order of their time and then their id), so that a file decoded and encoded again is the same text.
 * The records are public data of a schema and made-up files are the tests' fixtures; no private content is here.
 *
 * @example
 * ```ts
 * import { decodeIssueFile, encodeIssueFile } from "./erga.ts";
 * // const f = decodeIssueFile(text); f.kind === "ok" && encodeIssueFile(f.value) === text
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { formatJson5Error, isJsonObject, type Json, type JsonObject, parseJson5 } from "@intellectual-frontiers/formats/json5";

/** The schema of an issue file. */
export const ISSUE_SCHEMA = "erga/issue@1";
/** The schema of an event object of the store. */
export const EVENT_SCHEMA = "erga/issue-event@1";
/** The schema of the summary of a work's issues. */
export const INDEX_SCHEMA = "erga/issues-index@1";

/** The ten types of event of an issue file. */
export const ERGA_EVENT_TYPES = ["opened", "commented", "edited", "labeled", "assigned", "severity", "blocker", "closed", "reopened", "decided"] as const;
/** One type of event of an issue file. */
export type ErgaEventType = (typeof ERGA_EVENT_TYPES)[number];

/** Who made an event: `type` person, agent or tool, an `id` and a `name` where it has one. */
export type ErgaActor = { readonly type: "person" | "agent" | "tool"; readonly id: string; readonly name?: string };

/** One event: its id, its time (`YYYY-MM-DDTHH:MM:SSZ`), its actor, its type and its data as written. */
export type ErgaEvent = { readonly id: string; readonly at: string; readonly actor: ErgaActor; readonly type: ErgaEventType; readonly data?: Json };

/** An issue file: the comment that heads it as written, its id, its work and its events. */
export type ErgaIssueFile = { readonly header: string; readonly id: string; readonly work: string; readonly events: readonly ErgaEvent[] };

/** An event object of the store: the issue and the work it is of, and the event. */
export type ErgaStoreEvent = { readonly issue: string; readonly work: string; readonly event: ErgaEvent };

/** One issue in the summary of a work's issues. */
export type ErgaIndexEntry = {
  readonly id: string;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly state_reason: string;
  readonly severity: string;
  readonly motivation: string;
  readonly blocker: boolean;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly author: string;
  readonly created: string;
  readonly updated: string;
  readonly comments: number;
  readonly source: Json;
};

/** The summary of a work's issues. */
export type ErgaIndex = { readonly work: string; readonly updated: string; readonly open: number; readonly blockers: number; readonly issues: readonly ErgaIndexEntry[] };

/** Why a text is not one of the records. */
export type ErgaProblem = { readonly kind: "erga"; readonly message: string };

const bad = (message: string): { readonly kind: "err"; readonly error: ErgaProblem } => err({ kind: "erga", message });

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const SEVERITIES: readonly string[] = ["error", "warning", "note"];
const DECISIONS: readonly string[] = ["accept", "minor-revision", "major-revision", "reject"];

const isEventType = (t: unknown): t is ErgaEventType => typeof t === "string" && ERGA_EVENT_TYPES.some((x) => x === t);

function actorOf(v: Json | undefined): Result<ErgaActor, ErgaProblem> {
  if (v === undefined || !isJsonObject(v)) return bad("an event has no actor object");
  const type = v["type"];
  const id = v["id"];
  const name = v["name"];
  if ((type !== "person" && type !== "agent" && type !== "tool") || typeof id !== "string") return bad("an actor has a type of person, agent or tool, and an id");
  return ok(typeof name === "string" ? { type, id, name } : { type, id });
}

/** One event from a JSON value, or why it is not one. */
export function decodeErgaEvent(value: Json | undefined): Result<ErgaEvent, ErgaProblem> {
  if (value === undefined || !isJsonObject(value)) return bad("an event is not an object");
  const id = value["id"];
  const at = value["at"];
  const type = value["type"];
  const actor = actorOf(value["actor"]);
  if (typeof id !== "string" || typeof at !== "string" || !TIME.test(at) || actor.kind === "err" || !isEventType(type)) {
    return bad(`an event lacks an id, a time, an actor or a known type${typeof id === "string" ? ` (${id})` : ""}`);
  }
  const data = value["data"];
  const d: JsonObject = data !== undefined && isJsonObject(data) ? data : {};
  if (type === "opened" && typeof d["title"] !== "string") return bad(`the opening ${id} names no title`);
  if (type === "severity" && !SEVERITIES.includes(String(d["severity"]))) return bad(`the severity of ${id} is not error, warning or note`);
  if (type === "decided" && !DECISIONS.includes(String(d["decision"]))) return bad(`the decision of ${id} is not accept, minor-revision, major-revision or reject`);
  return ok(data === undefined || data === null ? { id, at, actor: actor.value, type } : { id, at, actor: actor.value, type, data });
}

function parse(text: string): Result<JsonObject, ErgaProblem> {
  const parsed = parseJson5(text);
  if (parsed.kind === "err") return bad(`it is not JSON5: ${formatJson5Error(parsed.error)}`);
  return isJsonObject(parsed.value) ? ok(parsed.value) : bad("it is not an object");
}

/** The comment lines that head a text, as written. */
function headerOf(text: string): string {
  return /^(?:[ \t]*\/\/[^\n]*\n)*/u.exec(text)?.[0] ?? "";
}

/** An issue file from its text, or why it is not one. */
export function decodeIssueFile(text: string): Result<ErgaIssueFile, ErgaProblem> {
  const j = parse(text);
  if (j.kind === "err") return j;
  if (j.value["schema"] !== ISSUE_SCHEMA) return bad(`its schema is not ${ISSUE_SCHEMA}`);
  const id = j.value["id"];
  const work = j.value["work"];
  const list = j.value["events"];
  if (typeof id !== "string" || typeof work !== "string") return bad("it names no id or no work");
  if (!Array.isArray(list) || list.length === 0) return bad("it has no events");
  const events: ErgaEvent[] = [];
  for (const [i, e] of list.entries()) {
    const d = decodeErgaEvent(e);
    if (d.kind === "err") return bad(`its event ${i + 1}: ${d.error.message}`);
    events.push(d.value);
  }
  return ok({ header: headerOf(text), id, work, events });
}

/** An event object of the store from its text, or why it is not one. */
export function decodeStoreEvent(text: string): Result<ErgaStoreEvent, ErgaProblem> {
  const j = parse(text);
  if (j.kind === "err") return j;
  if (j.value["schema"] !== EVENT_SCHEMA) return bad(`its schema is not ${EVENT_SCHEMA}`);
  const issue = j.value["issue"];
  const work = j.value["work"];
  if (typeof issue !== "string" || typeof work !== "string") return bad("it names no issue or no work");
  const e = decodeErgaEvent(j.value["event"]);
  return e.kind === "ok" ? ok({ issue, work, event: e.value }) : e;
}

const isTexts = (v: Json | undefined): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const strings = (v: Json | undefined): readonly string[] | undefined => (isTexts(v) ? v : undefined);

/** The summary of a work's issues from its text, or why it is not one. */
export function decodeIndex(text: string): Result<ErgaIndex, ErgaProblem> {
  const j = parse(text);
  if (j.kind === "err") return j;
  if (j.value["schema"] !== INDEX_SCHEMA) return bad(`its schema is not ${INDEX_SCHEMA}`);
  const { work, updated, open, blockers, issues } = j.value;
  if (typeof work !== "string" || typeof updated !== "string" || typeof open !== "number" || typeof blockers !== "number" || !Array.isArray(issues)) {
    return bad("it lacks its work, its time, its counts or its issues");
  }
  const entries: ErgaIndexEntry[] = [];
  for (const [i, raw] of issues.entries()) {
    if (!isJsonObject(raw)) return bad(`its issue ${i + 1} is not an object`);
    const state = raw["state"];
    const labels = strings(raw["labels"]);
    const assignees = strings(raw["assignees"]);
    const text = (k: string): string | undefined => (typeof raw[k] === "string" ? raw[k] : undefined);
    const id = text("id");
    const title = text("title");
    const reason = text("state_reason");
    const severity = text("severity");
    const motivation = text("motivation");
    const author = text("author");
    const created = text("created");
    const upd = text("updated");
    const blocker = raw["blocker"];
    const comments = raw["comments"];
    if (
      id === undefined || title === undefined || (state !== "open" && state !== "closed") || reason === undefined || severity === undefined || motivation === undefined ||
      typeof blocker !== "boolean" || labels === undefined || assignees === undefined || author === undefined || created === undefined || upd === undefined || typeof comments !== "number"
    ) {
      return bad(`its issue ${i + 1} lacks a field of the summary`);
    }
    entries.push({ id, title, state, state_reason: reason, severity, motivation, blocker, labels, assignees, author, created, updated: upd, comments, source: raw["source"] ?? null });
  }
  return ok({ work, updated, open, blockers, issues: entries });
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function actorJson(a: ErgaActor): JsonObject {
  return a.name === undefined ? { type: a.type, id: a.id } : { type: a.type, id: a.id, name: a.name };
}

/** An event as a file writes it: `id`, `at`, `actor`, `type`, and `data` where it has any. */
export function ergaEventJson(e: ErgaEvent): JsonObject {
  const head = { id: e.id, at: e.at, actor: actorJson(e.actor), type: e.type };
  return e.data === undefined ? head : { ...head, data: e.data };
}

/** The events in the order they are written: by time, then by id. */
export function orderedErgaEvents(events: readonly ErgaEvent[]): readonly ErgaEvent[] {
  return [...events].sort((a, b) => byText(a.at, b.at) || byText(a.id, b.id));
}

/** The text of an issue file: its header, then the issue as JSON with two spaces of indent, the events in the order they are written. */
export function encodeIssueFile(f: ErgaIssueFile): string {
  return `${f.header}${JSON.stringify({ schema: ISSUE_SCHEMA, id: f.id, work: f.work, events: orderedErgaEvents(f.events).map(ergaEventJson) }, null, 2)}\n`;
}

/** The text of an event object of the store. */
export function encodeStoreEvent(s: ErgaStoreEvent): string {
  return `${JSON.stringify({ schema: EVENT_SCHEMA, issue: s.issue, work: s.work, event: ergaEventJson(s.event) }, null, 2)}\n`;
}

/** The text of the summary of a work's issues. */
export function encodeIndex(i: ErgaIndex): string {
  const entry = (e: ErgaIndexEntry): JsonObject => ({
    id: e.id,
    title: e.title,
    state: e.state,
    state_reason: e.state_reason,
    severity: e.severity,
    motivation: e.motivation,
    blocker: e.blocker,
    labels: e.labels,
    assignees: e.assignees,
    author: e.author,
    created: e.created,
    updated: e.updated,
    comments: e.comments,
    source: e.source,
  });
  return `${JSON.stringify({ schema: INDEX_SCHEMA, work: i.work, updated: i.updated, open: i.open, blockers: i.blockers, issues: i.issues.map(entry) }, null, 2)}\n`;
}
