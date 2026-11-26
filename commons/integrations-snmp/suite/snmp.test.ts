/**
 * Tests of the SNMP connector (0002-snmp-connector FR-001 to FR-011): the governance as data, the security that is refused, the BER of the messages, the user-based security model, a session with a device made for the tests (discovery, a time window, a wrong
 * user, a changed answer), the bounded walk, the observation of a made-up switch, its identity keys for the estate, the gap and the error, and the conformance suite of Integrations.
 *
 * @module
 */
import { parseInstant } from "@intellectual-frontiers/integrations/governance";
import { conformConnector, type Json } from "@intellectual-frontiers/integrations/logical";
import { keysOfProps, sightingsOf, storedOf } from "@intellectual-frontiers/estate/logical";
import { observationCodec } from "@intellectual-frontiers/estate/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { ALLOWED_SUBTREES, DEFAULT_BOUNDS, authOf, oidAllowed, privOf, securityProblems, snmpGovernance } from "../src/governance/mod.ts";
import { bytesOfHex, decode, encode, hexOf, type Ber } from "../src/logical/ber.ts";
import { decodeMessage } from "../src/logical/message.ts";
import { snmpConnector } from "../src/logical/connector.ts";
import { jsonOf, snmpReadPort, type Pace } from "../src/logical/port.ts";
import { openSession, type SessionCredential, type SessionEnv } from "../src/logical/session.ts";
import { discoveryRequest, keysFor, MAC_LENGTH, openAnswer, passwordToKey, sealRequest } from "../src/logical/usm.ts";
import { nodeEnv, nodePrimitives } from "../src/physical/node.ts";
import { fakeDevice, num, switchMib, text } from "./agent.ts";

const NOW = (() => {
  const r = parseInstant("2026-11-26T10:00:00Z");
  if (r.kind === "err") throw new Error("instant");
  return r.value;
})();
const ENGINE = Uint8Array.from([0x80, 0x00, 0x1f, 0x88, 0x80, 0xaa, 0xbb, 0xcc, 0xdd, 0x01]);
const CRED: SessionCredential = { user: "synthetic-reader", protocol: "hmac-sha-256", authPassword: "synthetic-auth-pass", privPassword: "synthetic-priv-pass" };
const DEVICE = { engineId: ENGINE, user: CRED.user, authPassword: CRED.authPassword, privPassword: CRED.privPassword };
const PACE: Pace = { now: () => 0, sleep: () => Promise.resolve() };
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const envOf = (port: SessionEnv["datagram"]): SessionEnv => ({ ...nodeEnv(port), random: (n) => new Uint8Array(n).fill(7) });

proves(["0002-snmp-connector FR-001"], "the governance is read-only, a network device, of the SNMPv3 transport with authentication and privacy, and holds a plain user name and two secrets", () => {
  const g = must(snmpGovernance("Synthetic-Site-01"));
  assertEquals(g.contract.writes, "never");
  assertEquals(g.class, "network-device");
  assertEquals(g.entities, ["device"]);
  assertEquals(g.transport, { kind: "snmp-v3", level: "authPriv" });
  assert(g.credential.ref.includes("synthetic-site-01-read"));
  assertEquals(g.credential.fields.map((f) => `${f.name}:${f.secret}`), ["user:false", "authPassword:true", "privPassword:true"]);
  assert(g.scope.grants.every((x) => x.access === "read") && g.scope.grants.length === ALLOWED_SUBTREES.length);
  assertEquals(must(snmpConnector("a")).describe().readOnly, true);
});

proves(["0002-snmp-connector FR-002"], "version 1 and 2c, MD5, SHA-1 and DES are problems, and SHA-2 with AES-128 on version 3 is not", () => {
  assertEquals(securityProblems({ version: "3", auth: "hmac-sha-256", priv: "aes-128" }), []);
  assertEquals(securityProblems({ version: "2c", auth: "hmac-sha-256", priv: "aes-128" }).map((p) => p.kind), ["version"]);
  assertEquals(securityProblems({ version: "1", auth: "md5", priv: "des" }).map((p) => p.kind), ["version", "auth", "priv"]);
  assertEquals(securityProblems({ version: "3", auth: "sha-1", priv: "aes-128" }).map((p) => p.kind), ["auth"]);
  assertEquals(authOf("MD5"), undefined);
  assertEquals(privOf("DES"), undefined);
  assertEquals(authOf("HMAC-SHA-512"), "hmac-sha-512");
});

