// Spec: 0004-planning-sources FR-007
/**
 * The source for a folder of event files (0037-planning FR-025): each JSON5 issue file of the monorepo's schema `erga/issue@1`, together with the event objects of its store (`erga/issue-event@1`) of the same issue,
 * is one item with its events, read through the reading of the records (all ten types of event, every field of the opening, the ids of FR-044, the actors by the rules of FR-005 and FR-044); a file it cannot read is a
 * finding with the reason. A new event is written by the rules of that schema into the issue file, keeping every other byte: the event of a person or a tool, with a ULID that reads back as the id of the event.
 *
 * @remarks
 * The schema has no field for a principal (the owner's open question OQ-10 of commons 0037-planning), so an event of an agent is not written here (it waits in the outbox naming that reason) and neither is a
 * `started`, `deferred`, `linked` or `confirmed` event, which the schema has no type for. An item that lives only as event objects of the store is read and not written: its place is the monorepo's own sync. An event that
 * would not sort last in the file is written only into a file that is exactly the form its writer makes, where it is placed by the order of the writer.
 *
 * @example
 * ```ts
 * import { eventFilesLens } from "./event-files.ts";
 * eventFilesLens().name; // "event-files"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type JsonObject, isJsonObject, parseJson5 } from "@intellectual-frontiers/formats/json5";
import type { Observation, ObservedState, Patch, PersonActor } from "@intellectual-frontiers/planning/governance";
import { CLOSE_REASON_REGISTRY } from "@intellectual-frontiers/planning/governance";
import { fold, ulidOfUuid7 } from "@intellectual-frontiers/planning/logical";
import {
  type ErgaEvent,
  type ErgaIssueFile,
  decodeIssueFile,
  decodeStoreEvent,
  describeReadFinding,
  encodeIssueFile,
  ergaEventJson,
  ISSUE_SCHEMA,
  EVENT_SCHEMA,
  readIssueFile,
  DEFAULT_KNOWN_AGENTS,
} from "@intellectual-frontiers/planning/records";
import type { FileLens, FileRead } from "../file-source.ts";
import type { SourceFinding, SourceProblem } from "../source.ts";

/** What the configuration says of the source. */
export type EventFilesConfig = {
  /** The ids of actors that are agents acting for a person (FR-044): without a rule an agent recorded as a person is read as a person with a finding. */
  readonly agents?: { readonly [id: string]: { readonly actsFor: PersonActor } };
  readonly knownAgents?: readonly string[];
};

const SOURCE = "event-files";

type Piece = { readonly path: string; readonly text: string; readonly issue: ErgaIssueFile | undefined; readonly events: readonly ErgaEvent[]; readonly id: string; readonly work: string };

function schemaOf(text: string): string | undefined {
  const j = parseJson5(text);
  return j.kind === "ok" && isJsonObject(j.value) && typeof j.value["schema"] === "string" ? j.value["schema"] : undefined;
}

