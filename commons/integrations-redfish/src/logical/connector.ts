// Spec: 0002-redfish-connector FR-003, FR-004, FR-005, FR-006
/**
 * The connector of the management controllers that answer Redfish (0002-redfish-connector): from the service root it follows the links of the documents (systems, chassis, managers and the firmware inventory), bounded in depth and in the number of members of a collection, and
 * observes for each system its model, the vendor's text of its maker, serial, UUID, power state, health, BIOS version and the hardware addresses of its network interfaces. The `Oem` extensions and every field the denylist denies are dropped, a part that cannot be read is a
 * gap and the rest is observed, and a controller that does not answer is an error.
 *
 * @example
 * ```ts
 * import { redfishConnector } from "./connector.ts";
 * redfishConnector("synthetic-site-01", ["synthetic-bmc-01.example.test"]).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { FOLLOWED, LINK_BOUNDS, pathAllowed, REDFISH_POLICIES, redfishGovernance, ROOT_PATH, type GovernanceError } from "@intellectual-frontiers/integrations-redfish/governance";
import { defineConnector, fromReadFailure, isObject, member, textOf, type Connector, type DefinitionError, type Gap, type Json, type ObservedRecord, type ReadPort } from "@intellectual-frontiers/integrations/logical";

const linkOf = (j: Json | undefined, name: string): string | undefined => {
  const l = member(j, name);
  const id = isObject(l) ? textOf(l, "@odata.id") : undefined;
  if (id === undefined) return undefined;
  const p = id.endsWith("/") || id.includes("?") ? id : id;
  return pathAllowed(p) ? p : undefined;
};

type Docs = { readonly docs: Json[]; readonly gaps: Gap[] };

/** The members of a collection, each read, bounded: a member that cannot be read is a gap. */
async function members(port: ReadPort, collection: string, depth: number, into: Docs): Promise<void> {
  if (depth > LINK_BOUNDS.maxDepth) return;
  const c = await port.get(collection);
  if (c.kind === "err") {
    into.gaps.push({ kind: c.error.kind === "denied" ? "denied" : "unavailable", subject: collection });
    return;
  }
  const list = member(c.value, "Members");
  const links = Array.isArray(list) ? list.slice(0, LINK_BOUNDS.maxMembers) : [];
  for (const m of links) {
    const id = isObject(m) ? textOf(m, "@odata.id") : undefined;
    if (id === undefined || !pathAllowed(id)) continue;
    const d = await port.get(id);
    if (d.kind === "err") into.gaps.push({ kind: d.error.kind === "denied" ? "denied" : "unavailable", subject: id });
    else into.docs.push(d.value);
  }
}

const uuidKey = (u: string | undefined): string | undefined => {
  const t = u?.replace(/-/gu, "").toLowerCase();
  return t !== undefined && /^[0-9a-f]{32}$/u.test(t) ? t : undefined;
};
const healthOf = (j: Json | undefined): string | undefined => textOf(member(j, "Status"), "Health");

/** The connector of the controllers of one site. */
export function redfishConnector(site: string, hosts: readonly string[]): Result<Connector, GovernanceError | DefinitionError> {
  const g = redfishGovernance(site, hosts);
  if (g.kind === "err") return g;
  return defineConnector({
    governance: g.value,
    policies: REDFISH_POLICIES,
    probe: async ({ port }) => {
      const r = await port.get(ROOT_PATH);
      return r.kind === "ok" ? ok({ reachable: true as const, account: site }) : err(fromReadFailure(r.error));
    },
    observe: async ({ port, now }) => {
      const root = await port.get(ROOT_PATH);
      if (root.kind === "err") return err(fromReadFailure(root.error));
      const gaps: Gap[] = [];
      const collect = async (name: (typeof FOLLOWED)[number]): Promise<Docs> => {
        const into: Docs = { docs: [], gaps };
        const l = linkOf(root.value, name);
        if (l === undefined) {
          gaps.push({ kind: "unavailable", subject: name });
          return into;
        }
        await members(port, l, 1, into);
        return into;
      };
      const systems = await collect("Systems");
      const managers = await collect("Managers");
      await collect("Chassis");
      const updateLink = linkOf(root.value, "UpdateService");
      const firmware: Json[] = [];
      if (updateLink !== undefined) {
        const u = await port.get(updateLink);
        const inv = u.kind === "ok" ? linkOf(u.value, "FirmwareInventory") : undefined;
        if (inv === undefined) gaps.push({ kind: "unavailable", subject: updateLink });
        else await members(port, inv, 1, { docs: firmware, gaps });
      }
      const records: ObservedRecord[] = [];
      let unhealthy = 0;
      let off = 0;
      for (const s of systems.docs) {
        const id = textOf(s, "Id") ?? textOf(s, "SerialNumber") ?? "?";
        const nics: Json[] = [];
        const nicLink = linkOf(s, "EthernetInterfaces");
        if (nicLink !== undefined) await members(port, nicLink, 2, { docs: nics, gaps });
        const mac = nics.map((n) => textOf(n, "PermanentMACAddress") ?? textOf(n, "MACAddress")).find((m) => m !== undefined);
        const machineId = uuidKey(textOf(s, "UUID"));
        const health = healthOf(s);
        if (health !== undefined && health !== "OK") unhealthy += 1;
        if (textOf(s, "PowerState") === "Off") off += 1;
        const maker = textOf(s, "Manufacturer");
        const model = textOf(s, "Model");
        const serial = textOf(s, "SerialNumber");
        const bios = textOf(s, "BiosVersion");
        const power = textOf(s, "PowerState");
        records.push({
          label: "device",
          ocsf_class_uid: 5001,
          native_id: id,
          display_name: textOf(s, "HostName") ?? textOf(s, "Name") ?? id,
          props: {
            ...(machineId === undefined ? {} : { machineId }),
            ...(serial === undefined || serial.trim() === "" ? {} : { serial }),
            ...(mac === undefined ? {} : { mac: mac.toLowerCase().replace(/-/gu, ":") }),
            ...(maker === undefined ? {} : { vendor: maker }),
            ...(model === undefined ? {} : { model }),
            ...(bios === undefined ? {} : { biosVersion: bios }),
            ...(power === undefined ? {} : { powerState: power }),
            ...(health === undefined ? {} : { health }),
          },
        });
      }
      const versions = [...managers.docs.map((m) => textOf(m, "FirmwareVersion")), ...firmware.map((f) => textOf(f, "Version"))].filter((v): v is string => v !== undefined && v !== "");
      return ok({
        at: now,
        provider: "redfish-controllers",
        account: site,
        assets: records.map((r) => ({ kind: "device", id: r.native_id, name: r.display_name })),
        posture: { "controller-answers": true, systems: systems.docs.length, "systems-unhealthy": unhealthy, "systems-power-off": off, "firmware-known": versions.length > 0, "firmware-items": versions.length },
        gaps,
        entities: { devices: records.map((r) => ({ source: "redfish", id: r.native_id, name: r.display_name, ...(typeof r.props["serial"] === "string" ? { serial: r.props["serial"] } : {}), managed: true })) },
        records,
      });
    },
  });
}
