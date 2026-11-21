// Spec: 0002-planning-core FR-010, FR-011
/**
 * An issue file of the monorepo read as an item with its events (0037-planning FR-025, FR-044, FR-046): each ULID or other id becomes an id of the library by the pure function of FR-044 and is carried as an
 * external id, as the source named it; each of the ten types of event becomes a case of the union of fourteen with the data its record holds; and an actor is read as the file says, except where the
 * configuration says that an id is an agent acting for a person. The monorepo writes the agent `claude` as a person: with no rule the actor is read as a person and a finding names each such event, and a file
 * that records an agent with no rule is refused, because an agent with no principal is invalid when it is read. Every key of an event's data that the record does not know is a finding, so that nothing is
 * dropped silently.
 *
 * @example
 * ```ts
 * import { readIssueFile } from "./erga-read.ts";
 * // const r = await readIssueFile(file, { source: "event-files", agents: {}, knownAgents: ["claude"] })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { isJsonObject, type Json, type JsonObject } from "@intellectual-frontiers/formats/json5";
import {
  type Actor,
  agent,
  type CloseReason,
  type EventData,
  type ExternalId,
  externalId,
  type FindingSource,
  type ItemEvent,
  type ItemId,
  makeEvent,
  type OpenedData,
  type Origin,
  parseInstant,
  type PersonActor,
  person,
  type Severity,
  type Target,
  tool,
  type Verdict,
} from "@intellectual-frontiers/planning/governance";
import { eventIdOfExternal, itemIdOfExternal } from "@intellectual-frontiers/planning/logical";
import type { ErgaActor, ErgaEvent, ErgaIssueFile } from "./erga.ts";

/** How a file is read: the name of the source (the first part of each external id), the ids the configuration says are agents acting for a person, and the ids the file may record as a person. */
export type ReadOptions = {
  readonly source: string;
  /** The rule of FR-044: an actor id that is an agent acting for this person. */
  readonly agents: { readonly [id: string]: { readonly actsFor: PersonActor } };
  /** The ids of agents that a file is known to record as a person, so that reading them as a person is a finding. */
  readonly knownAgents: readonly string[];
};

/** The ids of agents that the monorepo's files record as a person. */
export const DEFAULT_KNOWN_AGENTS: readonly string[] = ["claude"];

/** Something a person should know about what was read: not a refusal. */
export type ReadFinding =
  | { readonly kind: "agent-recorded-as-a-person"; readonly event: string; readonly actor: string }
  | { readonly kind: "unknown-key"; readonly event: string; readonly key: string };

/** One sentence for a finding. */
export function describeReadFinding(f: ReadFinding): string {
  return f.kind === "agent-recorded-as-a-person"
    ? `the event ${f.event} records the agent ${f.actor} as a person; the configuration has no rule that makes it an agent acting for a person`
    : `the event ${f.event} holds the key ${f.key}, which the record does not know, and it is not carried`;
}

/** Why a file is not read as an item. */
export type ReadProblem = { readonly kind: "read"; readonly message: string };

/** What a file read as: the item, its events in the order of their id and what was found. */
export type Read = { readonly item: ItemId; readonly events: readonly ItemEvent[]; readonly findings: readonly ReadFinding[] };

const refuse = (message: string): { readonly kind: "err"; readonly error: ReadProblem } => err({ kind: "read", message });

const KNOWN_KEYS: { readonly [type: string]: readonly string[] } = {
  opened: ["title", "body", "labels", "assignees", "severity", "type", "blocker", "target", "source"],
  commented: ["body"],
  edited: ["title", "body"],
  labeled: ["add", "remove"],
  assigned: ["add", "remove"],
  severity: ["severity"],
  blocker: ["blocker"],
  closed: ["reason"],
  reopened: [],
  decided: ["decision", "note"],
};

const strs = (o: JsonObject, k: string): readonly string[] => {
  const v = o[k];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
};
const str = (o: JsonObject, k: string): string | undefined => {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
};

function targetOf(v: Json | undefined): Target | undefined {
  if (v === undefined || !isJsonObject(v)) return undefined;
  const file = str(v, "file");
  const page = typeof v["page"] === "number" ? v["page"] : undefined;
  const quote = str(v, "quote");
  return { ...(file === undefined ? {} : { file }), ...(page === undefined ? {} : { page }), ...(quote === undefined ? {} : { quote }) };
}

