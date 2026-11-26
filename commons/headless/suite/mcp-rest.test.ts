/**
 * Tests of the tool server and the REST skeleton (commons headless 0013-mcp-surface FR-001 to FR-006, 0014-rest-surface FR-001 to FR-003): tools and operations generated from governance by the caller's tier,
 * the arguments as a command line, the JSON-RPC server as a function from a line to a line, the refusals as data, and the whole path through the command line's `run`.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { ADMINISTRATOR, defineReach, OPERATOR, PUBLIC, type TierName } from "../src/governance/mod.ts";
import { argErrorMessage, argvOf, branch, command, flagOf, outcomeOf, placedCommands, programOf, type Program } from "../src/logical/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { callTool, failedStatus, framer, handleLine, MCP_REFUSALS, PROTOCOL_VERSION, serve, served, toolName, type McpConfig, type Transport } from "../src/surfaces/mcp/mod.ts";
import { exposed, methodOf, openApiOf, operationId, pathOf, REFUSAL_REASONS } from "../src/surfaces/rest/mod.ts";
import { world } from "./world.ts";

const both = defineReach({ channels: ["local", "mcp", "rest"], readOnly: true, idempotent: true });
const changing = defineReach({ channels: ["local", "mcp", "rest"] });
const destroying = defineReach({ channels: ["local", "mcp", "rest"], confirmation: "flag" });
const said = (name: string) => () => Promise.resolve(outcomeOf({ said: name }, { text: `${name} ran` }));

/** A program with a verb for each way a machine surface decides. */
const program = (): Program =>
  programOf({
    name: "desired-os-state",
    summary: "The fleet.",
    version: "1.0.0",
    children: [
      branch({
        name: "server",
        summary: "Servers.",
        children: [
          command({ name: "list", summary: "List servers.", options: { limit: value({ short: "l", help: "How many." }), all: flag({ short: "a", help: "Include retired." }) }, operands: [{ name: "name", help: "A name.", arity: "optional" }], action: { kind: "report", reach: both }, run: said("list") }),
          command({ name: "restart", summary: "Restart a server.", options: { reason: value({ help: "Why." }) }, operands: [{ name: "host", help: "The host.", arity: "one" }], action: { kind: "action", tier: OPERATOR, dryRun: true, reach: changing }, run: said("restart") }),
          command({ name: "wipe", summary: "Wipe a server.", options: {}, action: { kind: "action", effect: "destructive", dryRun: true, tier: ADMINISTRATOR, reach: destroying }, run: said("wipe") }),
          command({ name: "key-set", summary: "Set a key.", options: { passphrase: value({ short: "p", help: "The passphrase." }), label: value({ short: "b", help: "A label." }) }, action: { kind: "action", humanOnly: ["passphrase"], reach: changing }, run: said("key-set") }),
        ],
      }),
      command({ name: "login", summary: "Log a person in.", options: {}, action: { kind: "action", audience: "human", reach: defineReach({ channels: ["local"] }) }, run: said("login") }),
      command({ name: "version-info", summary: "Local only.", options: {}, action: { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) }, run: said("version-info") }),
    ],
  });

