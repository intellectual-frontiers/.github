/**
 * Tests of `archon tool` (commons archon-tool 0002-tool-command FR-001 to FR-007), through the assembled command of Archon and a made-up manager that is a real program: the five verbs, the tools of a
 * phase, a tool no dialect can carry out with each reason, doctor before and after, `ensure` in dry-run, check and apply mode with its plan hash, a second apply that changes nothing, a wrong plan
 * hash, and `clean` that removes nothing without a yes. Every name is made up.
 *
 * @module
 */
import { main } from "@intellectual-frontiers/archon/cli";
import { err } from "@intellectual-frontiers/core";
import { managerDialect, observeRequirements, runWithin, toolDialectOf, type CommandSource, type ManagerSpec } from "@intellectual-frontiers/package-managers";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { defineCatalog, defineTool, parseManagerId } from "@intellectual-frontiers/toolchain";
import { verbIds } from "@intellectual-frontiers/headless/logical";
import { assemble } from "@intellectual-frontiers/archon/cli";
import { toolPlugin, type ToolPluginConfig } from "../src/mod.ts";

const posix = proc.build.os !== "windows";
const MANAGER = parseManagerId("manager-fakepm");
if (MANAGER.kind === "err") throw new Error(MANAGER.error);
const SPEC: ManagerSpec = {
  id: "fakepm",
  manager: MANAGER.value,
  summary: "A made-up manager.",
  guarantees: { pin: "exact", integrity: "hash", scopes: ["user"], platforms: ["linux-x64"], binds: "package", sourceBuild: false },
  versioning: { kind: "joined", joiner: "@" },
  missingExit: 3,
};

type World = { readonly config: ToolPluginConfig; readonly work: string; readonly state: string; readonly cleaned: string[] };

/** A made-up manager as three scripts that keep their state in a folder, and the configuration of a fleet that uses it. */
async function withWorld<T>(f: (w: World) => Promise<T>, more: { readonly integrity?: "rolling" | "release-line" | "exact-hashed"; readonly noJq?: boolean } = {}): Promise<T> {
  return fs.withTempDir(async (dir) => {
    const state = path.join(dir, "state");
    const work = path.join(dir, "work");
    await fs.mkdir(state);
    await fs.mkdir(work);
    const script = async (name: string, body: string): Promise<string> => {
      const file = path.join(dir, name);
      await fs.writeTextFile(file, `#!/bin/sh\n${body}\n`);
      await fs.chmod(file, 0o755);
      return file;
    };
    const has = await script("has", `[ -e "${state}/$1" ] && exit 0\nexit 3`);
    const put = await script("put", `n="\${2%%@*}"\ncase "$2" in *@*) echo "\${2#*@}" > "${state}/$n";; *) echo 1.0.0 > "${state}/$n";; esac`);
    const ver = await script("ver", `[ -e "${state}/$1" ] && cat "${state}/$1" || exit 1`);
    const commands: CommandSource = (manager, op) => {
      if (manager !== SPEC.manager) return err("not this manager");
      const word = { Install: put, QueryInstalled: has, QueryVersion: ver, Refresh: has }[op];
      const template = op === "Install" ? `${word} install {packages}` : `${word} {package}`;
      return { kind: "ok", value: { manager, executable: "fakepm", needsAdministrator: false, template, verified: false } };
    };
    const tools = [
      defineTool({ name: "git", summary: "Git.", pin: "release-line", program: "git", versionArgs: ["--version"], phases: ["core"], scope: "user", bindings: [{ kind: "package", manager: SPEC.manager, packages: ["git"] }] }),
      defineTool({ name: "jq", summary: "jq.", pin: "release-line", program: "jq", versionArgs: ["--version"], phases: ["dev"], scope: "user", needs: ["git"], bindings: [{ kind: "package", manager: SPEC.manager, packages: ["jq"], version: "1.7.1" }] }),
      defineTool({ name: "zed", summary: "Zed.", pin: "exact", program: "zed", versionArgs: ["--version"], phases: ["stage"], scope: "user", bindings: [{ kind: "package", manager: "manager-othermanager", packages: ["zed"] }] }),
    ].flatMap((t) => (t.kind === "ok" ? [t.value] : []));
    assertEquals(tools.length, 3);
    const catalog = defineCatalog(more.noJq === true ? tools.filter((t) => String(t.name) !== "jq") : tools);
    assert(catalog.kind === "ok");
    const cleaned: string[] = [];
    const tool = toolDialectOf(SPEC);
    const config: ToolPluginConfig = {
      version: "0.1.0",
      catalog: catalog.value,
      runtimes: [
        {
          tool,
          dialect: managerDialect(SPEC, commands),
          observe: (reqs) => observeRequirements(SPEC, commands, reqs, { run: runWithin(5000) }),
          clean: (o) => {
            cleaned.push(o.programs ? "programs" : "cache");
            return Promise.resolve([`removed the cache${o.programs ? " and the programs" : ""}`]);
          },
        },
      ],
      preference: [tool.id],
      pins: { lookup: () => err("no pins here") },
      policy: { platform: "linux-x64", integrity: more.integrity ?? "release-line", systemCopy: "never" },
      subject: "build-01.example.test",
      assurance: "solo",
      workFolder: work,
    };
    return f({ config, work, state, cleaned });
  });
}

