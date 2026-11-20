/**
 * Tests of composition (commons headless 0009-composition FR-001 to FR-007): a host and plugins give one program, conflicts are values, the tree does not depend on the order of the
 * plugins, and the conformance suite a plugin runs on itself.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { defineReach, OPERATOR } from "../src/governance/mod.ts";
import {
  branch,
  compose,
  CONFORMANCE_RULES,
  command,
  definePlugin,
  outcomeOf,
  parsePluginId,
  parsePluginIdText,
  PLUGIN_CONTRACT,
  pluginConformance,
  verbIds,
  type Composed,
  type Node,
  type Plugin,
  type ProgramConfig,
} from "../src/logical/mod.ts";
import { completions, helpFor, manPage, SHELLS } from "../src/surfaces/cli/help.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { memoryStore, world } from "./world.ts";

const reach = defineReach({ channels: ["local"], readOnly: true, idempotent: true });
const verb = (name: string, extra: { tier?: typeof OPERATOR } = {}) =>
  command({ name, summary: `The ${name} verb.`, options: {}, action: { kind: "report", reach, ...extra }, run: () => Promise.resolve(outcomeOf(null, { text: `${name} ran` })) });
const host: Omit<ProgramConfig, "children"> = { name: "archon", summary: "The fleet.", version: "1.0.0" };
const hostConfig: ProgramConfig = { ...host, children: [verb("version-info")] };

function plugin(noun: string, nodes: readonly Node[], extra: { at?: readonly string[]; requires?: readonly string[] } = {}): Plugin {
  const r = definePlugin({ program: "archon", noun, version: "1.0.0", summary: `The ${noun} plugin.`, contributes: nodes.map((node) => ({ node, ...(extra.at === undefined ? {} : { at: extra.at }) })), ...(extra.requires === undefined ? {} : { requires: extra.requires }) });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
}
const server = () => plugin("server", [branch({ name: "server", summary: "Servers.", children: [verb("list"), verb("show")] })]);
const device = () => plugin("device", [branch({ name: "device", summary: "Devices.", children: [verb("list")] })]);
const okOf = (r: ReturnType<typeof compose>): Composed => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0009-composition FR-001", "0009-composition FR-002"], "a plugin is a value made by definePlugin with a stable id, and every problem of a definition is returned as a value", () => {
  assertEquals(parsePluginId("archon", "server").kind === "ok" && String((parsePluginId("archon", "server") as { value: string }).value), "archon-server");
  for (const [program, noun] of [["Archon", "x"], ["archon", "two-words"], ["archon", ""], ["", "x"]] as const) assertEquals(parsePluginId(program, noun).kind, "err", `${program} ${noun}`);
  assertEquals(parsePluginIdText("archon-server").kind, "ok");
  assertEquals(parsePluginIdText("Server").kind, "err");
  const p = server();
  assertEquals([String(p.id), p.contract, p.program, p.noun, p.requires], ["archon-server", PLUGIN_CONTRACT, "archon", "server", []]);
  const rules = (d: Parameters<typeof definePlugin>[0]) => {
    const r = definePlugin(d);
    return r.kind === "err" ? r.error.map((x) => x.rule) : [];
  };
  const base = { program: "archon", noun: "server", version: "1.0.0", summary: "S.", contributes: [{ node: verb("server") }] };
  assertEquals(rules(base), []);
  assertEquals(rules({ ...base, noun: "Server" }), ["plugin/id", "plugin/root-claim"]);
  assertEquals(rules({ ...base, version: "one" }), ["plugin/version"]);
  assertEquals(rules({ ...base, summary: " " }), ["plugin/summary"]);
  assertEquals(rules({ ...base, contributes: [] }), ["plugin/empty"]);
  assertEquals(rules({ ...base, contributes: [{ node: verb("device") }] }), ["plugin/root-claim"], "a plugin claims only its noun at the root");
  assertEquals(rules({ ...base, contributes: [{ at: ["device"], node: verb("list") }] }), [], "below another branch it may place nodes");
  assertEquals(rules({ ...base, requires: ["archon-server"] }), ["plugin/requires"]);
  assertEquals(rules({ ...base, requires: ["nope!"] }), ["plugin/requires"]);
});

proves(["0009-composition FR-003", "0009-composition FR-006"], "composing a host and plugins gives one program with the owner of every command, the same in any order of the plugins, with one help, completions, man page and verb ids", () => {
  const composed = okOf(compose(hostConfig, [server(), device()]));
  assertEquals(verbIds(composed.program), ["archon device list", "archon server list", "archon server show", "archon version-info"]);
  assertEquals(Object.fromEntries(Object.entries(composed.owners).map(([k, o]) => [k, o.kind === "host" ? "host" : String(o.id)])), {
    "version-info": "host",
    "server list": "archon-server",
    "server show": "archon-server",
    "device list": "archon-device",
  });
  assertEquals(composed.plugins.map(String), ["archon-device", "archon-server"]);
  assertEquals(composed.program.origins["server show"], "archon-server");
  assertEquals(composed.program.origins["version-info"], "archon");
  const reversed = okOf(compose(hostConfig, [device(), server()]));
  assertEquals(helpFor(reversed.program, []), helpFor(composed.program, []));
  assertEquals(manPage(reversed.program), manPage(composed.program));
  for (const shell of SHELLS) assertEquals(completions(reversed.program, shell), completions(composed.program, shell));
  const help = helpFor(composed.program, []) ?? "";
  for (const word of ["server", "device", "version-info"]) assertStringIncludes(help, word);
  fc.assert(
    fc.property(fc.shuffledSubarray([server(), device(), plugin("boot", [branch({ name: "boot", summary: "Boot.", children: [verb("list")] })])], { minLength: 0 }), (some) => {
      const a = compose(hostConfig, some);
      const b = compose(hostConfig, [...some].reverse());
      assertEquals(a.kind, b.kind);
      if (a.kind === "ok" && b.kind === "ok") assertEquals(verbIds(a.value.program), verbIds(b.value.program));
    }),
  );
  assertEquals(verbIds(okOf(compose({ ...host, children: [] }, [])).program), [], "no children and no plugins is an empty program");
});

proves(["0009-composition FR-004"], "two plugins claiming one verb is a conflict value naming both owners, no winner is chosen, and the other errors are values too", () => {
  const rival = plugin("server", [branch({ name: "server", summary: "Servers again.", children: [verb("list")] })]);
  const twice = definePlugin({ program: "archon", noun: "zeta", version: "1.0.0", summary: "Zeta.", contributes: [{ at: ["server"], node: verb("list") }, { node: branch({ name: "zeta", summary: "Z.", children: [verb("a")] }) }] });
  assertEquals(twice.kind, "ok");
  const clash = compose(hostConfig, [server(), twice.kind === "ok" ? twice.value : server()]);
  assertEquals(clash.kind, "err");
  const kinds = clash.kind === "err" ? clash.error.map((e) => (e.kind === "conflict" ? `${e.conflict.kind} ${e.conflict.path.join(" ")} ${e.conflict.owners.map((o) => (o.kind === "host" ? "host" : String(o.id))).join(",")}` : e.kind)) : [];
  assertEquals(kinds, ["claimed-twice server list archon-server,archon-zeta"]);
  const duplicate = compose(hostConfig, [server(), server()]);
  assertEquals(duplicate.kind === "err" && duplicate.error.some((e) => e.kind === "duplicate-plugin"), true);
  assertEquals(rival.id, server().id);
  const other = definePlugin({ program: "other", noun: "server", version: "1.0.0", summary: "S.", contributes: [{ node: verb("server") }] });
  const wrong = other.kind === "ok" ? compose(hostConfig, [other.value]) : undefined;
  assertEquals(wrong?.kind === "err" && wrong.error.map((e) => e.kind), ["wrong-program"]);
  const future: Plugin = { ...server(), contract: PLUGIN_CONTRACT + 1 };
  const old = compose(hostConfig, [future]);
  assertEquals(old.kind === "err" && old.error.map((e) => e.kind), ["contract"]);
  const needy = plugin("device", [branch({ name: "device", summary: "D.", children: [verb("x")] })], { requires: ["archon-server"] });
  const missing = compose(hostConfig, [needy]);
  assertEquals(missing.kind === "err" && missing.error.map((e) => e.kind), ["missing-requirement"]);
  assertEquals(compose(hostConfig, [needy, server()]).kind, "ok");
  const cmdVsBranch = plugin("server", [verb("server")]);
  const vsHost = compose({ ...host, children: [branch({ name: "server", summary: "S.", children: [verb("a")] })] }, [cmdVsBranch]);
  assertEquals(vsHost.kind === "err" && vsHost.error.map((e) => (e.kind === "conflict" ? e.conflict.kind : e.kind)), ["command-vs-branch"]);
  const orphan = plugin("keys", [verb("a")], { at: ["nowhere"] });
  assertEquals((() => { const r = compose(hostConfig, [orphan]); return r.kind === "err" && r.error.map((e) => (e.kind === "conflict" ? e.conflict.kind : e.kind)); })(), ["missing-parent"]);
  const below = plugin("keys", [verb("a")], { at: ["version-info"] });
  assertEquals((() => { const r = compose(hostConfig, [below]); return r.kind === "err" && r.error.map((e) => (e.kind === "conflict" ? e.conflict.kind : e.kind)); })(), ["parent-is-command"]);
  const merged = okOf(compose(hostConfig, [server(), plugin("keys", [verb("added")], { at: ["server"] })]));
  assertEquals(verbIds(merged.program).filter((i) => i.includes("server")), ["archon server added", "archon server list", "archon server show"], "two contributions of one branch merge");
});

proves(["0009-composition FR-005"], "the composed program is checked as one: a command with no reach policy and a tier that is not on the ladder are errors of the composition", () => {
  const noReach = plugin("server", [command({ name: "server", summary: "S.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null)) })]);
  const r = compose(hostConfig, [noReach]);
  assertEquals(r.kind === "err" && r.error.map((e) => (e.kind === "model" ? e.problem.rule : e.kind)), ["model/no-reach-policy"]);
  const strangeTier = plugin("server", [command({ name: "server", summary: "S.", options: {}, action: { kind: "report", reach, tier: OPERATOR }, run: () => Promise.resolve(outcomeOf(null)) })]);
  const ladder = { ladder: [OPERATOR], default: OPERATOR };
  assertEquals(compose({ ...hostConfig, children: [], tiers: ladder }, [strangeTier]).kind, "ok");
  assertEquals(compose({ ...hostConfig, children: [], tiers: { ladder: [], default: OPERATOR } }, [strangeTier]).kind, "err");
  const publicOnly = compose({ ...hostConfig, children: [], tiers: ladder }, [server()]);
  assertEquals(publicOnly.kind === "err" && [...new Set(publicOnly.error.map((e) => e.kind))], ["tier-not-on-ladder"]);
});

proves(["0009-composition FR-006"], "a composed program runs as one: its commands run, the run log names the plugin they came from, and there is one log", async () => {
  const composed = okOf(compose(hostConfig, [server(), device()]));
  const store = memoryStore(Date.UTC(2026, 10, 20, 10, 0, 0));
  const env = { HOME: "/home/u", XDG_STATE_HOME: "/state" };
  const ran = await run(composed.program, ["server", "list"], world({ store, env, pid: 1 }));
  assertEquals([ran.code, ran.out], [0, "server ran\n".replace("server", "list")]);
  await run(composed.program, ["device", "list"], world({ store, env, pid: 2 }));
  const logs = [...store.files.entries()].filter(([f]) => f.endsWith(".log"));
  assertEquals(logs.length, 2, "each run has its log under the one folder of the one program");
  assert(logs.some(([, v]) => v.text.includes("server list") && v.text.includes("from archon-server")));
  assert(logs.some(([, v]) => v.text.includes("device list") && v.text.includes("from archon-device")));
  const folders = new Set(logs.map(([f]) => f.slice(0, f.lastIndexOf("/"))));
  assertEquals(folders.size, 1);
});

proves(["0009-composition FR-007"], "the conformance suite gives a result for every rule, passes a good plugin and fails, by rule, a plugin that breaks one", () => {
  const good = pluginConformance(server(), host);
  assertEquals(good.results.map((r) => r.rule), [...CONFORMANCE_RULES]);
  assertEquals([good.passed, String(good.plugin)], [true, "archon-server"]);
  const failed = (p: Plugin, h: Omit<ProgramConfig, "children"> = host): string[] => pluginConformance(p, h).results.filter((r) => !r.passed).map((r) => r.rule);
  assertEquals(failed({ ...server(), contract: 99 }), ["conformance/contract", "conformance/ids"]);
  assertEquals(failed(server(), { ...host, name: "other" }), ["conformance/program", "conformance/ids"]);
  const noReach = plugin("server", [command({ name: "server", summary: "S.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null)) })]);
  const report = pluginConformance(noReach, host);
  assertEquals(report.results.filter((r) => !r.passed).map((r) => r.rule), ["conformance/reach", "conformance/ids"]);
  assert(report.results.find((r) => r.rule === "conformance/reach")?.messages.some((m) => m.includes("model/no-reach-policy")));
  const sneaky: Plugin = { ...server(), contributes: [{ at: [], node: verb("device") }] };
  assertEquals(failed(sneaky), ["conformance/definition", "conformance/root-claim"]);
  const needy = plugin("device", [branch({ name: "device", summary: "D.", children: [verb("x")] })], { requires: ["archon-server"] });
  assertEquals(pluginConformance(needy, host).passed, true, "the plugins it requires stand in");
});
