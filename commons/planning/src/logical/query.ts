// Spec: 0003-planning-reconcile FR-011
/**
 * The query algebra (0037-planning FR-020): a typed, pure and read-only question over the items, events, links and traces (select, filter by state, kind, label, assignee, severity and origin, join, order, limit).
 * A proposed item is not counted unless the question says so, and a surface (the SQL relations, `planctl query`) is a projection of this and not a second definition.
 *
 * @example
 * ```ts
 * import { runQuery } from "./query.ts";
 * // runQuery(data, { from: "items", where: { state: ["open"] }, order: { by: "title" }, limit: 10 })
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { EventType, Item, ItemEvent, ItemKind, Link, Origin, Severity, StateKind, Trace } from "@intellectual-frontiers/planning/governance";

/** What can be asked. */
export type Data = { readonly items: readonly Item[]; readonly traces: readonly Trace[] };

/** A filter on items. */
export type ItemFilter = {
  readonly state?: readonly StateKind[];
  readonly kind?: readonly ItemKind[];
  readonly label?: string;
  readonly assignee?: string;
  readonly severity?: readonly Severity[];
  readonly origin?: readonly Origin[];
  /** A proposed item is not counted unless this is true. */
  readonly includeProposed?: boolean;
};

/** The fields items are ordered by. */
export type ItemOrder = "id" | "title" | "state" | "severity" | "openedAt" | "updatedAt";

/** An ordering. */
export type Ordering = { readonly by: ItemOrder; readonly desc?: boolean };

/** A question. */
export type Query =
  | { readonly from: "items"; readonly where?: ItemFilter; readonly order?: Ordering; readonly limit?: number }
  | { readonly from: "events"; readonly where?: ItemFilter; readonly type?: readonly EventType[]; readonly limit?: number }
  | { readonly from: "links"; readonly where?: ItemFilter; readonly limit?: number }
  | { readonly from: "traces"; readonly where?: ItemFilter; readonly source?: string; readonly limit?: number }
  | { readonly from: "items-traces"; readonly where?: ItemFilter; readonly order?: Ordering; readonly limit?: number };

/** What a question gives back. */
export type Row =
  | { readonly kind: "item"; readonly item: Item }
  | { readonly kind: "event"; readonly event: ItemEvent }
  | { readonly kind: "link"; readonly link: Link }
  | { readonly kind: "trace"; readonly trace: Trace }
  | { readonly kind: "item-trace"; readonly item: Item; readonly trace: Trace };

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SEVERITY_RANK: Readonly<Record<Severity, number>> = { error: 0, warning: 1, note: 2 };

/** Whether an item passes a filter. */
export function passes(item: Item, f: ItemFilter | undefined): boolean {
  if (f?.includeProposed !== true && item.state.kind === "proposed") return false;
  if (f === undefined) return true;
  return (
    (f.state === undefined || f.state.includes(item.state.kind)) &&
    (f.kind === undefined || f.kind.includes(item.kind)) &&
    (f.label === undefined || item.labels.includes(f.label)) &&
    (f.assignee === undefined || item.assignees.includes(f.assignee)) &&
    (f.severity === undefined || (item.severity !== undefined && f.severity.includes(item.severity))) &&
    (f.origin === undefined || f.origin.includes(item.origin))
  );
}

function compareBy(by: ItemOrder): (a: Item, b: Item) => number {
  switch (by) {
    case "id":
      return (a, b) => byText(a.id, b.id);
    case "title":
      return (a, b) => byText(a.title, b.title) || byText(a.id, b.id);
    case "state":
      return (a, b) => byText(a.state.kind, b.state.kind) || byText(a.id, b.id);
    case "severity":
      return (a, b) => (a.severity === undefined ? 3 : SEVERITY_RANK[a.severity]) - (b.severity === undefined ? 3 : SEVERITY_RANK[b.severity]) || byText(a.id, b.id);
    case "openedAt":
      return (a, b) => byText(a.openedAt, b.openedAt) || byText(a.id, b.id);
    case "updatedAt":
      return (a, b) => byText(a.updatedAt, b.updatedAt) || byText(a.id, b.id);
    default:
      return absurd(by);
  }
}

function ordered(items: readonly Item[], order: Ordering | undefined): readonly Item[] {
  const cmp = compareBy(order?.by ?? "id");
  return [...items].sort(order?.desc === true ? (a, b) => cmp(b, a) : cmp);
}

const cut = <T>(rows: readonly T[], limit: number | undefined): readonly T[] => (limit === undefined ? rows : rows.slice(0, Math.max(0, limit)));

/** The rows a question gives, in an order that is a function of the data and the question alone. */
export function runQuery(data: Data, q: Query): readonly Row[] {
  switch (q.from) {
    case "items":
      return cut(ordered(data.items.filter((i) => passes(i, q.where)), q.order), q.limit).map((item) => ({ kind: "item", item }));
    case "events": {
      const rows = ordered(data.items.filter((i) => passes(i, q.where)), { by: "id" }).flatMap((i) => i.events.filter((e) => q.type === undefined || q.type.includes(e.data.type)));
      return cut(rows, q.limit).map((event) => ({ kind: "event", event }));
    }
    case "links": {
      const rows = ordered(data.items.filter((i) => passes(i, q.where)), { by: "id" }).flatMap((i) => i.links.filter((l) => l.from === i.id));
      return cut(rows, q.limit).map((link) => ({ kind: "link", link }));
    }
    case "traces": {
      const ids = new Set(data.items.filter((i) => passes(i, q.where)).map((i) => i.id));
      const rows = data.traces.filter((t) => ids.has(t.item) && (q.source === undefined || t.source === q.source)).sort((a, b) => byText(a.item, b.item) || byText(a.source, b.source) || byText(a.fingerprint, b.fingerprint));
      return cut(rows, q.limit).map((trace) => ({ kind: "trace", trace }));
    }
    case "items-traces": {
      const items = ordered(data.items.filter((i) => passes(i, q.where)), q.order);
      const rows = items.flatMap((item) =>
        data.traces
          .filter((t) => t.item === item.id)
          .sort((a, b) => byText(a.source, b.source) || byText(a.fingerprint, b.fingerprint))
          .map((trace) => ({ kind: "item-trace" as const, item, trace })),
      );
      return cut(rows, q.limit);
    }
    default:
      return absurd(q);
  }
}
