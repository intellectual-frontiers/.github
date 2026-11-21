/**
 * Tests of the plugin `boot` (commons archon-boot 0002-boot-command): the plugin composes into the command `archon` with its five verbs, the names of the variables it reads follow the program, an asset that may not be installed is refused with the fleet's own code and words and nothing is written or armed, `prepare` renders the install and the playbook with
 * the fleet's two dialects (generated, the same text every time, no secret), `arm`, `status` and `disarm` keep their state in the file given, and `serve` does not start where a boot file is missing or does not match its pin. Every name is made up.
 *
 * @module
 */
import { isGenerated } from "@intellectual-frontiers/archon/dialect";
import { ansible } from "@intellectual-frontiers/archon-dialect-ansible";
import { cloudInit } from "@intellectual-frontiers/archon-dialect-cloud-init";
import { assemble, main } from "@intellectual-frontiers/archon/cli";
import { defineRequirement, type Requirement } from "@intellectual-frontiers/archon/governance";
import { err, ok } from "@intellectual-frontiers/core";
import { verbIds } from "@intellectual-frontiers/headless/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { value } from "@intellectual-frontiers/terminal/args";
import { bootPlugin, defaultStateFile, variable, type BootPluginConfig } from "../src/mod.ts";

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMadeUpKeyForTestsOnlyMadeUpKeyForTestsOnly1";
function req(id: string, kind: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}
const REQS = [
  req("setting.timezone", "system-setting", { name: "timezone", value: "America/New_York" }),
  req("setting.locale", "system-setting", { name: "locale", value: "en_US.UTF-8" }),
  req("setting.keyboard", "system-setting", { name: "keyboard", value: "us" }),
  req("user.admin", "user", { name: "adminer", uid: 1000, comment: "Ada Admin" }),
  req("key.admin", "ssh-authorized-key", { user: "adminer", key: KEY }),
  req("dir.srv", "directory", { path: "/srv/lab", owner: "adminer", mode: "0750" }, { dependsOn: ["user.admin"] }),
];

function config(dir: string, refuse = false): BootPluginConfig {
  return {
    version: "0.1.0",
    program: "archon",
    options: { fleet: value<never>({ help: "The fleet's own option.", valueName: "NAME", default: "" }) },
    subject: async (asset, o) =>
      refuse
        ? err({ message: `${asset} is adopted: it is observed and never installed`, code: "E-NOT-OURS", exit: "findings" })
        : ok({
            requirements: REQS,
            install: cloudInit({ fleet: o["fleet"] ?? "", repository: { url: "https://git.example.test/lab.git", branch: "main", renderPath: `render/${asset}/ansible` }, allowedSigners: `signer@example.test ${KEY}`, base: "@archon:base@" }),
            playbook: ansible(),
            dir: path.join(dir, "render", asset),
            shown: `render/${asset}`,
          }),
    provider: () => ({ hosts: async () => [], userData: async () => undefined, metaData: async () => undefined, passwordHash: async () => undefined }),
  };
}

async function run(c: BootPluginConfig, argv: readonly string[]) {
  const plugin = bootPlugin(c);
  if (plugin.kind === "err") throw new Error(JSON.stringify(plugin.error));
  const out: string[] = [];
  const errs: string[] = [];
  const code = await main([plugin.value], "0.1.0", argv, { env: () => undefined, out: (t) => void out.push(t), err: (t) => void errs.push(t) });
  return { code, out: out.join(""), err: errs.join("") };
}

proves(["0002-boot-command FR-001"], "the plugin composes into the command with the verbs prepare, arm, disarm, status and serve, and the variables it reads follow the program", () => {
  const p = bootPlugin(config("/tmp/x"));
  assert(p.kind === "ok");
  const composed = assemble([p.value], "0.1.0");
  assert(composed.kind === "ok");
  assertEquals(verbIds(composed.value.program).filter((v) => v.includes("boot")), ["archon boot arm", "archon boot disarm", "archon boot prepare", "archon boot serve", "archon boot status"]);
  assertEquals([variable("archon", "BOOT_STATE"), variable("my-fleet", "SECRETS"), variable("opsfolio", "BOOT_ASSETS")], ["ARCHON_BOOT_STATE", "MY_FLEET_SECRETS", "OPSFOLIO_BOOT_ASSETS"]);
  assertEquals(defaultStateFile("archon", (n) => (n === "ARCHON_BOOT_STATE" ? "/s/state.json" : n === "XDG_CONFIG_HOME" ? "/cfg" : undefined)), "/s/state.json");
  assertEquals(defaultStateFile("archon", (n) => (n === "XDG_CONFIG_HOME" ? "/cfg" : undefined)), "/cfg/archon/boot/state.json");
});

