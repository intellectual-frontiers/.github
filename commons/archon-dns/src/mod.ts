// Spec: 0002-dns-command FR-001
/**
 * The plugin of `archon` for DNS: the noun `dns` with the verbs `plan` and `apply`, over the records and the provider that a fleet gives.
 *
 * @example
 * ```ts
 * import { dnsPlugin } from "./mod.ts";
 * // dnsPlugin({ version: "0.1.0", subject }) is a plugin the host composes
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { branch, definePlugin, type Plugin, type PluginProblem } from "@intellectual-frontiers/headless/logical";
import { dnsCommands } from "./commands.ts";
import type { DnsPluginConfig } from "./config.ts";

export * from "./commands.ts";
export * from "./config.ts";
export * from "./plan.ts";

/** The plugin, from what the fleet gives. */
export function dnsPlugin(config: DnsPluginConfig): Result<Plugin, readonly PluginProblem[]> {
  return definePlugin({
    program: config.program ?? "archon",
    noun: "dns",
    version: config.version,
    summary: "Plan the records of a zone, approve the plan by hash, apply it with the fleet's provider, show the plan is empty.",
    contributes: [{ node: branch({ name: "dns", summary: "The records of a DNS zone.", children: dnsCommands(config) }) }],
  });
}
