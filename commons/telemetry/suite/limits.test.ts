/**
 * Tests of the limits and the retention of a receiver (0003-telemetry-reach FR-023, FR-024), with a fake clock and synthetic sources.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { DEFAULT_SOURCE_LIMITS, limitProblems, newLimiter, take } from "../src/logical/limits.ts";
import { DEFAULT_RETENTION, expired, retentionProblems } from "../src/logical/retention.ts";
import { otlpReceiver } from "../src/physical/otel.ts";
import { encodeMetrics, type MetricBatch } from "../src/logical/otlp.ts";
import { err, ok } from "@intellectual-frontiers/core";

const S = (n: string): string => `0003-telemetry-reach ${n}`;
const batch = (n: number): MetricBatch => ({
  resource: { attributes: { "host.name": "synthetic-host-01" } },
  scope: { name: "synthetic" },
  metrics: [{ name: "system.uptime", description: "", unit: "s", data: { kind: "gauge", points: [{ attributes: {}, startTime: 0n, time: 1n, value: n }] } }],
});
const post = (body: unknown, headers: Record<string, string> = {}): Request => new Request("http://127.0.0.1:1/v1/metrics", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic-relay-token", ...headers }, body: JSON.stringify(body) });
const ID = (r: Request) => (r.headers.get("authorization") === "Bearer synthetic-relay-token" ? ok({ relayId: "relay-01" }) : err("no"));

proves([S("FR-023")], "a source has a burst, then the rate, and the wait it is told is when one more is allowed; sources are separate", () => {
  let l = newLimiter({ maxBodyBytes: 1000, burst: 2, perSecond: 1 });
  const go = (source: string, at: number) => {
    const t = take(l, source, at);
    l = t.limiter;
    return t;
  };
  assertEquals(go("device-01", 0).kind, "taken");
  assertEquals(go("device-01", 0).kind, "taken");
  const third = go("device-01", 0);
  assertEquals(third.kind, "limited");
  assertEquals(third.kind === "limited" ? third.retryAfterMs : -1, 1000);
  assertEquals(go("device-02", 0).kind, "taken", "another source has its own allowance");
  assertEquals(go("device-01", 500).kind, "limited");
  assertEquals(go("device-01", 1000).kind, "taken", "one more after a second");
  assertEquals(limitProblems(DEFAULT_SOURCE_LIMITS), []);
  assert(limitProblems({ maxBodyBytes: 0, burst: 0, perSecond: 0 }).length === 3);
});

proves([S("FR-023")], "the receiver answers 429 with Retry-After over the limit and takes the batch again when the wait is over, and 413 over the body limit", async () => {
  let now = 0;
  const got: MetricBatch[] = [];
  const handle = otlpReceiver({ onMetrics: (b) => void got.push(...b) }, { signatures: "optional", authenticate: ID, limits: { limits: { maxBodyBytes: 2000, burst: 1, perSecond: 1 }, now: () => now } });
  const body = encodeMetrics([batch(1)]);
  assertEquals((await handle(post(body))).status, 200);
  const over = await handle(post(body));
  assertEquals(over.status, 429);
  assertEquals(over.headers.get("retry-after"), "1");
  assert(JSON.stringify(await over.json()).includes("E-TELEM-RATE-LIMITED"));
  assertEquals(got.length, 1, "the batch over the limit reached no sink");
  now = 1000;
  assertEquals((await handle(post(body))).status, 200);
  assertEquals(got.length, 2);
  const big = encodeMetrics(Array.from({ length: 200 }, (_, i) => batch(i)));
  now = 5000;
  const declared = await handle(post(big, { "content-length": String(JSON.stringify(big).length) }));
  assertEquals(declared.status, 413);
  assertEquals(declared.headers.get("connection"), "close", "a body refused by its size is not read, so the connection closes");
  assertEquals((await handle(new Request("http://127.0.0.1:1/v1/metrics", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic-relay-token" }, body: JSON.stringify(big) }))).status, 413, "also by the length read");
});

proves([S("FR-023")], "a source that is not identified is refused before its limit is spent", async () => {
  const handle = otlpReceiver({}, { signatures: "optional", authenticate: ID, limits: { limits: { maxBodyBytes: 2000, burst: 1, perSecond: 1 }, now: () => 0 } });
  for (let i = 0; i < 3; i += 1) assertEquals((await handle(post(encodeMetrics([]), { authorization: "Bearer nobody" }))).status, 401);
  assertEquals((await handle(post(encodeMetrics([])))).status, 200);
});

proves([S("FR-024")], "retention is days per kind, a summary outlives the raw signals, and a record is past its period only after it", () => {
  assertEquals(DEFAULT_RETENTION, { raw: 30, summary: 395 });
  assertEquals(retentionProblems(DEFAULT_RETENTION), []);
  assert(retentionProblems({ raw: 30, summary: 10 }).length === 1, "a summary shorter than raw");
  assert(retentionProblems({ raw: 0, summary: 1.5 }).length >= 2);
  const day = 86_400_000;
  assertEquals(expired(DEFAULT_RETENTION, "raw", 0, 30 * day), false);
  assertEquals(expired(DEFAULT_RETENTION, "raw", 0, 30 * day + 1), true);
  assertEquals(expired(DEFAULT_RETENTION, "summary", 0, 31 * day), false);
});
