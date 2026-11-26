/**
 * Tests of the Redfish connector (0002-redfish-connector FR-001 to FR-012): the governance as data, the links it follows and their bounds, the observation of a made-up controller (no vendor extension kept), the identity keys for the estate, a gap where a document cannot be read, an error where the
 * controller is silent, the conformance suite of Integrations, and the read port of the physical layer with a recorded transport that cannot write.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { keysOfProps, sightingsOf, storedOf } from "@intellectual-frontiers/estate/logical";
import { observationCodec } from "@intellectual-frontiers/estate/physical";
import { parseInstant } from "@intellectual-frontiers/integrations/governance";
import { conformConnector, secretOf, type Json, type ReadPort } from "@intellectual-frontiers/integrations/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { LINK_BOUNDS, pathAllowed, redfishGovernance } from "../src/governance/mod.ts";
import { redfishConnector } from "../src/logical/mod.ts";
import { redfishReadPort } from "../src/physical/mod.ts";

const NOW = (() => {
  const r = parseInstant("2026-11-26T10:00:00Z");
  if (r.kind === "err") throw new Error("instant");
  return r.value;
})();
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const link = (id: string): Json => ({ "@odata.id": id });

function docs(): Record<string, Json> {
  return {
    "/redfish/v1/": { Name: "Root", Systems: link("/redfish/v1/Systems"), Chassis: link("/redfish/v1/Chassis"), Managers: link("/redfish/v1/Managers"), UpdateService: link("/redfish/v1/UpdateService") },
    "/redfish/v1/Systems": { Members: [link("/redfish/v1/Systems/1")] },
    "/redfish/v1/Systems/1": {
      Id: "1", Name: "synthetic-system-01", HostName: "synthetic-host-01", Manufacturer: "Synthetic Maker", Model: "SYN-R100", SerialNumber: "SYN-BMC-0001", UUID: "0123abcd-4567-89ef-0123-456789abcdef",
      PowerState: "On", BiosVersion: "9.9.9", Status: { Health: "OK", State: "Enabled" }, EthernetInterfaces: link("/redfish/v1/Systems/1/EthernetInterfaces"),
      Oem: { Synthetic: { AssetTag: "must-not-appear", Token: "must-not-appear-either" } },
    },
    "/redfish/v1/Systems/1/EthernetInterfaces": { Members: [link("/redfish/v1/Systems/1/EthernetInterfaces/1")] },
    "/redfish/v1/Systems/1/EthernetInterfaces/1": { Id: "1", MACAddress: "02:00:5E:10:00:09", PermanentMACAddress: "02-00-5E-10-00-0A" },
    "/redfish/v1/Chassis": { Members: [link("/redfish/v1/Chassis/1")] },
    "/redfish/v1/Chassis/1": { Id: "1", Model: "SYN-CHASSIS" },
    "/redfish/v1/Managers": { Members: [link("/redfish/v1/Managers/1")] },
    "/redfish/v1/Managers/1": { Id: "1", FirmwareVersion: "2.30" },
    "/redfish/v1/UpdateService": { FirmwareInventory: link("/redfish/v1/UpdateService/FirmwareInventory") },
    "/redfish/v1/UpdateService/FirmwareInventory": { Members: [link("/redfish/v1/UpdateService/FirmwareInventory/BIOS")] },
    "/redfish/v1/UpdateService/FirmwareInventory/BIOS": { Id: "BIOS", Version: "9.9.9" },
  };
}

const portOf = (d: Record<string, Json>, denied: readonly string[] = [], asked: string[] = []): ReadPort => ({
  get: (p) => {
    asked.push(p);
    if (denied.includes(p)) return Promise.resolve(err({ kind: "denied" as const, subject: p }));
    const v = d[p];
    return Promise.resolve(v === undefined ? err({ kind: "not-found" as const, subject: p }) : ok(v));
  },
  pages: async function* () {
    return ok(0);
  },
});

proves(["0002-redfish-connector FR-001"], "the governance is read-only, a network device, of pinned HTTPS to the hosts given, with a plain user and a secret password and no token endpoint", () => {
  const g = must(redfishGovernance("Synthetic-Site-01", ["synthetic-bmc-01.example.test"]));
  assertEquals(g.contract, { writes: "never", tokenEndpoints: [] });
  assertEquals(g.class, "network-device");
  assert(g.transport.kind === "https" && g.transport.tls.kind === "pinned" && g.transport.tls.origin === "trust-on-first-use");
  assertEquals(g.credential.fields.map((f) => `${f.name}:${f.secret}`), ["user:false", "password:true"]);
  assert(g.scope.grants.every((x) => x.access === "read"));
  assertEquals(redfishGovernance("a", ["not a host"]).kind, "err");
  assertEquals(must(redfishConnector("a", ["x.example.test"])).describe().readOnly, true);
});

proves(["0002-redfish-connector FR-002"], "a path is allowed only under the root of the service, with no query and no dot-dot", () => {
  assert(pathAllowed("/redfish/v1/") && pathAllowed("/redfish/v1/Systems/1"));
  assert(!pathAllowed("/etc/passwd") && !pathAllowed("/redfish/v1/../x") && !pathAllowed("/redfish/v1/Systems?$expand=*") && !pathAllowed("/redfish/v2/"));
  assert(LINK_BOUNDS.maxMembers > 0 && LINK_BOUNDS.maxDepth > 0);
});

proves(["0002-redfish-connector FR-003"], "the observation has the model, serial, UUID, power, health, firmware and hardware address of each system and keeps no vendor extension", async () => {
  const c = must(redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]));
  const o = await c.observe({ port: portOf(docs()), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture, { "controller-answers": true, systems: 1, "systems-unhealthy": 0, "systems-power-off": 0, "firmware-known": true, "firmware-items": 2 });
  const device = o.value.records?.[0];
  assertEquals(device?.props, { machineId: "0123abcd456789ef0123456789abcdef", serial: "SYN-BMC-0001", mac: "02:00:5e:10:00:0a", vendor: "Synthetic Maker", model: "SYN-R100", biosVersion: "9.9.9", powerState: "On", health: "OK" });
  assertEquals(o.value.gaps, []);
  const text = JSON.stringify(o.value);
  assert(!text.includes("must-not-appear") && !text.includes("Oem") && !text.includes("AssetTag"));
  assertEquals(c.check(o.value, NOW).filter((r) => r.id.startsWith("redfish-")).map((r) => r.status), ["pass", "pass", "pass"]);
});

proves(["0002-redfish-connector FR-004"], "a system that is not healthy fails its policy, and a collection past the bound of members is cut", async () => {
  const d = docs();
  d["/redfish/v1/Systems/1"] = { ...(d["/redfish/v1/Systems/1"] as object), Status: { Health: "Critical" } } as Json;
  const c = must(redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]));
  const o = await c.observe({ port: portOf(d), now: NOW });
  assert(o.kind === "ok");
  assertEquals(c.check(o.value, NOW).find((r) => r.id === "redfish-systems-healthy")?.status, "fail");
  const many = docs();
  many["/redfish/v1/Systems"] = { Members: Array.from({ length: LINK_BOUNDS.maxMembers + 10 }, (_v, i) => link(`/redfish/v1/Systems/${i}`)) };
  const asked: string[] = [];
  await c.observe({ port: portOf(many, [], asked), now: NOW });
  assert(asked.filter((p) => /^\/redfish\/v1\/Systems\/\d+$/u.test(p)).length <= LINK_BOUNDS.maxMembers);
});

proves(["0002-redfish-connector FR-005"], "the keys of a system for the estate are its machine id, serial and hardware address, and the sighting and the stored document are valid for the estate", async () => {
  const c = must(redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]));
  const o = await c.observe({ port: portOf(docs()), now: NOW });
  assert(o.kind === "ok");
  const seen = { at: o.value.at, provider: o.value.provider, account: o.value.account, posture: o.value.posture, records: o.value.records ?? [] };
  assertEquals(keysOfProps(seen.records[0]?.props ?? {}).map((k) => k.kind), ["machine-id", "serial", "mac"]);
  assertEquals(sightingsOf(seen, "synthetic-relay-01", "redfish").length, 1);
  assert(observationCodec.encode(storedOf(seen, "synthetic-asset-01")).kind === "ok");
});

proves(["0002-redfish-connector FR-006"], "a document that cannot be read is a gap and the rest is observed, and a controller that does not answer is an error", async () => {
  const c = must(redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]));
  const o = await c.observe({ port: portOf(docs(), ["/redfish/v1/Managers", "/redfish/v1/Systems/1/EthernetInterfaces"]), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.gaps.map((g) => `${g.kind}:${g.subject}`).sort(), ["denied:/redfish/v1/Managers", "denied:/redfish/v1/Systems/1/EthernetInterfaces"]);
  assertEquals(o.value.records?.[0]?.props["mac"], undefined);
  assertEquals((await c.observe({ port: portOf({}), now: NOW })).kind, "err");
  assertEquals(JSON.stringify(o).includes("secret"), false);
});

proves(["0002-redfish-connector FR-007"], "the conformance suite finds nothing over the recorded controller, and each observation is the same twice", async () => {
  const c = must(redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]));
  const findings = await conformConnector(c, [{ name: "synthetic-bmc-01", port: portOf(docs()), now: NOW, expect: { account: "synthetic-site-01", posture: { systems: 1, "controller-answers": true }, labels: { device: 1 }, policies: { "redfish-systems-healthy": "pass" } } }]);
  assertEquals(findings, []);
});

proves(["0002-redfish-connector FR-012"], "the read port asks with HTTP basic authentication, only with safe methods, and gives the document", async () => {
  const sent: { method: string; url: string; auth: string | undefined }[] = [];
  const port = redfishReadPort({
    transport: { kind: "recorded" as const, send: (r) => { sent.push({ method: r.method, url: r.url, auth: r.headers?.["authorization"] }); return Promise.resolve(ok({ method: r.method, url: r.url, status: 200, headers: {}, body: JSON.stringify({ Name: "Root" }) })); } },
    base: "https://synthetic-bmc-01.example.test",
    user: "synthetic-reader",
    password: secretOf("synthetic-password"),
  });
  assertEquals(must(await port.get("/redfish/v1/")), { Name: "Root" });
  assertEquals(sent[0]?.method, "GET");
  assertEquals(sent[0]?.auth, `Basic ${btoa("synthetic-reader:synthetic-password")}`);
});
