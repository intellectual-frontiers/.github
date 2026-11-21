// Spec: 0002-planning-core FR-011
/**
 * The summary of a work's issues in the monorepo's form, `erga/issues-index@1`, made from items (0037-planning FR-039, inventory entry 2): a rendition, a pure function from items to a value that
 * `encodeIndex` writes. The monorepo has the two states open and closed, so every state that is not closed is open in it, and its three severities, its motivation `commenting` and its flag `blocker`
 * where a record says none.
 *
 * @example
 * ```ts
 * import { indexOf } from "./erga-index.ts";
 * // indexOf("book/guide", items, "event-files", "2026-11-21T10:00:00Z")
 * ```
 *
 * @module
 */
import type { Item } from "@intellectual-frontiers/planning/governance";
import type { ErgaIndex, ErgaIndexEntry } from "./erga.ts";

/** The summary of a work's issues from its items; `source` is the name the items' external ids were made with, and `updated` the time the summary is made, which the caller passes in. */
export function indexOf(work: string, items: readonly Item[], source: string, updated: string): ErgaIndex {
  const entries: ErgaIndexEntry[] = items.map((i) => ({
    id: i.external.find((e) => e.source === source)?.value ?? i.id,
    title: i.title,
    state: i.state.kind === "closed" ? "closed" : "open",
    state_reason: i.state.kind === "closed" ? (i.state.reason === "not-planned" ? "not_planned" : i.state.reason) : "",
    severity: i.severity ?? "note",
    motivation: i.motivation ?? "commenting",
    blocker: i.blocker ?? false,
    labels: i.labels,
    assignees: i.assignees,
    author: i.openedBy.id,
    created: i.openedAt,
    updated: i.updatedAt,
    comments: i.comments.length,
    source: i.source ?? null,
  }));
  return {
    work,
    updated,
    open: entries.filter((e) => e.state === "open").length,
    blockers: entries.filter((e) => e.state === "open" && e.blocker).length,
    issues: entries,
  };
}
