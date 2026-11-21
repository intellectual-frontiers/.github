// Spec: 0001-linux-services-layers FR-001
/**
 * The Physical layer of Linux Services: the DNS provider, which touches the network.
 *
 * @module
 */
export { cloudflare } from "./cloudflare.ts";
export type { CloudflareOptions, DnsProvider } from "./cloudflare.ts";
