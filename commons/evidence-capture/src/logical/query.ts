// Spec: 0006-evidence-capture-query FR-001, FR-002, FR-003
/**
 * Questions of the journal in SQL (commons evidence-capture 0006-evidence-capture-query): the entries of the journal and the last look at each asset, made into relations, and a read-only SQL answered over them with the SQL language library
 * (its guard judges that the text is one read and binds it to the catalog, its engine answers). Pure: it is given the entries it reads, so that the assets that changed most, the assets not looked at for a day and the failures of a kind are one
 * line of SQL each.
 *
 * @example
 * ```ts
 * import { queryJournal } from "@intellectual-frontiers/evidence-capture/logical";
 * // queryJournal(entries, "SELECT asset, changes FROM assets ORDER BY changes DESC LIMIT 5");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import type { LedgerEntry } from "@intellectual-frontiers/grc/logical";

/** What may be given to a question. */
export type QueryOptions = { readonly limit?: number; readonly params?: readonly Value[] };

/** What a question gives. */
export type Answer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  journal: [["seq", "int"], ["at", "timestamp"], ["type", "text"], ["asset", "text"], ["evidence", "text"], ["digest", "text"], ["previous", "text"]],
  assets: [["asset", "text"], ["entries", "int"], ["changes", "int"], ["failures", "int"], ["last_type", "text"], ["last_at", "timestamp"], ["first_at", "timestamp"]],
};

/** The catalog of the relations. */
export function journalCatalog(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", int: "int", timestamp: "timestamp" });
}

const FAILURES: ReadonlySet<string> = new Set(["capture.unreachable", "capture.refused", "capture.unreadable", "push.failed"]);

/** The relations of the entries: `journal` is each entry (its subject is the asset), `assets` the entries of each asset counted, its last look and its first. */
export function journalRelations(entries: readonly LedgerEntry[]): Readonly<Record<string, Table>> {
  const columns = (name: string): readonly string[] => (SCHEMA[name] ?? []).map(([c]) => c);
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  const byAsset = new Map<string, LedgerEntry[]>();
  for (const e of ordered) byAsset.set(e.subject, [...(byAsset.get(e.subject) ?? []), e]);
  const assets: (readonly Value[])[] = [];
  for (const [asset, list] of [...byAsset].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const last = list[list.length - 1];
    assets.push([asset, list.length, list.filter((e) => e.type === "capture.changed").length, list.filter((e) => FAILURES.has(e.type)).length, last?.type ?? null, last?.createdAt ?? null, list[0]?.createdAt ?? null]);
  }
  return {
    journal: { columns: columns("journal"), rows: ordered.map((e) => [e.seq, e.createdAt, e.type, e.subject, e.evidence, e.digest, e.previous]) },
    assets: { columns: columns("assets"), rows: assets },
  };
}

/** The answer to one read-only question over the journal, or why it is refused (with its place) or cannot be answered. */
export function queryJournal(entries: readonly LedgerEntry[], sql: string, options: QueryOptions = {}): Result<Answer, string> {
  const checked = guard(sql, astsql, { catalog: journalCatalog() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const lookup = new Map(Object.entries(journalRelations(entries)));
  const r = createEngine((name) => lookup.get(name.toLowerCase())).run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
