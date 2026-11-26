/**
 * Tests of the bridge from an observation of devices to the estate (0009-estate-sightings FR-014): the keys of a record in the order of strength, a property that is not a key left out, a sighting for each device with a key and none without, and the stored document.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { keysOfProps, sightingsOf, storedOf, type SeenObservation } from "../src/logical/seen.ts";
import { observationCodec } from "../src/physical/documents.ts";

const OBS: SeenObservation = {
  at: "2026-11-26T10:00:00Z",
  provider: "synthetic-source",
  account: "synthetic-site-01",
  posture: { "device-answers": true, interfaces: 4 },
  records: [
    { label: "device", native_id: "synthetic-device-01", display_name: "synthetic-switch-01", props: { engineId: "80001f8880aabbccdd", serial: "SYN-0001", mac: "02:00:5e:10:00:01", other: "x" } },
    { label: "device", native_id: "synthetic-device-02", display_name: "synthetic-switch-02", props: { serial: "  ", mac: "ff:ff:ff:ff:ff:ff" } },
    { label: "interface", native_id: "1", display_name: "eth0", props: { mac: "02:00:5e:10:00:02" } },
  ],
};

proves(["0009-estate-sightings FR-014"], "the keys of a record are the valid ones, the strongest first, and a bad one is left out", () => {
  const keys = keysOfProps(OBS.records?.[0]?.props ?? {});
  assertEquals(keys.map((k) => k.kind), ["serial", "snmp-engine-id", "mac"]);
  assertEquals(keysOfProps(OBS.records?.[1]?.props ?? {}), []);
});

proves(["0009-estate-sightings FR-014"], "a sighting is made for a device with a key, with the provenance of the strongest, and for no other record", () => {
  const s = sightingsOf(OBS, "synthetic-relay-01", "snmp");
  assertEquals(s.length, 1);
  assertEquals(s[0]?.provenance, "relay:synthetic-relay-01/snmp#serial:SYN-0001");
  assertEquals(s[0]?.hostname, "synthetic-switch-01");
});

proves(["0009-estate-sightings FR-014"], "a record keeps the relay and the protocol it names, and a device an asset holds is no sighting", () => {
  const o: SeenObservation = { ...OBS, records: [{ label: "device", native_id: "a", display_name: "", props: { serial: "SYN-0002", relay: "synthetic-relay-02", protocol: "syslog" } }, { label: "device", native_id: "b", display_name: "", props: { serial: "SYN-0003", asset: "synthetic-asset-03" } }] };
  const s = sightingsOf(o, "synthetic-relay-01", "snmp");
  assertEquals(s.length, 1);
  assertEquals(s[0]?.provenance, "relay:synthetic-relay-02/syslog#serial:SYN-0002");
});

proves(["0009-estate-sightings FR-014"], "the stored document of an observation is one the estate's codec accepts", () => {
  const stored = storedOf(OBS, "synthetic-asset-01");
  assertEquals(stored.source, "synthetic-source:synthetic-site-01");
  const text = observationCodec.encode(stored);
  assert(text.kind === "ok", "the codec encodes it");
});
