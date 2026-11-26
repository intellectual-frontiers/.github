/**
 * Tests of syslog as log records and of our own small relay (0003-telemetry-reach FR-025): the two formats, a line that is neither, the batches by host, and a relay that sends with its token and keeps what it could not send.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { createConnection } from "node:net";
import { startSyslogRelay } from "../src/physical/relay.ts";
import { decodeLogs } from "../src/logical/otlp.ts";
import { logBatchesOf, parseSyslog, severityOf } from "../src/logical/syslog.ts";

const S = "0003-telemetry-reach FR-025";
const NOW = Date.UTC(2026, 10, 26, 10, 0, 0);

proves([S], "RFC 5424 and RFC 3164 lines are read into their parts and a line that is neither is kept whole", () => {
  const a = parseSyslog("<34>1 2026-11-26T10:00:00Z synthetic-switch-01 sshd 812 ID47 - Failed password for user");
  assertEquals([a.facility, a.severity, a.host, a.app, a.message, a.time, a.parsed], [4, 2, "synthetic-switch-01", "sshd", "Failed password for user", NOW, true]);
  const b = parseSyslog("<13>Nov 26 10:00:00 synthetic-router-01 kernel[1]: link down", NOW);
  assertEquals([b.facility, b.severity, b.host, b.app, b.message, b.time], [1, 5, "synthetic-router-01", "kernel", "link down", NOW]);
  const c = parseSyslog("no priority at all");
  assertEquals([c.parsed, c.message, c.host], [false, "no priority at all", ""]);
  const d = parseSyslog("<14>something odd");
  assertEquals([d.parsed, d.message], [false, "something odd"]);
  assertEquals([0, 2, 3, 4, 5, 6, 7].map(severityOf), [21, 21, 17, 13, 9, 9, 5]);
});

proves([S], "the lines of one host are one log batch with the device key as the line said it and no relay id", () => {
  const lines = ["<34>1 2026-11-26T10:00:00Z synthetic-a sshd 1 - - one", "<34>1 2026-11-26T10:00:01Z synthetic-b sshd 1 - - two", "<34>1 2026-11-26T10:00:02Z synthetic-a sshd 1 - - three"].map((l) => parseSyslog(l));
  const batches = logBatchesOf(lines, NOW);
  assertEquals(batches.length, 2);
  assertEquals(batches[0]?.resource.attributes["host.name"], "synthetic-a");
  assertEquals(batches[0]?.records.length, 2);
  assert(batches.every((b) => b.resource.attributes["if.relay.id"] === undefined && b.resource.attributes["if.asset.id"] === undefined));
  assertEquals(batches[0]?.records[0]?.attributes["syslog.severity"], 2);
});

const send = (port: number, text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const c = createConnection({ host: "127.0.0.1", port }, () => c.end(text));
    c.on("close", () => resolve());
    c.on("error", reject);
  });

proves([S], "a relay sends the lines it took as OTLP logs with its token, keeps them while the controller answers 503 and sends them once it answers", async () => {
  const seen: { url: string; authorization: string | null; body: string }[] = [];
  let status = 503;
  const fake = (async (url: URL, init: RequestInit) => {
    seen.push({ url: String(url), authorization: new Headers(init.headers).get("authorization"), body: String(init.body) });
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  const relay = await startSyslogRelay({ port: 0, host: "127.0.0.1", controller: "http://127.0.0.1:14318", token: "synthetic-relay-token", flushMs: 3_600_000, now: () => NOW, fetch: fake });
  try {
    await send(relay.address.port, "<34>1 2026-11-26T10:00:00Z synthetic-switch-01 sshd 1 - - one\n<34>1 2026-11-26T10:00:01Z synthetic-switch-01 sshd 1 - - two\n");
    await new Promise((r) => setTimeout(r, 100));
    const first = await relay.flush();
    assertEquals(first, { sent: 0, waiting: 2 });
    status = 200;
    const second = await relay.flush();
    assertEquals(second, { sent: 2, waiting: 0 });
    assertEquals(seen.at(-1)?.url, "http://127.0.0.1:14318/v1/logs");
    assertEquals(seen.at(-1)?.authorization, "Bearer synthetic-relay-token");
    const decoded = decodeLogs(JSON.parse(seen.at(-1)?.body ?? "{}"));
    assert(decoded.kind === "ok");
    if (decoded.kind === "ok") {
      assertEquals(decoded.value[0]?.records.map((r) => r.body), ["one", "two"]);
      assertEquals(decoded.value[0]?.resource.attributes["host.name"], "synthetic-switch-01");
    }
    assert(!JSON.stringify(seen.at(-1)?.body).includes("synthetic-relay-token"), "the token is in the header only");
  } finally {
    await relay.stop();
  }
});

proves([S], "a relay keeps at most its cap while the controller is away, drops the oldest and counts them", async () => {
  const fake = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
  const relay = await startSyslogRelay({ port: 0, host: "127.0.0.1", controller: "http://127.0.0.1:1", token: "synthetic-relay-token", flushMs: 3_600_000, maxLines: 3, now: () => NOW, fetch: fake });
  try {
    await send(relay.address.port, Array.from({ length: 5 }, (_, i) => `<14>1 2026-11-26T10:00:0${i}Z synthetic-a app 1 - - line ${i}\n`).join(""));
    await new Promise((r) => setTimeout(r, 100));
    assertEquals(await relay.flush(), { sent: 0, waiting: 3 });
    assertEquals(relay.dropped(), 2);
  } finally {
    await relay.stop();
  }
});
