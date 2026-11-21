// Spec: 0015-grc-query FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Questions of the records of GRC in SQL (0015-grc-query): the documents of an assessment made into relations, and a read-only SQL answered over them with the SQL language library: its guard judges that the text is one read and binds it to the
 * catalog, its engine answers it. No database is made and no record can be changed by a question.
 *
 * @example
 * ```ts
 * import { queryRecords } from "@intellectual-frontiers/grc/surfaces/query";
 * // queryRecords(records, "SELECT control, status FROM control_state WHERE freshness = 'stale'");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { astsql } from "@intellectual-frontiers/lang-sql/aide/relational";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import { controlUrn, type Check, type Exception, type Framework } from "@intellectual-frontiers/grc/governance";
import { asOf, type AsOfInput, type Attestation, type Evidence, type Finding, latestInstant } from "@intellectual-frontiers/grc/logical";

/** Everything a question may be about: the as-of input, and what an assessment adds to it. */
export type Records = AsOfInput & {
  readonly findings?: readonly Finding[];
  readonly evidence?: readonly Evidence[];
  readonly attestations?: readonly Attestation[];
};

/** What may be given to a question. */
export type QueryOptions = {
  /** The most rows of the answer (1000 where none is given). */
  readonly limit?: number;
  /** The values of the parameters (`?`). */
  readonly params?: readonly Value[];
  /** The instant of `control_state` (the newest recorded where none is given). */
  readonly at?: string;
};

/** What a question gives. */
export type Answer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  frameworks: [["id", "text"], ["version", "text"], ["title", "text"]],
  controls: [["urn", "text"], ["framework", "text"], ["control", "text"], ["title", "text"], ["family", "text"]],
  checks: [["id", "text"], ["ask", "text"], ["severity", "text"], ["freshness", "text"], ["runner", "text"]],
  check_controls: [["check_id", "text"], ["control", "text"]],
  results: [["id", "text"], ["check_id", "text"], ["subject", "text"], ["status", "text"], ["severity", "text"], ["reason", "text"], ["observed_at", "timestamp"]],
  result_controls: [["result", "text"], ["control", "text"]],
  findings: [["id", "text"], ["result", "text"], ["check_id", "text"], ["subject", "text"], ["status", "text"], ["severity", "text"], ["title", "text"]],
  evidence: [["id", "text"], ["subject", "text"], ["type", "text"], ["digest", "text"], ["media_type", "text"], ["size", "int"], ["observed_at", "timestamp"]],
  attestations: [["id", "text"], ["subject", "text"], ["check_id", "text"], ["claim", "text"], ["attester", "text"], ["role", "text"]],
  exceptions: [["id", "text"], ["excuses_type", "text"], ["excuses_ref", "text"], ["reason", "text"], ["approved_by", "text"], ["granted_at", "timestamp"], ["expires_at", "timestamp"]],
  risks: [["id", "text"], ["title", "text"], ["level", "text"], ["treatment", "text"], ["owner", "text"], ["review_by", "timestamp"]],
  risk_controls: [["risk", "text"], ["control", "text"]],
  control_state: [["control", "text"], ["status", "text"], ["coverage", "text"], ["freshness", "text"], ["newest_at", "timestamp"], ["risk", "text"]],
};

/** The catalog of the relations, with the type of each column. */
export function catalogOf(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", int: "int", timestamp: "timestamp" });
}

const table = (name: string, rows: readonly (readonly Value[])[]): Table => ({ columns: (SCHEMA[name] ?? []).map(([c]) => c), rows });

/** The relations of the records, the state of the controls being at the instant `at`. */
export function relationsOf(records: Records, at?: string): Readonly<Record<string, Table>> {
  const out: Record<string, Table> = {};
  const lists = <T extends { readonly id: string }>(items: readonly T[], of: (t: T) => readonly string[]): readonly (readonly Value[])[] => items.flatMap((t) => of(t).map((c) => [t.id, c]));
  out["frameworks"] = table("frameworks", records.frameworks.map((f: Framework) => [f.id, f.version, f.title]));
  out["controls"] = table("controls", records.frameworks.flatMap((f: Framework) => f.controls.map((c) => [controlUrn(f.id, f.version, c.id), f.id, c.id, c.title, c.family ?? null])));
  out["checks"] = table("checks", records.checks.map((c: Check) => [c.id, c.ask, c.severity ?? null, c.freshness, c.runner.kind]));
  out["check_controls"] = table("check_controls", lists(records.checks, (c) => c.controls));
  out["results"] = table("results", records.results.map((r) => [r.id, r.check, r.subject, r.status, r.severity, r.reason, r.observedAt]));
  out["result_controls"] = table("result_controls", lists(records.results, (r) => r.controls));
  out["findings"] = table("findings", (records.findings ?? []).map((f) => [f.id, f.result, f.check, f.subject, f.status, f.severity, f.title]));
  out["evidence"] = table("evidence", (records.evidence ?? []).map((e) => [e.id, e.subject, e.type, e.digest, e.mediaType, e.size, e.observedAt]));
  out["attestations"] = table("attestations", (records.attestations ?? []).map((a) => [a.id, a.subject, a.check, a.claim, a.attester, a.role]));
  out["exceptions"] = table("exceptions", records.exceptions.map((e: Exception) => [e.id, e.excuses.type, e.excuses.ref, e.reason, e.approvedBy, e.grantedAt, e.expiresAt]));
  out["risks"] = table("risks", records.risks.map((r) => [r.id, r.title, r.level, r.treatment, r.owner, r.reviewBy]));
  out["risk_controls"] = table("risk_controls", lists(records.risks, (r) => r.controls));
  const instant = at ?? latestInstant(records);
  const view = instant === undefined ? undefined : asOf(records, instant);
  out["control_state"] = table("control_state", view === undefined || view.kind === "err" ? [] : view.value.controls.map((c) => [c.control, c.status, c.coverage, c.freshness, c.newestAt ?? null, c.risk ?? null]));
  return out;
}

/** The answer to one read-only question over the records, or why it is refused (with its place) or cannot be answered. */
export function queryRecords(records: Records, sql: string, options: QueryOptions = {}): Result<Answer, string> {
  const checked = guard(sql, astsql, { catalog: catalogOf() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const tables = relationsOf(records, options.at);
  const lookup = new Map(Object.entries(tables));
  const engine = createEngine((name) => lookup.get(name.toLowerCase()));
  const r = engine.run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
