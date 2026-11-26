// Spec: 0003-telemetry-reach FR-002
/**
 * The durable export queue behind a port (0003-telemetry-reach FR-002 to FR-007): `SegmentQueue` is the port, `queueExporter`
 * is an `Exporter` that encodes each export request as OTLP JSON and enqueues it before it answers, `drain` sends the oldest segment first and acknowledges it only after the receiver took it, and
 * The pure rule of the policy and the queue over a store are `@intellectual-frontiers/anyfs/queue`.
 *
 * @remarks
 * A segment is delivered at least once; the receiver drops a batch whose device and sequence number it already took (FR-007). The queue holds encoded batches only, never a credential (FR-005).
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import { type Metric, redactAttributes, type Resource } from "./otel.ts";
import { encodeLogs, encodeMetrics, encodeTraces, type LogBatch, type MetricBatch, type TraceBatch } from "./otlp.ts";
import type { ExportResult, Exporter } from "./signals.ts";

/** The signal a segment carries. */
export type QueueSignal = "traces" | "logs" | "metrics";

/** What a segment is, beside its bytes: the signal, the instant it was made and the count of signals in it. */
export type SegmentMeta = { readonly signal: QueueSignal; readonly at: number; readonly count: number };

/** A segment as the queue holds it. */
export type Segment = { readonly id: string; readonly bytes: Uint8Array; readonly meta: SegmentMeta };

/** Why the queue refused or failed. */
export type QueueProblem = { readonly kind: "full" | "store"; readonly message: string };

/** What a queue holds: the count of segments, their bytes and the age of the oldest in milliseconds (`undefined` where it is empty). */
export type QueueStats = { readonly count: number; readonly bytes: number; readonly oldestAgeMs: number | undefined };

/** What was dropped since the last `takeDropped`, by signal (FR-004). */
export type Dropped = Readonly<Record<QueueSignal, number>>;

/** The port of a durable queue of encoded batches, in order, for one writer and one reader. */
export interface SegmentQueue {
  /** Appends a segment; where the policy says refuse and the queue is full it gives `full`. */
  enqueue(bytes: Uint8Array, meta: SegmentMeta): Promise<Result<string, QueueProblem>>;
  /** The oldest segments, in order, at most `limit`. */
  peek(limit: number): Promise<Result<readonly Segment[], QueueProblem>>;
  /** Removes a segment; it succeeds where the segment is already gone. */
  ack(id: string): Promise<Result<undefined, QueueProblem>>;
  /** The count, the bytes and the age of the oldest. */
  stats(): Promise<Result<QueueStats, QueueProblem>>;
  /** The drops since the last call, reset by it, so that the next batch can report them. */
  takeDropped(): Promise<Result<Dropped, QueueProblem>>;
}

/** What to do when the queue is full. */
export type OnFull = "drop-oldest" | "refuse-new";

/** The cap of a queue (FR-004). */
export type QueuePolicy = { readonly maxBytes: number; readonly maxAgeMs: number; readonly onFull: OnFull };

/** A queue that holds 64 MiB for a day and drops the oldest. */
export const DEFAULT_QUEUE_POLICY: QueuePolicy = { maxBytes: 64 * 1024 * 1024, maxAgeMs: 24 * 60 * 60 * 1000, onFull: "drop-oldest" };

/** The empty count of drops. */
export const NO_DROPS: Dropped = { traces: 0, logs: 0, metrics: 0 };

/** The total of a count of drops. */
export function totalDropped(d: Dropped): number {
  return d.traces + d.logs + d.metrics;
}

/**
 * The metric `if.telemetry.dropped` for the drops of a queue (FR-004): a cumulative-free sum of the segments dropped since the last report, one point for each signal that lost one, or `undefined` where none was
 * dropped. The exporter adds it to its next batch, so that a drop is never silent.
 */
export function droppedMetric(drops: Dropped, time: bigint): Metric | undefined {
  const points = (["traces", "logs", "metrics"] as const)
    .filter((signal) => drops[signal] > 0)
    .map((signal) => ({ attributes: { "if.telemetry.signal": signal }, startTime: time, time, value: BigInt(drops[signal]) }));
  if (points.length === 0) return undefined;
  return {
    name: "if.telemetry.dropped",
    description: "Segments the queue dropped, by the kind of signal.",
    unit: "{segment}",
    data: { kind: "sum", temporality: "delta", monotonic: true, points },
  };
}

const utf8 = new TextEncoder();

