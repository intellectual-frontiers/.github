/**
 * Tests of the assembled command (commons archon 0005-archon-assembly FR-001 to FR-004): the host and its verb `plugins`, the program composed from plugins in any order, conflicts as values, the tier
 * read from the environment, and the manifest that declares the plugin noun and the export. Every name is made up.
 *
 * @module
 */
import { defineReach } from "@intellectual-frontiers/headless/governance";
import { branch, command, definePlugin, outcomeOf, verbIds, type Plugin } from "@intellectual-frontiers/headless/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { archonHost, assemble, heldTier, main, TIER_VARIABLE } from "../src/physical/cli/mod.ts";
import { library } from "../library.ts";

const reach = defineReach({ channels: ["local"], readOnly: true, idempotent: true });
const verb = (name: string) => command({ name, summary: `The ${name} verb.`, options: {}, action: { kind: "report", reach }, run: () => Promise.resolve(outcomeOf(null, { text: `${name} ran` })) });
function plugin(noun: string, verbs: readonly string[]): Plugin {
  const r = definePlugin({ program: "archon", noun, version: "1.2.3", summary: `The ${noun} plugin.`, contributes: [{ node: branch({ name: noun, summary: `${noun}s.`, children: verbs.map(verb) }) }] });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
}

async function run(plugins: readonly Plugin[], argv: readonly string[], env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(plugins, "9.9.9", argv, { env: (n) => env[n], out: (t) => void out.push(t), err: (t) => void err.push(t) });
  return { code, out: out.join(""), err: err.join("") };
}

proves(["0005-archon-assembly FR-001"], "the host is the program archon with one verb of its own that lists the plugins by id, version and purpose, in the order of the ids", async () => {
  const host = archonHost("9.9.9", []);
  assertEquals([host.name, host.envPrefix, host.version, host.children.map((c) => c.name)], ["archon", "ARCHON", "9.9.9", ["plugins"]]);
  const none = await run([], ["plugins"]);
  assertEquals(none.code, 0);
  assert(none.out.includes("no plugin is assembled"), none.out);
  const some = await run([plugin("server", ["list"]), plugin("device", ["list"])], ["plugins"]);
  assertEquals(some.code, 0);
  const lines = some.out.trim().split("\n").filter((l) => l.startsWith("archon-"));
  assertEquals(lines.map((l) => l.split(" ")[0]), ["archon-device", "archon-server"]);
  assert(lines[0]?.includes("1.2.3") && lines[0].includes("The device plugin."));
});

proves(["0005-archon-assembly FR-002"], "plugins give the same program in any order, and a conflict is a value naming both with no program", () => {
  const a = assemble([plugin("server", ["list", "show"]), plugin("device", ["list"])], "1.0.0");
  const b = assemble([plugin("device", ["list"]), plugin("server", ["list", "show"])], "1.0.0");
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(verbIds(a.value.program), verbIds(b.value.program));
  assertEquals(verbIds(a.value.program), ["archon device list", "archon plugins", "archon server list", "archon server show"]);
  const twice = assemble([plugin("server", ["list"]), plugin("server", ["show"])], "1.0.0");
  assert(twice.kind === "err" && twice.error.length > 0, JSON.stringify(twice));
  const other = definePlugin({ program: "other", noun: "x", version: "1.0.0", summary: "X.", contributes: [{ node: branch({ name: "x", summary: "x", children: [verb("go")] }) }] });
  assert(other.kind === "ok");
  const wrong = assemble([other.value], "1.0.0");
  assert(wrong.kind === "err" && JSON.stringify(wrong.error).includes("wrong-program"));
});

proves(["0005-archon-assembly FR-003"], "main runs the program with the tier of the environment, ends with 2 for a word that is not a tier and 3 for plugins that conflict", async () => {
  const ok = await run([plugin("server", ["list"])], ["server", "list"]);
  assertEquals(ok.code, 0);
  assert(ok.out.includes("list ran"), ok.out);
  assertEquals((await run([], ["plugins"], { [TIER_VARIABLE]: "operator" })).code, 0);
  const bad = await run([], ["plugins"], { [TIER_VARIABLE]: "wizard" });
  assertEquals(bad.code, 2);
  assert(bad.err.includes("wizard") && bad.err.includes("public, operator, administrator"), bad.err);
  assertEquals("unknown" in heldTier((n) => (n === TIER_VARIABLE ? "Operator" : undefined)), true, "a tier is lower case");
  assertEquals("tier" in heldTier(() => undefined), true);
  assertEquals("tier" in heldTier((n) => (n === TIER_VARIABLE ? "" : undefined)), true);
  const conflict = await run([plugin("server", ["list"]), plugin("server", ["show"])], ["plugins"]);
  assertEquals(conflict.code, 3);
  assert(conflict.err.includes("cannot be assembled"), conflict.err);
});

proves(["0005-archon-assembly FR-004"], "the manifest declares the plugin noun tool and exports the assembly", () => {
  const t = decodeTable(library.kanon);
  assert(t.kind === "ok");
  assertEquals(library.exports.includes("./cli"), true);
  assertEquals(JSON.stringify(library.kanon.plugins), JSON.stringify([{ noun: "tool" }]));
});
