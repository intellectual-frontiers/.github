// Spec: 0002-telemetry-query FR-001, FR-002, FR-003
/**
 * Questions of captured signals in SQL (commons telemetry 0002-telemetry-query): the spans, the log records and the metric points of a journal or of any OTLP batches, made into relations, and a read-only SQL answered over them with the SQL
 * language library (its guard judges that the text is one read and binds it to the catalog, its engine answers). Pure: it is given the batches it reads, so that the slowest spans, the errors of a service and the logs of one trace are one line of SQL each.
 *
 * @example
 * ```ts
 * import { querySignals } from "@intellectual-frontiers/telemetry/query";
 * // querySignals(signals, "SELECT name, duration_ms FROM spans ORDER BY duration_ms DESC LIMIT 5");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import type { AnyValue, Attributes, AttributeValue } from "./otel.ts";
import type { LogBatch, MetricBatch, TraceBatch } from "./otlp.ts";

/** What a question is about: the batches of each signal. */
export type Signals = { readonly traces?: readonly TraceBatch[]; readonly logs?: readonly LogBatch[]; readonly metrics?: readonly MetricBatch[] };

/** What may be given to a question. */
export type QueryOptions = { readonly limit?: number; readonly params?: readonly Value[] };

/** What a question gives. */
export type Answer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  spans: [["trace_id", "text"], ["span_id", "text"], ["parent_span_id", "text"], ["name", "text"], ["kind", "text"], ["service", "text"], ["scope", "text"], ["start_time", "timestamp"], ["duration_ms", "float"], ["status", "text"], ["status_message", "text"]],
  span_attributes: [["trace_id", "text"], ["span_id", "text"], ["key", "text"], ["value", "text"]],
  span_events: [["trace_id", "text"], ["span_id", "text"], ["name", "text"], ["time", "timestamp"]],
  logs: [["time", "timestamp"], ["service", "text"], ["scope", "text"], ["severity", "int"], ["severity_text", "text"], ["event_name", "text"], ["body", "text"], ["trace_id", "text"], ["span_id", "text"]],
  metric_points: [["name", "text"], ["unit", "text"], ["kind", "text"], ["service", "text"], ["time", "timestamp"], ["value", "float"], ["count", "int"], ["attributes", "text"]],
};

/** The catalog of the relations. */
export function signalsCatalog(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", int: "int", float: "float", timestamp: "timestamp" });
}

/** A time in nanoseconds since the epoch as an ISO 8601 instant, to the millisecond; the epoch for a time that is not a date. */
function instant(ns: bigint): string {
  const d = new Date(Number(ns / 1_000_000n));
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/** A value of a signal as text: a string as it is, a number or a boolean as JSON writes it, a list or a map as JSON (a byte string as base 16). */
function textOf(v: AnyValue | AttributeValue): string {
  if (typeof v === "string") return v;
  if (typeof v === "bigint" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x instanceof Uint8Array ? [...x].map((b) => b.toString(16).padStart(2, "0")).join("") : x));
}

const serviceOf = (a: Attributes): string | null => {
  const s = a["service.name"];
  return typeof s === "string" ? s : null;
};

/** The relations of the signals: a span lasts from its start to its end, in milliseconds; a metric point holds a number (a histogram's sum, and its count). */
export function signalsRelations(signals: Signals): Readonly<Record<string, Table>> {
  const columns = (name: string): readonly string[] => (SCHEMA[name] ?? []).map(([c]) => c);
  const spans: (readonly Value[])[] = [];
  const attributes: (readonly Value[])[] = [];
  const events: (readonly Value[])[] = [];
  const logs: (readonly Value[])[] = [];
  const points: (readonly Value[])[] = [];
  for (const b of signals.traces ?? []) {
    const service = serviceOf(b.resource.attributes);
    for (const s of b.spans) {
      const t = s.context.traceId;
      const id = s.context.spanId;
      spans.push([t, id, s.parentSpanId ?? null, s.name, s.kind, service, b.scope.name, instant(s.startTime), Number(s.endTime - s.startTime) / 1_000_000, s.status.kind, s.status.kind === "error" ? s.status.message : null]);
      for (const [k, v] of Object.entries(s.attributes)) attributes.push([t, id, k, textOf(v)]);
      for (const e of s.events) events.push([t, id, e.name, instant(e.time)]);
    }
  }
  for (const b of signals.logs ?? []) {
    const service = serviceOf(b.resource.attributes);
    for (const r of b.records) logs.push([instant(r.time), service, b.scope.name, r.severityNumber, r.severityText, r.eventName ?? null, r.body === undefined ? null : textOf(r.body), r.traceId ?? null, r.spanId ?? null]);
  }
  for (const b of signals.metrics ?? []) {
    const service = serviceOf(b.resource.attributes);
    for (const m of b.metrics) {
      if (m.data.kind === "histogram") for (const p of m.data.points) points.push([m.name, m.unit, "histogram", service, instant(p.time), p.sum ?? null, p.count, textOf(p.attributes)]);
      else for (const p of m.data.points) points.push([m.name, m.unit, m.data.kind, service, instant(p.time), Number(p.value), null, textOf(p.attributes)]);
    }
  }
  return {
    spans: { columns: columns("spans"), rows: spans },
    span_attributes: { columns: columns("span_attributes"), rows: attributes },
    span_events: { columns: columns("span_events"), rows: events },
    logs: { columns: columns("logs"), rows: logs },
    metric_points: { columns: columns("metric_points"), rows: points },
  };
}

/** The answer to one read-only question over the signals, or why it is refused (with its place) or cannot be answered. */
export function querySignals(signals: Signals, sql: string, options: QueryOptions = {}): Result<Answer, string> {
  const checked = guard(sql, astsql, { catalog: signalsCatalog() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const lookup = new Map(Object.entries(signalsRelations(signals)));
  const r = createEngine((name) => lookup.get(name.toLowerCase())).run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
