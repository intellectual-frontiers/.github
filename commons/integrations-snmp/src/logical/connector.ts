// Spec: 0002-snmp-connector FR-007, FR-008, FR-009
/**
 * The connector of the devices that answer SNMPv3 (0002-snmp-connector FR-007): for one device, through the read port of a session, its name, its description, its object identifier, how long it has been up, its interfaces with their state, and the model, firmware and serial of its entity
 * where it gives them. It keeps what posture needs and what the estate needs to tell the device apart (the engine id, the serial, a hardware address) and no payload: a community, a password or an address of a person is never read, and an octet string that is not text stays hexadecimal. A part the
 * view of the user does not give is a gap and the rest is observed; a device that cannot be reached is an error.
 *
 * @example
 * ```ts
 * import { snmpConnector } from "./connector.ts";
 * snmpConnector("synthetic-site-01").kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ENTITY_COLUMNS, IF_COLUMNS, OIDS, SNMP_POLICIES, snmpGovernance, type GovernanceError } from "@intellectual-frontiers/integrations-snmp/governance";
import { ENGINE_PATH } from "./port.ts";
import { defineConnector, fromReadFailure, isObject, numberOf, textOf, type Connector, type DefinitionError, type Gap, type Json, type ObservedRecord, type ReadPort } from "@intellectual-frontiers/integrations/logical";

async function walk(port: ReadPort, root: string): Promise<Result<readonly Json[], "failed" | Gap>> {
  const rows: Json[] = [];
  const g = port.pages(`/${root}`);
  for (;;) {
    const n = await g.next();
    if (n.done === true) {
      if (n.value.kind === "err") return err(n.value.error.kind === "denied" || n.value.error.kind === "not-found" ? { kind: n.value.error.kind === "denied" ? "denied" : "unavailable", subject: root } : "failed");
      return ok(rows);
    }
    rows.push(n.value);
  }
}

/** The column and the row index of an object identifier under a table's entry: `<entry>.<column>.<index>`. */
function cell(oid: string, entry: string): { readonly column: string; readonly index: string } | undefined {
  if (!oid.startsWith(`${entry}.`)) return undefined;
  const rest = oid.slice(entry.length + 1);
  const dot = rest.indexOf(".");
  return dot < 0 ? undefined : { column: rest.slice(0, dot), index: rest.slice(dot + 1) };
}

function table(rows: readonly Json[], entry: string): ReadonlyMap<string, ReadonlyMap<string, Json>> {
  const out = new Map<string, Map<string, Json>>();
  for (const r of rows) {
    const c = cell(textOf(r, "oid") ?? "", entry);
    if (c === undefined) continue;
    const row = out.get(c.index) ?? new Map<string, Json>();
    row.set(c.column, r);
    out.set(c.index, row);
  }
  return out;
}

const textValue = (j: Json | undefined): string | undefined => (isObject(j) ? textOf(j, "text") : undefined);
const hexValue = (j: Json | undefined): string | undefined => (isObject(j) ? textOf(j, "hex") : undefined);
const intValue = (j: Json | undefined): number | undefined => (isObject(j) ? numberOf(j, "value") : undefined);
const macOf = (hex: string | undefined): string | undefined => (hex !== undefined && hex.length === 12 && hex !== "000000000000" ? hex.match(/../gu)?.join(":") : undefined);

