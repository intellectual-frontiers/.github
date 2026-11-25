// Spec: 0002-planning-query-relations FR-003
/**
 * The Logical layer of Planning Query: the rows of the relations made from the items, and asking a question in SQL (0002-planning-query-relations FR-002 to FR-004). One statement that only reads, refused with every reason
 * before anything runs, bound to the catalog of the relations (an unknown table or column is said with the nearest), run by the engine of `lang-sql` over the relations built as the statement names them, within a budget of
 * rows. Nothing here reads a file or the network: the items are given.
 *
 * @example
 * ```ts
 * import { openPlanningQuery } from "./mod.ts";
 * const q = openPlanningQuery({ items: [], traces: [] });
 * q.query("select count(*) as n from issues").kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import type { Item, Trace } from "@intellectual-frontiers/planning/governance";
import { EVENT_COLUMNS, ISSUE_COLUMNS, LINK_COLUMNS, RELATIONS, TRACE_COLUMNS } from "@intellectual-frontiers/planning-query/governance";

/** What can be asked: the items and the traces of the places they were seen in. */
export type PlanningData = { readonly items: readonly Item[]; readonly traces: readonly Trace[] };

/** How a column of a relation is filled from a row's subject: a table typed by the columns, so that a column with no way to be filled does not compile. */
type Fill<C extends readonly { readonly name: string }[], S> = { readonly [K in C[number]["name"]]: (subject: S) => Value };

const join = (xs: readonly string[] | undefined): string => (xs ?? []).join(",");

const ISSUE_FILL: Fill<typeof ISSUE_COLUMNS, Item> = {
  id: (i) => i.id,
  kind: (i) => i.kind,
  title: (i) => i.title,
  body: (i) => i.body,
  state: (i) => i.state.kind,
  reason: (i) => (i.state.kind === "closed" ? i.state.reason : ""),
  until: (i) => (i.state.kind === "deferred" ? (i.state.until ?? i.state.untilText ?? "") : ""),
  severity: (i) => i.severity ?? "",
  source_severity: (i) => i.sourceSeverity ?? "",
  blocker: (i) => i.blocker === true,
  origin: (i) => i.origin,
  labels: (i) => join(i.labels),
  assignees: (i) => join(i.assignees),
  external: (i) => i.external.map((e) => `${e.source}:${e.value}`).join(","),
  comments: (i) => i.comments.length,
  links: (i) => i.links.length,
  opened_by: (i) => i.openedBy.id,
  opened_at: (i) => i.openedAt,
  updated_at: (i) => i.updatedAt,
  motivation: (i) => i.motivation ?? "",
  priority: (i) => i.priority ?? "",
  size: (i) => i.size ?? "",
  goals: (i) => join(i.goals),
  engines: (i) => join(i.engines),
  cites: (i) => join(i.cites),
  evidence: (i) => join(i.evidence),
  due: (i) => i.due ?? "",
};

type EventRow = { readonly issue: string; readonly event: Item["events"][number] };
const EVENT_FILL: Fill<typeof EVENT_COLUMNS, EventRow> = {
  id: (r) => r.event.id,
  issue: (r) => r.issue,
  type: (r) => r.event.data.type,
  at: (r) => r.event.at,
  actor: (r) => r.event.actor.id,
  actor_kind: (r) => r.event.actor.kind,
  principal: (r) => (r.event.actor.kind === "agent" ? r.event.actor.principal.id : ""),
};

const LINK_FILL: Fill<typeof LINK_COLUMNS, Item["links"][number]> = { from_issue: (l) => l.from, to_issue: (l) => l.to, kind: (l) => l.kind };

const TRACE_FILL: Fill<typeof TRACE_COLUMNS, Trace> = {
  issue: (t) => t.item,
  source: (t) => t.source,
  fingerprint: (t) => t.fingerprint,
  locator: (t) => (t.locator.kind === "file-span" ? `${t.locator.path}:${t.locator.startLine}` : t.locator.kind === "url" ? t.locator.url : t.locator.sha),
  presence: (t) => t.presence,
  content_hash: (t) => t.contentHash,
};

function table<S>(columns: readonly { readonly name: string }[], fill: { readonly [name: string]: (subject: S) => Value }, subjects: readonly S[]): Table {
  return { columns: columns.map((c) => c.name), rows: subjects.map((s) => columns.map((c) => fill[c.name]?.(s) ?? null)) };
}

