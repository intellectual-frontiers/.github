/**
 * Tests of the dialect for each family of Linux (commons archon-dialect-ansible 0003-ansible-families): the module that carries a package by family, what is not carried said with the reason (a package on a family whose package module is not in ansible-core, the keyboard layout where the family keeps no
 * such file), and, on real disposable machines of the library `lab` (Debian 13 with ansible-core 2.19 and Rocky Linux 9 with ansible-core 2.14) with the real tool, the same order checked, applied, applied again with no change, and found again when changed by hand. Skipped, with the reason, where there is no container
 * runtime. Every name is made up.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOf } from "@intellectual-frontiers/archon/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansible, kindsCarriedFor } from "../src/dialect.ts";

function req(id: string, kind: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

const SUBJECT = (() => {
  const n = parseSubjectName("synthetic-server-02");
  if (n.kind === "err") throw new Error(n.error);
  return { name: n.value, class: "machine" as const };
})();

function orderOf(requirements: readonly Requirement[]) {
  const o = buildOrder({ subject: SUBJECT, assurance: "solo" as never, layers: [{ layer: "baseline", requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return o.value;
}

const SHARED = [
  req("group.lab", "group", { name: "labgroup" }),
  req("user.lab", "user", { name: "labuser", uid: 1500, comment: "Lab User", shell: "/bin/bash", groups: ["labgroup"] }, { dependsOn: ["group.lab"] }),
  req("dir.lab", "directory", { path: "/srv/lab", owner: "labuser", mode: "0750" }, { dependsOn: ["user.lab"] }),
  req("file.lab", "file", { path: "/srv/lab/motd", content: "hello\n", owner: "labuser", mode: "0640" }, { dependsOn: ["dir.lab"] }),
  req("setting.timezone", "system-setting", { name: "timezone", value: "America/New_York" }),
  req("setting.locale", "system-setting", { name: "locale", value: "en_US.UTF-8" }),
  req("pkg.ssh", "package", { name: "openssh-server" }),
];

async function render(family: "debian" | "rhel" | "suse" | "arch", reqs: readonly Requirement[]) {
  const order = orderOf(reqs);
  return await ansible({ family }).render(order, planOf(order, new Map()));
}

proves(["0003-ansible-families FR-001", "0003-ansible-families FR-002"], "a package is carried by apt on debian and dnf on rhel, the version is written as each writes it, and a service is carried by the module systemd that every version of ansible-core has", async () => {
  const deb = await render("debian", [...SHARED, req("pkg.v", "package", { name: "curl", version: "8.5.0-2" }), req("svc.ssh", "service", { name: "ssh.service", running: true, enabled: true })]);
  const rpm = await render("rhel", [...SHARED, req("pkg.v", "package", { name: "curl", version: "7.76.1-29.el9" }), req("svc.ssh", "service", { name: "sshd.service", running: true, enabled: true })]);
  assert(deb.kind === "ok" && rpm.kind === "ok");
  const d = deb.value.files.get("ansible/playbook.yml") ?? "";
  const r = rpm.value.files.get("ansible/playbook.yml") ?? "";
  assert(d.includes("ansible.builtin.apt") && d.includes("curl=8.5.0-2") && !d.includes("ansible.builtin.dnf"));
  assert(r.includes("ansible.builtin.dnf") && r.includes("curl-7.76.1-29.el9") && !r.includes("ansible.builtin.apt") && !r.includes("update_cache"));
  for (const text of [d, r]) assert(text.includes("ansible.builtin.systemd\"") && !text.includes("systemd_service"));
  assert(r.includes("/etc/locale.conf") && !r.includes("locale-gen") && !r.includes('"locales"'), "the locale of the family is its own file and no package");
  assert(!r.includes("/etc/timezone") && r.includes("/etc/localtime") && d.includes("/etc/timezone"), "the time zone of rhel is the link alone");
});

proves(["0003-ansible-families FR-003"], "what a family does not carry is said with the reason: a package on suse and arch, the keyboard layout on every family but debian, and the guarantees list only what is carried", async () => {
  for (const family of ["suse", "arch"] as const) {
    const r = await render(family, [req("pkg.x", "package", { name: "curl" }), req("group.lab", "group", { name: "labgroup" })]);
    assert(r.kind === "err" && r.error.length === 1 && r.error[0]?.includes(`not carried for the family ${family}`) === true && r.error[0]?.includes("no builtin module"), JSON.stringify(r));
    assert(!kindsCarriedFor(family).includes("package") && kindsCarriedFor(family).includes("group"));
    assert(!ansible({ family }).guarantees.kinds.map(String).includes("package"));
  }
  assert(kindsCarriedFor("debian").includes("package") && kindsCarriedFor("rhel").includes("package"));
  const kb = await render("rhel", [req("setting.kb", "system-setting", { name: "keyboard", value: "us" })]);
  assert(kb.kind === "err" && kb.error[0]?.includes("keyboard layout is not carried for the family rhel") === true);
  assertEquals((await render("debian", [req("setting.kb", "system-setting", { name: "keyboard", value: "us" })])).kind, "ok");
});

const reason = await runtimeUsable("docker");

for (const [image, family, version, ssh] of [["debian:13", "debian", "2.19", "ssh.service"], ["quay.io/rockylinux/rockylinux:9", "rhel", "2.14", "sshd.service"]] as const) {
  proves(["0003-ansible-families FR-004"], `on a real ${image} machine with the real ansible-core: check shows the change, apply makes it, a second apply changes nothing, and a change by hand is found again`, async (t) => {
    if (reason !== undefined) return t.skip(reason);
    const spec = readMachineSpec({ name: `fam-${family}`, image, users: [{ name: "admin", sudo: true }], packages: ["ansible-core"] });
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const machine = started.value;
    try {
      const run = (argv: readonly string[], input?: string) => machine.executor.exec(argv, input === undefined ? {} : { input });
      const text = async (argv: readonly string[]) => new TextDecoder().decode((await run(argv)).stdout);
      // on a network that inspects TLS (LAB_CA_BUNDLE names the certificate) the machine trusts it, as a person's own machine behind such a network does
      const ca = process.env["LAB_CA_BUNDLE"];
      if (family === "rhel" && ca !== undefined && ca !== "" && existsSync(ca)) {
        assert((await run(["tee", "/etc/pki/ca-trust/source/anchors/lab-ca.pem"], readFileSync(ca, "utf8"))).success);
        assert((await run(["update-ca-trust"])).success);
      }
      const first = (await text(["ansible-playbook", "--version"])).split("\n")[0] ?? "";
      assert(first.includes(`core ${version}`), `the machine has ${first}`);
      const reqs = [...SHARED, req("svc.ssh", "service", { name: ssh, running: true, enabled: true })];
      const d = ansible({ family, version, renderRoot: "/var/lib/archon" });
      const converge = async (mode: "check" | "apply") => {
        const order = orderOf(reqs);
        const plan = planOf(order, new Map());
        const rendered = await d.render(order, plan);
        assert(rendered.kind === "ok", JSON.stringify(rendered));
        const steps = d.steps(plan, rendered.value);
        for (const [path, body] of rendered.value.files) {
          const full = `/var/lib/archon/${rendered.value.digest}/${path}`;
          assert((await run(["mkdir", "-p", full.slice(0, full.lastIndexOf("/"))])).success);
          assert((await run(["tee", full], body)).success);
        }
        const r = await run(mode === "check" ? steps[0]!.check! : steps[0]!.apply);
        return { code: r.code, out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr) };
      };
      const check = await converge("check");
      assertEquals(check.code, 2, check.out);
      assert((await run(["getent", "passwd", "labuser"])).code !== 0, "check changed nothing");
      const applied = await converge("apply");
      assertEquals(applied.code, 0, applied.out);
      assertEquals(await text(["cat", "/srv/lab/motd"]), "hello\n");
      assertEquals((await text(["readlink", "/etc/localtime"])).trim(), "/usr/share/zoneinfo/America/New_York");
      assert((await text(["cat", family === "debian" ? "/etc/default/locale" : "/etc/locale.conf"])).includes("LANG=en_US.UTF-8"));
      const again = await converge("apply");
      assertEquals(again.code, 0, again.out);
      assert(/changed=0\b/.test(again.out), `the second apply changes nothing:\n${again.out}`);
      assertEquals((await converge("check")).code, 0);
      assert((await run(["tee", "/srv/lab/motd"], "changed by hand\n")).success);
      const drift = await converge("check");
      assertEquals(drift.code, 2, drift.out);
    } finally {
      await machine.stop();
    }
  }, { timeout: 900_000 });
}
