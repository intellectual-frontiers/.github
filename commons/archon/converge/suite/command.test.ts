/**
 * Tests of the plugin `converge` (commons archon-converge 0002-converge-command): the plugin composes into the command `archon` with its two verbs, an asset that is not for the plugin to change is refused with the code, the exit and the words the fleet gives, and, on a real disposable machine of the library `lab` with the
 * real ansible-core and the dialect of the fleet's choosing, the whole of it through the command: the plan with its hash (what no dialect carries said), nothing changed by the plan, an apply of a hash that is not the plan's refused, the approved plan applied and the plan after it empty, drift found again, and a
 * removal that needs `--allow-removal yes`. Without a container runtime the real test is skipped with the reason. Every name is made up.
 *
 * @module
 */
import { ansible } from "@intellectual-frontiers/archon-dialect-ansible";
import { assemble, main } from "@intellectual-frontiers/archon/cli";
import { defineRequirement, type Requirement } from "@intellectual-frontiers/archon/governance";
import { err, ok } from "@intellectual-frontiers/core";
import { textOf, verbIds } from "@intellectual-frontiers/headless/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { value } from "@intellectual-frontiers/terminal/args";
import { convergePlugin, type ConvergePluginConfig } from "../src/mod.ts";

function req(id: string, kind: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

const CARRIED = [
  req("group.lab", "group", { name: "labgroup" }),
  req("user.lab", "user", { name: "labuser", shell: "/bin/bash", groups: ["labgroup"] }, { dependsOn: ["group.lab"] }),
  req("dir.lab", "directory", { path: "/srv/lab", owner: "labuser", mode: "0750" }, { dependsOn: ["user.lab"] }),
  req("file.lab", "file", { path: "/srv/lab/motd", content: "hello\n", owner: "labuser", mode: "0640" }, { dependsOn: ["dir.lab"] }),
];
const UNEXPRESSED = [req("fw.ssh", "firewall-rule", { port: 22 })];

async function run(config: ConvergePluginConfig, argv: readonly string[]) {
  const plugin = convergePlugin(config);
  if (plugin.kind === "err") throw new Error(JSON.stringify(plugin.error));
  const out: string[] = [];
  const errs: string[] = [];
  const code = await main([plugin.value], "0.1.0", argv, { env: () => undefined, out: (t) => void out.push(t), err: (t) => void errs.push(t) });
  return { code, out: out.join(""), err: errs.join("") };
}

const base = (subject: ConvergePluginConfig["subject"]): ConvergePluginConfig => ({
  version: "0.1.0",
  dialect: ansible({ renderRoot: "/var/lib/archon-test" }),
  renderRoot: "/var/lib/archon-test",
  toolVersion: ["ansible-playbook", "--version"],
  options: { fleet: value<never>({ help: "The fleet's own option.", valueName: "NAME", default: "" }) },
  subject,
});

proves(["0002-converge-command FR-001"], "the plugin composes into the command with the verbs plan and apply, and an asset that is not for it to change is refused with the fleet's own code, exit and words, and the options the fleet gave reach its function", async () => {
  const composed = assemble([(() => {
    const p = convergePlugin(base(async () => err({ message: "synthetic-server-02 is adopted", code: "E-NOT-OURS", exit: "findings" })));
    if (p.kind === "err") throw new Error("plugin");
    return p.value;
  })()], "0.1.0");
  assert(composed.kind === "ok");
  assertEquals(verbIds(composed.value.program).filter((v) => v.includes("converge")), ["archon converge apply", "archon converge plan"]);
  const seen: Array<[string, Record<string, string>]> = [];
  const refused = await run(base(async (asset, o) => (seen.push([asset, { ...o }]), err({ message: "synthetic-server-02 is adopted: it is observed and never changed", code: "E-NOT-OURS", exit: "findings" }))), ["converge", "plan", "--asset", "synthetic-server-02", "--fleet", "lab"]);
  assertEquals(refused.code, 1, refused.err + refused.out);
  assert(refused.err.includes("E-NOT-OURS") && refused.err.includes("never changed"), refused.err);
  assertEquals(seen, [["synthetic-server-02", { fleet: "lab" }]]);
  assertEquals((await run(base(async () => err({ message: "no such asset", code: "E-ASSET", exit: "usage" })), ["converge", "apply", "--asset", "x", "--plan-hash", "sha256:0"])).code, 2);
});

const reason = await runtimeUsable("docker");

proves(["0002-converge-command FR-002", "0002-converge-command FR-003", "0002-converge-command FR-004", "0002-converge-command FR-005"], "through the command on a real machine with ansible-core: plan with a hash and what no dialect carries, an apply of another hash refused, the approved plan applied and the plan after it empty, drift found again, and a removal that needs --allow-removal yes", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "synthetic-server-02", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: ["ansible-core"] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const m = started.value;
  try {
    let carried = CARRIED;
    const config = base(async () => ok({ requirements: carried, unexpressed: UNEXPRESSED, executor: m.executor, elevate: [] }));
    const sh = async (...argv: string[]) => textOf((await m.executor.exec(argv)).stdout);
    let hash = "";

    const plan = await run(config, ["converge", "plan", "--asset", "synthetic-server-02"]);
    assertEquals(plan.code, 4, plan.err + plan.out);
    assert(plan.out.includes("4 changes, 0 already as declared") && plan.out.includes("create group.lab") && plan.out.includes("not converged: fw.ssh"), plan.out);
    hash = /(sha256:[0-9a-f]{64})/.exec(plan.out)?.[1] ?? "";
    assert(hash !== "");
    assertEquals((await m.executor.exec(["getent", "passwd", "labuser"])).code, 2, "the plan changed nothing");
    assertEquals((await m.executor.exec(["test", "-e", "/var/lib/archon-test"])).code, 1, "and wrote nothing on the machine");

    const wrong = await run(config, ["converge", "apply", "--asset", "synthetic-server-02", "--plan-hash", `sha256:${"0".repeat(64)}`]);
    assertEquals(wrong.code, 1);
    assert(wrong.err.includes("the plan changed"), wrong.err);
    assertEquals((await m.executor.exec(["getent", "passwd", "labuser"])).code, 2);

    const applied = await run(config, ["converge", "apply", "--asset", "synthetic-server-02", "--plan-hash", hash]);
    assertEquals(applied.code, 0, applied.err + applied.out);
    assert(applied.out.includes("applied") && applied.out.includes("the plan after the apply is empty"), applied.out);
    assertEquals((await sh("stat", "-c", "%U %a", "/srv/lab/motd")).trim(), "labuser 640");
    const again = await run(config, ["converge", "plan", "--asset", "synthetic-server-02"]);
    assertEquals(again.code, 0, again.err + again.out);
    assert(again.out.includes("0 changes, 4 already as declared") && again.out.includes("the plan is empty"), again.out);

    assert((await m.executor.exec(["tee", "/srv/lab/motd"], { input: "changed by hand\n" })).success);
    const drift = await run(config, ["converge", "plan", "--asset", "synthetic-server-02"]);
    assertEquals(drift.code, 4);
    assert(drift.out.includes("1 change, 3 already as declared") && drift.out.includes("update file.lab"), drift.out);
    assertEquals((await run(config, ["converge", "apply", "--asset", "synthetic-server-02", "--plan-hash", /(sha256:[0-9a-f]{64})/.exec(drift.out)?.[1] ?? ""])).code, 0);
    assertEquals(await sh("cat", "/srv/lab/motd"), "hello\n");

    carried = [CARRIED[0]!, CARRIED[1]!, req("file.lab", "file", { path: "/srv/lab/motd" }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" }), CARRIED[2]!];
    const removal = await run(config, ["converge", "plan", "--asset", "synthetic-server-02"]);
    assertEquals(removal.code, 4, removal.err + removal.out);
    assert(removal.out.includes("remove") && removal.out.includes("file.lab"), removal.out);
    const h = /(sha256:[0-9a-f]{64})/.exec(removal.out)?.[1] ?? "";
    const refused = await run(config, ["converge", "apply", "--asset", "synthetic-server-02", "--plan-hash", h]);
    assertEquals(refused.code, 1);
    assert(refused.err.includes("--allow-removal"), refused.err);
    assertEquals((await m.executor.exec(["test", "-f", "/srv/lab/motd"])).success, true, "nothing was removed");
    assertEquals((await run(config, ["converge", "apply", "--asset", "synthetic-server-02", "--plan-hash", h, "--allow-removal", "yes"])).code, 0);
    assertEquals((await m.executor.exec(["test", "-f", "/srv/lab/motd"])).success, false, "the file is gone");
  } finally {
    await m.stop();
  }
});

proves(["0002-converge-command FR-006"], "a machine of another family is converged by its own dialect and observed by the program of its family: on a real Rocky Linux machine the plan is made, the hash approved, the apply made and the plan after it empty", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "rocky", image: "quay.io/rockylinux/rockylinux:9", users: [{ name: "admin", sudo: true }], packages: ["ansible-core"] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const m = started.value;
  try {
    const dialect = ansible({ family: "rhel", version: "2.14", renderRoot: "/var/lib/archon-test" });
    const reqs = [req("group.lab", "group", { name: "labgroup" }), req("pkg.ssh", "package", { name: "openssh-server" }), req("dir.lab", "directory", { path: "/srv/lab", mode: "0750" }, { dependsOn: ["group.lab"] })];
    const config: ConvergePluginConfig = { ...base(async () => ok({ requirements: reqs, unexpressed: [], executor: m.executor, elevate: [], family: "rhel", dialect })), dialect: ansible({ renderRoot: "/var/lib/archon-test" }) };
    const plan = await run(config, ["converge", "plan", "--asset", "rocky"]);
    assertEquals(plan.code, 4, plan.err + plan.out);
    assert(plan.out.includes("2 changes, 1 already as declared") && plan.out.includes("create group.lab") && !plan.out.includes("pkg.ssh: "), plan.out);
    const hash = /(sha256:[0-9a-f]{64})/.exec(plan.out)?.[1] ?? "";
    const applied = await run(config, ["converge", "apply", "--asset", "rocky", "--plan-hash", hash]);
    assertEquals(applied.code, 0, applied.err + applied.out);
    assert(applied.out.includes("the plan after the apply is empty"), applied.out);
    assertEquals((await run(config, ["converge", "plan", "--asset", "rocky"])).code, 0);
  } finally {
    await m.stop();
  }
}, { timeout: 900_000 });
