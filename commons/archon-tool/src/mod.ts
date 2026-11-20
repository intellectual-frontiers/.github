// Spec: 0002-tool-command FR-001
/**
 * The plugin of `archon` for tools: a fleet gives it its catalog, its dialects and its policy, and assembles it with the other plugins of the command.
 *
 * @example
 * ```ts
 * import { toolPlugin } from "./mod.ts";
 * // toolPlugin(config) is a Result of the plugin that contributes the branch `tool`
 * ```
 *
 * @module
 */
import { branch, definePlugin, type Plugin, type PluginProblem } from "@intellectual-frontiers/headless/logical";
import type { Result } from "@intellectual-frontiers/core";
import { toolCommands } from "./commands.ts";
import type { ToolPluginConfig } from "./config.ts";

export * from "./analysis.ts";
export * from "./commands.ts";
export * from "./config.ts";

/** The plugin that contributes `archon tool`, over the fleet's configuration, or everything wrong with its definition. */
export function toolPlugin(config: ToolPluginConfig): Result<Plugin, readonly PluginProblem[]> {
  return definePlugin({
    program: "archon",
    noun: "tool",
    version: config.version,
    summary: "The tools a computer needs to do its work: list them, show how each is resolved, ensure them, find what drifted, clean what can be got again.",
    contributes: [{ node: branch({ name: "tool", summary: "The tools a computer needs to do its work.", children: toolCommands(config) }) }],
  });
}
