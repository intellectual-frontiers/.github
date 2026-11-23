// Spec: 0002-boot-command FR-001
/**
 * The plugin of `archon` for the network install of a blank machine: a fleet gives it its dialects and the function that says what to render for an asset, and assembles it with the other plugins of the command.
 *
 * @example
 * ```ts
 * import { bootPlugin } from "./mod.ts";
 * // bootPlugin(config) is a Result of the plugin that contributes the branch `boot`
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { branch, definePlugin, type Plugin, type PluginProblem } from "@intellectual-frontiers/headless/logical";
import { bootCommands } from "./commands.ts";
import type { BootPluginConfig } from "./config.ts";

export * from "./boot.ts";
export * from "./commands.ts";
export * from "./config.ts";

/** The plugin that contributes `archon boot`, over the fleet's configuration, or everything wrong with its definition. */
export function bootPlugin(config: BootPluginConfig): Result<Plugin, readonly PluginProblem[]> {
  return definePlugin({
    program: config.program ?? "archon",
    noun: "boot",
    version: config.version,
    summary: "Install a blank managed machine from nothing: render its install, arm it, and serve the network boot.",
    contributes: [{ node: branch({ name: "boot", summary: "The network install of a managed machine.", children: bootCommands(config) }) }],
  });
}
