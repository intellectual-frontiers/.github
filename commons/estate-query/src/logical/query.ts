// Spec: 0003-estate-query-run FR-001, FR-002, FR-003, FR-004
/**
 * Asking the estate a question in SQL: one statement that only reads, refused with every reason before anything runs, bound to the catalog of the relations (an unknown table or column is said with the nearest), run by the engine of lang-sql over the relations built as the query names them, within a
 * budget of rows, and given back as a table, JSON or CSV. Nothing here reads a file or the network: what an estate holds is given.
 *
 * @example
 * ```ts
 * import { openEstateQuery } from "./query.ts";
 * const q = openEstateQuery({ assets: [], now: "2026-12-01T00:00:00Z" });
 * q.query("select count(*) as n from asset").kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { LIVE_STATUS, osqueryRelation, RELATIONS, type Relation } from "@intellectual-frontiers/estate-query/governance";
import { tablesOf, type EstateData } from "./data.ts";

/** Why a question was not answered. */
export type QueryProblem =
  | { readonly kind: "refused"; readonly reasons: readonly string[] }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "budget"; readonly message: string };

/** What a question may cost. */
export type Budget = { readonly maxRows?: number; readonly maxNodes?: number };

/** The defaults: ten thousand rows and a statement of at most two thousand nodes. */
export const DEFAULT_BUDGET = { maxRows: 10_000, maxNodes: 2_000 } as const;

/** An estate that can be asked. */
export type EstateQuery = {
  /** One read-only statement, with `?` or `$1` for values given apart. */
  readonly query: (sql: string, params?: readonly Value[]) => Result<Table, QueryProblem>;
};

/** The catalog of the relations, made from the one list of them. */
export const CATALOG = catalogOf([]);

function catalogOf(extra: readonly Relation[]) {
  return catalogFromTables([...RELATIONS, ...extra].map((r) => ({ name: r.name, columns: r.columns.map((c) => ({ name: c.name, type: c.type })) })), { int: "int", text: "text", bool: "bool", timestamp: "timestamp" });
}

/** What the machines said, gathered before the question is asked: the live relations by name and the status of each machine and table. */
export type Live = { readonly tables: Readonly<Record<string, Table>>; readonly status: Table };

/** The estate, openable for questions. */
export function openEstateQuery(data: EstateData, budget: Budget = {}, live?: Live): EstateQuery {
  const maxRows = budget.maxRows ?? DEFAULT_BUDGET.maxRows;
  const maxNodes = budget.maxNodes ?? DEFAULT_BUDGET.maxNodes;
  const built = tablesOf(data);
  const known = new Map<string, () => Table>(Object.entries(built));
  const catalog = live === undefined ? CATALOG : catalogOf([...Object.keys(live.tables).flatMap((n) => osqueryRelation(n.replace(/^osquery_/, "")) ?? []), LIVE_STATUS]);
  if (live !== undefined) {
    for (const [name, t] of Object.entries(live.tables)) known.set(name, () => t);
    known.set(LIVE_STATUS.name, () => live.status);
  }
  const cache = new Map<string, Table>();
  const engine = createEngine((name) => {
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    const make = known.get(name);
    if (make === undefined) return undefined;
    const t = make();
    cache.set(name, t);
    return t;
  });
  return {
    query: (sql, params = []) => {
      const guarded = guard(sql, astsql, { catalog, maxNodes });
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
  const widths = t.columns.map((c, i) => Math.max(c.length, ...t.rows.map((r) => cell(r[i] ?? null).length)));
  const line = (cells: readonly string[]): string => cells.map((s, i) => s.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return `${[line(t.columns), line(widths.map((w) => "-".repeat(w))), ...t.rows.map((r) => line(r.map(cell)))].join("\n")}\n${t.rows.length} row${t.rows.length === 1 ? "" : "s"}\n`;
}