function sourceOf(v: Json | undefined): FindingSource | undefined {
  if (v === undefined || !isJsonObject(v)) return undefined;
  const out: { [key: string]: string | number | boolean | null } = {};
  for (const [k, x] of Object.entries(v)) if (x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean") out[k] = x;
  return out;
}

const severityOf = (s: string | undefined): Severity | undefined => (s === "error" || s === "warning" || s === "note" ? s : undefined);
const reasonOf = (s: string | undefined): CloseReason => (s === "not_planned" ? "not-planned" : s === "duplicate" ? "duplicate" : "completed");
const verdictOf = (s: string | undefined): Verdict => (s === "accept" || s === "minor-revision" || s === "major-revision" ? s : "reject");

function actorOf(a: ErgaActor, eventId: string, o: ReadOptions, findings: ReadFinding[]): Result<Actor, ReadProblem> {
  const rule = o.agents[a.id];
  const name = a.name ?? "";
  if (a.type === "tool") {
    const t = tool(a.id, name);
    return t.kind === "ok" ? t : refuse(`the tool of ${eventId} is not an actor`);
  }
  if (a.type === "agent" || rule !== undefined) {
    if (rule === undefined) return refuse(`the event ${eventId} is by the agent ${a.id}, and no rule of the configuration says whom it acts for: an agent with no principal is invalid`);
    const g = agent(a.id, name, rule.actsFor, "configuration");
    return g.kind === "ok" ? g : refuse(`the agent of ${eventId} is not an actor`);
  }
  if (o.knownAgents.includes(a.id)) findings.push({ kind: "agent-recorded-as-a-person", event: eventId, actor: a.id });
  const p = person(a.id, name);
  return p.kind === "ok" ? p : refuse(`the person of ${eventId} is not an actor`);
}

function dataOf(e: ErgaEvent, actor: Actor, findings: ReadFinding[]): Result<EventData, ReadProblem> {
  const d: JsonObject = e.data !== undefined && isJsonObject(e.data) ? e.data : {};
  for (const key of Object.keys(d)) if (!(KNOWN_KEYS[e.type] ?? []).includes(key)) findings.push({ kind: "unknown-key", event: e.id, key });
  switch (e.type) {
    case "opened": {
      const target = targetOf(d["target"]);
      const source = sourceOf(d["source"]);
      const severity = severityOf(str(d, "severity"));
      const motivation = str(d, "type");
      const origin: Origin = actor.kind === "tool" ? "derived" : "declared";
      const opened: OpenedData = {
        type: "opened",
        kind: source === undefined ? "issue" : "finding",
        title: str(d, "title") ?? "",
        body: str(d, "body") ?? "",
        labels: strs(d, "labels"),
        assignees: strs(d, "assignees"),
        origin,
        ...(severity === undefined ? {} : { severity }),
        ...(motivation === undefined ? {} : { motivation }),
        ...(typeof d["blocker"] === "boolean" ? { blocker: d["blocker"] } : {}),
        ...(target === undefined ? {} : { target }),
        ...(source === undefined ? {} : { source }),
      };
      return ok(opened);
    }
    case "commented":
      return ok({ type: "commented", body: str(d, "body") ?? "" });
    case "edited": {
      const title = str(d, "title");
      const body = str(d, "body");
      return ok({ type: "edited", ...(title === undefined ? {} : { title }), ...(body === undefined ? {} : { body }) });
    }
    case "labeled":
      return ok({ type: "labeled", add: strs(d, "add"), remove: strs(d, "remove") });
    case "assigned":
      return ok({ type: "assigned", add: strs(d, "add"), remove: strs(d, "remove") });
    case "severity": {
      const severity = severityOf(str(d, "severity"));
      return severity === undefined ? refuse(`the severity of ${e.id} is not error, warning or note`) : ok({ type: "severity-set", severity });
    }
    case "blocker":
      return ok({ type: "blocker-set", blocker: d["blocker"] === true });
    case "closed":
      return ok({ type: "closed", reason: reasonOf(str(d, "reason")) });
    case "reopened":
      return ok({ type: "reopened" });
    case "decided":
      return ok({ type: "decided", verdict: verdictOf(str(d, "decision")), note: str(d, "note") ?? "" });
    default: {
      const unhandled: never = e.type;
      return refuse(`an event of the unknown type ${String(unhandled)}`);
    }
  }
}

function external(source: string, value: string): Result<ExternalId, ReadProblem> {
  const x = externalId(source, value);
  return x.kind === "ok" ? x : refuse(`the id ${value} is not an external id`);
}

/** An issue file read as an item with its events, the ids of FR-044, the actors by the rules of FR-005 and FR-044, and the findings. */
export async function readIssueFile(file: ErgaIssueFile, options: ReadOptions): Promise<Result<Read, ReadProblem>> {
  const ordered = [...file.events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const first = ordered[0];
  if (first === undefined) return refuse("an issue file has no events");
  const firstAt = parseInstant(first.at);
  if (firstAt.kind === "err") return refuse(`the time of ${first.id} is not a time`);
  const item = await itemIdOfExternal(options.source, file.id, Date.parse(first.at));
  if (item.kind === "err") return refuse(`the id ${file.id} is not an id`);
  const itemExternal = external(options.source, file.id);
  if (itemExternal.kind === "err") return itemExternal;
  const findings: ReadFinding[] = [];
  const events: ItemEvent[] = [];
  for (const e of ordered) {
    const at = parseInstant(e.at);
    if (at.kind === "err") return refuse(`the time of ${e.id} is not a time`);
    const id = await eventIdOfExternal(options.source, e.id, Date.parse(e.at));
    if (id.kind === "err") return refuse(`the id ${e.id} is not an id`);
    const actor = actorOf(e.actor, e.id, options, findings);
    if (actor.kind === "err") return actor;
    const data = dataOf(e, actor.value, findings);
    if (data.kind === "err") return data;
    const ext = external(options.source, e.id);
    if (ext.kind === "err") return ext;
    const made = makeEvent({ id: id.value, item: item.value, at: at.value, actor: actor.value, external: [ext.value] }, data.value);
    if (made.kind === "err") return refuse(`the event ${e.id} is refused: ${made.error.kind}`);
    events.push(made.value);
  }
  // The item's own external id is carried by its opening.
  const opening = events[0];
  if (opening === undefined) return refuse("an issue file has no events");
  const carried = makeEvent(
    { id: opening.id, item: opening.item, at: opening.at, actor: opening.actor, external: [itemExternal.value, ...(opening.external ?? [])] },
    opening.data,
  );
  if (carried.kind === "err") return refuse(`the opening is refused: ${carried.error.kind}`);
  events[0] = carried.value;
  events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ok({ item: item.value, events, findings });
}
