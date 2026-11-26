/**
 * Tests of sightings and levels (commons estate 0009-estate-sightings and 0041-telemetry-and-reach FR-001, FR-011): the smart constructors of keys, resolution that never merges, the fold of sightings of two relays into one
 * asset, what nobody declared, the staleness of what depends on a relay, the level and its fall, the minimums and the closed table of reach. Synthetic names and addresses only.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ASSET_LEVELS,
  hostKeyKey,
  KEY_ORDER,
  KEY_STRENGTH,
  type IdentityKey,
  macKey,
  machineIdKey,
  provenanceOf,
  REACH,
  serialKey,
  type Sighting,
  snmpEngineIdKey,
} from "../src/governance/sightings.ts";
import {
  decodeSighting,
  foldSightings,
  levelFinding,
  levelOf,
  missingMinimums,
  relayDependentStatus,
  resolveIdentity,
  seenAssetId,
  sightingsHash,
  unexpectedSightings,
} from "../src/logical/sightings.ts";

const S = (n: string): string => `0009-estate-sightings ${n}`;
const V = (n: string): string => `0041-telemetry-and-reach ${n}`;

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: string }): T => {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const mac = (n: number): IdentityKey => must(macKey(`02:00:00:00:00:${n.toString(16).padStart(2, "0")}`));
const mid = (n: number): IdentityKey => must(machineIdKey(String(n).repeat(32).slice(0, 32)));

const sighting = (id: string, relay: string, protocol: Sighting["protocol"], keys: IdentityKey[], at = "2026-11-26T10:00:00Z"): Sighting => ({
  id,
  at,
  relay,
  protocol,
  keys,
  count: 3,
  provenance: provenanceOf(relay, protocol, keys[0] as IdentityKey),
});

proves([S("FR-004")], "a key is made only by its constructor, which normalises it and refuses what is not one", () => {
  assertEquals(must(macKey("02-00-00-00-00-AB")).value, "02:00:00:00:00:ab");
  assertEquals(macKey("ff:ff:ff:ff:ff:ff").kind, "err");
  assertEquals(macKey("01:00:5e:00:00:01").kind, "err");
  assertEquals(machineIdKey("xyz").kind, "err");
  assertEquals(hostKeyKey("SHA256:short").kind, "err");
  assertEquals(hostKeyKey(`SHA256:${"A".repeat(43)}`).kind, "ok");
  assertEquals(serialKey("  ").kind, "err");
  assertEquals(must(serialKey(" SN-1 ")).value, "SN-1");
  assertEquals(must(snmpEngineIdKey("0x80001F8880AB")).value, "80001f8880ab");
  assertEquals(KEY_STRENGTH.mac, "weak");
  assertEquals(KEY_STRENGTH["machine-id"], "strong");
});

proves([S("FR-005"), S("FR-006")], "resolution: none is new, a strong key adopts, a weak key is a candidate, two assets are a conflict, and it never merges", () => {
  const known = [
    { id: "asset-a", keys: [mid(1), mac(1)] },
    { id: "asset-b", keys: [mac(2)] },
  ];
  assertEquals(resolveIdentity([mac(9)], known).kind, "new");
  assertEquals(resolveIdentity([mid(1)], known).kind, "adopt");
  assertEquals(resolveIdentity([mac(2)], known).kind, "candidate");
  assertEquals(resolveIdentity([mac(2)], known, { weakAdopts: true }).kind, "adopt");
  const clone = resolveIdentity([mac(1), mac(2)], known);
  assert(clone.kind === "conflict" && clone.assetIds.join() === "asset-a,asset-b");
});

proves([S("FR-007"), S("FR-008")], "a device seen by two relays by two protocols is one asset with a stable id from its strongest key", () => {
  const seen = foldSightings([
    sighting("s1", "relay-01", "syslog", [mac(5)], "2026-11-26T10:00:00Z"),
    sighting("s2", "relay-02", "snmp", [mac(5), mid(5)], "2026-11-26T11:00:00Z"),
    sighting("s3", "relay-01", "neighbor", [mac(6)], "2026-11-26T09:00:00Z"),
  ]);
  assertEquals(seen.length, 2);
  const one = seen.find((s) => s.keys.length === 2);
  assert(one !== undefined);
  assertEquals(one.relays, ["relay-01", "relay-02"]);
  assertEquals(one.protocols, ["snmp", "syslog"]);
  assertEquals(one.count, 6);
  assertEquals(one.first, "2026-11-26T10:00:00Z");
  assertEquals(one.last, "2026-11-26T11:00:00Z");
  assert(one.id.startsWith("device-") && !one.id.includes(":"));
  assertEquals(seenAssetId([mac(6)]), "device-020000000006");
  assertEquals(KEY_ORDER[0], "machine-id");
});

proves([S("FR-008")], "assets seen that nobody declared, and declared assets behind a relay not seen within the window", () => {
  const seen = foldSightings([sighting("s1", "relay-01", "syslog", [mac(5)], "2026-11-26T10:00:00Z"), sighting("s2", "relay-01", "syslog", [mac(7)], "2026-11-20T10:00:00Z")]);
  const now = Date.parse("2026-11-26T12:00:00Z");
  const r = unexpectedSightings(
    [
      { asset: "switch-01", keys: [mac(5)], behindRelay: true },
      { asset: "switch-02", keys: [mac(7)], behindRelay: true },
      { asset: "server-01", keys: [mid(1)] },
    ],
    seen,
    now,
    24 * 3600 * 1000,
  );
  assertEquals(r.unexpected, []);
  assertEquals(r.unseen, ["switch-02"]);
  assertEquals(unexpectedSightings([], seen, now, 1).unexpected.length, 2);
});

proves([S("FR-009")], "an asset behind a relay is stale when silent, never failed, and unknown when the relay is itself stale", () => {
  const base = { nowMs: 1_000, staleAfterMs: 100 };
  assertEquals(relayDependentStatus({ ...base, relayStale: false, lastSeenMs: 950 }), "fresh");
  assertEquals(relayDependentStatus({ ...base, relayStale: false, lastSeenMs: 800 }), "stale");
  assertEquals(relayDependentStatus({ ...base, relayStale: true, lastSeenMs: 800 }), "unknown");
  assertEquals(relayDependentStatus({ ...base, relayStale: false, lastSeenMs: undefined }), "unknown");
});

proves([S("FR-011")], "the approval names the sightings looked at by a hash of their sorted ids and keys", async () => {
  const a = sighting("s1", "relay-01", "syslog", [mac(5)]);
  const b = sighting("s2", "relay-01", "snmp", [mac(6)]);
  assertEquals(await sightingsHash([a, b]), await sightingsHash([b, a]));
  assert((await sightingsHash([a, b])) !== (await sightingsHash([a])));
});

proves([S("FR-001"), S("FR-002")], "a sighting has keys and a provenance and no payload; the decoder refuses what it does not read", () => {
  const s = sighting("s1", "relay-01", "syslog", [mac(5)]);
  assertEquals(must(decodeSighting(JSON.parse(JSON.stringify(s)))), s);
  assertEquals(decodeSighting({ ...s, provenance: "" }).kind, "err");
  assertEquals(decodeSighting({ ...s, keys: [] }).kind, "err");
  assertEquals(decodeSighting({ ...s, protocol: "ftp" }).kind, "err");
  assertEquals(s.provenance, "relay:relay-01/syslog#mac:02:00:00:00:00:05");
});

proves([V("FR-001"), S("FR-012")], "the level is a total function of what is observed", () => {
  assertEquals(levelOf({ identified: true, sshOut: true, osquery: true }), 3);
  assertEquals(levelOf({ identified: true, sshOut: true, osquery: false }), 2);
  assertEquals(levelOf({ identified: true, sshOut: false, osquery: false }), 1);
  assertEquals(levelOf({ identified: false, sshOut: false, osquery: false }), 0);
  assertEquals([...ASSET_LEVELS], [0, 1, 2, 3]);
});

proves([V("FR-002")], "a fall of level is a finding that names what was lost", () => {
  const f = levelFinding({ identified: true, sshOut: true, osquery: true }, { identified: true, sshOut: true, osquery: false });
  assertEquals(f, "the level fell from 3 to 2: osQuery lost");
  assertEquals(levelFinding({ identified: true, sshOut: true, osquery: false }, { identified: true, sshOut: true, osquery: true }), undefined);
});

proves([V("FR-011")], "an asset with an identity and no telemetry path is told to lack it", () => {
  assertEquals(missingMinimums({ identity: true, factsAndQuery: true, telemetry: false }), ["telemetry"]);
  assertEquals(missingMinimums({ identity: true, factsAndQuery: true, telemetry: true }), []);
});

proves([V("FR-005"), V("FR-006")], "the table of reach is closed and no row needs an inbound port on a device", () => {
  assertEquals(REACH.map((r) => r.row), ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
  assert(REACH.every((r) => r.openedBy !== "controller" || r.row === "R7"));
  assertEquals(REACH.find((r) => r.row === "R8")?.status, "optional-later");
});
