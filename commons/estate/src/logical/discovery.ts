// Spec: 0003-estate-logical FR-009
/**
 * Discovery of devices on a network by what a machine already knows of it: the neighbor table (`ip neigh`) or the ARP table (`arp -an`) read as devices with an address and a hardware address, and the devices that no declaration expects. Nothing is scanned: a device that has not talked to this machine is not seen, and
 * a discovered asset is only listed (0002-estate-governance FR-002).
 *
 * @example
 * ```ts
 * import { parseNeighbors } from "./discovery.ts";
 * parseNeighbors("192.168.1.20 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE")[0]?.mac; // "aa:bb:cc:dd:ee:ff"
 * ```
 *
 * @module
 */

/** A device seen: its address, its hardware address and the interface it was seen on. */
export type SeenDevice = { readonly address: string; readonly mac: string; readonly interface: string };

const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/;

/** The devices of a neighbor table, in the form of `ip neigh show` (`<address> dev <if> lladdr <mac> <state>`) or `arp -an` (`? (<address>) at <mac> [ether] on <if>`); an entry with no hardware address (FAILED, INCOMPLETE), a broadcast or a multicast address is not a device, and a device is once, by its hardware address. */
export function parseNeighbors(text: string): readonly SeenDevice[] {
  const seen = new Map<string, SeenDevice>();
  for (const raw of text.split("\n")) {
    const line = raw.trim().toLowerCase();
    const ip = /^([0-9a-f:.]+) dev (\S+) lladdr ([0-9a-f:]+)\b/.exec(line);
    const arp = /^\S+ \(([0-9.]+)\) at ([0-9a-f:]+) \[\S+\] on (\S+)/.exec(line);
    const device = ip !== null ? { address: ip[1] ?? "", interface: ip[2] ?? "", mac: ip[3] ?? "" } : arp !== null ? { address: arp[1] ?? "", interface: arp[3] ?? "", mac: arp[2] ?? "" } : undefined;
    if (device === undefined || !MAC.test(device.mac) || device.mac === "ff:ff:ff:ff:ff:ff" || (parseInt(device.mac.slice(0, 2), 16) & 1) === 1) continue;
    if (!seen.has(device.mac)) seen.set(device.mac, device);
  }
  return [...seen.values()].sort((a, b) => a.mac.localeCompare(b.mac));
}

/** The identity a discovered device gets: `device-` and its hardware address without the colons. */
export const deviceIdOf = (mac: string): string => `device-${mac.replace(/:/g, "")}`;

/** What an estate declares of a device the network may show: the address or the hardware address of an asset. */
export type Declared = { readonly asset: string; readonly address?: string; readonly mac?: string };

/** The devices seen that no asset declares (by hardware address, or by address where no hardware address is declared), and the assets that declare an address or a hardware address and were not seen. */
export function unexpectedDevices(declared: readonly Declared[], seen: readonly SeenDevice[]): { readonly unexpected: readonly SeenDevice[]; readonly unseen: readonly string[] } {
  const known = (d: SeenDevice): boolean => declared.some((x) => (x.mac !== undefined ? x.mac.toLowerCase() === d.mac : x.address === d.address));
  const seenBy = (x: Declared): boolean => seen.some((d) => (x.mac !== undefined ? x.mac.toLowerCase() === d.mac : x.address === d.address));
  return { unexpected: seen.filter((d) => !known(d)), unseen: declared.filter((x) => (x.mac !== undefined || x.address !== undefined) && !seenBy(x)).map((x) => x.asset).sort() };
}
