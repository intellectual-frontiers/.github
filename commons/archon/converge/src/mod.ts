// Spec: 0002-converge-command FR-001
/**
 * The plugin of `archon` for convergence: a fleet gives it its dialect and the function that says what must be true of an asset, and assembles it with the other plugins of the command.
 *
 * @example
 * ```ts
 * import { convergePlugin } from "./mod.ts";
 * // convergePlugin(config) is a Result of the plugin that contributes the branch `converge`
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { branch, definePlugin, type Plugin, type PluginProblem } from "@intellectual-frontiers/headless/logical";
import { convergeCommands } from "./commands.ts";
import type { ConvergePluginConfig } from "./config.ts";

export * from "./commands.ts";
export * from "./config.ts";
export * from "./run.ts";

/** The plugin that contributes `archon converge`, over the fleet's configuration, or everything wrong with its definition. */
export function convergePlugin(config: ConvergePluginConfig): Result<Plugin, readonly PluginProblem[]> {
  return definePlugin({
    program: config.program ?? "archon",
    noun: "converge",
    version: config.version,
    summary: "Converge a managed machine to what its requirements declare: plan, approve by hash, apply with the fleet's dialect, show the plan is empty.",
    contributes: [{ node: branch({ name: "converge", summary: "Convergence of a managed machine.", children: convergeCommands(config) }) }],
  });
}
