// Spec: 0006-agents FR-018, FR-029
/**
 * A handshake with a tool server (commons ergonex 0006-agents FR-018, FR-029): `initialize`, `notifications/initialized` and `tools/list`, sent as lines on its standard input, and the answers read.
 * It is how `agent doctor` and `remote bootstrap` ask whether `ergonex mcp` answers; it is not the proof of the server (FR-023 is proved by clients that Ergonex did not write).
 *
 * @example
 * ```ts
 * import { handshakeInput, readHandshake } from "./mcp-probe.ts";
 * readHandshake("").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** What a server said of itself. */
export type Handshake = { readonly protocolVersion: string; readonly serverName: string; readonly tools: readonly string[] };

/** The lines a client sends, as one text; closing the input ends a server of standard input and output. */
export function handshakeInput(clientName: string): string {
  const lines = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: clientName, version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ];
  return `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
}

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The handshake from what the server wrote, or what is wrong with it. */
export function readHandshake(stdout: string): Result<Handshake, string> {
  let init: Readonly<Record<string, unknown>> | undefined;
  let list: Readonly<Record<string, unknown>> | undefined;
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      return err("standard output holds a line that is not a message of the protocol (a tool server writes nothing else there)");
    }
    if (!isObject(v)) continue;
    if (v["id"] === 1 && isObject(v["result"])) init = v["result"];
    if (v["id"] === 2 && isObject(v["result"])) list = v["result"];
  }
  if (init === undefined) return err("the server did not answer `initialize`");
  const info = init["serverInfo"];
  const version = init["protocolVersion"];
  const tools = list !== undefined && Array.isArray(list["tools"]) ? list["tools"].flatMap((t) => (isObject(t) && typeof t["name"] === "string" ? [t["name"]] : [])) : [];
  if (list === undefined) return err("the server did not answer `tools/list`");
  return ok({ protocolVersion: typeof version === "string" ? version : "", serverName: isObject(info) && typeof info["name"] === "string" ? info["name"] : "", tools });
}
