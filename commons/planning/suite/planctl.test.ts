/**
 * Tests of `planctl` (commons planning 0005-planning-surfaces FR-001 to FR-006): the configuration parsed and refused naming its field, the principal established and never guessed, the verbs run over a made-up
 * repository in a temporary folder (in process and as a real process), the plan that is only a dry run and the apply held to its hash, the check mode and its status, and the tool server over its real transport with
 * an agent and its principal. The live client of a Git host needs an account and is not used here.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { output } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { agent, person, type ItemEvent } from "@intellectual-frontiers/planning/governance";
import { contextOf, definePlanning, mintEventId, parsePlanning, principalOf } from "@intellectual-frontiers/planning/logical";
import { main } from "../src/planctl.ts";
import { ADA, clock, event, itemId, must, WALL } from "./support.ts";

type Run = { readonly code: number; readonly out: string; readonly err: string };

async function run(cwd: string, argv: readonly string[], env: Record<string, string | undefined> = {}): Promise<Run> {
  let out = "";
  let err = "";
  const code = await main(argv, { cwd, env: { ...env }, out: (t) => void (out += t), err: (t) => void (err += t), now: () => WALL + 5_000_000_000 });
  return { code, out, err };
}

const CONFIG = (extra = "") => `export default {\n  store: { place: "planning/" },\n  sources: [{ name: "markdown", place: "docs/" }],\n${extra}};\n`;

function repo(config = CONFIG(), tasks = "# Tasks\n- [ ] write the spec\n- [ ] write the code\n  - [ ] and the tests\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "planctl-"));
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "docs", "tasks.md"), tasks);
  writeFileSync(join(dir, "planning.config.ts"), config);
  return dir;
}
const cleanup = (dir: string) => rmSync(dir, { recursive: true, force: true });
const storeFiles = (dir: string): readonly string[] => {
  try {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)).map((p) => `${e.name}/${p}`) : [e.name]));
    return walk(join(dir, "planning"));
  } catch {
    return [];
  }
};

proves(["0005-planning-surfaces FR-001"], "the configuration is parsed by the one reader: definePlanning is the identity, a field of the wrong type is refused naming it, and a field the type does not have is an error", () => {
  const good = definePlanning({ store: { place: "planning/" }, sources: [{ name: "markdown", place: "docs/" }, { name: "comments", place: "src/", markers: ["TODO"], anchors: ["src/"] }, { name: "issues", place: "issues/", scope: "data" }, { name: "githost", place: "github.com/o/r", issues: [1, 2] }], principal: { id: "ada", name: "Ada" }, confirmers: "principal", authority: { title: "source-wins" }, duplicates: { threshold: 0.8 }, clock: { maxDriftMs: 1000 }, agents: { claude: { actsFor: "ada" } }, render: ["markdown", "json5"] });
  assertEquals(parsePlanning(good), { kind: "ok", value: good });
  const refuse = (v: unknown) => {
    const r = parsePlanning(v);
    return r.kind === "err" ? `${r.error.path}` : "ok";
  };
  assertEquals(refuse({ ...good, store: { place: 3 } }), "store.place");
  assertEquals(refuse({ ...good, sources: [{ name: "markdown" }] }), "sources[0].place");
  assertEquals(refuse({ ...good, sources: [{ name: "wiki", place: "x" }] }), "sources[0].name");
  assertEquals(refuse({ ...good, sources: [{ name: "issues", place: "i/" }] }), "sources[0].scope");
  assertEquals(refuse({ ...good, authority: { title: "whoever" } }), "authority.title");
  assertEquals(refuse({ ...good, authority: { colour: "source-wins" } }), "authority.colour");
  assertEquals(refuse({ ...good, duplicates: { threshold: 2 } }), "duplicates.threshold");
  assertEquals(refuse({ ...good, confirmers: "everyone" }), "confirmers");
  assertEquals(refuse({ ...good, clock: { maxDriftMs: -1 } }), "clock.maxDriftMs");
  assertEquals(refuse({ ...good, extra: 1 }), "extra");
  assertEquals(refuse("planning"), "");
  assertEquals(refuse({ ...good, render: ["pdf"] }), "render");
  assert(principalOf(good)?.id === "ada", "the principal of the configuration is a person");
});

proves(["0005-planning-surfaces FR-001", "0005-planning-surfaces FR-005"], "only planning.config.ts at the root is read: JSON beside it is not, a configuration that is not trusted in a repository is not run, and a trusted one is run again only until it changes", async () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, "planning.config.json"), '{ "store": { "place": "x" }, "sources": [] }');
    mkdirSync(join(dir, ".git"));
    const untrusted = await run(dir, ["show"]);
    assertEquals(untrusted.code === 0, false);
    assert(untrusted.err.includes("E-TRUST"), "not trusted yet");
    assertEquals(storeFiles(dir), []);
    const trusted = await run(dir, ["show", "--trust"]);
    assertEquals(trusted.code, 0);
    assertEquals((await run(dir, ["show"])).code, 0);
    writeFileSync(join(dir, "planning.config.ts"), `${CONFIG()}// changed\n`);
    assert((await run(dir, ["show"])).err.includes("E-TRUST"), "a changed file is not trusted");
    rmSync(join(dir, "planning.config.ts"));
    const none = await run(dir, ["show", "--trust"]);
    assert(none.err.includes("planning.config.json is not read"), "JSON beside it is not read, and the message says so");
    assertEquals(none.code === 0, false);
  } finally {
    cleanup(dir);
  }
});

proves(["0005-planning-surfaces FR-002"], "the principal comes from the argument over the configuration, from a session for a tool server and from nothing otherwise, and an agent or a person with none is refused saying that no principal is established", async () => {
  const ada = must(person("ada", "Ada"));
  const bob = must(person("bob", "Bob"));
  assertEquals(contextOf({ argument: ada, configuration: bob }).kind, "argument");
  assertEquals(contextOf({ configuration: bob }).kind, "configuration");
  assertEquals(contextOf({ session: ada, argument: bob }), { kind: "session", person: ada });
  assertEquals(contextOf({}), { kind: "none" });
  const dir = repo();
  try {
    must({ kind: "ok" as const, value: 1 });
    await run(dir, ["collect"]);
    const item = JSON.parse((await run(dir, ["show", "--json"])).out).data[0].id as string;
    const none = await run(dir, ["plan", item, "--source", "markdown", "--do", "close"]);
    assertEquals(none.code === 0, false);
    assert(none.err.includes("no principal is established"), "it says so");
    const given = await run(dir, ["plan", item, "--source", "markdown", "--do", "close", "--principal", "ada:Ada"]);
    assertEquals(given.code, 0, `${given.err} ${given.out}`);
  } finally {
    cleanup(dir);
  }
  // the principal of the configuration (a module is loaded once for a process, so this is another repository)
  const other = repo(CONFIG('  principal: { id: "bob" },\n'));
  try {
    await run(other, ["collect"]);
    const first = (JSON.parse((await run(other, ["show", "--json"])).out).data as { id: string }[])[0];
    assert(first !== undefined, "an item");
    const viaConfig = await run(other, ["plan", first.id, "--source", "markdown", "--do", "close"]);
    assertEquals(viaConfig.code, 0, `${viaConfig.err} ${viaConfig.out}`);
    assertEquals((await run(other, ["plan", first.id, "--source", "markdown", "--do", "close", "--principal", "carol"])).code, 0);
  } finally {
    cleanup(other);
  }
});

proves(["0005-planning-surfaces FR-003", "0005-planning-surfaces FR-006"], "collect reads the sources into the store: a dry run writes nothing, a run writes the events and traces, the check mode ends with the status of something pending where the place changed, and an unchanged place is quiet", async () => {
  const dir = repo();
  try {
    const dry = await run(dir, ["collect", "--dry-run"]);
    assertEquals(dry.code, 0);
    assert(dry.out.includes("3 new") && dry.out.includes("would be written"), dry.out);
    assertEquals(storeFiles(dir), []);
    const check = await run(dir, ["collect", "--check"]);
    assertEquals(check.code, 4);
    const real = await run(dir, ["collect"]);
    assertEquals(real.code, 0);
    assert(storeFiles(dir).some((f) => f.endsWith(".json5")) && storeFiles(dir).some((f) => f.startsWith(".traces/")), "events and traces are in the store");
    assertEquals((await run(dir, ["collect", "--check"])).code, 0);
    writeFileSync(join(dir, "docs", "tasks.md"), "# Tasks\n- [ ] write the spec\n- [ ] write the code\n  - [ ] and the tests\n- [ ] a new task\n");
    assertEquals((await run(dir, ["collect", "--check"])).code, 4);
    assertEquals((await run(dir, ["collect"])).code, 0);
    const shown = JSON.parse((await run(dir, ["show", "--json"])).out).data as { title: string; state: string }[];
    assertEquals(shown.map((s) => s.title).sort(), ["a new task", "and the tests", "write the code", "write the spec"]);
    const q = JSON.parse((await run(dir, ["query", "--state", "open", "--limit", "2", "--json"])).out).data as unknown[];
    assertEquals(q.length, 2);
    assertEquals((await run(dir, ["query", "--state", "bogus"])).code === 0, false);
    const views = await run(dir, ["views", "--view", "roadmap"]);
    assertEquals(views.code, 0);
    const rendered = await run(dir, ["render"]);
    assert(rendered.out.includes("- [ ] write the spec") && rendered.out.includes("unexpressed in Markdown"), "the items render in Markdown and it says what it cannot hold");
  } finally {
    cleanup(dir);
  }
});

proves(["0005-planning-surfaces FR-003"], "plan prints the preview and its hash and writes nothing, apply with that hash writes exactly that plan, a hash that is not the plan's is refused, and apply with no hash is a dry run", async () => {
  const dir = repo();
  try {
    await run(dir, ["collect"]);
    const shown = JSON.parse((await run(dir, ["show", "--json"])).out).data as { id: string; title: string }[];
    const target = shown.find((s) => s.title === "write the code");
    assert(target !== undefined, "the item");
    const base = ["--source", "markdown", "--do", "close", "--principal", "ada:Ada"];
    const before = readFileSync(join(dir, "docs", "tasks.md"), "utf8");
    const plan = await run(dir, ["plan", target.id, ...base, "--json"]);
    assertEquals(plan.code, 0);
    const hash = JSON.parse(plan.out).data.preview.hash as string;
    assertEquals(readFileSync(join(dir, "docs", "tasks.md"), "utf8"), before);
    const noHash = await run(dir, ["apply", target.id, ...base]);
    assertEquals(noHash.code, 0);
    assertEquals(readFileSync(join(dir, "docs", "tasks.md"), "utf8"), before);
    assertEquals((await run(dir, ["apply", target.id, ...base, "--check"])).code, 4);
    const stale = await run(dir, ["apply", target.id, ...base, "--preview-hash", "f".repeat(64)]);
    assertEquals(stale.code === 0, false);
    assert(stale.err.includes("E-PLAN-STALE"), "the refusal is the stale plan");
    assertEquals(readFileSync(join(dir, "docs", "tasks.md"), "utf8"), before);
    const applied = await run(dir, ["apply", target.id, ...base, "--preview-hash", hash]);
    assertEquals(applied.code, 0);
    assertEquals(readFileSync(join(dir, "docs", "tasks.md"), "utf8"), before.replace("- [ ] write the code", "- [x] write the code"));
    // an event the place cannot hold goes to the outbox, and nothing is written to the file
    const comment = await run(dir, ["apply", target.id, "--source", "markdown", "--do", "comment", "--text", "hi", "--principal", "ada:Ada", "--preview-hash", "x"]);
    assertEquals(comment.code, 0);
    assert(comment.out.includes("cannot") || comment.out.includes("waits"), comment.out);
    assert(storeFiles(dir).some((f) => f.startsWith(".outbox/")), "the patch waits in the outbox");
  } finally {
    cleanup(dir);
  }
});

proves(["0005-planning-surfaces FR-003"], "planctl runs as a real process over a temporary folder: collect, show and the status of the check mode", async () => {
  const dir = repo();
  try {
    const entry = join(import.meta.dirname ?? ".", "..", "src", "planctl.ts");
    const proc = async (...args: string[]) => {
      const r = await output(["bun", entry, ...args], { cwd: dir, env: { ...process.env, PLANCTL_PRINCIPAL: undefined } as never });
      return { code: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
    };
    assertEquals((await proc("collect", "--check")).code, 4);
    assertEquals((await proc("collect")).code, 0);
    assertEquals((await proc("collect", "--check")).code, 0);
    assert((await proc("show")).out.includes("write the spec"), "the items are shown");
    assertEquals((await proc("help")).code, 0);
  } finally {
    cleanup(dir);
  }
});

// ---- confirm and the tool server

async function proposed(dir: string): Promise<string> {
  const { memoryStore } = await import("@intellectual-frontiers/anyfs/memory");
  void memoryStore;
  const { localStore } = await import("@intellectual-frontiers/anyfs/local");
  const { writeEvents } = await import("@intellectual-frontiers/planning/physical");
  mkdirSync(join(dir, "planning"), { recursive: true });
  const store = must(await localStore(join(dir, "planning"), { create: true }));
  const m = must(mintEventId(clock(), WALL));
  const item = itemId(77);
  const claude = must(agent("claude", "Claude", ADA, "session"));
  const opened: ItemEvent = event(item, m.id, 1, claude, { type: "opened", kind: "task", title: "A proposal by an agent", body: "", labels: [], assignees: [], origin: "inferred" });
  must(await writeEvents(store, [opened]));
  return item;
}

proves(["0005-planning-surfaces FR-003", "0005-planning-surfaces FR-004"], "a proposal is confirmed by a person at the command line, and the tool server's agent, which cannot confirm, is refused", async () => {
  const dir = repo();
  try {
    const item = await proposed(dir);
    assertEquals((await run(dir, ["query", "--json"])).out.includes(item), false);
    assertEquals(JSON.parse((await run(dir, ["query", "--proposals", "--json"])).out).data.length, 1);
    const dry = await run(dir, ["confirm", item, "--principal", "ada:Ada", "--dry-run"]);
    assertEquals(dry.code, 0);
    assertEquals(JSON.parse((await run(dir, ["show", item, "--json"])).out).data.state, "proposed");
    assertEquals((await run(dir, ["confirm", item])).err.includes("no principal"), true);
    assertEquals((await run(dir, ["confirm", item, "--principal", "ada:Ada"])).code, 0);
    assertEquals(JSON.parse((await run(dir, ["show", item, "--json"])).out).data.state, "open");
    assertEquals(JSON.parse((await run(dir, ["query", "--json"])).out).data.length, 1);
  } finally {
    cleanup(dir);
  }
});

async function serveLines(dir: string, lines: readonly string[], env: Record<string, string | undefined>): Promise<readonly unknown[]> {
  const entry = join(import.meta.dirname ?? ".", "..", "src", "planctl.ts");
  const r = await output(["bun", entry, "mcp"], { cwd: dir, env: { ...process.env, ...env } as never, input: new TextEncoder().encode(`${lines.join("\n")}\n`) });
  return new TextDecoder().decode(r.stdout).split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
}

const rpc = (id: number, method: string, params?: unknown) => JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });

proves(["0005-planning-surfaces FR-004"], "the tool server serves the verbs over its real transport as an agent acting for the person of its session: a write needs the target and the hash, a call cannot name a principal or a trust, an agent cannot confirm, and with no principal every call is refused", async () => {
  const dir = repo();
  try {
    await run(dir, ["collect"]);
    const item = (JSON.parse((await run(dir, ["show", "--json"])).out).data as { id: string; title: string }[]).find((s) => s.title === "write the spec")?.id;
    assert(item !== undefined, "an item");
    const answers = await serveLines(
      dir,
      [
        rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } }),
        rpc(2, "tools/list"),
        rpc(3, "tools/call", { name: "planctl_show", arguments: {} }),
        rpc(4, "tools/call", { name: "planctl_plan", arguments: { ITEM: item, source: "markdown", do: "close" } }),
        rpc(5, "tools/call", { name: "planctl_plan", arguments: { ITEM: item, source: "markdown", do: "close", principal: "mallory" } }),
        rpc(6, "tools/call", { name: "planctl_collect", arguments: { trust: true } }),
      ],
      { PLANCTL_PRINCIPAL: "ada:Ada", PLANCTL_AGENT: "claude" },
    );
    const text = JSON.stringify(answers);
    const names = JSON.stringify(answers[1]);
    for (const verb of ["collect", "show", "query", "views", "confirm", "plan", "apply"]) assert(names.includes(`planctl_${verb}`), `the tool ${verb} is served`);
    assert(text.includes("write the spec"), "show is answered");
    assert(text.includes('\"hash\"'), "plan gives its hash");
    assert(JSON.stringify(answers[4]).includes("human-only-option") && JSON.stringify(answers[4]).includes("principal"), "a principal cannot be named by a call");
    assert(JSON.stringify(answers[5]).includes("human-only-option") && JSON.stringify(answers[5]).includes("trust"), "a trust cannot be given by a call");
    // a write is the plan and then the hash: the agent's event is in the store naming its principal
    const planned = (await serveLines(dir, [rpc(1, "tools/call", { name: "planctl_plan", arguments: { ITEM: item, source: "markdown", do: "close" } })], { PLANCTL_PRINCIPAL: "ada:Ada", PLANCTL_AGENT: "claude" }))[0] as { result: { structuredContent: { data: { preview: { hash: string } } } } };
    const hash = planned.result.structuredContent.data.preview.hash;
    const before = readFileSync(join(dir, "docs", "tasks.md"), "utf8");
    const written = await serveLines(dir, [rpc(1, "tools/call", { name: "planctl_apply", arguments: { ITEM: item, source: "markdown", do: "close", previewHash: hash } })], { PLANCTL_PRINCIPAL: "ada:Ada", PLANCTL_AGENT: "claude" });
    assert(JSON.stringify(written).includes('\\"written\\": true') || JSON.stringify(written).includes('"written":true'), "the plan of the hash is written");
    assertEquals(readFileSync(join(dir, "docs", "tasks.md"), "utf8"), before.replace("- [ ] write the spec", "- [x] write the spec"));
    const files = storeFiles(dir).filter((f) => f.endsWith(".json5") && !f.startsWith("."));
    const agentEvents = files.map((f) => readFileSync(join(dir, "planning", f), "utf8")).filter((t) => t.includes('"claude"') || t.includes("claude"));
    assertEquals(agentEvents.length, 1);
    assert(agentEvents[0]?.includes("ada") === true && agentEvents[0].includes("session"), "the agent's event names its principal and how it was established");
    // an agent cannot confirm a proposal, its own or another's
    const prop = await proposed(dir);
    const confirmed = await serveLines(dir, [rpc(1, "tools/call", { name: "planctl_confirm", arguments: { ITEM: prop } })], { PLANCTL_PRINCIPAL: "ada:Ada", PLANCTL_AGENT: "claude" });
    assert(JSON.stringify(confirmed).includes("cannot confirm"), `an agent cannot confirm: ${JSON.stringify(confirmed).slice(0, 400)}`);
    assertEquals(JSON.parse((await run(dir, ["show", prop, "--json"])).out).data.state, "proposed");
    // no principal: every call is refused
    const bare = await serveLines(dir, [rpc(1, "initialize", {}), rpc(2, "tools/call", { name: "planctl_show", arguments: {} })], { PLANCTL_PRINCIPAL: undefined });
    assert(JSON.stringify(bare).includes("no principal is established") || bare.length === 0, `refused: ${JSON.stringify(bare)}`);
  } finally {
    cleanup(dir);
  }
});
