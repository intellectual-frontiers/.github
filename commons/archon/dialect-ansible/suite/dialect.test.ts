/**
 * Tests of the dialect of Ansible (commons archon-dialect-ansible 0002-ansible-dialect FR-001 to FR-006): what it guarantees, the render of an order and its plan (generated, the same text every time, no secret, a kind that is not carried refused), the steps and the
 * plan of headless made from them, and, on a disposable machine of the library `lab` with the real ansible-core of the release's archive, the guarantees that the data claims: a check that shows what would change, an apply that changes it, a second apply that changes
 * nothing, drift found again, and a removal that is destructive. Without a container runtime the real tests are skipped with the reason and never pass. Every name is made up.
 *
 * @module
 */
import { executionPlanOf, isGenerated, stepFindings } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOf, type Observed } from "@intellectual-frontiers/archon/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansible, DIALECT_ID, KINDS_CARRIED, PINNED_VERSION } from "../src/dialect.ts";

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

const REQS = [
  req("group.lab", "group", { name: "labgroup" }),
  req("user.lab", "user", { name: "labuser", uid: 1500, comment: "Lab User", shell: "/bin/bash", groups: ["labgroup"] }, { dependsOn: ["group.lab"] }),
  req("dir.lab", "directory", { path: "/srv/lab", owner: "labuser", mode: "0750" }, { dependsOn: ["user.lab"] }),
  req("file.lab", "file", { path: "/srv/lab/motd", content: "hello\n", owner: "labuser", mode: "0640" }, { dependsOn: ["dir.lab"] }),
  req("setting.timezone", "system-setting", { name: "timezone", value: "America/New_York" }),
  req("setting.keyboard", "system-setting", { name: "keyboard", value: "us" }),
  req("setting.locale", "system-setting", { name: "locale", value: "en_US.UTF-8" }),
  req("key.lab", "ssh-authorized-key", { user: "labuser", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMadeUpKeyForTestsOnlyMadeUpKeyForTestsOnly1 lab@test" }, { dependsOn: ["user.lab"] }),
];

proves(["0002-ansible-dialect FR-001"], "the data says what the dialect guarantees: the kinds it carries, a faithful plan, a proven idempotence, the pinned tool, and that it can destroy", () => {
  const d = ansible();
  assertEquals(String(d.id), DIALECT_ID);
  assertEquals(d.tool, { name: "ansible-core", version: PINNED_VERSION });
  assertEquals(d.guarantees.kinds.map(String), [...KINDS_CARRIED]);
  assertEquals([d.guarantees.plan, d.guarantees.idempotence, d.guarantees.destroy, d.guarantees.subjects], ["faithful", "proven", true, ["machine"]]);
  assertEquals(ansible({ version: "2.18.6" }).tool.version, "2.18.6");
});

proves(["0002-ansible-dialect FR-002", "0002-ansible-dialect FR-003"], "the render is generated, the same text every time, only for what changes, and an observed resource that is as it must be is left out", async () => {
  const order = orderOf(REQS);
  const plan = planOf(order, new Map());
  const a = await ansible().render(order, plan);
  const b = await ansible().render(order, plan);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals([...a.value.files.keys()], ["ansible/inventory.yml", "ansible/ansible.cfg", "ansible/playbook.yml"]);
  for (const text of a.value.files.values()) assert(isGenerated(text));
  assertEquals(a.value.digest, b.value.digest);
  const playbook = a.value.files.get("ansible/playbook.yml") ?? "";
  for (const word of ["ansible.builtin.group", "ansible.builtin.user", "ansible.builtin.copy", "ansible.builtin.lineinfile", "ansible_check_mode"]) assert(playbook.includes(word), word);
  assert(!playbook.includes("community.") && !playbook.includes("ansible.posix"), "only ansible-core's own modules");
  const observed: Observed = new Map([[REQS[0]!.id, REQS[0]!.desired]]);
  const partly = await ansible().render(order, planOf(order, observed));
  assert(partly.kind === "ok" && !(partly.value.files.get("ansible/playbook.yml") ?? "").includes("ansible.builtin.group"));
});

proves(["0002-ansible-dialect FR-004"], "a secret, a kind that is not carried and a malformed desired state are refused with every reason", async () => {
  // a made-up key; the header is joined here so that no file holds the literal marker, which the secret scan of a commit reads in every staged file
  const marker = (edge: string): string => ["-----", edge, " OPENSSH PRIVATE", " KEY-----"].join("");
  const pem = [marker("BEGIN"), "abc", marker("END")].join("\n");
  assertEquals(defineRequirement({ id: "file.secret", summary: "x.", why: ["a reason"], subject: { by: "all" }, kind: "file", desired: { path: "/etc/x", content: pem }, change: "additive" }).kind, "err", "a secret is refused before the dialect sees it");
  const tooBad = [req("sysctl.x", "sysctl", { key: "net.ipv4.ip_forward", value: "1" }), req("dir.bad", "directory", { path: "relative/path" }), req("svc.bad", "service", { name: "cron" })];
  const order = orderOf(tooBad);
  const r = await ansible().render(order, planOf(order, new Map()));
  assert(r.kind === "err");
  assertEquals(r.error.length, 3, r.error.join("\n"));
  const all = r.error.join("\n");
  assert(all.includes("not carried") && all.includes("absolute path") && all.includes("true or false"), all);
});

proves(["0002-ansible-dialect FR-005"], "the steps check with the difference and name the exit that means a change, name the digest of what was rendered, cover only what changes, and a plan that changes nothing has none; a removal is destructive and has a check", async () => {
  const order = orderOf(REQS);
  const plan = planOf(order, new Map());
  const d = ansible({ renderRoot: "/var/lib/archon" });
  const rendered = await d.render(order, plan);
  assert(rendered.kind === "ok");
  const steps = d.steps(plan, rendered.value);
  assertEquals(steps.length, 1);
  for (const step of steps) assertEquals(stepFindings(step), [], "every step is words of core and no shell string (0004-archon-dialects FR-007)");
  const s = steps[0]!;
  assertEquals(s.covers.map(String).sort(), REQS.map((r) => String(r.id)).sort());
  assertEquals(s.changedExit, 2);
  assert(s.apply.includes("ansible-playbook") && s.check?.includes("--check") && s.check.includes("--diff") && !s.apply.includes("--check"));
  assert(s.apply.some((w) => w.includes(rendered.value.digest)), "the digest is in the vector");
  const exec = executionPlanOf(plan, rendered.value, steps);
  assert(exec.kind === "ok" && exec.value !== undefined && exec.value.steps.length === 1);
  const done: Observed = new Map(REQS.map((r) => [r.id, r.desired]));
  const nothing = planOf(order, done);
  const none = await d.render(order, nothing);
  assert(none.kind === "ok");
  assertEquals(d.steps(nothing, none.value), []);
  const gone = req("user.gone", "user", { name: "labuser" }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" });
  const o2 = orderOf([gone]);
  const p2 = planOf(o2, new Map([[gone.id, { name: "labuser" }]]));
  const r2 = await d.render(o2, p2);
  assert(r2.kind === "ok");
  const e2 = executionPlanOf(p2, r2.value, d.steps(p2, r2.value));
  assert(e2.kind === "ok" && e2.value?.steps[0]?.effect === "destructive" && e2.value.steps[0].check !== undefined);
});

const reason = await runtimeUsable("docker");

proves(["0002-ansible-dialect FR-006"], "on a disposable machine with the real ansible-core: check shows the change, apply makes it, a second apply changes nothing, drift is found again, and a removal is carried out", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "synthetic-server-02", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: ["ansible-core"] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const machine = started.value;
  try {
    const run = (argv: readonly string[], input?: string) => machine.executor.exec(argv, input === undefined ? {} : { input });
    const version = new TextDecoder().decode((await run(["ansible-playbook", "--version"])).stdout).split("\n")[0] ?? "";
    assert(version.includes(PINNED_VERSION), `the machine has ${version}, and the dialect pins ${PINNED_VERSION}`);
    const d = ansible({ renderRoot: "/var/lib/archon" });
    const observe = async (): Promise<Observed> => {
      const o = new Map<(typeof REQS)[number]["id"], never>();
      const has = async (argv: string[]) => (await run(argv)).success;
      if (await has(["getent", "group", "labgroup"])) o.set(REQS[0]!.id, REQS[0]!.desired as never);
      if (await has(["getent", "passwd", "labuser"])) o.set(REQS[1]!.id, REQS[1]!.desired as never);
      return o;
    };
    const converge = async (reqs: readonly Requirement[], observed: Observed, mode: "check" | "apply") => {
      const order = orderOf(reqs);
      const plan = planOf(order, observed);
      const rendered = await d.render(order, plan);
      assert(rendered.kind === "ok", JSON.stringify(rendered));
      const steps = d.steps(plan, rendered.value);
      if (steps.length === 0) return { code: 0, out: "nothing to do", plan };
      for (const [path, text] of rendered.value.files) {
        const full = `/var/lib/archon/${rendered.value.digest}/${path}`;
        assert((await run(["mkdir", "-p", full.slice(0, full.lastIndexOf("/"))])).success);
        assert((await run(["tee", full], text)).success);
      }
      const argv = mode === "check" ? steps[0]!.check! : steps[0]!.apply;
      const r = await run(argv);
      return { code: r.code, out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr), plan };
    };
    const first = await converge(REQS, new Map(), "check");
    assertEquals(first.code, 2, first.out);
    assert((await run(["getent", "passwd", "labuser"])).code !== 0, "check changed nothing");
    const applied = await converge(REQS, new Map(), "apply");
    assertEquals(applied.code, 0, applied.out);
    assert((await run(["getent", "passwd", "labuser"])).success && (await run(["test", "-f", "/srv/lab/motd"])).success, "apply made them");
    assertEquals(new TextDecoder().decode((await run(["cat", "/srv/lab/motd"])).stdout), "hello\n");
    assertEquals(new TextDecoder().decode((await run(["cat", "/etc/timezone"])).stdout), "America/New_York\n");
    assertEquals(new TextDecoder().decode((await run(["readlink", "/etc/localtime"])).stdout).trim(), "/usr/share/zoneinfo/America/New_York");
    assert(new TextDecoder().decode((await run(["cat", "/etc/default/keyboard"])).stdout).includes('XKBLAYOUT="us"'));
    assert(new TextDecoder().decode((await run(["cat", "/etc/default/locale"])).stdout).includes("LANG=en_US.UTF-8"));
    assert(new TextDecoder().decode((await run(["locale", "-a"])).stdout).split("\n").some((l) => /^en_US\.utf-?8$/i.test(l)), "the locale was generated");
    // the second time, everything is as it must be: observed equals desired, so there is nothing to do, and ansible itself also reports no change
    const again = await converge(REQS, new Map(REQS.map((r) => [r.id, r.desired])), "apply");
    assertEquals(again.code, 0);
    const forced = await converge(REQS, new Map(), "apply");
    assertEquals(forced.code, 0, forced.out);
    assert(/changed=0\b/.test(forced.out), `the second apply of the same order changes nothing:\n${forced.out}`);
    const quiet = await converge(REQS, new Map(), "check");
    assertEquals(quiet.code, 0, `the check after apply: ${quiet.out}`);
    // drift
    assert((await run(["tee", "/srv/lab/motd"], "changed by hand\n")).success);
    const drift = await converge(REQS, new Map(), "check");
    assertEquals(drift.code, 2, drift.out);
    assert(drift.out.includes("changed by hand") || drift.out.includes("hello"), "the difference is shown");
    // removal
    const gone = req("user.lab", "user", { name: "labuser" }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" });
    const removed = await converge([gone], new Map([[gone.id, { name: "labuser" }]]), "apply");
    assertEquals(removed.code, 0, removed.out);
    assert((await run(["getent", "passwd", "labuser"])).code !== 0, "the user is gone");
    void observe;
  } finally {
    await machine.stop();
  }
});
