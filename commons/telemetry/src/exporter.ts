// Spec: 0003-telemetry-reach FR-020
/**
 * The program of an asset of level 3, as one round (0003-telemetry-reach FR-020, FR-022): collect the batches the caller's probe gives, add the drops and the health of the queue, make each a signed envelope with the
 * next sequence number, enqueue it, and drain the queue in order. The clock, the random source, the queue, the signer, the sequence store, the collector and the sender are given (`ExporterDeps`), so that a test is exact and
 * the library names no probe, no store and no network. It needs no Collector and runs on Bun and Node 26.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type EnvelopeSigner, type Sequence, newEpoch, nextSeq, sealBatch } from "./envelope.ts";
import type { Metric } from "./otel.ts";
import type { LogBatch, MetricBatch } from "./otlp.ts";
import { encodeLogs, encodeMetrics } from "./otlp.ts";
import { type Drained, drain, droppedMetric, type QueueSignal, type SegmentQueue, type SendSegment, outcomeOfStatus } from "./queue.ts";

/** What the caller's probe gave in this round. */
export type Collected = { readonly metrics?: MetricBatch; readonly logs?: LogBatch };

/** The state of the forward of R4: the exporter does not open it (FR-013). */
export type ForwardState = "up" | "down" | "reconnecting" | "none";

/** Where the sequence of the device is kept with the queue, so that it survives a restart (FR-009). */
export interface SequenceStore {
  load(): Promise<Sequence | undefined>;
  save(sequence: Sequence): Promise<void>;
}

/** What the program is given. */
export type ExporterDeps = {
  readonly device: string;
  readonly now: () => number;
  readonly random: () => Uint8Array;
  readonly queue: SegmentQueue;
  readonly signer: EnvelopeSigner;
  readonly sequence: SequenceStore;
  readonly collect: () => Promise<Collected>;
  readonly send: SendSegment;
  readonly forward?: () => ForwardState;
};

/** What a round did. `drained` is `undefined` where the forward is down: the batches wait in the queue and nothing fails (FR-013). */
export type Round = { readonly queued: number; readonly drained: Drained | undefined; readonly forward: ForwardState };

const nanos = (ms: number): bigint => BigInt(Math.trunc(ms)) * 1_000_000n;

function healthMetric(count: number, oldestAgeMs: number | undefined, ms: number): readonly Metric[] {
  const point = (value: number): { attributes: Record<string, never>; startTime: bigint; time: bigint; value: number } => ({ attributes: {}, startTime: nanos(ms), time: nanos(ms), value });
  const out: Metric[] = [{ name: "if.telemetry.queue.length", description: "Segments waiting in the queue.", unit: "{segment}", data: { kind: "gauge", points: [point(count)] } }];
  if (oldestAgeMs !== undefined) out.push({ name: "if.telemetry.queue.age", description: "Age of the oldest segment in the queue.", unit: "s", data: { kind: "gauge", points: [point(oldestAgeMs / 1000)] } });
  return out;
}

/** One round of the exporter: collect, seal, enqueue, drain. A sealing or queue failure is the error; a failed send keeps the segments in order. */
export async function exportOnce(deps: ExporterDeps): Promise<Result<Round, string>> {
  let seq = (await deps.sequence.load()) ?? newEpoch(deps.random());
  const collected = await deps.collect();
  const ms = deps.now();
  const drops = await deps.queue.takeDropped();
  const stats = await deps.queue.stats();
  const extra: Metric[] = [];
  if (drops.kind === "ok") {
    const d = droppedMetric(drops.value, nanos(ms));
    if (d !== undefined) extra.push(d);
  }
  if (stats.kind === "ok") extra.push(...healthMetric(stats.value.count, stats.value.oldestAgeMs, ms));
  const resource = collected.metrics?.resource ?? { attributes: {} };
  const parts: { signal: QueueSignal; json: string; count: number }[] = [];
  const metrics: MetricBatch = { resource, scope: collected.metrics?.scope ?? { name: "exporter" }, metrics: [...(collected.metrics?.metrics ?? []), ...extra] };
  parts.push({ signal: "metrics", json: JSON.stringify(encodeMetrics([metrics])), count: metrics.metrics.length });
  if (collected.logs !== undefined && collected.logs.records.length > 0) parts.push({ signal: "logs", json: JSON.stringify(encodeLogs([collected.logs])), count: collected.logs.records.length });
  let queued = 0;
  for (const part of parts) {
    const [n, after] = nextSeq(seq);
    seq = after;
    const sealed = await sealBatch(part.json, { device: deps.device, signal: part.signal, epoch: seq.epoch, seq: n, at: ms, count: part.count }, deps.signer);
    if (sealed.kind === "err") return err(`the batch could not be signed: ${sealed.error}`);
    const q = await deps.queue.enqueue(new TextEncoder().encode(JSON.stringify(sealed.value)), { signal: part.signal, at: ms, count: part.count });
    if (q.kind === "err") return err(`the batch could not be queued: ${q.error.message}`);
    queued += 1;
  }
  await deps.sequence.save(seq);
  const forward = deps.forward?.() ?? "none";
  if (forward === "down" || forward === "reconnecting") return ok({ queued, drained: undefined, forward });
  const drained = await drain(deps.queue, deps.send);
  if (drained.kind === "err") return err(drained.error.message);
  return ok({ queued, drained: drained.value, forward });
}

/**
 * A sender over `fetch` to the receiver at `base` (`http://127.0.0.1:<port>` for the forward of R4): it posts the segment (a signed envelope) as `application/vnd.ifc.telemetry+json`, and turns the answer to an outcome
 * by `outcomeOfStatus`; a network failure is a retry. With `loopbackOnly` it refuses any address that is not loopback and puts no credential in a header (FR-013).
 */
export function httpSender(
  base: string,
  options: { readonly loopbackOnly?: boolean; readonly headers?: Readonly<Record<string, string>>; readonly fetch?: typeof fetch } = {},
): Result<SendSegment, string> {
  const url = new URL(base);
  if (options.loopbackOnly === true && url.hostname !== "127.0.0.1" && url.hostname !== "localhost" && url.hostname !== "[::1]") {
    return err(`${url.hostname} is not loopback: the forward carries nothing to another address`);
  }
  const doFetch = options.fetch ?? fetch;
  return ok(async (segment) => {
    try {
      const res = await doFetch(new URL(`/v1/${segment.meta.signal}`, url), {
        method: "POST",
        headers: { "content-type": "application/vnd.ifc.telemetry+json", ...(options.headers ?? {}) },
        body: new TextDecoder().decode(segment.bytes),
      });
      const after = Number(res.headers.get("retry-after"));
      const o = outcomeOfStatus(res.status, Number.isFinite(after) && after > 0 ? after * 1000 : undefined);
      await res.body?.cancel().catch(() => undefined);
      return o;
    } catch (e) {
      return { kind: "retry", message: e instanceof Error ? e.message : String(e) };
    }
  });
}
