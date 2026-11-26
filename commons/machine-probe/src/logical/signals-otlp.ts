// Spec: 0009-machine-probe-signals FR-005
/**
 * The mapped signals as OTLP batches (0009-machine-probe-signals FR-005, FR-007, FR-008): the metrics as one metric batch, each signal and attribute named by an entry of `SEMCONV`, and the gaps as log records
 * `if.probe.gap`. A counter is cumulative, as the system gives it, and a value that is not a number never reaches here. Pure: the instant is the observation's.
 *
 * @module
 */
import { SEVERITY, type Attributes, type LogRecord, type Metric, type NumberPoint } from "@intellectual-frontiers/telemetry/otel";
import type { LogBatch, MetricBatch } from "@intellectual-frontiers/telemetry/otlp";
import { semconvEntry } from "@intellectual-frontiers/telemetry/semconv";
import type { DeclaredSignal, Mapped } from "./signals.ts";

const SCOPE = { name: "machine-probe" } as const;

const nanos = (iso: string): bigint => BigInt(Date.parse(iso)) * 1_000_000n;

/** Names that are not entries of the table of conventions, each a finding of a test and never a string typed at the place of use (FR-005). */
export function namesOutsideTable(m: Mapped): readonly string[] {
  const names = new Set<string>([...Object.keys(m.resource), ...m.signals.map((s) => s.name), ...m.signals.flatMap((s) => Object.keys(s.attributes))]);
  return [...names].filter((n) => semconvEntry(n) === undefined).sort();
}

/** The metrics of a mapping as one batch of the resource given beside the mapper's own (the exporter supplies `if.asset.id` and `if.level`). */
export function toMetricBatch(m: Mapped, resource: Readonly<Record<string, string>> = {}): MetricBatch {
  const groups = new Map<string, DeclaredSignal[]>();
  for (const s of m.signals) groups.set(s.name, [...(groups.get(s.name) ?? []), s]);
  const metrics: Metric[] = [...groups.entries()].map(([name, list]) => {
    const first = list[0] as DeclaredSignal;
    const points: NumberPoint[] = list.map((s) => ({ attributes: s.attributes as Attributes, startTime: nanos(s.at), time: nanos(s.at), value: s.value }));
    const entry = semconvEntry(name);
    const data: Metric["data"] =
      first.kind === "gauge"
        ? { kind: "gauge", points }
        : { kind: "sum", temporality: "cumulative", monotonic: first.kind === "counter", points };
    return { name, description: entry?.note ?? "", unit: first.unit, data };
  });
  return { resource: { attributes: { ...m.resource, ...resource } }, scope: SCOPE, metrics };
}

/** The gaps of a mapping as log records `if.probe.gap`, naming the table and no value (FR-007). */
export function toGapLogBatch(m: Mapped, at: string, resource: Readonly<Record<string, string>> = {}): LogBatch {
  const records: LogRecord[] = m.gaps.map((g) => ({
    time: nanos(at),
    observedTime: nanos(at),
    severityNumber: SEVERITY.WARN,
    severityText: "WARN",
    body: `if.probe.gap: ${g.table} ${g.why}`,
    attributes: { "if.probe.table": g.table },
    droppedAttributesCount: 0,
    eventName: "if.probe.gap",
  }));
  return { resource: { attributes: { ...m.resource, ...resource } }, scope: SCOPE, records };
}
