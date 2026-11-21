// Spec: 0002-mizan-query FR-001, FR-002, FR-003
/**
 * Questions of the trace in SQL (commons mizan 0002-mizan-query): the findings of the trace check judged against a baseline, the baseline's keys and the specifications with their requirements, made into relations, and a read-only SQL answered
 * over them with the SQL language library (its guard judges that the text is one read and binds it to the catalog, its engine answers). Pure: it is given the findings, the baseline and the specifications it reads.
 *
 * @example
 * ```ts
 * import { queryTrace } from "@intellectual-frontiers/mizan/query";
 * // queryTrace(input, "SELECT rule, count(*) AS n FROM findings WHERE status = 'fresh' GROUP BY rule ORDER BY n DESC");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import { inForce, judge, type Keyed, type Spec } from "./trace.ts";

/** What a question is about: the findings of a check, the keys of its baseline and the specifications. */
export type TraceRecords = { readonly findings: readonly Keyed[]; readonly baseline: readonly string[]; readonly specs: readonly Spec[] };

/** What may be given to a question. */
export type QueryOptions = { readonly limit?: number; readonly params?: readonly Value[] };

/** What a question gives. */
export type Answer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  findings: [["rule", "text"], ["file", "text"], ["line", "int"], ["message", "text"], ["key", "text"], ["status", "text"]],
  baseline: [["key", "text"], ["status", "text"]],
  specs: [["slug", "text"], ["status", "text"], ["in_force", "bool"], ["requirements", "int"]],
  requirements: [["spec", "text"], ["id", "text"], ["line", "int"], ["reviewed", "bool"]],
};

/** The catalog of the relations. */
export function traceCatalog(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", int: "int", bool: "bool" });
}

/** The relations of the records: a finding is `fresh` (the baseline does not hold it) or `held`; a key of the baseline is `held` (a finding has it) or `stale` (none has). */
export function traceRelations(records: TraceRecords): Readonly<Record<string, Table>> {
  const columns = (name: string): readonly string[] => (SCHEMA[name] ?? []).map(([c]) => c);
  const judged = judge(records.findings, records.baseline);
  const fresh = new Set(judged.fresh);
  const stale = new Set(judged.stale);
  const keys = [...new Set([...records.baseline])].sort();
  const requirements: (readonly Value[])[] = [];
  for (const s of records.specs) for (const r of s.requirements) requirements.push([s.slug, r.id, r.line, s.reviewed.includes(r.id)]);
  return {
    findings: { columns: columns("findings"), rows: records.findings.map((f) => [f.rule, f.file, f.line, f.message, f.key, fresh.has(f) ? "fresh" : "held"]) },
    baseline: { columns: columns("baseline"), rows: keys.map((k) => [k, stale.has(k) ? "stale" : "held"]) },
    specs: { columns: columns("specs"), rows: records.specs.map((s) => [s.slug, s.status ?? null, inForce(s), s.requirements.length]) },
    requirements: { columns: columns("requirements"), rows: requirements },
  };
}

/** The answer to one read-only question over the trace, or why it is refused (with its place) or cannot be answered. */
export function queryTrace(records: TraceRecords, sql: string, options: QueryOptions = {}): Result<Answer, string> {
  const checked = guard(sql, astsql, { catalog: traceCatalog() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const lookup = new Map(Object.entries(traceRelations(records)));
  const r = createEngine((name) => lookup.get(name.toLowerCase())).run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