proves(["0002-snmp-connector FR-003"], "an object identifier is allowed only at or under a subtree of the list, and the system group is", () => {
  assert(oidAllowed("1.3.6.1.2.1.1.5.0") && oidAllowed("1.3.6.1.2.1.2.2.1.8.4") && oidAllowed("1.3.6.1.2.1.47.1.1.1.1.11.1"));
  assert(!oidAllowed("1.3.6.1.2.1.25.1.1.0") && !oidAllowed("1.3.6.1.2.1.11") && !oidAllowed("1.3.6.1.2.1.1x") && !oidAllowed(""));
  assert(!oidAllowed("1.3.6.1.2.10.1"), "a longer arc that starts with the same digits is not under the subtree");
  assert(DEFAULT_BOUNDS.maxRows > 0 && DEFAULT_BOUNDS.maxMs > 0 && DEFAULT_BOUNDS.maxRequestsPerSecond > 0);
});

proves(["0002-snmp-connector FR-004"], "BER gives the bytes of X.690 for known values, reads what it writes, and refuses what is not one value", () => {
  assertEquals(hexOf(encode({ kind: "int", value: 0n })), "020100");
  assertEquals(hexOf(encode({ kind: "int", value: 128n })), "02020080");
  assertEquals(hexOf(encode({ kind: "int", value: -129n })), "0202ff7f");
  assertEquals(hexOf(encode({ kind: "oid", value: "1.3.6.1.2.1.1.1.0" })), "06082b06010201010100");
  assertEquals(hexOf(encode({ kind: "octets", value: new Uint8Array(200) })).slice(0, 6), "0481c8");
  assertEquals(hexOf(encode({ kind: "octets", value: new Uint8Array(300) })).slice(0, 8), "0482012c");
  const roundtrip = fc.assert(fc.property(fc.bigInt({ min: -(2n ** 63n), max: 2n ** 63n }), fc.uint8Array({ maxLength: 300 }), fc.array(fc.integer({ min: 0, max: 2 ** 31 }), { minLength: 2, maxLength: 8 }), (n, bytes, arcs) => {
    const oid = `1.3.${arcs.join(".")}`;
    const b: Ber = { kind: "seq", items: [{ kind: "int", value: n }, { kind: "octets", value: bytes }, { kind: "oid", value: oid }, { kind: "null" }, { kind: "app", tag: 3, value: Uint8Array.of(1, 2) }, { kind: "exc", tag: 1 }, { kind: "ctx", tag: 2, items: [{ kind: "int", value: 1n }] }] };
    const back = decode(encode(b));
    return back.kind === "ok" && JSON.stringify(back.value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v)) === JSON.stringify(b, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v));
  }));
  assertEquals(roundtrip, undefined);
  assertEquals(decode(Uint8Array.of(0x02, 0x01)).kind, "err");
  assertEquals(decode(Uint8Array.of(0x02, 0x01, 0x00, 0x00)).kind, "err");
  assertEquals(decode(Uint8Array.of(0x30, 0x80, 0x00, 0x00)).kind, "err", "an indefinite length is refused");
  assertEquals(decode(Uint8Array.of(0x06, 0x02, 0x2b, 0x86)).kind, "err", "an object identifier that does not end is refused");
  assertEquals(decode(Uint8Array.of(0x1f, 0x01, 0x00)).kind, "err");
  assertEquals(bytesOfHex("zz"), undefined);
});

