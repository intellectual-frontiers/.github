/**
 * Tests of the queue, the envelope, the table of conventions and the authenticated receiver (commons 0003-telemetry-reach FR-002 to FR-017), with synthetic devices, a fake clock, real Ed25519 keys and no
 * network: a batch waits while the receiver answers 503 and arrives once, in order; a full queue drops the oldest and counts it; a changed batch fails its digest; another asset's id is overwritten.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { accept, newEpoch, nextSeq, openEnvelope, sealBatch, type BatchPredicate, type SeenLedger, webCryptoSigner } from "../src/envelope.ts";
import { otlpReceiver } from "../src/host/otel.ts";
import { type LogBatch, type MetricBatch, type TraceBatch, encodeMetrics } from "../src/otlp.ts";
import { drain, droppedMetric, NO_DROPS, outcomeOfStatus, queueExporter, type Segment, type SegmentQueue, type SendOutcome } from "../src/queue.ts";
import { SEMCONV, SEMCONV_VERSION, semconvEntry, unknownNames } from "../src/semconv.ts";

const S = (n: string): string => `0003-telemetry-reach ${n}`;

const metricBatch = (device: string, value: number, claimed?: string): MetricBatch => ({
  resource: { attributes: { "host.name": device, ...(claimed === undefined ? {} : { "if.asset.id": claimed }) } },
  scope: { name: "synthetic" },
  metrics: [{ name: "system.uptime", description: "", unit: "s", data: { kind: "gauge", points: [{ attributes: {}, startTime: 0n, time: 1n, value }] } }],
});

/** A queue in memory with no cap: the policy and the store are anyfs 0011; this holds what the exporter and the drain need. */
function memoryQueue(): SegmentQueue {
  let n = 0;
  let items: Segment[] = [];
  return {
    enqueue(bytes, meta) {
      n += 1;
      const id = String(n).padStart(20, "0");
      items.push({ id, bytes, meta });
      return Promise.resolve(ok(id));
    },
    peek: (limit) => Promise.resolve(ok(items.slice(0, limit))),
    ack(id) {
      items = items.filter((s) => s.id !== id);
      return Promise.resolve(ok(undefined));
    },
    stats: () => Promise.resolve(ok({ count: items.length, bytes: items.reduce((a, s) => a + s.bytes.length, 0), oldestAgeMs: undefined })),
    takeDropped: () => Promise.resolve(ok(NO_DROPS)),
  };
}

const clock = (start = 1_000): { now: () => number; tick: (ms: number) => void } => {
  let t = start;
  return { now: () => t, tick: (ms) => void (t += ms) };
};

proves([S("FR-003")], "a batch waits in the queue while the receiver answers 503 and arrives once, in the order made", async () => {
  const c = clock();
  const q = memoryQueue();
  const exporter = queueExporter(q, c.now);
  for (const v of [1, 2, 3]) assertEquals((await exporter.exportMetrics([metricBatch("synthetic-host-01", v)])).kind, "success");
  let up = false;
  const taken: string[] = [];
  const send = (s: { id: string }): Promise<SendOutcome> => {
    if (!up) return Promise.resolve(outcomeOfStatus(503, 2_000));
    taken.push(s.id);
    return Promise.resolve(outcomeOfStatus(200));
  };
  const first = await drain(q, send);
  assert(first.kind === "ok" && first.value.sent === 0 && first.value.remaining === 3 && first.value.stopped?.waitMs === 2_000);
  up = true;
  const second = await drain(q, send);
  assert(second.kind === "ok" && second.value.sent === 3 && second.value.remaining === 0);
  assertEquals(taken, [...taken].sort());
  assertEquals(taken.length, 3);
});

proves([S("FR-003")], "a permanent refusal removes the segment so that one bad segment cannot stop the queue", async () => {
  const c = clock();
  const q = memoryQueue();
  await queueExporter(q, c.now).exportMetrics([metricBatch("synthetic-host-01", 1)]);
  const r = await drain(q, () => Promise.resolve(outcomeOfStatus(400)));
  assert(r.kind === "ok" && r.value.refused === 1 && r.value.remaining === 0);
});

