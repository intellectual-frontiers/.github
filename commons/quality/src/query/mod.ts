// Spec: 0002-quality-query FR-001, FR-002, FR-003
/**
 * Questions of the runs kept as evidence in SQL (commons quality 0002-quality-query): the runs and the cases of the records, made into relations, and a read-only SQL answered over them with the SQL language library (its guard judges that the
 * text is one read and binds it to the catalog, its engine answers). Pure: it is given the records it reads, so that the flaky test, the slowest suite and the requirement with no passing case are each one line of SQL.
 *
 * @example
 * ```ts
 * import { queryRuns } from "@intellectual-frontiers/quality/query";
 * // queryRuns(runs, "SELECT name, count(*) AS n FROM cases WHERE outcome = 'failed' GROUP BY name ORDER BY n DESC LIMIT 5");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import type { QualityRecord } from "../pure/record.ts";

/** A run as it is kept: its record, the day of its file and the grade the branch gives it. */
export type KeptRun = { readonly record: QualityRecord; readonly day: string; readonly grade: string };

/** What may be given to a question. */
export type QueryOptions = { readonly limit?: number; readonly params?: readonly Value[] };

/** What a question gives. */
export type Answer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  runs: [["trace_id", "text"], ["day", "text"], ["revision", "text"], ["grade", "text"], ["tests", "int"], ["passed", "int"], ["failed", "int"], ["not_run", "int"]],
  cases: [["trace_id", "text"], ["day", "text"], ["file", "text"], ["name", "text"], ["outcome", "text"], ["grade", "text"], ["risk", "text"], ["characteristic", "text"], ["runtime", "text"], ["attempt", "int"], ["duration_ms", "float"], ["rule", "text"], ["line", "int"], ["reason", "text"]],
  case_requirements: [["trace_id", "text"], ["file", "text"], ["name", "text"], ["requirement", "text"]],
};

/** The catalog of the relations. */
export function qualityCatalog(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", int: "int", float: "float" });
}

/** The relations of the runs: a case lasts from its start to its end (nanoseconds in the record), in milliseconds. */
export function qualityRelations(runs: readonly KeptRun[]): Readonly<Record<string, Table>> {
  const runRows: (readonly Value[])[] = [];
  const caseRows: (readonly Value[])[] = [];
  const requirementRows: (readonly Value[])[] = [];
  const columns = (name: string): readonly string[] => (SCHEMA[name] ?? []).map(([c]) => c);
  for (const { record: q, day, grade } of runs) {
    const c = q.counts;
    runRows.push([q.traceId, day, q.run.runner.revision ?? null, grade, c.tests, c.passed, c.failed, c.notRun]);
    for (const k of q.cases) {
      caseRows.push([q.traceId, day, k.file, k.name, k.outcome, k.grade, k.risk, k.characteristic ?? null, k.runtime, k.attempt, Number(k.end - k.start) / 1_000_000, k.rule ?? null, k.line ?? null, k.reason ?? null]);
      for (const r of k.requirements) requirementRows.push([q.traceId, k.file, k.name, r]);
    }
  }
  return {
    runs: { columns: columns("runs"), rows: runRows },
    cases: { columns: columns("cases"), rows: caseRows },
    case_requirements: { columns: columns("case_requirements"), rows: requirementRows },
  };
}

/** The answer to one read-only question over the runs, or why it is refused (with its place) or cannot be answered. */
export function queryRuns(runs: readonly KeptRun[], sql: string, options: QueryOptions = {}): Result<Answer, string> {
  const checked = guard(sql, astsql, { catalog: qualityCatalog() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const lookup = new Map(Object.entries(qualityRelations(runs)));
  const r = createEngine((name) => lookup.get(name.toLowerCase())).run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