const redactedResources = <B extends { readonly resource: Resource }>(batches: readonly B[]): readonly B[] =>
  batches.map((b) => ({ ...b, resource: { attributes: redactAttributes(b.resource.attributes) } }));

/** What turns an encoded batch into the bytes that wait in the queue: the batch itself, or a signed envelope of it. It is given the signal, the encoded JSON and the count of signals. */
export type Wrap = (signal: QueueSignal, json: string, count: number) => Promise<Result<Uint8Array, string>>;

/**
 * An `Exporter` that encodes each export request as OTLP JSON, wraps it (a signed envelope, FR-008) and enqueues it before it answers success (FR-003); it answers failure only where the queue or the wrap refused.
 * Resource attributes are redacted before the batch is encoded, so that nothing a redaction would remove is at rest in the queue (FR-005).
 */
export function queueExporter(queue: SegmentQueue, now: () => number, wrap: Wrap = (_s, json) => Promise.resolve(ok(utf8.encode(json)))): Exporter {
  const put = async (signal: QueueSignal, body: object, count: number): Promise<ExportResult> => {
    const w = await wrap(signal, JSON.stringify(body), count);
    if (w.kind === "err") return { kind: "failure", message: w.error };
    const r = await queue.enqueue(w.value, { signal, at: now(), count });
    return r.kind === "ok" ? { kind: "success" } : { kind: "failure", message: r.error.message };
  };
  const total = (n: readonly { readonly spans?: readonly unknown[]; readonly records?: readonly unknown[]; readonly metrics?: readonly unknown[] }[]): number =>
    n.reduce((a, b) => a + (b.spans?.length ?? b.records?.length ?? b.metrics?.length ?? 0), 0);
  return {
    exportTraces: (b: readonly TraceBatch[]) => put("traces", encodeTraces(redactedResources(b)), total(b)),
    exportLogs: (b: readonly LogBatch[]) => put("logs", encodeLogs(redactedResources(b)), total(b)),
    exportMetrics: (b: readonly MetricBatch[]) => put("metrics", encodeMetrics(redactedResources(b)), total(b)),
    shutdown: () => Promise.resolve(),
  };
}

/** What sending one segment came to. `refused` is a permanent refusal (a 4xx other than 429): the segment is removed and counted, because a segment that can never be taken would stop the queue. */
export type SendOutcome =
  | { readonly kind: "taken" }
  | { readonly kind: "retry"; readonly afterMs?: number; readonly message: string }
  | { readonly kind: "refused"; readonly message: string };

/** What sends one segment: the HTTP client, the SSH forward or a test. It never throws. */
export type SendSegment = (segment: Segment) => Promise<SendOutcome>;

/** The outcome of an HTTP status (FR-003): 2xx taken; 429, 502, 503 and 504 retry; any other is a permanent refusal. */
export function outcomeOfStatus(status: number, retryAfterMs?: number): SendOutcome {
  if (status >= 200 && status < 300) return { kind: "taken" };
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return { kind: "retry", message: `HTTP ${status}`, ...(retryAfterMs === undefined ? {} : { afterMs: retryAfterMs }) };
  }
  return { kind: "refused", message: `HTTP ${status}` };
}

/** What a drain did. `waitMs` is how long to wait before the next try where it stopped on a retry. */
export type Drained = {
  readonly sent: number;
  readonly refused: number;
  readonly remaining: number;
  readonly stopped: { readonly message: string; readonly waitMs: number | undefined } | undefined;
};

/** Sends the oldest segment first and removes it only after it was taken; on a retry it stops and keeps every segment in order (FR-003); a queue problem is the error. */
export async function drain(queue: SegmentQueue, send: SendSegment, limit = 100): Promise<Result<Drained, QueueProblem>> {
  const p = await queue.peek(limit);
  if (p.kind === "err") return p;
  let sent = 0;
  let refused = 0;
  for (const segment of p.value) {
    const o = await send(segment);
    if (o.kind === "retry") {
      const s = await queue.stats();
      return ok({ sent, refused, remaining: s.kind === "ok" ? s.value.count : p.value.length - sent - refused, stopped: { message: o.message, waitMs: o.afterMs } });
    }
    const a = await queue.ack(segment.id);
    if (a.kind === "err") return a;
    if (o.kind === "taken") sent += 1;
    else refused += 1;
  }
  const s = await queue.stats();
  return ok({ sent, refused, remaining: s.kind === "ok" ? s.value.count : 0, stopped: undefined });
}
