// Spec: 0002-otel-connector FR-001, FR-002
/**
 * The governance of the OTel connector as data (0002-otel-connector): it reads what the controller's receiver kept of the signals of assets and of site relays, with the access of the process that runs it, so its credential has no secret field (`localAccess`) and its transport is
 * `local`. It keeps no log body and no attribute of a log record, only counts by severity and by a closed list of event classes, and the latest value of a closed list of host metrics. Nothing here reaches a network or a file.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { cadence, denylistWith, localAccess, parseConnectorId, parseCredentialRef, type ConnectorGovernance } from "@intellectual-frontiers/integrations/governance";
import type { PosturePolicy } from "@intellectual-frontiers/integrations/logical";

/** Why a governance cannot be made. */
export type GovernanceError = { readonly kind: "id"; readonly what: string };

/** The host metrics whose latest value is kept: a closed list, so a metric of a device that is not here is not read. */
export const HOST_METRICS = ["system.uptime", "if.host.load.1m", "if.host.load.5m", "if.host.load.15m", "system.memory.utilization", "system.filesystem.utilization", "if.host.updates.pending"] as const;
/** One host metric. */
export type HostMetric = (typeof HOST_METRICS)[number];

/** The severities of a log record that are counted. */
export const SEVERITIES = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
/** One severity. */
export type Severity = (typeof SEVERITIES)[number];

/** The classes of event of a log record that are counted: the table a probe could not read, and every other record. */
export const EVENT_CLASSES = ["probe-gap", "other"] as const;
/** One class of event. */
export type EventClass = (typeof EVENT_CLASSES)[number];

/** The class of an event name. */
export const eventClassOf = (name: string | undefined): EventClass => (name === "if.probe.gap" ? "probe-gap" : "other");
/** The severity of a text, or `undefined` where it is not one. */
export const severityOf = (text: string | undefined): Severity | undefined => SEVERITIES.find((s) => s === text?.toLowerCase());

/** How long a device may be silent before it is counted as silent, in milliseconds. */
export const SILENT_AFTER_MS = 15 * 60_000;

/** The governance of the connector of the receiver store of one site. */
export function otelGovernance(site: string): Result<ConnectorGovernance, GovernanceError> {
  const id = parseConnectorId("otel-receiver");
  const ref = parseCredentialRef(`vault://otel/${site.toLowerCase()}-store`);
  const cad = cadence("5m");
  if (id.kind === "err" || ref.kind === "err" || cad.kind === "err") return err({ kind: "id", what: "otel-receiver: its id, its credential reference or its cadence" });
  const spec = localAccess(ref.value, [{ name: "store", secret: false, hint: "The folder of the controller's receiver store that this connector reads, which the process that runs it can read and no other can." }]);
  if (spec.kind === "err") return err({ kind: "id", what: "otel-receiver: the access to the store" });
  return ok({
    id: id.value,
    title: "What the receiver kept of the signals of assets and relays: who is heard, their host metrics and their counts of log records",
    class: "network-device",
    labels: { serviceModels: [], categories: ["telemetry", "otlp"] },
    contract: { writes: "never", tokenEndpoints: [] },
    credential: spec.value,
    scope: { grants: [{ resource: "receiver-store", access: "read" }] },
    cadence: cad.value,
    entities: ["device"],
    denylist: denylistWith([{ kind: "exact", text: "body", why: "the text of a log record" }, { kind: "contains", text: "attributes", why: "the attributes of a log record" }]),
    transport: { kind: "local" },
  });
}

/** The posture policies of the receiver's view. */
export const OTEL_POLICIES: readonly PosturePolicy[] = [
  { id: "otel-devices-heard", title: "Every device that reports has been heard in the last fifteen minutes", fact: "devices-silent", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Find why the device is silent: its network, its queue (it keeps what it could not send) or its power." },
  { id: "otel-no-sequence-gaps", title: "No batch of a device is missing from its sequence", fact: "sequence-gaps", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "low", onMiss: "warn", controls: [], fix: "A gap is a batch the device sent and the receiver did not keep, or one the device dropped: see the drop count of the device." },
  { id: "otel-devices-identified", title: "Every device that reports is an asset", fact: "unidentified-devices", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Have a person approve or refuse each sighting (opsfolio enroll sightings)." },
];