proves(["0002-boot-command FR-002"], "an asset that may not be installed is refused by prepare and by arm with the fleet's code, exit and words, and nothing is written or armed", async () => {
  await fs.withTempDir(async (dir) => {
    const state = path.join(dir, "state.json");
    const c = config(dir, true);
    const p = await run(c, ["boot", "prepare", "--asset", "athens"]);
    assertEquals(p.code, 1, p.err + p.out);
    assert(p.err.includes("E-NOT-OURS") && p.err.includes("never installed"), p.err);
    const a = await run(c, ["boot", "arm", "--asset", "athens", "--state", state]);
    assertEquals(a.code, 1);
    assertEquals([await fs.exists(path.join(dir, "render")), await fs.exists(state)], [false, false]);
  });
});

proves(["0002-boot-command FR-003"], "prepare renders the autoinstall and the playbook with the fleet's two dialects, as generated files with no secret, the same text every time, each dialect taking the requirements it carries", async () => {
  await fs.withTempDir(async (dir) => {
    const c = config(dir);
    const r = await run(c, ["boot", "prepare", "--asset", "athens", "--fleet", "lab"]);
    assertEquals(r.code, 0, r.err + r.out);
    const base = path.join(dir, "render", "athens");
    const files = ["cloud-init/user-data", "cloud-init/meta-data", "ansible/playbook.yml", "ansible/inventory.yml", "ansible/ansible.cfg"];
    const text: Record<string, string> = {};
    for (const f of files) {
      text[f] = await fs.readTextFile(path.join(base, f));
      assert(isGenerated(text[f] ?? ""), f);
      for (const bad of ["PRIVATE KEY", "$6$", "$y$"]) assert(!(text[f] ?? "").includes(bad), `${f} holds ${bad}`);
      assert(r.out.includes(`wrote render/athens/${f}`), r.out);
    }
    assert((text["cloud-init/user-data"] ?? "").includes("@archon:password-hash@") && (text["cloud-init/user-data"] ?? "").includes('"hostname": "athens"') && !(text["cloud-init/user-data"] ?? "").includes("/srv/lab"), "the install holds what an install can state and not a directory");
    assert((text["ansible/playbook.yml"] ?? "").includes("ansible.builtin.file") && (text["ansible/playbook.yml"] ?? "").includes("/srv/lab"), "the playbook converges the whole of it");
    await run(c, ["boot", "prepare", "--asset", "athens", "--fleet", "lab"]);
    assertEquals(await fs.readTextFile(path.join(base, "ansible/playbook.yml")), text["ansible/playbook.yml"], "the same text every time");
  });
});

proves(["0002-boot-command FR-004"], "arm, status and disarm keep their state in the file given: an arming says whether it may erase a disk that holds data, and a disarmed asset is not armed", async () => {
  await fs.withTempDir(async (dir) => {
    const c = config(dir);
    const state = path.join(dir, "s", "state.json");
    const status = () => run(c, ["boot", "status", "--state", state, "--assets", dir]);
    assert((await status()).out.includes("armed: nothing"));
    const armed = await run(c, ["boot", "arm", "--asset", "athens", "--state", state]);
    assertEquals(armed.code, 0, armed.err + armed.out);
    assert(armed.out.includes("stopped if a disk holds data"));
    assert((await status()).out.includes("athens (armed"));
    assert(!(await fs.readTextFile(state)).includes("confirmDestroy"));
    const erase = await run(c, ["boot", "arm", "--asset", "athens", "--state", state, "--confirm-destroy", "yes", "--mac", "aa:bb:cc:dd:ee:ff"]);
    assert(erase.out.includes("may erase a disk that holds data") && (await fs.readTextFile(state)).includes('"confirmDestroy": true') && (await fs.readTextFile(state)).includes("aa:bb:cc:dd:ee:ff"));
    assertEquals((await fs.stat(state)).mode! & 0o077, 0, "kept for its owner alone");
    assertEquals((await run(c, ["boot", "disarm", "--asset", "athens", "--state", state])).code, 0);
    assert((await status()).out.includes("armed: nothing"));
  });
});

proves(["0002-boot-command FR-005"], "serve does not start where a boot file is missing or does not match its pin, and says how to get the files", async () => {
  await fs.withTempDir(async (dir) => {
    const r = await run(config(dir), ["boot", "serve", "--state", path.join(dir, "state.json"), "--assets", dir, "--for", "1"]);
    assertEquals(r.code, 3, r.err + r.out);
    assert(r.err.includes("--fetch yes"), r.err);
    await fs.writeTextFile(path.join(dir, "linux"), "tampered");
    const t = await run(config(dir), ["boot", "serve", "--state", path.join(dir, "state.json"), "--assets", dir, "--for", "1"]);
    assertEquals(t.code, 3);
  });
});
