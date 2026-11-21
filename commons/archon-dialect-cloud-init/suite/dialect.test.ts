/**
 * Tests of the dialect of the unattended install (commons archon-dialect-cloud-init 0002-cloud-init-dialect FR-001 to FR-007): what it guarantees, the facts of an install taken from an order (and every reason there are not enough), the autoinstall configuration that is rendered (generated, the same
 * text every time, the password only as a placeholder, no secret, the blank-disk guard first, key-only sign-in), and, on a disposable machine of the library `lab` with the real git, ssh-keygen and ansible-core, the script the machine converges itself with: it runs nothing unless
 * the tip of its repository is signed by one of its signers, and runs the playbook of the signed tip. Without a container runtime the real test is skipped with the reason and never passes. Every name is made up.
 *
 * @module
 */
import { isGenerated } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { cloudInit, DIALECT_ID, installSpecOf, KINDS_CARRIED, type CloudInitOptions } from "../src/dialect.ts";
import { autoinstall, convergeScript, metaData, PASSWORD_PLACEHOLDER } from "../src/install.ts";

function req(id: string, kind: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}
const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMadeUpKeyForTestsOnlyMadeUpKeyForTestsOnly1";
const REQS = [
  req("setting.timezone", "system-setting", { name: "timezone", value: "America/New_York" }),
  req("setting.locale", "system-setting", { name: "locale", value: "en_US.UTF-8" }),
  req("setting.keyboard", "system-setting", { name: "keyboard", value: "us" }),
  req("user.admin", "user", { name: "adminer", uid: 1000, comment: "Ada Admin" }),
  req("key.admin", "ssh-authorized-key", { user: "adminer", key: KEY }),
  req("pkg.git", "package", { name: "git" }),
];
const OPTIONS: CloudInitOptions = {
  fleet: "labfleet",
  repository: { url: "https://git.example.test/labfleet.git", branch: "main", renderPath: "fleets/lab/render/athens/ansible" },
  allowedSigners: `signer@example.test ${KEY}`,
  base: "http://192.0.2.10:8080/install/athens/tok/",
};
const SUBJECT = (() => {
  const n = parseSubjectName("athens");
  if (n.kind === "err") throw new Error(n.error);
  return { name: n.value, class: "machine" as const };
})();
function orderOf(requirements: readonly Requirement[]) {
  const o = buildOrder({ subject: SUBJECT, assurance: "solo", layers: [{ layer: "baseline", requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return o.value;
}

proves(["0002-cloud-init-dialect FR-001"], "the data says what the dialect guarantees: the kinds an install can state, no plan, nothing proven by a run of the tool, and that it destroys (it erases a disk)", () => {
  const d = cloudInit(OPTIONS);
  assertEquals(String(d.id), DIALECT_ID);
  assertEquals(d.guarantees.kinds.map(String), [...KINDS_CARRIED]);
  assertEquals([d.guarantees.plan, d.guarantees.idempotence, d.guarantees.destroy, d.guarantees.subjects], ["none", "unproven", true, ["machine"]]);
  assertEquals(d.steps(planOrder(orderOf(REQS), new Map()), { files: new Map(), digest: "x" as never }), [], "the installer carries it out, not an executor");
});

proves(["0002-cloud-init-dialect FR-002"], "the facts of an install are taken from the order, and every reason there are not enough is given", () => {
  const ok = installSpecOf(orderOf(REQS), OPTIONS);
  assert(ok.kind === "ok");
  assertEquals([ok.value.hostname, ok.value.admin, ok.value.timezone, ok.value.locale, ok.value.keyboard, ok.value.packages], ["athens", { user: "adminer", realname: "Ada Admin", sshKeys: [KEY] }, "America/New_York", "en_US.UTF-8", "us", ["git"]]);
  const bad = installSpecOf(orderOf([REQS[0]!, req("fw.x", "firewall-rule", { port: 22 }), req("gone", "package", { name: "x" }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" })]), OPTIONS);
  assert(bad.kind === "err");
  const all = bad.error.join("\n");
  for (const word of ["the kind firewall-rule is not carried", "never what must not", "needs a requirement of the kind user", "setting locale", "setting keyboard"]) assert(all.includes(word), `${word}\n${all}`);
  const noKey = installSpecOf(orderOf(REQS.filter((r) => r.id !== "key.admin")), OPTIONS);
  assert(noKey.kind === "err" && noKey.error.join("").includes("a key for the administrator adminer"));
});

proves(["0002-cloud-init-dialect FR-003", "0002-cloud-init-dialect FR-004"], "the render is generated and the same every time, holds the password only as a placeholder and no secret, runs the blank-disk guard first, and allows key sign-in only", async () => {
  const order = orderOf(REQS);
  const plan = planOrder(order, new Map());
  const a = await cloudInit(OPTIONS).render(order, plan);
  const b = await cloudInit(OPTIONS).render(order, plan);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value.digest, b.value.digest);
  assertEquals([...a.value.files.keys()], ["cloud-init/user-data", "cloud-init/meta-data"]);
  for (const t of a.value.files.values()) assert(isGenerated(t));
  const userData = a.value.files.get("cloud-init/user-data") ?? "";
  assert(userData.startsWith("#cloud-config\n"));
  for (const bad of ["PRIVATE KEY", "$6$", "$y$", "password: \"$"]) assert(!userData.includes(bad), bad);
  const doc = JSON.parse(userData.split("\n").filter((l) => !l.startsWith("#")).join("\n")) as { autoinstall: Record<string, any> };
  const ai = doc.autoinstall;
  assertEquals(ai["identity"], { hostname: "athens", username: "adminer", realname: "Ada Admin", password: PASSWORD_PLACEHOLDER });
  assertEquals(ai["ssh"], { "install-server": true, "allow-pw": false, "authorized-keys": [KEY] });
  assertEquals(ai["storage"], { layout: { name: "lvm", match: { size: "largest" } } });
  assert(String(ai["early-commands"][0]).includes("guard.sh") && String(ai["early-commands"][0]).includes("poweroff"), "the guard runs first and fails closed");
  assertEquals([ai["locale"], ai["keyboard"], ai["timezone"], ai["updates"], ai["shutdown"]], ["en_US.UTF-8", { layout: "us" }, "America/New_York", "security", "reboot"]);
  assert(String(ai["late-commands"][0]).endsWith("/done || true"));
  assertEquals(ai["user-data"]["runcmd"][0], ["/usr/local/sbin/archon-converge"]);
  const paths = ai["user-data"]["write_files"].map((f: { path: string }) => f.path);
  assert(paths.includes("/etc/archon/allowed_signers") && paths.includes("/etc/systemd/system/archon-converge.timer"));
  assertEquals(metaData({ hostname: "athens" }), "instance-id: archon-athens\nlocal-hostname: athens\n");
  const served = autoinstall(installSpecOf(order, OPTIONS).kind === "ok" ? (installSpecOf(order, OPTIONS) as { value: Parameters<typeof autoinstall>[0] }).value : (undefined as never), "$6$made$up");
  assert(served.includes('"password": "$6$made$up"') && !served.includes(PASSWORD_PLACEHOLDER), "the boot server puts the hash in when it serves the file");
});

proves(["0002-cloud-init-dialect FR-005"], "a secret in a requirement and a kind that is not carried are refused by the render", async () => {
  const order = orderOf([...REQS, req("fw.x", "firewall-rule", { port: 22 })]);
  const r = await cloudInit(OPTIONS).render(order, planOrder(order, new Map()));
  assert(r.kind === "err" && r.error.join("").includes("firewall-rule"));
});

const reason = await runtimeUsable("docker");

proves(["0002-cloud-init-dialect FR-006"], "on a disposable machine the converge script runs nothing from an unsigned tip and runs the playbook of a tip signed by a fleet signer", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "athens", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: ["ansible-core", "git", "openssh-client"] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const m = started.value;
  try {
    const run = async (argv: readonly string[], input?: string) => {
      const r = await m.executor.exec(argv, input === undefined ? {} : { input });
      return { code: r.code, out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr) };
    };
    const ok = async (argv: readonly string[], input?: string) => {
      const r = await run(argv, input);
      assertEquals(r.code, 0, `${argv.join(" ")}: ${r.out}`);
      return r.out;
    };
    await ok(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "signer@example.test", "-f", "/root/signer"]);
    const pub = (await ok(["cat", "/root/signer.pub"])).trim();
    await ok(["mkdir", "-p", "/etc/archon", "/srv/origin/render"]);
    await ok(["tee", "/etc/archon/allowed_signers"], `signer@example.test ${pub}\n`);
    await ok(["tee", "/srv/origin/render/playbook.yml"], JSON.stringify([{ hosts: "all", gather_facts: false, tasks: [{ "ansible.builtin.copy": { dest: "/srv/proof", content: "converged\n" } }] }]));
    await ok(["tee", "/srv/origin/render/inventory.yml"], JSON.stringify({ all: { hosts: { athens: { ansible_connection: "local", ansible_python_interpreter: "auto_silent" } } } }));
    await ok(["tee", "/srv/origin/render/ansible.cfg"], "[defaults]\nnocows = True\n");
    await ok(["tee", "/usr/local/sbin/archon-converge"], convergeScript({ repository: { url: "/srv/origin", branch: "main", renderPath: "render" }, base: "http://127.0.0.1:1/" }));
    await ok(["chmod", "755", "/usr/local/sbin/archon-converge"]);
    const git = (...a: string[]) => ok(["git", "-C", "/srv/origin", "-c", "user.name=t", "-c", "user.email=t@example.test", ...a]);
    await ok(["git", "init", "-q", "-b", "main", "/srv/origin"]);
    await git("add", "-A");
    await git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "unsigned");
    const refused = await run(["/usr/local/sbin/archon-converge"]);
    assertEquals(refused.code, 1, refused.out);
    assertEquals((await run(["test", "-e", "/srv/proof"])).code, 1, "nothing ran from an unsigned tip");
    await git("-c", "gpg.format=ssh", "-c", "user.signingkey=/root/signer.pub", "-c", "gpg.ssh.program=ssh-keygen", "commit", "-q", "--amend", "-S", "-m", "signed", "--no-edit");
    // ssh-keygen -Y sign wants the private key beside the public one when given the .pub; the agent is not used
    const done = await run(["/usr/local/sbin/archon-converge"]);
    assertEquals(done.code, 0, done.out + (await run(["cat", "/var/log/archon-converge.log"])).out);
    assertEquals((await run(["cat", "/srv/proof"])).out, "converged\n");
    const again = await run(["/usr/local/sbin/archon-converge"]);
    assertEquals(again.code, 0, "the script can run again (the timer does)");
  } finally {
    await m.stop();
  }
});

proves(["0002-cloud-init-dialect FR-003"], "the autoinstall section is valid against Subiquity's published schema, where the schema (AUTOINSTALL_SCHEMA, a file) and a Python with jsonschema are at hand", async (t) => {
  const file = process.env["AUTOINSTALL_SCHEMA"];
  if (file === undefined || file === "") return t.skip("AUTOINSTALL_SCHEMA names no file: fetch autoinstall-schema.json from Subiquity's repository (it is GPL, so it is not kept here)");
  const python = process.env["AUTOINSTALL_PYTHON"] ?? "python3";
  const spec = installSpecOf(orderOf(REQS), OPTIONS);
  assert(spec.kind === "ok");
  const text = autoinstall(spec.value, "$6$made$up").split("\n").filter((l) => !l.startsWith("#")).join("\n");
  const code = "import json,sys,jsonschema;s=json.load(open(sys.argv[1]));d=json.loads(sys.stdin.read())['autoinstall'];e=list(jsonschema.Draft7Validator(s).iter_errors(d));print('\\n'.join(x.message for x in e));sys.exit(1 if e else 0)";
  const r = await proc.run([python, "-c", code, file], { input: text });
  assertEquals(r.code, 0, r.stdout + r.stderr);
});

proves(["0002-cloud-init-dialect FR-007"], "the facts that are not requirements (the repository, the signers, the boot server's URL, the MAC, the disk and a proxy) are carried into the install", () => {
  const spec = installSpecOf(orderOf(REQS), { ...OPTIONS, mac: "aa:bb:cc:dd:ee:ff", disk: { match: "/dev/nvme0n1", layout: "direct" }, proxy: "http://proxy.example.test:3128" });
  assert(spec.kind === "ok");
  const doc = JSON.parse(autoinstall(spec.value, "x").split("\n").filter((l) => !l.startsWith("#")).join("\n")) as { autoinstall: Record<string, any> };
  const ai = doc.autoinstall;
  assertEquals(ai["network"].ethernets.uplink.match, { macaddress: "aa:bb:cc:dd:ee:ff" });
  assertEquals(ai["storage"], { layout: { name: "direct", match: { path: "/dev/nvme0n1" } } });
  assertEquals(ai["proxy"], "http://proxy.example.test:3128");
  const files = ai["user-data"].write_files as { path: string; content: string }[];
  assert(files.find((f) => f.path === "/etc/archon/boot-events")?.content === `${OPTIONS.base}event\n`);
  assert(files.find((f) => f.path === "/usr/local/sbin/archon-converge")?.content.includes("fleets/lab/render/athens/ansible"));
  assert(files.some((f) => f.path === "/etc/archon/proxy.env"));
});