async function run(config: ToolPluginConfig, argv: readonly string[]) {
  const plugin = toolPlugin(config);
  if (plugin.kind === "err") throw new Error(JSON.stringify(plugin.error));
  const out: string[] = [];
  const err2: string[] = [];
  const code = await main([plugin.value], "1.0.0", argv, { env: () => undefined, out: (t) => void out.push(t), err: (t) => void err2.push(t) });
  return { code, out: out.join(""), err: err2.join("") };
}

proves(["0002-tool-command FR-001", "0002-tool-command FR-007"], "the plugin is made from the configuration alone, contributes the five verbs, and another configuration gives another result", async () => {
  if (!posix) return;
  await withWorld(async ({ config }) => {
    const plugin = toolPlugin(config);
    assert(plugin.kind === "ok");
    assertEquals([String(plugin.value.id), plugin.value.noun, plugin.value.version], ["archon-tool", "tool", "0.1.0"]);
    const composed = assemble([plugin.value], "1.0.0");
    assert(composed.kind === "ok");
    assertEquals(verbIds(composed.value.program), ["archon plugins", "archon tool clean", "archon tool doctor", "archon tool ensure", "archon tool list", "archon tool show"]);
    assert((await run(config, ["tool", "list"])).out.includes("jq"));
  });
  await withWorld(async ({ config }) => assert(!(await run(config, ["tool", "list"])).out.includes("jq")), { noJq: true });
  const broken = toolPlugin({ ...(await withWorld((w) => Promise.resolve(w.config))), version: "one" });
  assert(broken.kind === "err" && broken.error[0]?.rule === "plugin/version", "a definition that is wrong is a value");
});

proves(["0002-tool-command FR-002"], "list shows each tool with its phases, pin and dialect, selects a phase, and refuses a word that is not a phase", async () => {
  if (!posix) return;
  await withWorld(async ({ config }) => {
    const all = await run(config, ["tool", "list"]);
    assertEquals(all.code, 0, all.err);
    const lines = all.out.trim().split("\n");
    assertEquals(lines.map((l) => l.split(/\s+/)[0]), ["git", "jq", "zed"]);
    assert(lines[0]?.includes("core") && lines[0].includes("release-line") && lines[0].includes("fakepm"), lines[0]);
    assert(lines[2]?.includes("unresolved"), lines[2]);
    const dev = await run(config, ["tool", "list", "--phase", "dev"]);
    assertEquals(dev.out.trim().split("\n").map((l) => l.split(/\s+/)[0]), ["jq"]);
    const bad = await run(config, ["tool", "list", "--phase", "someday"]);
    assertEquals(bad.code, 2);
    assert(bad.err.includes("not a phase"), bad.err);
  });
});

