// Spec: 0013-mcp-surface FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * A tool server in the Model Context Protocol (commons headless 0013-mcp-surface): JSON-RPC 2.0, one message to a line, over any transport that gives lines and takes lines. `handleLine` is the whole
 * server as a function: a line in, the line to answer with (or none, for a notification) out. It answers `initialize`, `ping`, `tools/list` and `tools/call`; the tools are those the caller's tier may
 * see (`served`), a call is gated by governance as a machine's (the tier, the channel, the key that may only read, what only a person may do and give, and the confirmation a flag cannot stand for)
 * and then run through a port, `ToolRunner`, which the host wires to the command line's `run` with the caller's tier.
 *
 * @remarks
 * The server touches no process global and no stream: `serve` takes a `Transport` (lines in, lines out), and `stdioTransport` is the standard streams'. Standard output carries the protocol and nothing else.
 * A call that is refused is a tool result with `isError` and a `refusal` that names why in a closed set, so a client and an agent can tell a tier from a channel from a confirmation; a call to
 * a word that is no tool at all is the protocol's invalid parameters.
 *
 * @example
 * ```ts
 * import { handleLine } from "./server.ts";
 * // handleLine(config, '{"jsonrpc":"2.0","id":1,"method":"ping"}') // resolves to '{"jsonrpc":"2.0","id":1,"result":{}}'
 * ```
 *
 * @module
 */
import { type Result } from "@intellectual-frontiers/core";
import {
  decide,
  modeOf,
  reachDecision,
  tierMessage,
  type Refusal,
  type TierName,
} from "@intellectual-frontiers/headless/governance";
import { argErrorMessage, argvOf, hiddenVerb, type Program } from "@intellectual-frontiers/headless/logical";
import { served, type McpTool, type Served, type ToolProblem } from "./tools.ts";

/** The version of the protocol this server speaks. */
export const PROTOCOL_VERSION = "2025-06-18";

/** What ran a tool: the status and the two streams, as the command line's `run` gives them. */
export type ToolOutput = { readonly code: number; readonly out: string; readonly err: string };

/** The port that runs a command by its argument vector (the words, options and operands, with no program name). The host wires it to the command line's `run` with the caller's tier. */
export type ToolRunner = (argv: readonly string[]) => Promise<ToolOutput>;

/** What the server is: the program, who calls it, and how a command runs. */
export type McpConfig = {
  readonly program: Program;
  /** The tier the caller holds: fixed by the host (a key, a forced command), never taken from a message. */
  readonly tier: TierName;
  /** Whether the caller's key may only read: a command that changes something is then refused. */
  readonly mayOnlyRead: boolean;
  readonly run: ToolRunner;
};

/** Why a call was refused, a closed set. */
export type McpRefusal = Refusal | "tier-too-low" | "tier-unknown" | "channel" | "read-only-key";

/** Every refusal, for a program that walks them. */
export const MCP_REFUSALS: readonly McpRefusal[] = ["human-only-action", "human-only-option", "confirmation-needed", "confirmation-not-accepted", "consent-needed", "tier-too-low", "tier-unknown", "channel", "read-only-key"];

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** The result of a call that ran, or was refused. */
export type CallResult = {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly structuredContent?: Json;
  readonly isError: boolean;
};

const text = (t: string, isError: boolean, extra: { readonly structuredContent?: Json } = {}): CallResult => ({ content: [{ type: "text", text: t }], isError, ...extra });

/** A call that was refused: one sentence, and the reason as data. */
export function refused(reason: McpRefusal, message: string): CallResult {
  return text(message, true, { structuredContent: { refusal: reason } });
}

/** The tools the caller is served, or the names that collide. */
export function toolsOf(config: McpConfig): Result<readonly Served[], readonly ToolProblem[]> {
  return served(config.program, config.tier);
}

function jsonOrUndefined(t: string): Json | undefined {
  try {
    return JSON.parse(t) as Json;
  } catch {
    return undefined;
  }
}

/** Whether a status is one a tool ended as, and not one that it failed with: 0 (ok), 1 (findings) and 4 (pending) are results; the rest are errors. */
export function failedStatus(code: number): boolean {
  return !(code === 0 || code === 1 || code === 4);
}

/**
 * A tool call: refused where governance says so, else run and told. The order is the tier (a hidden tool is refused for it), the channel, the key that may only read, then `decide` as a machine
 * surface that cannot ask and takes no flag for a confirmation (a destructive action goes only as a preview here).
 */
