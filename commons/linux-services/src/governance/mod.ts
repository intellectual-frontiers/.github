// Spec: 0001-linux-services-layers FR-001
/**
 * The Governance layer of Linux Services: what a profile is and the rules its fields obey.
 *
 * @module
 */
export { DOMAIN, MAILBOX, MARKER, NAME, PORTS } from "./profiles.ts";
export type { CertificateProfile, DnsProfile, DnsRecord, MailRelayProfile, McpAccessProfile, PostgresProfile } from "./profiles.ts";
export { COLLECTOR_VERSION, RELAY_PATHS } from "./relay.ts";
export type { NetflowReceiver, OtelSiteRelayProfile, OtlpLoopbackReceiver, PrometheusReceiver, RedfishReceiver, RelayBuild, RelayProgram, RelayReceiver, SnmpReceiver, SyslogReceiver } from "./relay.ts";