proves(["0002-tool-command FR-003"], "show says what is declared, what carries the tool out, and for a tool no dialect can carry out each dialect and its reason; an unknown name is refused", async () => {
  if (!posix) return;
  await withWorld(async ({ config }) => {
    const git = await run(config, ["tool", "show", "git"]);
    assertEquals(git.code, 0, git.err);
    assert(git.out.includes("carried out by fakepm") && git.out.includes("installed: missing") && git.out.includes("phases core"), git.out);
    const zed = await run(config, ["tool", "show", "zed"]);
    assert(zed.out.includes("cannot be carried out here") && zed.out.includes("fakepm:") && zed.out.includes("no package binding"), zed.out);
    const none = await run(config, ["tool", "show", "nosuch"]);
    assertEquals(none.code, 2);
    assert(none.err.includes("not in the catalog"), none.err);
  });
});

proves(["0002-tool-command FR-004", "0002-tool-command FR-005"], "doctor finds what is missing with its fix, ensure plans, checks and applies, a second apply changes nothing, and doctor ends ok", async () => {
  if (!posix) return;
  await withWorld(async ({ config, work, state }) => {
    const before = await run(config, ["tool", "doctor", "--phase", "dev"]);
    assertEquals(before.code, 4, before.err + before.out);
    assert(before.out.includes("missing git") && before.out.includes("missing jq"), before.out);
    assert(before.err.includes("archon tool ensure"), before.err);

    const dry = await run(config, ["tool", "ensure", "--phase", "dev", "--dry-run"]);
    assertEquals(dry.code, 0, dry.err);
    assert(dry.out.includes("2 of 2 tools would change") && /plan hash [0-9a-f]{64}/.test(dry.out), dry.out);
    assertEquals(await fs.exists(path.join(work, ".archon")), false, "a dry run writes nothing");
    assertEquals(await fs.listFiles(state), []);

    const checked = await run(config, ["tool", "ensure", "--phase", "dev", "--check"]);
    assertEquals(checked.code, 4, checked.err + checked.out);
    assertEquals(await fs.listFiles(state), [], "a check runs only checks");
    assert(await fs.exists(path.join(work, ".archon")), "a check writes the generated files it reads");

    const hash = /plan hash ([0-9a-f]{64})/.exec(dry.out)?.[1] ?? "";
    const wrong = await run(config, ["tool", "ensure", "--phase", "dev", "--plan-hash", "0".repeat(64)]);
    assertEquals(wrong.code, 1);
    assert(wrong.err.includes("not the one approved"), wrong.err);
    assertEquals(await fs.listFiles(state), [], "nothing ran for a plan that was not approved");

    const applied = await run(config, ["tool", "ensure", "--phase", "dev", "--plan-hash", hash]);
    assertEquals(applied.code, 0, applied.err + applied.out);
    assertEquals((await fs.listFiles(state)).sort(), ["git", "jq"]);
    assertEquals((await fs.readTextFile(path.join(state, "jq"))).trim(), "1.7.1");

    const again = await run(config, ["tool", "ensure", "--phase", "dev"]);
    assertEquals(again.code, 0, again.err);
    assert(again.out.includes("every selected tool is as the fleet asks"), again.out);
    const after = await run(config, ["tool", "doctor", "--phase", "dev"]);
    assertEquals(after.code, 0, after.err + after.out);
    assert(after.out.includes("ok") && !after.out.includes("missing"), after.out);
  });
});

proves(["0002-tool-command FR-006"], "clean removes nothing in a dry run or without a yes, and asks each dialect to clean when confirmed", async () => {
  if (!posix) return;
  await withWorld(async ({ config, cleaned }) => {
    const dry = await run(config, ["tool", "clean", "--dry-run"]);
    assertEquals(dry.code, 0, dry.err);
    assertEquals(cleaned, []);
    const unconfirmed = await run(config, ["tool", "clean"]);
    assert(unconfirmed.code !== 0, "a destructive command is refused where nobody confirms");
    assertEquals(cleaned, []);
    const yes = await run(config, ["tool", "clean", "--yes"]);
    assertEquals(yes.code, 0, yes.err);
    assert(yes.out.includes("removed the cache"), yes.out);
    assertEquals(cleaned, ["cache"]);
    await run(config, ["tool", "clean", "--programs", "--yes"]);
    assertEquals(cleaned, ["cache", "programs"]);
  });
});
