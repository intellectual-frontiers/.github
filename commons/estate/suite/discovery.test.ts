/**
 * Tests of discovery (commons estate 0003-estate-logical): the neighbor table in both forms read as devices, what is not a device left out, a device once, the devices no asset declares and the assets declared and not seen. Every address is made up (documentation ranges).
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { deviceIdOf, parseNeighbors, unexpectedDevices } from "../src/logical/mod.ts";

const IP = `192.0.2.20 dev eth0 lladdr aa:bb:cc:dd:ee:01 REACHABLE
192.0.2.21 dev eth0 lladdr AA:BB:CC:DD:EE:02 STALE
192.0.2.22 dev eth0  FAILED
192.0.2.255 dev eth0 lladdr ff:ff:ff:ff:ff:ff PERMANENT
224.0.0.251 dev eth0 lladdr 01:00:5e:00:00:fb PERMANENT
192.0.2.20 dev eth0 lladdr aa:bb:cc:dd:ee:01 DELAY
fe80::1 dev eth0 lladdr aa:bb:cc:dd:ee:03 router STALE
`;
const ARP = `? (192.0.2.30) at aa:bb:cc:dd:ee:04 [ether] on wlan0
? (192.0.2.31) at <incomplete> on wlan0
gateway.example (192.0.2.1) at aa:bb:cc:dd:ee:05 [ether] on wlan0
`;

proves(["0003-estate-logical FR-009"], "the neighbor table of ip and of arp is read as devices, an entry with no hardware address, a broadcast and a multicast address are not devices, and a device is once", () => {
  assertEquals(parseNeighbors(IP).map((d) => [d.address, d.mac, d.interface]), [["192.0.2.20", "aa:bb:cc:dd:ee:01", "eth0"], ["192.0.2.21", "aa:bb:cc:dd:ee:02", "eth0"], ["fe80::1", "aa:bb:cc:dd:ee:03", "eth0"]]);
  assertEquals(parseNeighbors(ARP).map((d) => [d.address, d.mac, d.interface]), [["192.0.2.30", "aa:bb:cc:dd:ee:04", "wlan0"], ["192.0.2.1", "aa:bb:cc:dd:ee:05", "wlan0"]].sort((a, b) => String(a[1]).localeCompare(String(b[1]))));
  assertEquals(parseNeighbors("garbage\n\n"), []);
  assertEquals(deviceIdOf("aa:bb:cc:dd:ee:01"), "device-aabbccddee01");
});

proves(["0003-estate-logical FR-009"], "the devices seen that no asset declares are found by hardware address or, where none is declared, by address, and the assets declared and not seen are found", () => {
  const seen = parseNeighbors(IP);
  const r = unexpectedDevices([{ asset: "olympia", mac: "AA:BB:CC:DD:EE:01" }, { asset: "athens", address: "192.0.2.21" }, { asset: "sparta", address: "192.0.2.99" }, { asset: "corinth" }], seen);
  assertEquals(r.unexpected.map((d) => d.mac), ["aa:bb:cc:dd:ee:03"]);
  assertEquals(r.unseen, ["sparta"], "corinth declares nothing to be seen by");
});