async function parseAll(config: EventFilesConfig, files: readonly { readonly path: string; readonly text: string }[]): Promise<{ readonly observations: readonly Observation[]; readonly findings: readonly SourceFinding[] }> {
  const findings: SourceFinding[] = [];
  const pieces: Piece[] = [];
  for (const f of files) {
    const schema = schemaOf(f.text);
    if (schema === ISSUE_SCHEMA) {
      const d = decodeIssueFile(f.text);
      if (d.kind === "ok") pieces.push({ path: f.path, text: f.text, issue: d.value, events: d.value.events, id: d.value.id, work: d.value.work });
      else findings.push({ path: f.path, message: `cannot be read as an issue file: ${d.error.message}` });
    } else if (schema === EVENT_SCHEMA) {
      const d = decodeStoreEvent(f.text);
      if (d.kind === "ok") pieces.push({ path: f.path, text: f.text, issue: undefined, events: [d.value.event], id: d.value.issue, work: d.value.work });
      else findings.push({ path: f.path, message: `cannot be read as an event object: ${d.error.message}` });
    } else findings.push({ path: f.path, message: schema === undefined ? "is not JSON5 of a known schema" : `has the schema ${schema}, which is neither ${ISSUE_SCHEMA} nor ${EVENT_SCHEMA}` });
  }
  const byIssue = new Map<string, Piece[]>();
  for (const p of pieces) byIssue.set(p.id, [...(byIssue.get(p.id) ?? []), p]);
  const observations: Observation[] = [];
  for (const [id, group] of [...byIssue.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const home = group.find((g) => g.issue !== undefined) ?? group[0];
    if (home === undefined) continue;
    const events = new Map<string, ErgaEvent>();
    for (const g of group) for (const e of g.events) if (!events.has(e.id)) events.set(e.id, e);
    const file: ErgaIssueFile = { header: home.issue?.header ?? "", id, work: home.work, events: [...events.values()] };
    const read = await readIssueFile(file, { source: SOURCE, agents: config.agents ?? {}, knownAgents: config.knownAgents ?? DEFAULT_KNOWN_AGENTS });
    if (read.kind === "err") {
      findings.push({ path: home.path, message: `cannot be read as an item: ${read.error.message}` });
      continue;
    }
    for (const f of read.value.findings) findings.push({ path: home.path, message: describeReadFinding(f) });
    const folded = fold(read.value.events);
    if (folded.kind === "err") {
      findings.push({ path: home.path, message: `its events are not one history: ${folded.error.kind}` });
      continue;
    }
    const item = folded.value;
    const open = read.value.events[0];
    const opened = open?.data.type === "opened" ? open.data : undefined;
    const state: ObservedState = item.state.kind === "closed" ? { kind: "closed", reason: item.state.reason } : item.state.kind === "deferred" ? { kind: "deferred", until: item.state.until } : item.state.kind === "in-progress" ? { kind: "in-progress" } : { kind: "open" };
    const lines = home.text.split("\n").length;
    observations.push({
      source: SOURCE,
      locator: { kind: "file-span", path: home.path, startLine: 1, endLine: lines },
      contentHash: await sha256(group.map((g) => g.text).sort().join("\u0000")),
      fingerprint: read.value.item,
      content: {
        kind: item.kind,
        title: item.title,
        body: item.body,
        labels: item.labels,
        assignees: item.assignees,
        ...(item.severity === undefined ? {} : { severity: item.severity }),
        state,
        origin: item.origin,
        external: item.external,
        ...(opened?.motivation === undefined ? {} : { motivation: opened.motivation }),
        ...(item.blocker === undefined ? {} : { blocker: item.blocker }),
        ...(opened?.target === undefined ? {} : { target: opened.target }),
        ...(opened?.source === undefined ? {} : { source: opened.source }),
        history: read.value.events,
      },
      raw: { schema: ISSUE_SCHEMA, id, work: home.work, events: [...events.values()].map((e) => ergaEventJson(e)) },
    });
  }
  return { observations, findings };
}

/** The erga event a patch's event is, or why the schema cannot say it. */
function ergaEventOf(patch: Patch): Result<ErgaEvent, SourceProblem> {
  const e = patch.event;
  const a = e.actor;
  if (a.kind === "agent") return err({ kind: "unexpressed", reason: "the issue schema has no field for the principal of an agent (the person it acts for), so an event of an agent is not written (OQ-10 of commons 0037-planning)" });
  const actor = { type: a.kind, id: a.id, name: a.name };
  const head = { id: ulidOfUuid7(e.id), at: e.at, actor };
  const d = e.data;
  const typed = (type: ErgaEvent["type"], data?: JsonObject): Result<ErgaEvent, SourceProblem> => ok(data === undefined ? { ...head, type } : { ...head, type, data });
  switch (d.type) {
    case "commented":
      return typed("commented", { body: d.body });
    case "edited":
      return typed("edited", { ...(d.title === undefined ? {} : { title: d.title }), ...(d.body === undefined ? {} : { body: d.body }) });
    case "labeled":
      return typed("labeled", { add: [...d.add], remove: [...d.remove] });
    case "assigned":
      return typed("assigned", { add: [...d.add], remove: [...d.remove] });
    case "severity-set":
      return typed("severity", { severity: d.severity });
    case "blocker-set":
      return typed("blocker", { blocker: d.blocker });
    case "closed":
      return typed("closed", { reason: CLOSE_REASON_REGISTRY[d.reason].githubStateReason });
    case "reopened":
      return typed("reopened");
    case "decided":
      return typed("decided", { decision: d.verdict, note: d.note });
    case "opened":
      return err({ kind: "unexpressed", reason: "a new issue file is made by the monorepo's own sync" });
    case "started":
    case "deferred":
    case "linked":
    case "confirmed":
      return err({ kind: "unexpressed", reason: `the issue schema has no event of the type ${d.type}` });
    default: {
      const never: never = d;
      return never;
    }
  }
}

function edit(file: FileRead, patch: Patch): Result<string | undefined, SourceProblem> {
  const o = file.observations.find((x) => x.fingerprint === patch.fingerprint);
  if (o === undefined) return err({ kind: "refused", message: "the item is not in this file" });
  const decoded = decodeIssueFile(file.text);
  if (decoded.kind === "err") return err({ kind: "unexpressed", reason: "the item lives only as event objects of the store, which the monorepo's own sync writes" });
  const event = ergaEventOf(patch);
  if (event.kind === "err") return event;
  // what the place already says is not a change
  const history = o.content.history ?? [];
  const folded = fold(history);
  const data = patch.event.data;
  if (folded.kind === "ok") {
    const s = folded.value.state;
    if (data.type === "reopened" && s.kind !== "closed" && s.kind !== "deferred") return ok(undefined);
    if (data.type === "closed" && s.kind === "closed" && s.reason === data.reason) return ok(undefined);
  }
  if (decoded.value.events.some((e) => e.id === event.value.id)) return ok(undefined);
  const last = decoded.value.events.reduce<ErgaEvent | undefined>((m, e) => (m === undefined || e.at > m.at || (e.at === m.at && e.id > m.id) ? e : m), undefined);
  const after = last === undefined || event.value.at > last.at || (event.value.at === last.at && event.value.id > last.id);
  const canonicalFile = encodeIssueFile(decoded.value) === file.text;
  if (!after) {
    if (!canonicalFile) return err({ kind: "refused", message: "the event sorts before the last one and the file is not in the form its writer makes, so it cannot be placed without changing other bytes" });
    return ok(encodeIssueFile({ ...decoded.value, events: [...decoded.value.events, event.value] }));
  }
  const body = JSON.stringify(ergaEventJson(event.value), null, 2).split("\n").map((l) => `    ${l}`).join("\n");
  const tail = file.text.lastIndexOf("\n  ]\n}");
  if (tail === -1) return err({ kind: "refused", message: "the end of the events of the file is not in the form its writer makes" });
  return ok(`${file.text.slice(0, tail)},\n${body}${file.text.slice(tail)}`);
}

/** The lens for the issue files and event objects of a folder. */
export function eventFilesLens(config: EventFilesConfig = {}): FileLens {
  return {
    name: SOURCE,
    capabilities: ["read", "append-event"],
    reads: (path) => path.endsWith(".json5"),
    parse: async () => ({ observations: [], findings: [] }),
    parseAll: (files) => parseAll(config, files),
    edit,
  };
}

