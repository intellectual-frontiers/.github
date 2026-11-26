// Spec: 0002-dns-command FR-001
/**
 * What a fleet gives the plugin for DNS: the options of its own, and for a zone the records it wants and the provider that holds them. The plugin holds no provider and no token.
 *
 * @example
 * ```ts
 * import type { DnsPluginConfig } from "./config.ts";
 * // a fleet writes { version, subject } and gives it to dnsPlugin
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { DnsRecord } from "@intellectual-frontiers/linux-services/governance";
import type { DnsProvider } from "@intellectual-frontiers/linux-services/physical";
import type { ValueOption } from "@intellectual-frontiers/terminal/args";

/** An option of the fleet's own, as the terminal takes one. */
export type FleetOption = ValueOption<string, "none" | "required" | "default", never>;

/** What is known of one zone. */
export type DnsSubject = {
  /** The records the fleet wants in the zone. */
  readonly wanted: readonly DnsRecord[];
  /** The provider of the zone. */
  readonly provider: DnsProvider;
};

/** Why a zone is not for the plugin to change, in the fleet's own words and code. */
export type Refusal = { readonly message: string; readonly code: string; readonly exit: "usage" | "findings" | "environment" };

/** What the plugin is made with. */
export type DnsPluginConfig = {
  /** The version of the plugin as published. */
  readonly version: string;
  /** The program the plugin extends: `desired-os-state` by default. */
  readonly program?: string;
  /** The options of the fleet's own (where the tenant is, where the token is), by name. */
  readonly options?: Readonly<Record<string, FleetOption>>;
  /** The records and the provider of a zone, given the options the person gave. */
  readonly subject: (zone: string, options: Readonly<Record<string, string>>) => Promise<Result<DnsSubject, Refusal>>;
};
