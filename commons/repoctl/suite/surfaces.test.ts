/**
 * Tests of the surfaces of Repoctl (commons repoctl 0006-repoctl-surfaces FR-001 to FR-006): the model of the program under Headless' conformance and the examples of every verb, its description for the documentation, the tools of the tool
 * server by tier (and a real `repoctl mcp` on standard input and output), the reach of each action and the confirmation that only a person may give, the tier as a fact of the host, and the root package's script and bin.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { err } from "@intellectual-frontiers/core";
import { describe } from "@intellectual-frontiers/headless/describe";
import { callTool, served, toolsOf } from "@intellectual-frontiers/headless/mcp";
import { modelProblems, placedCommands } from "@intellectual-frontiers/headless/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { PROBLEM_CODES, TIERS, VERBS, verbIds, type VerbId } from "@intellectual-frontiers/repoctl/governance";
import { INERT_HOST, repoctlProgram, systemWorld, traitsOf } from "@intellectual-frontiers/repoctl/physical";
import { main } from "@intellectual-frontiers/repoctl";
import { CAN_RUN, CHECKOUT, execute, hostOf } from "./world.ts";

const program = repoctlProgram(INERT_HOST);

proves(["0006-repoctl-surfaces FR-001"], "every verb has examples and its facts from the table, and the model of the program has no problem", () => {
  assertEquals(modelProblems(program, { requireReach: true }), []);
  const placed = placedCommands(program.children);
  assertEquals(placed.map((p) => p.id).sort(), [...verbIds()].sort());
  for (const p of placed) {
    assert(p.command.examples.length > 0, `${p.id} has an example`);
    assert(p.command.examples.every((e) => e.says.trim() !== ""), `${p.id}'s examples say what they do`);
    const facts = VERBS[p.id as VerbId];
    assertEquals([p.command.summary, p.facts.effect, p.facts.idempotent, p.facts.kind], [facts.summary, facts.effect, facts.idempotent, facts.kind], p.id);
  }
  assertEquals(program.name, "repoctl");
});

proves(["0006-repoctl-surfaces FR-002"], "the program is described: its verbs, options, tools and codes are elements of the model", () => {
  const model = JSON.stringify(describe(program));
  for (const id of verbIds()) assertStringIncludes(model, id);
  for (const code of PROBLEM_CODES) assertStringIncludes(model, code);
  for (const text of ["repoctl_release_publish", "--confirm", "--offline", "--only", "reachConfirmation", "releaser"]) assertStringIncludes(model, text);
});

const names = (tier: keyof typeof TIERS): readonly string[] => {
  const r = toolsOf({ program, tier: TIERS[tier], mayOnlyRead: false, run: () => Promise.resolve({ code: 0, out: "", err: "" }) });
  return r.kind === "ok" ? r.value.map((s) => s.tool.name) : [];
};

proves(["0006-repoctl-surfaces FR-003", "0006-repoctl-surfaces FR-005"], "the tools a tier sees are the verbs of that tier and below that come through the tool server", () => {
  assertEquals(names("public"), ["repoctl_check", "repoctl_status", "repoctl_hygiene", "repoctl_release_plan", "repoctl_doctor"]);
  assertEquals(names("contributor"), ["repoctl_check", "repoctl_sync", "repoctl_merge", "repoctl_status", "repoctl_hygiene", "repoctl_release_plan", "repoctl_release_apply", "repoctl_new_library", "repoctl_commit", "repoctl_doctor"]);
  assertEquals(names("releaser"), [...names("contributor").slice(0, 7), "repoctl_release_publish", ...names("contributor").slice(7)]);
  assert(!names("releaser").includes("repoctl_mcp"), "the tool server does not serve itself");
  const publish = served(program, TIERS.releaser);
  assert(publish.kind === "ok");
  const tool = publish.value.find((s) => s.tool.name === "repoctl_release_publish")?.tool;
  assertEquals(tool?.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });
  assert(tool !== undefined && !("confirm" in tool.inputSchema.properties), "the option that types the confirmation is not in the schema");
  assert(tool !== undefined && "dryRun" in tool.inputSchema.properties);
});

proves(["0006-repoctl-surfaces FR-003", "0006-repoctl-surfaces FR-004"], "a tool the tier does not see is refused with the reason, a destruction is only a preview, the confirmation is for a person alone and a key that may only read changes nothing", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    const host = hostOf(systemWorld(dir, () => undefined));
    const real = repoctlProgram(host);
    const ran: string[][] = [];
    const config = (tier: keyof typeof TIERS, mayOnlyRead = false) => ({
      program: real,
      tier: TIERS[tier],
      mayOnlyRead,
      run: (argv: readonly string[]) => {
        ran.push([...argv]);
        return Promise.resolve({ code: 0, out: "{}", err: "" });
      },
    });
    const hidden = await callTool(config("public"), "repoctl_sync", {});
    assertEquals(hidden?.structuredContent, { refusal: "tier-too-low" });
    assertEquals(hidden?.isError, true);
    const noPublish = await callTool(config("contributor"), "repoctl_release_publish", { dryRun: true });
    assertEquals(noPublish?.structuredContent, { refusal: "tier-too-low" });
    const destroy = await callTool(config("releaser"), "repoctl_release_publish", {});
    assertEquals(destroy?.structuredContent, { refusal: "confirmation-needed" });
    const person = await callTool(config("releaser"), "repoctl_release_publish", { confirm: "publish 1 abcdefgh", dryRun: true });
    assertEquals(person?.structuredContent, { refusal: "human-only-option" });
    const preview = await callTool(config("releaser"), "repoctl_release_publish", { dryRun: true });
    assertEquals(preview?.isError, false);
    assertEquals(ran, [["release", "publish", "--dry-run", "--json", "--non-interactive"]]);
    const readOnly = await callTool(config("contributor", true), "repoctl_sync", {});
    assertEquals(readOnly?.structuredContent, { refusal: "read-only-key" });
    const reads = await callTool(config("contributor", true), "repoctl_status", { offline: true });
    assertEquals(reads?.isError, false);
    assertEquals(await callTool(config("releaser"), "repoctl_nothing", {}), undefined);
  });
});

proves(["0006-repoctl-surfaces FR-004"], "the reach of each action: reports are read-only and safe to repeat, sync previews and checks, publish is a destruction confirmed by a person who alone gives the confirmation", () => {
  for (const id of verbIds()) {
    const t = traitsOf(id);
    const f = VERBS[id];
    assertEquals(t.reach?.readOnly, f.effect === "read", id);
    assertEquals(t.reach?.idempotent, f.idempotent, id);
    if (f.kind === "report") assertEquals([t.reach?.readOnly, t.reach?.idempotent], [true, true], id);
  }
  assertEquals([traitsOf("sync").dryRun, traitsOf("sync").check, traitsOf("sync").reach?.idempotent], [true, true, true]);
  const publish = traitsOf("release publish");
  assertEquals([publish.effect, publish.dryRun, publish.reach?.confirmation, publish.humanOnly], ["destructive", true, "person", ["confirm"]]);
  assertEquals(publish.tier, TIERS.releaser);
});

proves(["0006-repoctl-surfaces FR-005"], "the tier is the host's: an unknown word ends with 2, and a verb of a higher tier is not there, offered or run", async () => {
  const out: string[] = [];
  const e: string[] = [];
  const run = (argv: readonly string[], tier: string | undefined) => main(argv, { cwd: CHECKOUT, env: tier === undefined ? {} : { REPOCTL_TIER: tier }, out: (t) => void out.push(t), err: (t) => void e.push(t) });
  assertEquals(await run(["help"], "admin"), 2);
  assertStringIncludes(e.join(""), "admin is not a tier");
  out.length = 0;
  assertEquals(await run(["help"], "public"), 0);
  const help = out.join("");
  assertStringIncludes(help, "check");
  assert(!/^\s+sync\b/m.test(help) && !/^\s+merge\b/m.test(help), "a public caller is not offered sync or merge");
  e.length = 0;
  assertEquals(await run(["sync", "--check"], "public"), 2);
  assertStringIncludes(e.join(""), "tier-too-low");
  out.length = 0;
  assertEquals(await run(["release", "--help"], "contributor"), 0);
  assert(!/^\s+publish\b/m.test(out.join("")), "a contributor is not offered publish");
  out.length = 0;
  assertEquals(await run(["release", "--help"], "releaser"), 0);
  assert(/^\s+publish\b/m.test(out.join("")), "a releaser is");
  out.length = 0;
  assertEquals(await run(["release", "--help"], undefined), 0, "the tier of a caller who says nothing is contributor");
  assert(!/^\s+publish\b/m.test(out.join("")));
  const real = await execute({ env: () => undefined, world: () => err("no checkout") }, ["check"]);
  assertEquals(real.code, 3, "a host that has no checkout ends with 3");
});

proves(["0006-repoctl-surfaces FR-003"], "a real tool server on standard input and output serves the tools of the held tier and answers a call", async () => {
  if (!CAN_RUN) return;
  const { proc } = await import("@intellectual-frontiers/system");
  const lines = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "repoctl_status", arguments: { offline: true } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "repoctl_sync", arguments: {} } },
  ];
  const r = await proc.run(["bun", path.join(CHECKOUT, "commons/repoctl/src/repoctl.ts"), "mcp"], { cwd: CHECKOUT, input: `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`, env: { REPOCTL_TIER: "public" } });
  const replies = r.stdout.split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as { id: number; result?: { tools?: { name: string }[]; isError?: boolean; structuredContent?: { data?: { rows?: unknown[] }; refusal?: string } } });
  assertEquals(replies.map((x) => x.id), [1, 2, 3, 4]);
  assertEquals(replies[1]?.result?.tools?.map((t) => t.name), ["repoctl_check", "repoctl_status", "repoctl_hygiene", "repoctl_release_plan", "repoctl_doctor"]);
  assertEquals(replies[2]?.result?.isError, false);
  assert((replies[2]?.result?.structuredContent?.data?.rows?.length ?? 0) > 20, "the status of every library");
  assertEquals(replies[3]?.result?.structuredContent, { refusal: "tier-too-low" });
}, { timeout: 60_000 });

proves(["0006-repoctl-surfaces FR-006"], "the root package has the script and the bin, and the launcher and the bundle's entry are there", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(CHECKOUT, "package.json"))) as { scripts: Record<string, string>; bin: Record<string, string> };
  assertEquals(pkg.scripts["repoctl"], "bun commons/libraries/src/link.ts && bun commons/repoctl/src/repoctl.ts");
  assertEquals(pkg.bin["repoctl"], "./commons/repoctl/bin/repoctl.mjs");
  for (const f of ["commons/repoctl/bin/repoctl.mjs", "commons/repoctl/bin/main.ts", "commons/repoctl/tools/pack.ts"]) assert(await fs.exists(path.join(CHECKOUT, f)), f);
  assertStringIncludes(await fs.readTextFile(path.join(CHECKOUT, "commons/repoctl/tools/pack.ts")), 'bin: { repoctl: "bin/main.ts" }');
  assertStringIncludes(await fs.readTextFile(path.join(CHECKOUT, "commons/repoctl/bin/repoctl.mjs")), "ts/node");
});