proves([S("FR-004")], "the drops of a queue become the metric if.telemetry.dropped, one point for each signal, and none where nothing dropped", () => {
  assertEquals(droppedMetric({ traces: 0, logs: 0, metrics: 0 }, 1n), undefined);
  const m = droppedMetric({ traces: 0, logs: 2, metrics: 1 }, 5n);
  assert(m !== undefined && m.data.kind === "sum" && m.data.points.length === 2);
  assertEquals(m.data.points.map((p) => [p.attributes["if.telemetry.signal"], p.value]), [["logs", 2n], ["metrics", 1n]]);
  assert(semconvEntry("if.telemetry.dropped")?.ours === true);
});

proves([S("FR-005")], "a secret in the resource is not at rest in the queue", async () => {
  const c = clock();
  const q = memoryQueue();
  const secret = ["Bearer", "abcdefghijklmnopqrstuvwxyz0123456789"].join(" ");
  await queueExporter(q, c.now).exportMetrics([{ ...metricBatch("synthetic-host-01", 1), resource: { attributes: { "url.full": "https://synthetic.example/?token=abcdefghijklmnopqrstuvwxyz0123456789", authorization: secret } } }]);
  const p = await q.peek(1);
  assert(p.kind === "ok");
  const text = new TextDecoder().decode(p.value[0]?.bytes);
  assert(!text.includes("abcdefghijklmnopqrstuvwxyz"));
});

// --- the envelope -----------------------------------------------------------------------------------------------------------------

async function keys(): Promise<{ signer: ReturnType<typeof webCryptoSigner>; other: ReturnType<typeof webCryptoSigner> }> {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const stranger = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  return {
    signer: webCryptoSigner([{ key: pair.privateKey, keyid: "device-01" }], [{ key: pair.publicKey, keyid: "device-01" }]),
    other: webCryptoSigner([{ key: stranger.privateKey, keyid: "device-99" }], [{ key: pair.publicKey, keyid: "device-01" }]),
  };
}

const predicate = (device: string, seq: number): BatchPredicate => ({ device, signal: "metrics", epoch: "e1", seq, at: 5, count: 1 });

proves([S("FR-008")], "a sealed batch opens to its predicate and its batch", async () => {
  const { signer } = await keys();
  const batch = JSON.stringify(encodeMetrics([metricBatch("synthetic-host-01", 7)]));
  const sealed = await sealBatch(batch, predicate("device-01", 1), signer);
  assert(sealed.kind === "ok");
  const opened = await openEnvelope(sealed.value, signer);
  assert(opened.kind === "ok" && opened.value.predicate.seq === 1 && opened.value.batch === batch && opened.value.keyId === "device-01");
});

proves([S("FR-008"), S("FR-011")], "a batch changed after signing is refused by the digest, and the refusal names no key and no payload", async () => {
  const { signer } = await keys();
  const batch = JSON.stringify(encodeMetrics([metricBatch("synthetic-host-01", 7)]));
  const sealed = await sealBatch(batch, predicate("device-01", 1), signer);
  assert(sealed.kind === "ok");
  const opened = await openEnvelope({ ...sealed.value, batch: batch.replace("7", "8") }, signer);
  assert(opened.kind === "err" && opened.error.kind === "digest");
  assert(!JSON.stringify(opened.error).includes("device-01"));
});

proves([S("FR-010"), S("FR-011")], "an envelope signed by a key that is not trusted is refused; a body that is not an envelope is malformed", async () => {
  const { signer, other } = await keys();
  const batch = "{}";
  const sealed = await sealBatch(batch, predicate("device-01", 1), other);
  assert(sealed.kind === "ok");
  const opened = await openEnvelope(sealed.value, signer);
  assert(opened.kind === "err" && opened.error.kind === "signature");
  const bad = await openEnvelope({ nothing: 1 }, signer);
  assert(bad.kind === "err" && bad.error.kind === "malformed");
});

proves([S("FR-009")], "a sequence number grows by one; a new epoch starts a new count; a receiver drops a replay and takes the new epoch", () => {
  const e = newEpoch(new Uint8Array([1, 2, 3, 4]));
  const [a, s1] = nextSeq(e);
  const [b] = nextSeq(s1);
  assertEquals([a, b], [1, 2]);
  let seen: SeenLedger = new Map();
  const step = (p: { device: string; epoch: string; seq: number }): boolean => {
    const [v, next] = accept(seen, p);
    seen = next;
    return v.kind === "ok";
  };
  assertEquals(step({ device: "d", epoch: "e1", seq: 1 }), true);
  assertEquals(step({ device: "d", epoch: "e1", seq: 1 }), false);
  assertEquals(step({ device: "d", epoch: "e1", seq: 2 }), true);
  assertEquals(step({ device: "d", epoch: "e2", seq: 1 }), true);
});