/** The relations of the items, each built when a statement names it; a proposed item is in `issues` only where `includeProposed` is true. */
export function tablesOf(data: PlanningData, includeProposed = false): Readonly<Record<string, () => Table>> {
  const items = data.items.filter((i) => includeProposed || i.state.kind !== "proposed").sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ids = new Set(items.map((i) => i.id));
  return {
    issues: () => table(ISSUE_COLUMNS, ISSUE_FILL, items),
    events: () => table(EVENT_COLUMNS, EVENT_FILL, items.flatMap((i) => i.events.map((event): EventRow => ({ issue: i.id, event })))),
    links: () => table(LINK_COLUMNS, LINK_FILL, items.flatMap((i) => i.links.filter((l) => l.from === i.id))),
    traces: () => table(TRACE_COLUMNS, TRACE_FILL, data.traces.filter((t) => ids.has(t.item)).sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : a.source < b.source ? -1 : a.fingerprint < b.fingerprint ? -1 : 1))),
  };
}

/** Why a question was not answered. */
export type QueryProblem =
  | { readonly kind: "refused"; readonly reasons: readonly string[] }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "budget"; readonly message: string };

/** What a question may cost. */
export type Budget = { readonly maxRows?: number; readonly maxNodes?: number };

/** The defaults: ten thousand rows and a statement of at most two thousand nodes. */
export const DEFAULT_BUDGET = { maxRows: 10_000, maxNodes: 2_000 } as const;

/** Items that can be asked. */
export type PlanningQuery = { readonly query: (sql: string, params?: readonly Value[]) => Result<Table, QueryProblem> };

/** The catalog of the relations, made from the one list of them. */
export const CATALOG = catalogFromTables(RELATIONS.map((r) => ({ name: r.name, columns: r.columns.map((c) => ({ name: c.name, type: c.type })) })), { int: "int", text: "text", bool: "bool", timestamp: "timestamp" });

/** The items, openable for questions. */
export function openPlanningQuery(data: PlanningData, options: Budget & { readonly includeProposed?: boolean } = {}): PlanningQuery {
  const maxRows = options.maxRows ?? DEFAULT_BUDGET.maxRows;
  const maxNodes = options.maxNodes ?? DEFAULT_BUDGET.maxNodes;
  const built = tablesOf(data, options.includeProposed === true);
  const cache = new Map<string, Table>();
  const engine = createEngine((name) => {
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    const make = built[name];
    if (make === undefined) return undefined;
    const t = make();
    cache.set(name, t);
    return t;
  });
  return {
    query: (sql, params = []) => {
      const guarded = guard(sql, astsql, { catalog: CATALOG, tables: RELATIONS.map((r) => r.name), maxNodes });
      if (guarded.kind === "err") return err({ kind: "refused", reasons: guarded.error.map((v) => v.message) });
      const ran = engine.run(sql, params);
      if (ran.kind === "err") return err({ kind: "failed", message: ran.error.message });
      if (ran.value.rows.length > maxRows) return err({ kind: "budget", message: `the answer has ${ran.value.rows.length} rows and a question may have ${maxRows}: ask for fewer (where, limit)` });
      return ok(ran.value);
    },
  };
}

/** A table as the text of one of its formats. */
export function formatTable(t: Table, format: "table" | "json" | "csv"): string {
  if (format === "json") return `${JSON.stringify(t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, r[i] ?? null]))), null, 2)}\n`;
  const cell = (v: Value): string => (v === null ? "" : String(v));
  if (format === "csv") {
    const q = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    return `${[t.columns.map(q).join(","), ...t.rows.map((r) => r.map((v) => q(cell(v))).join(","))].join("\n")}\n`;
  }
  const widths = t.columns.map((col, i) => Math.max(col.length, ...t.rows.map((r) => cell(r[i] ?? null).length)));
  const line = (cells: readonly string[]): string => cells.map((s, i) => s.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return `${[line(t.columns), line(widths.map((w) => "-".repeat(w))), ...t.rows.map((r) => line(r.map(cell)))].join("\n")}\n${t.rows.length} row${t.rows.length === 1 ? "" : "s"}\n`;
}
