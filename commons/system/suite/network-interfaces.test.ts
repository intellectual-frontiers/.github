/**
 * Tests of `proc.networkInterfaces` (commons 0001-system FR-009): each address's name, family, address, netmask and whether it is internal, with a loopback among them.
 *
 * @module
 */
import { type NetworkInterfaceInfo, networkInterfaces } from "../src/proc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(
  ["0001-system FR-009"],
  "networkInterfaces gives each address's name, family, address, netmask and internal, a loopback among them",
  () => {
    const all = networkInterfaces();
    const loopback = all.filter((i: NetworkInterfaceInfo) => i.internal);
    assert(
      loopback.some((i) => i.address === "127.0.0.1" || i.address === "::1"),
      `a loopback: ${JSON.stringify(all)}`,
    );
    for (const i of all) {
      assert(i.name !== "");
      assert(i.family === "IPv4" ? i.address.includes(".") : i.address.includes(":"), JSON.stringify(i));
      assert(i.netmask !== "");
      assertEquals(typeof i.internal, "boolean");
    }
  },
);