proves(["0002-snmp-connector FR-005"], "the key of a password is the hash of one mebibyte, the key of an engine is the hash of key, engine and key, and a short password is refused", () => {
  const ku = passwordToKey(nodePrimitives, "hmac-sha-256", "synthetic-auth-pass");
  assertEquals(ku.length, 32);
  assertEquals(passwordToKey(nodePrimitives, "hmac-sha-256", "synthetic-auth-pass"), ku);
  assert(hexOf(passwordToKey(nodePrimitives, "hmac-sha-256", "synthetic-auth-pasT")) !== hexOf(ku));
  const k = must(keysFor(nodePrimitives, "hmac-sha-256", "synthetic-auth-pass", "synthetic-priv-pass", ENGINE));
  assertEquals(k.auth.length, 32);
  assertEquals(k.priv.length, 16);
  const other = must(keysFor(nodePrimitives, "hmac-sha-256", "synthetic-auth-pass", "synthetic-priv-pass", Uint8Array.from([...ENGINE, 1])));
  assert(hexOf(other.auth) !== hexOf(k.auth), "another engine gives another key");
  assertEquals(keysFor(nodePrimitives, "hmac-sha-256", "short", "synthetic-priv-pass", ENGINE).kind, "err");
  for (const p of ["hmac-sha-224", "hmac-sha-384", "hmac-sha-512"] as const) assertEquals(must(keysFor(nodePrimitives, p, "synthetic-auth-pass", "synthetic-priv-pass", ENGINE)).auth.length, { "hmac-sha-224": 28, "hmac-sha-384": 48, "hmac-sha-512": 64 }[p]);
  assertEquals(MAC_LENGTH["hmac-sha-256"], 24);
});

proves(["0002-snmp-connector FR-005"], "a sealed request is authenticated and enciphered: its digest is checked before it is deciphered and a changed octet, another key or another engine refuses it", () => {
  const k = must(keysFor(nodePrimitives, "hmac-sha-256", "synthetic-auth-pass", "synthetic-priv-pass", ENGINE));
  const scoped = { contextEngineId: ENGINE, contextName: new Uint8Array(), pdu: { type: "get" as const, requestId: 5, errorStatus: 0, errorIndex: 0, varbinds: [{ oid: "1.3.6.1.2.1.1.5.0", value: { kind: "null" as const } }] } };
  const bytes = must(sealRequest(nodePrimitives, k, { msgId: 9, maxSize: 1400, user: "u", engine: { id: ENGINE, boots: 3, time: 40 }, scoped, salt: new Uint8Array(8).fill(1) }));
  const msg = must(decodeMessage(bytes));
  assert(msg.flags.auth && msg.flags.priv && msg.data.kind === "encrypted");
  assert(!hexOf(bytes).includes(hexOf(encode({ kind: "oid", value: "1.3.6.1.2.1.1.5.0" }))), "the object identifier is not in the clear");
  assertEquals(must(openAnswer(nodePrimitives, k, bytes)).scoped.pdu.requestId, 5);
  const flipped = bytes.slice();
  flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 1;
  assertEquals(openAnswer(nodePrimitives, k, flipped).kind, "err");
  const wrong = must(keysFor(nodePrimitives, "hmac-sha-256", "synthetic-auth-pasX", "synthetic-priv-pass", ENGINE));
  assertEquals(openAnswer(nodePrimitives, wrong, bytes).kind, "err");
  assertEquals(openAnswer(nodePrimitives, k, discoveryRequest(1, 1400, 2)).kind, "err", "a message with no authentication is not an answer");
});

proves(["0002-snmp-connector FR-006"], "a session discovers the engine, gets and gets next, and has no way to set", async () => {
  const dev = fakeDevice({ ...DEVICE, mib: switchMib() });
  const s = must(await openSession(envOf(dev.port), CRED));
  assertEquals(hexOf(s.engineId), hexOf(ENGINE));
  const got = must(await s.get(["1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.9.9"]));
  assertEquals(jsonOf(got[0] as { oid: string; value: Ber }), { oid: "1.3.6.1.2.1.1.5.0", type: "octets", text: "synthetic-switch-01", hex: hexOf(new TextEncoder().encode("synthetic-switch-01")) });
  assertEquals((jsonOf(got[1] as { oid: string; value: Ber }) as { type: string }).type, "missing");
  const next = must(await s.getNext("1.3.6.1.2.1.1.1.0"));
  assertEquals(next.oid, "1.3.6.1.2.1.1.2.0");
  assertEquals(dev.seen.discoveries, 1);
  assertEquals(dev.seen.setLike, 0);
  assertEquals(Object.keys(s).sort(), ["engineId", "get", "getNext"]);
});