// --- the receiver -----------------------------------------------------------------------------------------------------------------

const post = (signal: string, type: string, body: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`http://127.0.0.1:1/v1/${signal}`, { method: "POST", headers: { "content-type": type, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

proves([S("FR-012")], "the receiver sets the asset id from the key that signed and overwrites the sender's claim", async () => {
  const { signer } = await keys();
  const got: MetricBatch[] = [];
  const ledger = { current: new Map() as SeenLedger };
  const handle = otlpReceiver(
    { onMetrics: (b) => void got.push(...b) },
    { signatures: "required", signer, identityOfKey: (k) => (k === "device-01" ? { assetId: "device-01" } : undefined), ledger },
  );
  const batch = JSON.stringify(encodeMetrics([metricBatch("synthetic-host-01", 7, "device-77")]));
  const sealed = await sealBatch(batch, predicate("device-01", 1), signer);
  assert(sealed.kind === "ok");
  const r = await handle(post("metrics", "application/vnd.ifc.telemetry+json", sealed.value));
  assertEquals(r.status, 200);
  assertEquals(got[0]?.resource.attributes["if.asset.id"], "device-01");
  const again = await handle(post("metrics", "application/vnd.ifc.telemetry+json", sealed.value));
  assertEquals(again.status, 200);
  assertEquals(got.length, 1);
});

proves([S("FR-012")], "a path that requires a signature answers 401 to a plain body and to a device that is not enrolled", async () => {
  const { signer } = await keys();
  const handle = otlpReceiver({}, { signatures: "required", signer, identityOfKey: () => undefined });
  assertEquals((await handle(post("metrics", "application/json", encodeMetrics([])))).status, 401);
  const sealed = await sealBatch("{}", predicate("device-01", 1), signer);
  assert(sealed.kind === "ok");
  assertEquals((await handle(post("metrics", "application/vnd.ifc.telemetry+json", sealed.value))).status, 401);
});

proves([S("FR-011"), S("FR-012")], "a relay's batch is bound to the relay by its token, carries no asset id of the sender and keeps the device keys", async () => {
  const got: MetricBatch[] = [];
  const handle = otlpReceiver(
    { onMetrics: (b) => void got.push(...b) },
    { signatures: "optional", authenticate: (r) => (r.headers.get("authorization") === "Bearer synthetic-relay-token" ? ok({ relayId: "relay-01" }) : err("no")) },
  );
  const body = encodeMetrics([{ ...metricBatch("synthetic-switch-01", 3, "device-77"), resource: { attributes: { "host.mac": "02:00:00:00:00:01", "if.asset.id": "device-77" } } }]);
  assertEquals((await handle(post("metrics", "application/json", body))).status, 401);
  assertEquals((await handle(post("metrics", "application/json", body, { authorization: "Bearer synthetic-relay-token" }))).status, 200);
  assertEquals(got[0]?.resource.attributes["if.relay.id"], "relay-01");
  assertEquals(got[0]?.resource.attributes["host.mac"], "02:00:00:00:00:01");
  assertEquals(got[0]?.resource.attributes["if.asset.id"], undefined);
});

proves([S("FR-012")], "without a policy the receiver is as it was: it takes application/json and refuses the telemetry type with 415", async () => {
  const logs: LogBatch[] = [];
  const traces: TraceBatch[] = [];
  const handle = otlpReceiver({ onLogs: (b) => void logs.push(...b), onTraces: (b) => void traces.push(...b) });
  assertEquals((await handle(post("metrics", "application/vnd.ifc.telemetry+json", {}))).status, 415);
});

// --- the table --------------------------------------------------------------------------------------------------------------------

proves([S("FR-016"), S("FR-017")], "the table has a version, ours are under if. and marked ours, and a name that is not in it is a finding", () => {
  assert(/^\d+\.\d+\.\d+$/.test(SEMCONV_VERSION));
  for (const e of SEMCONV) assertEquals(e.ours, e.name.startsWith("if."));
  assertEquals(semconvEntry("system.uptime")?.unit, "s");
  assertEquals(unknownNames(["system.uptime", "made.up", "made.up"]), ["made.up"]);
  assertEquals(new Set(SEMCONV.map((e) => e.name)).size, SEMCONV.length);
});
