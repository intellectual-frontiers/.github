// Spec: 0002-planning-query-relations FR-001
/**
 * The Governance layer of Planning Query: the relations as data (0002-planning-query-relations FR-001, FR-002). A relation has a name, a sentence and columns; each column has a name, a type and a sentence. The catalog the guard
 * binds a statement to, the help that lists the relations and the rows are all made from these lists, so that no column is described twice.
 *
 * @example
 * ```ts
 * import { relationNamed } from "./mod.ts";
 * relationNamed("issues")?.columns.map((c) => c.name).includes("opened_at"); // true
 * ```
 *
 * @module
 */

/** The types of a column: whole numbers, text, true or false, and an instant or a day as text in ISO 8601 (which sorts as time does). */
export type ColumnType = "int" | "text" | "bool" | "timestamp";

/** A column: its name, its type and a sentence. */
export type Column<N extends string = string> = { readonly name: N; readonly type: ColumnType; readonly summary: string };

const c = <const N extends string>(name: N, type: ColumnType, summary: string): Column<N> => ({ name, type, summary });

/** The columns of `issues`, in order: one for each field of the core of an item and for its state, and the monorepo's (`id`, `title`, `state`, `reason`, `severity`, `blocker`, `labels`, `assignees`, `comments`, `opened_at`, `updated_at`). */
export const ISSUE_COLUMNS = [
  c("id", "text", "The id of the item, a UUID version 7."),
  c("kind", "text", "issue, task, todo or finding."),
  c("title", "text", "The title."),
  c("body", "text", "The body."),
  c("state", "text", "proposed, open, in-progress, deferred or closed."),
  c("reason", "text", "Why it is closed (completed, not-planned, duplicate); empty where it is not."),
  c("until", "text", "The day a deferred item is deferred until, as YYYY-MM-DD; empty where it is not deferred."),
  c("severity", "text", "error, warning or note; empty where the item has none."),
  c("source_severity", "text", "The severity as its source wrote it where the source has more levels (critical, high, medium, low); empty where none."),
  c("blocker", "bool", "Whether the item is a blocker."),
  c("origin", "text", "declared, derived or inferred."),
  c("labels", "text", "The labels, joined by a comma."),
  c("assignees", "text", "Who it is assigned to, joined by a comma."),
  c("external", "text", "The ids it has in the places it was read from, as source:value joined by a comma."),
  c("comments", "int", "How many comments it has."),
  c("links", "int", "How many links it has."),
  c("opened_by", "text", "The id of the actor that opened it."),
  c("opened_at", "timestamp", "When it was opened."),
  c("updated_at", "timestamp", "When its last event was made."),
  c("motivation", "text", "The Web Annotation motivation of the record; empty where none."),
  c("priority", "text", "The priority its source gives; empty where none."),
  c("size", "text", "The size its source gives; empty where none."),
  c("goals", "text", "The goals its source gives, joined by a comma."),
  c("engines", "text", "The engines its source names, joined by a comma."),
  c("cites", "text", "The requirements it cites, joined by a comma."),
  c("evidence", "text", "The evidence its source gives, joined by a comma."),
] as const;

/** The columns of `events`. */
export const EVENT_COLUMNS = [
  c("id", "text", "The id of the event."),
  c("issue", "text", "The id of the item it is of."),
  c("type", "text", "opened, commented, edited, labeled, assigned, severity-set, blocker-set, started, deferred, closed, reopened, decided, linked or confirmed."),
  c("at", "timestamp", "When it was made."),
  c("actor", "text", "The id of its actor."),
  c("actor_kind", "text", "person, agent or tool."),
  c("principal", "text", "The person an agent acted for; empty where it is not an agent."),
] as const;

/** The columns of `links`. */
export const LINK_COLUMNS = [c("from_issue", "text", "Where the link starts."), c("to_issue", "text", "Where it ends."), c("kind", "text", "blocks, same-as, relates-to or parent-of.")] as const;

/** The columns of `traces`. */
export const TRACE_COLUMNS = [
  c("issue", "text", "The item that was seen."),
  c("source", "text", "The source that saw it."),
  c("fingerprint", "text", "The fingerprint of the thing it saw."),
  c("locator", "text", "Where: a file and its first line, a URL or a commit."),
  c("presence", "text", "present or absent."),
  c("content_hash", "text", "The SHA-256 of the bytes it was read from."),
] as const;

/** A relation of the library. */
export type Relation = { readonly name: string; readonly summary: string; readonly columns: readonly Column[] };

/** Every relation, in the order the help lists them. */
export const RELATIONS: readonly Relation[] = [
  { name: "issues", summary: "One row for each counted item: the core of an item, its state and what its source carried.", columns: ISSUE_COLUMNS },
  { name: "events", summary: "One row for each event of the counted items, with its actor and the person an agent acted for.", columns: EVENT_COLUMNS },
  { name: "links", summary: "One row for each link of the counted items.", columns: LINK_COLUMNS },
  { name: "traces", summary: "One row for each place a counted item was seen in: the source, the fingerprint and where.", columns: TRACE_COLUMNS },
];

/** The relation of a name, or nothing. */
export function relationNamed(name: string): Relation | undefined {
  return RELATIONS.find((r) => r.name === name);
}
