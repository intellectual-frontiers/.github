// Spec: 0013-mcp-surface FR-001
/**
 * The tool-server surface (commons headless 0013-mcp-surface): tools generated from governance by the caller's tier, the JSON-RPC 2.0 server of the Model Context Protocol as a function from a line
 * to a line, and the standard streams as its transport.
 *
 * @example
 * ```ts
 * import { toolName } from "@intellectual-frontiers/headless/mcp";
 * toolName("desired-os-state", ["server", "list"]); // "desired_os_state_server_list"
 * ```
 *
 * @module
 */
export * from "./server.ts";
export * from "./stdio.ts";
export * from "./tools.ts";