/** The connector of the devices of one site. */
export function snmpConnector(site: string): Result<Connector, GovernanceError | DefinitionError> {
  const g = snmpGovernance(site);
  if (g.kind === "err") return g;
  return defineConnector({
    governance: g.value,
    policies: SNMP_POLICIES,
    probe: async ({ port }) => {
      const r = await port.get(`/${OIDS.sysName}`);
      return r.kind === "ok" ? ok({ reachable: true as const, account: site }) : err(fromReadFailure(r.error));
    },
    observe: async ({ port, now }) => {
      const names = await Promise.all([OIDS.sysName, OIDS.sysDescr, OIDS.sysObjectID, OIDS.sysUpTime].map((o) => port.get(`/${o}`)));
      const [name, descr, objectId, uptime] = names;
      if (name?.kind !== "ok") return err({ kind: "transport", subject: OIDS.sysName, failure: name?.kind === "err" && name.error.kind === "denied" ? "denied" : "network" });
      const gaps: Gap[] = [];
      const ifs = await walk(port, OIDS.interfaces);
      const ent = await walk(port, OIDS.entity);
      if (ifs.kind === "err") gaps.push(ifs.error === "failed" ? { kind: "unavailable", subject: OIDS.interfaces } : ifs.error);
      if (ent.kind === "err") gaps.push(ent.error === "failed" ? { kind: "unavailable", subject: OIDS.entity } : ent.error);
      const interfaces = ifs.kind === "ok" ? table(ifs.value, OIDS.interfaces) : new Map<string, ReadonlyMap<string, Json>>();
      const entities = ent.kind === "ok" ? table(ent.value, OIDS.entity) : new Map<string, ReadonlyMap<string, Json>>();
      const chassis = [...entities.values()].find((row) => intValue(row.get(ENTITY_COLUMNS.class)) === 3) ?? [...entities.values()][0];
      const firmware = textValue(chassis?.get(ENTITY_COLUMNS.firmware)) || textValue(chassis?.get(ENTITY_COLUMNS.software)) || undefined;
      const serial = textValue(chassis?.get(ENTITY_COLUMNS.serial)) || undefined;
      const model = textValue(chassis?.get(ENTITY_COLUMNS.model)) || undefined;
      const engine = await port.get(ENGINE_PATH);
      const engineId = engine.kind === "ok" ? hexValue(engine.value) : undefined;
      const sysName = textValue(name.value) ?? "";
      const macs = [...interfaces.values()].map((row) => macOf(hexValue(row.get(IF_COLUMNS.mac)))).filter((m): m is string => m !== undefined);
      const downUnexpectedly = [...interfaces.values()].filter((row) => intValue(row.get(IF_COLUMNS.admin)) === 1 && intValue(row.get(IF_COLUMNS.oper)) === 2).length;
      const upSeconds = uptime?.kind === "ok" ? Math.floor((intValue(uptime.value) ?? 0) / 100) : undefined;
      const id = engineId ?? sysName;
      const device: ObservedRecord = {
        label: "device",
        ocsf_class_uid: 5001,
        native_id: id,
        display_name: sysName,
        props: {
          ...(engineId === undefined ? {} : { engineId }),
          ...(serial === undefined ? {} : { serial }),
          ...(macs[0] === undefined ? {} : { mac: macs[0] }),
          ...(model === undefined ? {} : { model }),
          ...(firmware === undefined ? {} : { firmware }),
          ...(objectId?.kind === "ok" && textOf(objectId.value, "value") !== undefined ? { sysObjectID: textOf(objectId.value, "value") ?? "" } : {}),
          ...(upSeconds === undefined ? {} : { uptimeSeconds: upSeconds }),
        },
      };
      const records: ObservedRecord[] = [device];
      for (const [index, row] of interfaces) {
        records.push({ label: "interface", ocsf_class_uid: 4001, native_id: `${id}#${index}`, display_name: textValue(row.get(IF_COLUMNS.descr)) ?? index, props: { admin: intValue(row.get(IF_COLUMNS.admin)) === 1 ? "up" : "down", oper: intValue(row.get(IF_COLUMNS.oper)) === 1 ? "up" : "down", ...(macOf(hexValue(row.get(IF_COLUMNS.mac))) === undefined ? {} : { mac: macOf(hexValue(row.get(IF_COLUMNS.mac))) ?? "" }) } });
      }
      return ok({
        at: now,
        provider: "snmp-devices",
        account: site,
        assets: [{ kind: "device", id, name: sysName }],
        posture: {
          "device-answers": true,
          "firmware-known": firmware !== undefined,
          interfaces: interfaces.size,
          "interfaces-down-unexpectedly": downUnexpectedly,
          ...(upSeconds === undefined ? {} : { "uptime-seconds": upSeconds }),
          ...(descr?.kind === "ok" ? { "has-description": textValue(descr.value) !== undefined } : {}),
        },
        gaps,
        entities: { devices: [{ source: "snmp", id, name: sysName, ...(serial === undefined ? {} : { serial }), managed: true }] },
        records,
      });
    },
  });
}
