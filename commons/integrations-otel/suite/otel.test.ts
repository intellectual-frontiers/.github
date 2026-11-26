/**
 * Tests of the OTel connector (0002-otel-connector FR-001 to FR-008): the governance with no secret field, the fold of kept batches into devices with the latest host metrics and the counts of log records (no body), the sightings of devices no asset holds, the gap in a sequence,
 * the same observation twice, the watermark, and the read port of a folder of kept batches.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { machineIdKey } from "@intellectual-frontiers/estate/governance";
import { sightingsOf, storedOf } from "@intellectual-frontiers/estate/logical";
import { observationCodec } from "@intellectual-frontiers/estate/physical";
import { parseInstant } from "@intellectual-frontiers/integrations/governance";
import { conformConnector, type Json, type ReadPort } from "@intellectual-frontiers/integrations/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { eventClassOf, otelGovernance, severityOf } from "../src/governance/mod.ts";
import { otelConnector } from "../src/logical/mod.ts";
import { receiverStorePort } from "../src/physical/mod.ts";

const NOW = (() => {
  const r = parseInstant("2026-11-26T10:00:00Z");
  if (r.kind === "err") throw new Error("instant");
  return r.value;
})();
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

const MACHINE = "0123456789abcdef0123456789abcdef";
const batch = (seq: number, device: string, at: string, resource: Record<string, string>, metrics: Json[] = [], records: Json[] = []): Json => ({ seq, device, at, resource, metrics, records });

function batches(): Json[] {
  return [
    batch(1, "synthetic-asset-01", "2026-11-26T09:50:00Z", { "if.asset.id": "synthetic-asset-01", "host.id": MACHINE, "host.name": "synthetic-host-01" }, [{ name: "system.uptime", value: 100 }, { name: "system.memory.utilization", value: 0.4 }, { name: "process.cpu.time", value: 9 }]),
    batch(2, "synthetic-asset-01", "2026-11-26T09:55:00Z", { "if.asset.id": "synthetic-asset-01" }, [{ name: "system.uptime", value: 400 }], [{ severity: "WARN", event: "if.probe.gap", body: "must-not-appear table x" }, { severity: "INFO", event: "other.event", body: "must-not-appear either" }]),
    batch(4, "synthetic-asset-01", "2026-11-26T09:58:00Z", { "if.asset.id": "synthetic-asset-01" }, [{ name: "system.uptime", value: 700 }], [{ severity: "ERROR", event: "x" }]),
    batch(3, "relay:synthetic-relay-01/mac-02005e100077", "2026-11-26T09:57:00Z", { "if.relay.id": "synthetic-relay-01", "if.relay.protocol": "syslog", "host.mac": "02:00:5E:10:00:77", "host.name": "synthetic-switch-07" }, [], [{ severity: "INFO", event: "link", body: "must-not-appear link up" }]),
    batch(5, "synthetic-asset-02", "2026-11-26T08:00:00Z", { "host.id": MACHINE.replace(/0/gu, "a") }, [{ name: "system.uptime", value: 5 }]),
  ];
}

const portOf = (items: readonly Json[], denied = false): ReadPort => ({
  get: () => Promise.resolve(err({ kind: "not-found" as const, subject: "x" })),
  pages: async function* (p) {
    if (denied) return err({ kind: "denied" as const, subject: p });
    const since = Number(new URL(p, "file:///").searchParams.get("since") ?? "0");
    for (const i of items) if (((i as { seq: number }).seq) > since) yield i;
    return ok(items.length);
  },
});

const known = [{ id: "synthetic-asset-02", keys: [must(machineIdKey(MACHINE.replace(/0/gu, "a")))] }];
const connector = (since = 0): ReturnType<typeof otelConnector> => otelConnector("synthetic-site-01", { since, known });

proves(["0002-otel-connector FR-001"], "the governance is read-only, local and has a credential with no secret field, and a log body is a denied field", () => {
  const g = must(otelGovernance("Synthetic-Site-01"));
  assertEquals(g.transport, { kind: "local" });
  assertEquals(g.contract.writes, "never");
  assert(g.credential.fields.length === 1 && g.credential.fields.every((f) => !f.secret));
  assertEquals(g.class, "network-device");
  assert(g.denylist.patterns.some((p) => p.text === "body"));
  assertEquals(must(connector()).describe().readOnly, true);
});

proves(["0002-otel-connector FR-002"], "the severities, the classes of event and the host metrics are closed lists", () => {
  assertEquals(severityOf("WARN"), "warn");
  assertEquals(severityOf("loud"), undefined);
  assertEquals(eventClassOf("if.probe.gap"), "probe-gap");
  assertEquals(eventClassOf("anything"), "other");
});

proves(["0002-otel-connector FR-003"], "a device record is made for each asset or set of keys with the latest host metrics only, and a device that no asset holds is told", async () => {
  const c = must(connector());
  const o = await c.observe({ port: portOf(batches()), now: NOW });
  assert(o.kind === "ok");
  const by = (id: string) => o.value.records?.find((r) => r.native_id === id);
  assertEquals(by("synthetic-asset-01")?.props["metric.system.uptime"], 700);
  assertEquals(by("synthetic-asset-01")?.props["metric.system.memory.utilization"], 0.4);
  assertEquals(by("synthetic-asset-01")?.props["metric.process.cpu.time"], undefined);
  assertEquals(by("synthetic-asset-01")?.props["asset"], "synthetic-asset-01");
  assertEquals(by("synthetic-asset-02")?.props["asset"], "synthetic-asset-02", "held by its keys");
  assertEquals(by("relay:synthetic-relay-01/mac-02005e100077")?.props["asset"], undefined);
  assertEquals(o.value.posture["devices"], 3);
  assertEquals(o.value.posture["unidentified-devices"], 1);
  assertEquals(o.value.posture["devices-silent"], 1);
  assertEquals(o.value.posture["watermark"], 5);
});

proves(["0002-otel-connector FR-004"], "log records are counted by severity and class and no body or attribute is kept", async () => {
  const o = await must(connector()).observe({ port: portOf(batches()), now: NOW });
  assert(o.kind === "ok");
  const p = o.value.records?.find((r) => r.native_id === "synthetic-asset-01")?.props ?? {};
  assertEquals([p["logs.warn"], p["logs.info"], p["logs.error"], p["logs.probe-gap"], p["logs.other"]], [1, 1, 1, 1, 2]);
  assert(!JSON.stringify(o.value).includes("must-not-appear"));
  assertEquals(o.value.posture["logs-warn"], 1);
  assertEquals(o.value.posture["logs-error"], 1);
});

proves(["0002-otel-connector FR-005"], "a device no asset holds is one sighting with the relay and the protocol the relay recorded, resolved by its keys", async () => {
  const o = await must(connector()).observe({ port: portOf(batches()), now: NOW });
  assert(o.kind === "ok");
  const seen = { at: o.value.at, provider: o.value.provider, account: o.value.account, posture: o.value.posture, records: o.value.records ?? [] };
  const s = sightingsOf(seen, "controller", "otlp");
  assertEquals(s.map((x) => x.provenance), ["relay:synthetic-relay-01/syslog#mac:02:00:5e:10:00:77"]);
  assert(observationCodec.encode(storedOf(seen, "synthetic-asset-01")).kind === "ok");
});

proves(["0002-otel-connector FR-006"], "the same batches and watermark give the same observation, a watermark leaves out what was seen, and a missing sequence number is a gap that names the device and the range", async () => {
  const c = must(connector());
  const a = await c.observe({ port: portOf(batches()), now: NOW });
  const b = await c.observe({ port: portOf(batches()), now: NOW });
  assertEquals(JSON.stringify(a), JSON.stringify(b));
  assert(a.kind === "ok");
  assertEquals(a.value.gaps.map((g) => g.subject), ["synthetic-asset-01 sequence 3-3"]);
  assertEquals(a.value.posture["sequence-gaps"], 1);
  const later = await must(connector(3)).observe({ port: portOf(batches()), now: NOW });
  assert(later.kind === "ok");
  assertEquals(later.value.posture["batches"], 2);
  assertEquals(later.value.posture["watermark"], 5);
  assertEquals(c.check(a.value, NOW).filter((r) => r.id.startsWith("otel-")).map((r) => `${r.id}:${r.status}`), ["otel-devices-heard:warn", "otel-no-sequence-gaps:warn", "otel-devices-identified:warn"]);
});

proves(["0002-otel-connector FR-007"], "a store that is denied is a gap and an unreachable one an error, and the conformance suite finds nothing", async () => {
  const c = must(connector());
  const denied = await c.observe({ port: portOf(batches(), true), now: NOW });
  assert(denied.kind === "ok");
  assertEquals(denied.value.gaps.length, 1);
  assertEquals(await conformConnector(c, [{ name: "synthetic-store", port: portOf(batches()), now: NOW, expect: { account: "synthetic-site-01", posture: { devices: 3, watermark: 5 }, labels: { device: 3 }, policies: { "otel-devices-heard": "warn" } } }]), []);
});

proves(["0002-otel-connector FR-008"], "the read port of a folder gives the batches above the watermark in order and leaves out a file that is not one", async () => {
  const dir = await fs.makeTempDir({ prefix: "otel-store-" });
  try {
    for (const b of batches()) await fs.writeTextFile(path.join(dir, `${(b as { seq: number }).seq}.json`), JSON.stringify(b));
    await fs.writeTextFile(path.join(dir, "notes.txt"), "x");
    await fs.writeTextFile(path.join(dir, "9.json"), "not json");
    const got: number[] = [];
    for await (const j of receiverStorePort(dir).pages("/batches?since=2")) got.push((j as { seq: number }).seq);
    assertEquals(got, [3, 4, 5]);
    const o = await must(connector()).observe({ port: receiverStorePort(dir), now: NOW });
    assert(o.kind === "ok");
    assertEquals(o.value.posture["batches"], 5);
    const missing = await must(connector()).observe({ port: receiverStorePort(path.join(dir, "absent")), now: NOW });
    assertEquals(missing.kind, "err");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});
