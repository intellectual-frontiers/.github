// Spec: 0003-planning-reconcile FR-013
/**
 * Rendering items in a format (0037-planning FR-039): a pure function from items to text, Markdown or JSON5, that says what its format cannot hold and does not drop it silently. Markdown holds the title, the
 * state (as a task list item), the labels, the assignees, the severity, the body and the links as text; it cannot hold the events, the actors with their principals or the carried fields, and says so.
 *
 * @example
 * ```ts
 * import { renderMarkdown } from "./render.ts";
 * // renderMarkdown(items).text starts with "- [ ] "
 * ```
 *
 * @module
 */
import { toJson5 } from "@intellectual-frontiers/formats/json5";
import type { Item } from "@intellectual-frontiers/planning/governance";
import { eventToJson, jsonOf } from "./store.ts";
import type { Field } from "@intellectual-frontiers/planning/logical";

/** A rendering: the text, and what the format could not hold. */
export type Rendered = { readonly text: string; readonly unexpressed: readonly { readonly field: Field; readonly reason: string }[] };

/** The items as a Markdown task list: closed items checked; what Markdown cannot hold is named at the end. */
export function renderMarkdown(items: readonly Item[]): Rendered {
  const lines = items.map((i) => {
    const mark = i.state.kind === "closed" ? "x" : " ";
    const meta = [i.severity === undefined ? "" : `severity: ${i.severity}`, i.labels.length === 0 ? "" : `labels: ${i.labels.join(", ")}`, i.assignees.length === 0 ? "" : `assignees: ${i.assignees.join(", ")}`, `state: ${i.state.kind}`].filter((x) => x !== "").join("; ");
    const links = i.links.filter((l) => l.from === i.id).map((l) => `${l.kind} ${l.to}`);
    const body = i.body === "" ? [] : i.body.split("\n").map((l) => `  ${l}`);
    return [`- [${mark}] ${i.title} (${meta})`, ...body, ...(links.length === 0 ? [] : [`  links: ${links.join("; ")}`])].join("\n");
  });
  const unexpressed = [
    { field: "events" as const, reason: "a task list holds no history" },
    { field: "principal" as const, reason: "a task list holds no actor" },
    { field: "external" as const, reason: "a task list holds no id of another scheme" },
  ];
  const note = `<!-- unexpressed in Markdown: ${unexpressed.map((u) => u.field).join(", ")} -->`;
  return { text: `${[...lines, note].join("\n")}\n`, unexpressed };
}

/** The items as JSON5, with the events of each in the order of their id and the keys in order: it holds every field. */
export function renderJson5(items: readonly Item[]): Rendered {
  const value = items.map((i) => jsonOf({ id: i.id, kind: i.kind, title: i.title, state: i.state.kind, events: i.events.map(eventToJson) }));
  return { text: toJson5(value), unexpressed: [] };
}