const config = (tier: TierName, extra: Partial<McpConfig> = {}): McpConfig & { readonly argv: string[][] } => {
  const argv: string[][] = [];
  const p = program();
  return {
    argv,
    program: p,
    tier,
    mayOnlyRead: false,
    run: (words) => {
      argv.push([...words]);
      return Promise.resolve({ code: 0, out: JSON.stringify({ ok: true, words }), err: "" });
    },
    ...extra,
  };
};
const names = (tier: TierName) => {
  const r = served(program(), tier);
  return r.kind === "ok" ? r.value.map((s) => s.tool.name) : r.error;
};
const rpc = async (c: McpConfig, message: unknown): Promise<{ readonly [k: string]: unknown } | undefined> => {
  const line = await handleLine(c, typeof message === "string" ? message : JSON.stringify(message));
  return line === undefined ? undefined : (JSON.parse(line) as { readonly [k: string]: unknown });
};
const call = (c: McpConfig, name: string, args: unknown) => rpc(c, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
const refusalOf = (r: { readonly [k: string]: unknown } | undefined): unknown => ((r?.["result"] as { structuredContent?: { refusal?: string } } | undefined)?.structuredContent)?.refusal;

proves(["0013-mcp-surface FR-001"], "the tools are generated from governance: one for each visible command that may come through mcp and is not for a person alone, with a schema from its options and hints from its effect", () => {
  assertEquals(toolName("desired-os-state", ["server", "key-set"]), "desired_os_state_server_key_set");
  assertEquals(names(PUBLIC), ["desired_os_state_server_list", "desired_os_state_server_key_set"]);
  assertEquals(names(OPERATOR), ["desired_os_state_server_list", "desired_os_state_server_restart", "desired_os_state_server_key_set"]);
  assertEquals(names(ADMINISTRATOR), ["desired_os_state_server_list", "desired_os_state_server_restart", "desired_os_state_server_wipe", "desired_os_state_server_key_set"]);
  const all = served(program(), ADMINISTRATOR);
  const tools = all.kind === "ok" ? all.value.map((s) => s.tool) : [];
  const byName = (n: string) => tools.find((t) => t.name === n);
  assertEquals(byName("desired_os_state_server_list")?.inputSchema, {
    type: "object",
    properties: { limit: { type: "string", description: "How many." }, all: { type: "boolean", description: "Include retired." }, name: { type: "string", description: "A name." } },
    required: [],
    additionalProperties: false,
  });
  const restart = byName("desired_os_state_server_restart");
  assertEquals(Object.keys(restart?.inputSchema.properties ?? {}), ["reason", "dryRun", "host"]);
  assertEquals(restart?.inputSchema.required, ["host"]);
  assertEquals(Object.keys(byName("desired_os_state_server_key_set")?.inputSchema.properties ?? {}), ["label"], "what only a person may give is not offered");
  assertEquals(byName("desired_os_state_server_list")?.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  assertEquals([byName("desired_os_state_server_wipe")?.annotations.destructiveHint, byName("desired_os_state_server_wipe")?.annotations.readOnlyHint], [true, false]);
  assert(!tools.some((t) => t.name.includes("login") || t.name.includes("version")), "a command for a person or for the local channel alone is no tool");
  const clash = programOf({ name: "p", summary: "P.", version: "1", children: [command({ name: "a-b", summary: "A.", options: {}, action: { kind: "report", reach: both }, run: said("x") }), command({ name: "a_b", summary: "A.", options: {}, action: { kind: "report", reach: both }, run: said("x") })] });
  const bad = served(clash, PUBLIC);
  assertEquals(bad.kind === "err" && bad.error.map((p) => p.rule), ["mcp/name-collision"]);
});

proves(["0013-mcp-surface FR-005"], "the arguments of a call become a command line: flags, values as --name=value, operands last, and an unknown, mistyped, missing or option-like argument is an error value", () => {
  const find = (id: string) => placedCommands(program().children).find((p) => p.id === id);
  const list = find("server list");
  const restart = find("server restart");
  if (list === undefined || restart === undefined) throw new Error("fixture");
  const argv = (p: typeof list, a: unknown) => {
    const r = argvOf(p, a);
    return r.kind === "ok" ? r.value : argErrorMessage(r.error);
  };
  assertEquals(flagOf("dryRun"), "--dry-run");
  assertEquals(argv(list, {}), ["server", "list"]);
  assertEquals(argv(list, { limit: "5", all: true, name: "web" }), ["server", "list", "--limit=5", "--all", "web"]);
  assertEquals(argv(list, { all: false }), ["server", "list"]);
  assertEquals(argv(list, { limit: "--x" }), ["server", "list", "--limit=--x"], "a value that starts with a dash is still its value");
  assertEquals(argv(restart, { host: "web-1", dryRun: true, reason: "patch" }), ["server", "restart", "--reason=patch", "--dry-run", "web-1"]);
  assertEquals(argv(list, { extra: 1 }), "extra is not an argument of this tool");
  assertEquals(argv(list, { limit: 5 }), "limit is a string");
  assertEquals(argv(list, { all: "yes" }), "all is a boolean");
  assertEquals(argv(restart, {}), "host is required");
  assertEquals(argv(restart, { host: "--force" }), "host starts with a dash: an operand cannot be given as an option");
  assertEquals(argv(list, []), "the arguments are an object");
  assertEquals(argv(list, { name: null, limit: undefined }), ["server", "list"]);
  assertEquals([failedStatus(0), failedStatus(1), failedStatus(4), failedStatus(2), failedStatus(3)], [false, false, false, true, true]);
});

proves(["0013-mcp-surface FR-004", "0013-mcp-surface FR-006"], "the server answers initialize, ping and tools/list, never answers a notification, and gives the codes of JSON-RPC for a line that is not JSON, not a request, a method it does not serve and parameters that are wrong", async () => {
  const c = config(PUBLIC);
  const init = await rpc(c, { jsonrpc: "2.0", id: "a", method: "initialize", params: { protocolVersion: PROTOCOL_VERSION } });
  assertEquals(init, { jsonrpc: "2.0", id: "a", result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "desired-os-state", version: "1.0.0" } } });
  assertEquals(await rpc(c, { jsonrpc: "2.0", id: 2, method: "ping" }), { jsonrpc: "2.0", id: 2, result: {} });
  const list = await rpc(c, { jsonrpc: "2.0", id: 3, method: "tools/list" });
  assertEquals(((list?.["result"] as { tools: { name: string }[] }).tools).map((t) => t.name), ["desired_os_state_server_list", "desired_os_state_server_key_set"]);
  assertEquals(await rpc(c, { jsonrpc: "2.0", method: "notifications/initialized" }), undefined);
  assertEquals(await rpc(c, { jsonrpc: "2.0", method: "nothing/at-all" }), undefined, "a notification is never answered, whatever it names");
  const code = async (m: unknown) => ((await rpc(c, m))?.["error"] as { code: number } | undefined)?.code;
  assertEquals(await code("{not json"), -32700);
  assertEquals(await code([{ jsonrpc: "2.0", id: 1, method: "ping" }]), -32600, "a batch is not part of this protocol version");
  assertEquals(await code({ id: 1, method: "ping" }), -32600);
  assertEquals(await code({ jsonrpc: "2.0", id: { x: 1 }, method: "ping" }), -32600);
  assertEquals(await code({ jsonrpc: "2.0", id: 4, method: "resources/list" }), -32601);
  assertEquals(await code({ jsonrpc: "2.0", id: 5, method: "tools/call", params: {} }), -32602);
  assertEquals(await code({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "desired_os_state_nothing", arguments: {} } }), -32602);
  assertEquals((await rpc(c, "{not json"))?.["id"], null);
  // every answer is one line
  for (const m of [{ jsonrpc: "2.0", id: 7, method: "tools/list" }, "{not json"]) assert(!(await handleLine(c, typeof m === "string" ? m : JSON.stringify(m)))?.includes("\n"));
  // the framing: lines from chunks, a partial line kept, the end gives the rest
  const f = framer();
  assertEquals([f.push("a\nb"), f.push("c\r\nd\n"), f.push("e"), f.end(), f.end()], [["a"], ["bc", "d"], [], ["e"], []]);
  // serving a transport answers each line in order and writes nothing for a notification
  const written: string[] = [];
  const lines = ['{"jsonrpc":"2.0","id":1,"method":"ping"}', "", '{"jsonrpc":"2.0","method":"notifications/initialized"}', '{"jsonrpc":"2.0","id":2,"method":"ping"}'];
  const transport: Transport = { lines: (async function* () { yield* lines; })(), write: (l) => void written.push(l) };
  await serve(c, transport);
  assertEquals(written.map((l) => (JSON.parse(l) as { id: number }).id), [1, 2]);
});

