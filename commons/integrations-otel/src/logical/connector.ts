// Spec: 0002-otel-connector FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The connector of what the receiver kept (0002-otel-connector): from the batches since a watermark it makes one device record for each asset or set of keys, the latest value of each host metric of it, counts of its log records by severity and by event class (no body and no attribute), and a
 * record that no asset holds as one the estate reads as a sighting, with the relay and protocol it was seen by. A device is resolved by its keys with `resolveIdentity` of the estate, never by a name alone. Observing twice over the same batches gives the same observation, and a missing
 * sequence number of a device is a gap that names the device and the range.
 *
 * @example
 * ```ts
 * import { otelConnector } from "./connector.ts";
 * otelConnector("synthetic-site-01", { since: 0, known: [] }).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { keyOf, SIGHTING_PROTOCOLS, type IdentityKey } from "@intellectual-frontiers/estate/governance";
import { resolveIdentity, type KnownKeys } from "@intellectual-frontiers/estate/logical";
import { eventClassOf, EVENT_CLASSES, HOST_METRICS, OTEL_POLICIES, otelGovernance, SEVERITIES, severityOf, SILENT_AFTER_MS, type GovernanceError } from "@intellectual-frontiers/integrations-otel/governance";
import { defineConnector, fromReadFailure, isObject, numberOf, textOf, type Connector, type DefinitionError, type Gap, type Json, type ObservedRecord, type ReadPort } from "@intellectual-frontiers/integrations/logical";

/** What the connector is given: the watermark of the last observation (the greatest sequence number it saw) and the assets the estate knows by their keys. */
export type OtelOptions = { readonly since: number; readonly known: readonly KnownKeys[] };

/** A batch the receiver kept, as the read port gives it. */
type Kept = { readonly seq: number; readonly device: string; readonly at: string; readonly resource: Readonly<Record<string, string>>; readonly metrics: readonly { readonly name: string; readonly value: number }[]; readonly logs: readonly { readonly severity: string | undefined; readonly event: string | undefined }[] };

function keptOf(j: Json): Kept | undefined {
  const seq = numberOf(j, "seq");
  const device = textOf(j, "device");
  const at = textOf(j, "at");
  const res = isObject(j) ? j["resource"] : undefined;
  if (seq === undefined || device === undefined || at === undefined || Number.isNaN(Date.parse(at))) return undefined;
  const resource: Record<string, string> = {};
  if (isObject(res)) for (const [k, v] of Object.entries(res)) if (typeof v === "string") resource[k] = v;
  const metrics = isObject(j) && Array.isArray(j["metrics"]) ? j["metrics"].filter(isObject).flatMap((m) => (textOf(m, "name") !== undefined && numberOf(m, "value") !== undefined ? [{ name: textOf(m, "name") ?? "", value: numberOf(m, "value") ?? 0 }] : [])) : [];
  const logs = isObject(j) && Array.isArray(j["records"]) ? j["records"].filter(isObject).map((r) => ({ severity: textOf(r, "severity"), event: textOf(r, "event") })) : [];
  return { seq, device, at, resource, metrics, logs };
}

function keysOf(resource: Readonly<Record<string, string>>): readonly IdentityKey[] {
  const out: IdentityKey[] = [];
  const id = resource["host.id"]?.replace(/-/gu, "");
  const machine = id === undefined ? undefined : keyOf("machine-id", id);
  if (machine?.kind === "ok") out.push(machine.value);
  for (const m of (resource["host.mac"] ?? "").split(/[,\s]+/u)) {
    const k = m === "" ? undefined : keyOf("mac", m);
    if (k?.kind === "ok" && !out.some((o) => o.kind === "mac" && o.value === k.value.value)) out.push(k.value);
  }
  return out;
}

async function kept(port: ReadPort, since: number): Promise<Result<readonly Kept[], "failed" | Gap>> {
  const out: Kept[] = [];
  const g = port.pages(`/batches?since=${since}`);
  for (;;) {
    const n = await g.next();
    if (n.done === true) {
      if (n.value.kind === "err") return err(n.value.error.kind === "denied" ? { kind: "denied", subject: "receiver-store" } : "failed");
      return ok(out.sort((a, b) => a.seq - b.seq));
    }
    const k = keptOf(n.value);
    if (k !== undefined && k.seq > since) out.push(k);
  }
}

/** The connector of the receiver store of one site. */
export function otelConnector(site: string, options: OtelOptions): Result<Connector, GovernanceError | DefinitionError> {
  const g = otelGovernance(site);
  if (g.kind === "err") return g;
  return defineConnector({
    governance: g.value,
    policies: OTEL_POLICIES,
    probe: async ({ port }) => {
      const r = await port.pages(`/batches?since=${Number.MAX_SAFE_INTEGER}`).next();
      return r.done === true && r.value.kind === "err" ? err(fromReadFailure(r.value.error)) : ok({ reachable: true as const, account: site });
    },
    observe: async ({ port, now }) => {
      const batches = await kept(port, options.since);
      if (batches.kind === "err") return batches.error === "failed" ? err({ kind: "transport", subject: "receiver-store", failure: "network" }) : ok({ at: now, provider: "otel-receiver", account: site, assets: [], posture: {}, gaps: [batches.error], entities: {}, records: [] });
      const byDevice = new Map<string, Kept[]>();
      for (const b of batches.value) byDevice.set(b.device, [...(byDevice.get(b.device) ?? []), b]);
      const nowMs = Date.parse(now);
      const records: ObservedRecord[] = [];
      const gaps: Gap[] = [];
      let silent = 0;
      let unidentified = 0;
      let seqGaps = 0;
      let warn = 0;
      let error = 0;
      for (const [device, list] of [...byDevice].sort((a, b) => a[0].localeCompare(b[0]))) {
        const resource = Object.assign({}, ...list.map((b) => b.resource)) as Record<string, string>;
        const keys = keysOf(resource);
        const held = resource["if.asset.id"] ?? (() => {
          const r = resolveIdentity(keys, options.known);
          return r.kind === "adopt" ? r.assetId : undefined;
        })();
        const latest = new Map<string, { at: number; value: number }>();
        const counts = new Map<string, number>();
        for (const b of list) {
          const at = Date.parse(b.at);
          for (const m of b.metrics) if ((HOST_METRICS as readonly string[]).includes(m.name) && (latest.get(m.name)?.at ?? -1) <= at) latest.set(m.name, { at, value: m.value });
          for (const l of b.logs) {
            const sev = severityOf(l.severity);
            if (sev === undefined) continue;
            const k = `logs.${sev}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
            const c = `logs.${eventClassOf(l.event)}`;
            counts.set(c, (counts.get(c) ?? 0) + 1);
            if (sev === "warn") warn += 1;
            if (sev === "error" || sev === "fatal") error += 1;
          }
        }
        const seqs = list.map((b) => b.seq);
        for (let i = 1; i < seqs.length; i += 1) {
          const prev = seqs[i - 1] ?? 0;
          const cur = seqs[i] ?? 0;
          if (cur - prev > 1) {
            seqGaps += 1;
            gaps.push({ kind: "partial", subject: `${device} sequence ${prev + 1}-${cur - 1}` });
          }
        }
        const lastAt = Math.max(...list.map((b) => Date.parse(b.at)));
        if (nowMs - lastAt > SILENT_AFTER_MS) silent += 1;
        if (held === undefined) unidentified += 1;
        const protocol = resource["if.relay.protocol"];
        const props: Record<string, string | number | boolean> = { lastSeen: new Date(lastAt).toISOString(), batches: list.length };
        for (const k of keys) props[k.kind === "machine-id" ? "machineId" : k.kind] = props[k.kind === "machine-id" ? "machineId" : k.kind] ?? k.value;
        if (held !== undefined) props["asset"] = held;
        if (resource["if.relay.id"] !== undefined) props["relay"] = resource["if.relay.id"];
        if (protocol !== undefined && (SIGHTING_PROTOCOLS as readonly string[]).includes(protocol)) props["protocol"] = protocol;
        for (const [name, v] of latest) props[`metric.${name}`] = v.value;
        for (const sev of SEVERITIES) if (counts.has(`logs.${sev}`)) props[`logs.${sev}`] = counts.get(`logs.${sev}`) ?? 0;
        for (const c of EVENT_CLASSES) if (counts.has(`logs.${c}`)) props[`logs.${c}`] = counts.get(`logs.${c}`) ?? 0;
        records.push({ label: "device", ocsf_class_uid: 5001, native_id: device, display_name: resource["host.name"] ?? device, props });
      }
      const watermark = Math.max(options.since, ...batches.value.map((b) => b.seq));
      return ok({
        at: now,
        provider: "otel-receiver",
        account: site,
        assets: records.map((r) => ({ kind: "device", id: r.native_id, name: r.display_name })),
        posture: { batches: batches.value.length, devices: records.length, "devices-silent": silent, "unidentified-devices": unidentified, "sequence-gaps": seqGaps, "logs-warn": warn, "logs-error": error, watermark },
        gaps,
        entities: { devices: records.map((r) => ({ source: "otel", id: r.native_id, name: r.display_name, managed: r.props["asset"] !== undefined })) },
        records,
      });
    },
  });
}