export async function callTool(config: McpConfig, name: string, args: unknown): Promise<CallResult | undefined> {
  const built = toolsOf(config);
  const all = built.kind === "ok" ? built.value : [];
  const found = all.find((s) => s.tool.name === name);
  if (found === undefined) {
    // a tool that exists but is hidden from this caller is refused with the reason; a name that is no tool at all is unknown (the caller turns it into an invalid-params error)
    const names = new Map(placedAll(config.program).map((p) => [p.name, p.words] as const));
    const words = names.get(name);
    if (words === undefined) return undefined;
    const hidden = hiddenVerb(config.program, words, config.tier);
    if (hidden !== undefined) return refused(hidden.decision.reason, tierMessage(hidden.id, hidden.decision));
    return refused("channel", `${words.join(" ")} may not be reached through mcp`);
  }
  const { placed } = found;
  const reach = reachDecision(placed.facts, placed.reach ?? { channels: ["mcp"], readOnly: false, idempotent: false, needsTty: false, runsAs: "caller", confirmation: "none" }, "mcp", { mayOnlyRead: config.mayOnlyRead });
  if (reach.kind === "refused") return refused(reach.reason === "channel" ? "channel" : "read-only-key", reach.message);
  const given = typeof args === "object" && args !== null ? Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k]) => k) : [];
  const person = placed.facts.humanOnly.find((k) => given.includes(k));
  if (person !== undefined) return refused("human-only-option", `${person} is for a person to give: it cannot be given through this interface`);
  const argv = argvOf(placed, args ?? {});
  if (argv.kind === "err") return text(argErrorMessage(argv.error), true);
  const mode = modeOf({ dryRun: argv.value.includes("--dry-run"), check: argv.value.includes("--check") });
  if (mode.kind === "err") return text(mode.error, true);
  const decision = decide(placed.facts, { audience: "machine", interactive: false, flagConfirms: false }, { mode: mode.value, confirmed: false, given }, placed.reach);
  if (decision.kind === "refuse") return refused(decision.reason, decision.message);
  const ran = await config.run([...argv.value, "--json", "--non-interactive"]);
  const structured = jsonOrUndefined(ran.out);
  return text(ran.out === "" ? ran.err : ran.out, failedStatus(ran.code), structured === undefined ? {} : { structuredContent: structured });
}

/** Every command of the program with the name its tool would have, whatever the tier: so that a hidden tool is told from a word that is no tool. */
function placedAll(program: Program): readonly { readonly name: string; readonly words: readonly string[] }[] {
  const walk = (nodes: Program["children"], path: readonly string[]): readonly { readonly name: string; readonly words: readonly string[] }[] =>
    nodes.flatMap((n) => {
      const here = [...path, n.name];
      return n.kind === "branch" ? walk(n.children, here) : [{ name: [program.name, ...here].join("_").replace(/[^A-Za-z0-9_]/g, "_"), words: here }];
    });
  return walk(program.children, []);
}

/** The codes of JSON-RPC 2.0 this server uses. */
export const RPC = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 } as const;

type Id = string | number | null;

const reply = (id: Id, result: Json): string => JSON.stringify({ jsonrpc: "2.0", id, result });
const fail = (id: Id, code: number, message: string): string => JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });

const isRecord = (v: unknown): v is { readonly [k: string]: unknown } => typeof v === "object" && v !== null && !Array.isArray(v);

/** The tool as `tools/list` gives it. */
function listed(t: McpTool): Json {
  return JSON.parse(JSON.stringify(t)) as Json;
}

/**
 * One line in, the line to answer with out, or `undefined` for a notification (no `id`), which is never answered. A line that is not JSON is a parse error, one that is not a request an invalid request
 * (a batch is one: this protocol version has none), a method that is not served `method not found`.
 */
export async function handleLine(config: McpConfig, line: string): Promise<string | undefined> {
  const parsed = jsonOrUndefined(line);
  if (parsed === undefined) return fail(null, RPC.parse, "the line is not JSON");
  if (!isRecord(parsed) || parsed["jsonrpc"] !== "2.0" || typeof parsed["method"] !== "string") return fail(isRecord(parsed) && (typeof parsed["id"] === "string" || typeof parsed["id"] === "number") ? parsed["id"] : null, RPC.invalidRequest, "not a JSON-RPC 2.0 request");
  const id = parsed["id"];
  const notification = id === undefined;
  if (!notification && typeof id !== "string" && typeof id !== "number") return fail(null, RPC.invalidRequest, "the id is a string or a number");
  const method = parsed["method"];
  const params = parsed["params"];
  const answer = async (): Promise<string> => {
    const rid: Id = notification ? null : id;
    switch (method) {
      case "initialize":
        return reply(rid, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: config.program.name, version: config.program.version } });
      case "ping":
        return reply(rid, {});
      case "tools/list": {
        const built = toolsOf(config);
        return built.kind === "ok" ? reply(rid, { tools: built.value.map((s) => listed(s.tool)) }) : fail(rid, RPC.internal, `two commands would be one tool: ${built.error.map((p) => p.name).join(", ")}`);
      }
      case "tools/call": {
        if (!isRecord(params) || typeof params["name"] !== "string") return fail(rid, RPC.invalidParams, "tools/call takes a name and arguments");
        const result = await callTool(config, params["name"], params["arguments"]);
        return result === undefined ? fail(rid, RPC.invalidParams, `${params["name"]} is not a tool of this server`) : reply(rid, JSON.parse(JSON.stringify(result)) as Json);
      }
      default:
        return fail(rid, RPC.methodNotFound, `${method} is not served`);
    }
  };
  if (notification) {
    // a notification (`notifications/initialized`, `notifications/cancelled`) is never answered, whatever it says
    return undefined;
  }
  try {
    return await answer();
  } catch {
    return fail(id, RPC.internal, "the server failed");
  }
}

/** Lines in and lines out: what a tool server is served over. */
export type Transport = {
  readonly lines: AsyncIterable<string>;
  readonly write: (line: string) => void;
};

/** Serves a transport until its lines end: each line is answered in order, and a line is never written with a line break inside it. */
export async function serve(config: McpConfig, transport: Transport): Promise<void> {
  for await (const line of transport.lines) {
    if (line.trim() === "") continue;
    const out = await handleLine(config, line);
    if (out !== undefined) transport.write(out);
  }
}