proves(["0002-snmp-connector FR-006"], "a request that is late is sent again with the time the engine reported, and a wrong user, a wrong password and a changed answer are refused in words that hold no secret", async () => {
  const late = fakeDevice({ ...DEVICE, mib: switchMib(), refuseFirstAsLate: true });
  const s = must(await openSession(envOf(late.port), CRED));
  assertEquals(must(await s.get(["1.3.6.1.2.1.1.5.0"])).length, 1);
  assertEquals(late.seen.requests, 2);
  const dev = fakeDevice({ ...DEVICE, mib: switchMib() });
  const user = must(await openSession(envOf(dev.port), { ...CRED, user: "synthetic-other" }));
  const unknown = await user.get(["1.3.6.1.2.1.1.5.0"]);
  assertEquals(unknown.kind === "err" ? unknown.error : undefined, { kind: "refused", what: "unknown-user" });
  const bad = must(await openSession(envOf(dev.port), { ...CRED, authPassword: "synthetic-auth-pasX" }));
  const refused = await bad.get(["1.3.6.1.2.1.1.5.0"]);
  assertEquals(refused.kind === "err" ? refused.error : undefined, { kind: "refused", what: "wrong-digest" });
  assert(!JSON.stringify(refused).includes("synthetic"), "no password in the failure");
  const tampered = fakeDevice({ ...DEVICE, mib: switchMib(), tamper: true });
  const t = must(await openSession(envOf(tampered.port), CRED));
  const answer = await t.get(["1.3.6.1.2.1.1.5.0"]);
  assertEquals(answer.kind, "err");
  assertEquals((await openSession(envOf({ exchange: () => Promise.resolve({ kind: "err" as const, error: "timeout" as const }) }), CRED)).kind, "err");
  assertEquals((await openSession(envOf(dev.port), { ...CRED, authPassword: "short" })).kind, "err");
});

proves(["0002-snmp-connector FR-007"], "a walk stays in the subtree, inside the allow-list and under its bounds, and a request outside the list is refused before it is sent", async () => {
  const dev = fakeDevice({ ...DEVICE, mib: switchMib() });
  const s = must(await openSession(envOf(dev.port), CRED));
  const port = snmpReadPort(s, DEFAULT_BOUNDS, PACE);
  const rows: Json[] = [];
  const g = port.pages("/1.3.6.1.2.1.2.2.1");
  for (;;) {
    const n = await g.next();
    if (n.done === true) {
      assertEquals(n.value.kind, "ok");
      break;
    }
    rows.push(n.value);
  }
  assertEquals(rows.length, 8);
  const before = dev.seen.requests;
  const denied = await port.get("/1.3.6.1.2.1.25.1.1.0");
  assertEquals(denied.kind === "err" ? denied.error.kind : "", "denied");
  const walkDenied = port.pages("/1.3.6.1.2.1.25").next();
  assertEquals(((await walkDenied).value as { kind: string }).kind, "err");
  assertEquals(dev.seen.requests, before, "nothing was sent for a path outside the list");
  const small = snmpReadPort(s, { ...DEFAULT_BOUNDS, maxRows: 3 }, PACE);
  let n = 0;
  for await (const _ of small.pages("/1.3.6.1.2.1.2.2.1")) n += 1;
  assertEquals(n, 3);
  const slept: number[] = [];
  let clock = 0;
  const paced = snmpReadPort(s, { ...DEFAULT_BOUNDS, maxRequestsPerSecond: 10 }, { now: () => clock, sleep: (ms) => { slept.push(ms); clock += ms; return Promise.resolve(); } });
  for await (const _ of paced.pages("/1.3.6.1.2.1.1")) clock += 0;
  assert(slept.length > 0 && slept.every((ms) => ms <= 100), "requests are spaced by the bound");
  const quick = snmpReadPort(s, { ...DEFAULT_BOUNDS, maxMs: 0 }, { now: (() => { let t = 0; return () => (t += 1); })(), sleep: () => Promise.resolve() });
  let m = 0;
  for await (const _ of quick.pages("/1.3.6.1.2.1.2.2.1")) m += 1;
  assert(m <= 1, "the time bound ends a walk");
});