proves(["0013-mcp-surface FR-002", "0013-mcp-surface FR-003"], "a call is gated as a machine's: a hidden tool is refused with the reason of the tier, a channel, a key that may only read, what only a person may give or do and a destructive action that a flag cannot confirm are refused with theirs, and a preview goes", async () => {
  const c = config(OPERATOR);
  const ran = await call(c, "desired_os_state_server_restart", { host: "web-1" });
  assertEquals(c.argv, [["server", "restart", "web-1", "--json", "--non-interactive"]]);
  assertEquals((ran?.["result"] as { isError: boolean }).isError, false);
  assertEquals(refusalOf(await call(c, "desired_os_state_server_wipe", {})), "tier-too-low");
  assertEquals(refusalOf(await call(config(PUBLIC), "desired_os_state_server_restart", { host: "x" })), "tier-too-low");
  assertEquals(c.argv.length, 1, "nothing else ran");
  const admin = config(ADMINISTRATOR);
  assertEquals(refusalOf(await call(admin, "desired_os_state_server_wipe", {})), "confirmation-needed");
  const sure = await call(admin, "desired_os_state_server_wipe", { dryRun: true });
  assertEquals((sure?.["result"] as { isError: boolean }).isError, false);
  assertEquals(admin.argv, [["server", "wipe", "--dry-run", "--json", "--non-interactive"]], "a destructive action goes as a preview only");
  assertEquals(refusalOf(await call(admin, "desired_os_state_server_key_set", { passphrase: "x", label: "l" })), "human-only-option");
  assertEquals(refusalOf(await call(admin, "desired_os_state_login", {})), "channel", "a command for a person is never a tool of this server");
  assertEquals(refusalOf(await call(admin, "desired_os_state_version_info", {})), "channel");
  const reading = config(ADMINISTRATOR, { mayOnlyRead: true });
  assertEquals(refusalOf(await call(reading, "desired_os_state_server_restart", { host: "x" })), "read-only-key");
  assertEquals((await call(reading, "desired_os_state_server_list", {}))?.["result"] !== undefined, true, "a key that may only read runs a report");
  const typed = await call(admin, "desired_os_state_server_restart", {});
  assertStringIncludes(JSON.stringify(typed), "host is required");
  assertEquals((typed?.["result"] as { isError: boolean }).isError, true);
  assertEquals(await callTool(admin, "desired_os_state_ghost", {}), undefined);
  assertEquals(new Set(MCP_REFUSALS).size, MCP_REFUSALS.length);
  const failing = config(OPERATOR, { run: () => Promise.resolve({ code: 3, out: "", err: "the environment is not ready" }) });
  const bad = await call(failing, "desired_os_state_server_list", {});
  assertEquals(bad?.["result"], { content: [{ type: "text", text: "the environment is not ready" }], isError: true });
});

