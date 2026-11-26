// Spec: 0003-linux-services-otel FR-001, FR-002
/**
 * The profile of a site relay as data: a machine that receives what devices that cannot run a program send (syslog, SNMP, NetFlow, Redfish, Prometheus, OTLP) and forwards it as OTLP over its own outbound SSH forward to the controller.
 * It carries no secret: a credential is the path of a file on the machine.
 *
 * @example
 * ```ts
 * import { RELAY_PATHS } from "./relay.ts";
 * RELAY_PATHS.token; // "/etc/ifc-relay/token"
 * ```
 *
 * @module
 */

/** A syslog receiver: a port, the transport and the format. */
export type SyslogReceiver = { readonly kind: "syslog"; readonly port: number; readonly transport: "udp" | "tcp"; readonly format: "rfc5424" | "rfc3164" };
/** An SNMP poller: SNMPv3 with authentication and privacy only; the credentials are a file on the machine. */
export type SnmpReceiver = { readonly kind: "snmp"; readonly targets: readonly string[]; readonly version: "v3"; readonly security: "authPriv"; readonly scope: readonly string[]; readonly intervalSec: number; readonly credentialsFile: string };
/** A flow receiver. */
export type NetflowReceiver = { readonly kind: "netflow"; readonly port: number; readonly scheme: "netflow" | "sflow" | "ipfix" };
/** A Redfish poller of baseboard controllers; the credentials are a file on the machine. */
export type RedfishReceiver = { readonly kind: "redfish"; readonly targets: readonly string[]; readonly intervalSec: number; readonly credentialsFile: string };
/** A Prometheus scrape of targets. */
export type PrometheusReceiver = { readonly kind: "prometheus"; readonly targets: readonly string[] };
/** An OTLP receiver on the loopback of the relay only. */
export type OtlpLoopbackReceiver = { readonly kind: "otlp"; readonly port: number };

/** A receiver of a relay. */
export type RelayReceiver = SyslogReceiver | SnmpReceiver | NetflowReceiver | RedfishReceiver | PrometheusReceiver | OtlpLoopbackReceiver;

/** The build of the relay's program that OUR release holds, pinned by the SHA-256 of that release (never the publisher's contrib distribution). */
export type RelayBuild = { readonly pin: string; readonly version: string; readonly downloadUrl: string; readonly sha256: string; readonly archiveFormat: "zip" | "tar" | "file"; readonly binPath: string };

/** The program of the relay: the Collector of our build, or a command the machine already has (our own relay, which takes TCP syslog and OTLP only). */
export type RelayProgram = { readonly kind: "collector"; readonly build: RelayBuild } | { readonly kind: "command"; readonly argv: readonly string[] };

/** A site relay. */
export type OtelSiteRelayProfile = {
  readonly machine: string;
  /** The name of the relay (the name of its program and its unit). */
  readonly name: string;
  /** The identifier the relay is known by at the controller (`if.relay.id`). */
  readonly relayId: string;
  /** The controller: where its SSH service is, and its host key as the line of a known-hosts file (public). */
  readonly controller: { readonly host: string; readonly port: number; readonly hostKey: string };
  /** The loopback port of the controller's receiver, and the local port of the forward. */
  readonly receiverPort: number;
  readonly forwardPort: number;
  readonly receivers: readonly RelayReceiver[];
  readonly program: RelayProgram;
};

/** Where the files of a relay are on its machine. A secret is put there by the owner and is never in the model. */
export const RELAY_PATHS = {
  account: "ifc-relay",
  etc: "/etc/ifc-relay",
  state: "/var/lib/ifc-relay",
  queue: "/var/lib/ifc-relay/queue",
  token: "/etc/ifc-relay/token",
  forwardKey: "/etc/ifc-relay/forward_key",
  knownHosts: "/etc/ifc-relay/known_hosts",
  config: "/etc/ifc-relay/collector.yaml",
  bin: "/opt/ifc-relay/bin",
  unit: "/etc/systemd/system",
} as const;

/** The version of the Collector and of the builder that a relay is made with. */
export const COLLECTOR_VERSION = "0.165.0";