const observed = async (mib: Record<string, Ber>): Promise<{ port: ReturnType<typeof snmpReadPort>; seen: { requests: number } }> => {
  const dev = fakeDevice({ ...DEVICE, mib });
  const s = must(await openSession(envOf(dev.port), CRED));
  return { port: snmpReadPort(s, DEFAULT_BOUNDS, PACE), seen: dev.seen };
};

proves(["0002-snmp-connector FR-008"], "the observation of a switch has its name, firmware, serial, interfaces and uptime, its policies pass and warn, and no object outside the list was read", async () => {
  const { port } = await observed(switchMib());
  const c = must(snmpConnector("synthetic-site-01"));
  const o = await c.observe({ port, now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture, { "device-answers": true, "firmware-known": true, interfaces: 2, "interfaces-down-unexpectedly": 1, "uptime-seconds": 86400, "has-description": true });
  const device = o.value.records?.find((r) => r.label === "device");
  assertEquals(device?.props["serial"], "SYN-0001");
  assertEquals(device?.props["firmware"], "fw-9.9.9");
  assertEquals(device?.props["model"], "SYN-SW-24");
  assertEquals(device?.props["engineId"], hexOf(ENGINE));
  assertEquals(device?.props["mac"], "02:00:5e:10:00:01");
  assertEquals(o.value.records?.filter((r) => r.label === "interface").length, 2);
  const res = c.check(o.value, NOW);
  assertEquals(res.find((r) => r.id === "snmp-device-answers")?.status, "pass");
  assertEquals(res.find((r) => r.id === "snmp-firmware-known")?.status, "pass");
  assertEquals(res.find((r) => r.id === "snmp-interfaces-up")?.status, "warn");
  assert(!JSON.stringify(o.value).includes("outside the allow-list"));
});

proves(["0002-snmp-connector FR-009"], "the keys of the device for the estate are its serial, engine id and hardware address, and the sighting and the stored document are valid for the estate", async () => {
  const { port } = await observed(switchMib());
  const o = await must(snmpConnector("synthetic-site-01")).observe({ port, now: NOW });
  assert(o.kind === "ok");
  const seen = { at: o.value.at, provider: o.value.provider, account: o.value.account, posture: o.value.posture, records: o.value.records ?? [] };
  assertEquals(keysOfProps(o.value.records?.[0]?.props ?? {}).map((k) => k.kind), ["serial", "snmp-engine-id", "mac"]);
  const s = sightingsOf(seen, "synthetic-relay-01", "snmp");
  assertEquals(s.length, 1);
  assertEquals(s[0]?.protocol, "snmp");
  assert(observationCodec.encode(storedOf(seen, "synthetic-asset-01")).kind === "ok");
});

proves(["0002-snmp-connector FR-010"], "a table the view does not give is a gap and the rest is observed, and a device that does not answer is an error", async () => {
  const mib = switchMib();
  for (const k of Object.keys(mib)) if (k.startsWith("1.3.6.1.2.1.47")) delete mib[k];
  const { port } = await observed(mib);
  const c = must(snmpConnector("synthetic-site-01"));
  const o = await c.observe({ port, now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture["firmware-known"], false);
  assertEquals(c.check(o.value, NOW).find((r) => r.id === "snmp-firmware-known")?.status, "warn");
  const dead = snmpReadPort(must(await openSession(envOf(fakeDevice({ ...DEVICE, mib: switchMib() }).port), CRED)), DEFAULT_BOUNDS, PACE);
  const silent = { ...dead, get: () => Promise.resolve({ kind: "err" as const, error: { kind: "network" as const, subject: "x" } }) };
  assertEquals((await c.observe({ port: silent, now: NOW })).kind, "err");
});

proves(["0002-snmp-connector FR-011"], "the conformance suite finds nothing over the recorded switch, each fixture is the same observed twice and no denied field is kept", async () => {
  const { port } = await observed(switchMib());
  const c = must(snmpConnector("synthetic-site-01"));
  const findings = await conformConnector(c, [{ name: "synthetic-switch-01", port, now: NOW, expect: { account: "synthetic-site-01", posture: { interfaces: 2, "device-answers": true }, labels: { device: 1, interface: 2 }, policies: { "snmp-device-answers": "pass", "snmp-interfaces-up": "warn" } } }]);
  assertEquals(findings, []);
  void text;
  void num;
});