proves(["0013-mcp-surface FR-005"], "a call runs the command through the command line with the caller's tier and gives its JSON document as the text and as the structured content", async () => {
  const p = program();
  const runner = (tier: TierName) => async (words: readonly string[]) => {
    const r = await run(p, [...words], world({ tier }));
    return { code: r.code, out: r.out, err: r.err };
  };
  const c = config(OPERATOR, { run: runner(OPERATOR) });
  const r = await call(c, "desired_os_state_server_list", { limit: "3" });
  const result = r?.["result"] as { content: { text: string }[]; structuredContent: { command: string; ok: boolean }; isError: boolean };
  assertEquals([result.isError, result.structuredContent.command, result.structuredContent.ok], [false, "server list", true]);
  assertEquals(JSON.parse(result.content[0]?.text ?? "{}"), result.structuredContent);
  const hidden = await run(p, ["server", "wipe", "--json"], world({ tier: OPERATOR }));
  assertEquals(hidden.code, 2, "the command line refuses what the tier hides, too");
});

proves(["0014-rest-surface FR-001", "0014-rest-surface FR-002", "0014-rest-surface FR-003"], "the OpenAPI 3.1 document has a path for each command the tier may see and the rest channel allows, GET for a report and POST for the rest, with the effect and the tier of each, and the refusals as data", () => {
  assertEquals(pathOf(["server", "list"]), "/v1/server/list");
  assertEquals(operationId("desired-os-state", ["server", "key-set"]), "desired_os_state_server_key_set");
  const doc = (tier: TierName) => openApiOf(program(), tier) as { openapi: string; info: { title: string; version: string }; paths: Record<string, Record<string, { operationId: string; "x-effect": string; "x-tier": string; parameters?: { name: string; in: string; required: boolean }[]; requestBody?: { required: boolean; content: { "application/json": { schema: { properties: Record<string, unknown>; required: string[] } } } }; responses: Record<string, unknown> }>>; components: { securitySchemes: Record<string, unknown> } };
  const pub = doc(PUBLIC);
  assertEquals([pub.openapi, pub.info.title, pub.info.version], ["3.1.0", "desired-os-state", "1.0.0"]);
  assertEquals(Object.keys(pub.paths), ["/v1/server/list", "/v1/server/key-set"]);
  assertEquals(Object.keys(doc(ADMINISTRATOR).paths), ["/v1/server/list", "/v1/server/restart", "/v1/server/wipe", "/v1/server/key-set"]);
  const list = pub.paths["/v1/server/list"]?.["get"];
  assertEquals([list?.operationId, list?.["x-effect"], list?.["x-tier"]], ["desired_os_state_server_list", "read", "public"]);
  assertEquals(list?.parameters?.map((p) => [p.name, p.in, p.required]), [["limit", "query", false], ["all", "query", false], ["name", "query", false]]);
  const set = pub.paths["/v1/server/key-set"]?.["post"];
  assertEquals(Object.keys(set?.requestBody?.content["application/json"].schema.properties ?? {}), ["label"], "what only a person may give is absent");
  const restart = doc(OPERATOR).paths["/v1/server/restart"]?.["post"];
  assertEquals([restart?.["x-tier"], restart?.requestBody?.required, restart?.requestBody?.content["application/json"].schema.required], ["operator", true, ["host"]]);
  assertEquals(Object.keys(pub.paths["/v1/server/list"]?.["get"]?.responses ?? {}), ["200", "400", "403", "409"]);
  assertEquals(Object.keys(pub.components.securitySchemes), ["bearer"]);
  const refusal = JSON.stringify(pub.paths["/v1/server/list"]?.["get"]?.responses["403"]);
  for (const reason of REFUSAL_REASONS) assertStringIncludes(refusal, reason);
  assertEquals([...REFUSAL_REASONS].sort(), [...MCP_REFUSALS].sort(), "the REST refusals are the tool server's");
  const placed = placedCommands(program().children);
  assertEquals(placed.filter(exposed).map((p) => [p.id, methodOf(p)]), [["server list", "get"], ["server restart", "post"], ["server wipe", "post"], ["server key-set", "post"]]);
  assertEquals(JSON.stringify(openApiOf(program(), PUBLIC)), JSON.stringify(openApiOf(program(), PUBLIC)), "pure");
  assert(!JSON.stringify(pub).includes("login"));
});
