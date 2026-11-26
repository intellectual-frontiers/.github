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
import type { Permit } from "@intellectual-frontiers/estate/governance";
import type { DnsRecord } from "@intellectual-frontiers/linux-services/governance";
import type { DnsPlan } from "@intellectual-frontiers/linux-services/logical";
import type { DnsProvider } from "@intellectual-frontiers/linux-services/physical";
import type { ValueOption } from "@intellectual-frontiers/terminal/args";

/** An option of the fleet's own, as the terminal takes one. */
export type FleetOption = ValueOption<string, "none" | "required" | "default", never>;

/** What is known of one zone. */
export type DnsSubject = {
  /** The records the fleet wants in the zone. */
  readonly wanted: readonly DnsRecord[];
  /** The provider of the zone, for reading it: a provider that can change the zone is not given to the plugin. */
  readonly provider: Pick<DnsProvider, "list">;
  /** The change of the zone at the provider: it takes the permit for `apply` that the estate's interlock gave for this zone, so that a call with no permit does not type-check. */
  readonly change: (plan: DnsPlan, permit: Permit<"apply">) => Promise<void>;
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
  /** The permit for `apply` on a zone, asked of the boundaries of the fleet that declares it, or the refusal in the fleet's own words; the fleet records the refusal before the plugin returns. A change of a zone is never made without it. */
  readonly permit: (zone: string, options: Readonly<Record<string, string>>) => Promise<Result<Permit<"apply">, Refusal>>;
};
