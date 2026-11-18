// Spec: 0016-sql-plan-report FR-010
/**
 * The report in the database (commons data 0016-sql-plan-report FR-010): a table of what happened to it, one row for each step, made with the dialect's own types and loaded by an upsert, so that
 * loading it twice leaves the same rows.
 *
 * @module
 */
import { type Dialect, qualified, type Statement, upsert } from "@intellectual-frontiers/data/sql/physical";
import type { ReportData } from "./report.ts";
import { type Report, type ReportSettings, settingsOf } from "./settings.ts";

/**
 * The statements that record a report.
 *
 * @param data - the report
 * @param dialect - the dialect
 * @param options - the table's settings, the schema it is in, and its name where the dialect has no schemas and the words are in the name
 * @returns the statements, in the groups of table and data
 */
export function recordStatements(
  data: ReportData,
  dialect: Dialect,
  options: { readonly settings?: ReportSettings; readonly qualifier?: string; readonly tableName?: string } = {},
): readonly Statement[] {
  const settings: Report = settingsOf(options.settings);
  const name = options.tableName ?? settings.table;
  const q = (n: string): string => dialect.quote(n);
  const text = dialect.type({ kind: "text" });
  const int = dialect.type({ kind: "integer" });
  const json = dialect.type({ kind: "json" });
  const columns = ["step_id", "seq", "name", "kind", "class", "reversibility", "idempotency", "approvers", "elements"];
  const types = [text, int, text, text, text, text, text, json, json];
  const ref = qualified(dialect, options.qualifier, name);
  const create: Statement = {
    group: "table",
    sql: `CREATE TABLE IF NOT EXISTS ${ref} (\n${columns.map((c, i) => `    ${q(c)} ${types[i]}${c === "step_id" ? " NOT NULL PRIMARY KEY" : c === "idempotency" ? "" : " NOT NULL"}`).join(",\n")}\n);`,
    of: [],
  };
  if (data.steps.length === 0) return [create];
  const rows = data.steps.map((s) => [
    `${data.to}:${s.number}:${s.key}`,
    s.number,
    s.name,
    s.kind,
    s.class,
    s.reversibility,
    s.idempotency ?? null,
    JSON.stringify(s.approvers),
    JSON.stringify(s.elements.map((e) => e.element)),
  ]);
  return [create, { group: "data", sql: upsert(dialect, name, columns, ["step_id"], rows, options.qualifier), of: [] }];
}
