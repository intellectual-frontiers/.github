/**
 * Tests of enrolling a machine for observation (commons machine-probe 0007-machine-probe-enroll): the address of a machine, the policy pack's judgement of an observation (a machine never observed is waiting, never failing, and an accepted risk is accepted and never a pass), and, on a
 * real disposable machine of the library `lab` with a real sshd: the host key is shown and nothing is done until a fingerprint is given, a fingerprint that is not the machine's pins nothing and installs nothing, the right one pins that key alone, makes the probe's key and installs the probe and one
 * restricted line (again, safely), and the probe then answers to the restricted key. Without a container runtime the real test is skipped with the reason. Every name is made up.
 *
 * @module
 */
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { acceptRisk } from "@intellectual-frontiers/estate/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { evaluate, judgeObserved, type Observed } from "../src/logical/mod.ts";
import { enrollProbe, observe, parseSsh, probeExecutor, sendVia } from "../src/physical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const BAD: Observed = {
  at: NOW, probe: "1", os: { family: "ubuntu", name: "Ubuntu", version: "24.04", kernel: "6.8", arch: "x86_64", hostname: "synthetic-server-02" }, hardware: {},
  security: { diskEncryption: "off", firewall: "on", autoUpdates: "on", sshPasswordAuth: "off", admins: ["ubuntu"] }, software: { pendingUpdates: 0, osquery: "5" }, listening: [22],
};

proves(["0007-machine-probe-enroll FR-001"], "an address is user@host or user@host:port, and anything else is refused", () => {
  assertEquals(parseSsh("admin@synthetic-server-03.example:2222"), { kind: "ok", value: { user: "admin", address: "synthetic-server-03.example", port: 2222 } });
  assertEquals(parseSsh("admin@10.0.0.5"), { kind: "ok", value: { user: "admin", address: "10.0.0.5" } });
  for (const bad of ["synthetic-server-03", "admin@", "@host", "admin@host:0", "admin@host:70000", "a b@host", "-x@host"]) assertEquals(parseSsh(bad).kind, "err", bad);
});

proves(["0007-machine-probe-enroll FR-004"], "a machine never observed is waiting in the policy that says so and never failing, and an observation is judged with the risks accepted for it", () => {
  const never = judgeObserved(undefined, [], NOW);
  assertEquals([never.observedAt, never.results.map((r) => [r.id, r.status])], [null, [["observed", "waiting"]]]);
  const plain = judgeObserved(BAD, [], NOW);
  assertEquals([plain.observedAt, plain.results.find((r) => r.id === "disk-encryption")?.status], [NOW, "fail"]);
  const risk = acceptRisk({ policy: "disk-encryption", reason: "the replacement disk is on order", by: "Ada Admin", until: "2026-12-15" }, "2026-11-21");
  assert(risk.kind === "ok");
  const accepted = judgeObserved(BAD, [risk.value], NOW);
  assertEquals(accepted.results.find((r) => r.id === "disk-encryption")?.status, "accepted");
  assertEquals(accepted.results.length, evaluate(BAD, NOW).length);
});

const reason = await runtimeUsable("docker");

proves(["0007-machine-probe-enroll FR-002", "0007-machine-probe-enroll FR-003"], "on a real sshd the host key is shown first, a wrong fingerprint pins and installs nothing, the right one pins that key alone and installs the probe and one restricted line, again safely, and the probe answers to the restricted key", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "synthetic-server-03", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: [] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const m = started.value;
  await fs.withTempDir(async (dir) => {
    const known = path.join(dir, "fleet", "known_hosts");
    const keys = path.join(dir, "keys");
    const ssh = { user: "admin", address: "127.0.0.1", port: m.port };
    const o = { asset: "synthetic-server-03", knownHosts: known, keys, identity: m.identityFile };

    const shown = await enrollProbe(ssh, o);
    assert(shown.kind === "ok" && shown.value.kind === "show" && shown.value.fingerprint.includes("SHA256:"));
    const fingerprint = shown.value.fingerprint.split(" | ")[0] ?? "";
    assertEquals([await fs.exists(known), await fs.exists(keys)], [false, false], "showing the host key writes nothing");
    assertEquals((await m.executor.exec(["test", "-e", "/home/admin/.local/bin/machine-probe"])).code, 1, "and installs nothing");

    const wrong = await enrollProbe(ssh, { ...o, fingerprint: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
    assert(wrong.kind === "err" && wrong.error.includes("nothing was pinned"));
    assertEquals([await fs.exists(known), await fs.exists(keys)], [false, false]);

    const done = await enrollProbe(ssh, { ...o, fingerprint });
    assert(done.kind === "ok" && done.value.kind === "done", done.kind === "err" ? done.error : "");
    const e = done.value;
    assertEquals(e.reach, { address: "127.0.0.1", port: m.port, user: "admin", credential: "synthetic-server-03-probe" });
    const pinned = (await fs.readTextFile(known)).trim().split("\n");
    assertEquals(pinned.length, 1, "exactly the one host key compared is pinned");
    assertEquals((await fs.stat(e.keyFile)).mode! & 0o077, 0, "the private key is for its owner alone");
    const authorized = new TextDecoder().decode((await m.executor.exec(["cat", "/home/admin/.ssh/authorized_keys"])).stdout).trim().split("\n");
    assertEquals(authorized.length, 2, "the person's own key and one more");
    assert(authorized.some((l) => l.startsWith('restrict,command=".local/bin/machine-probe" ssh-ed25519 ')));

    const again = await enrollProbe(ssh, { ...o, fingerprint });
    assert(again.kind === "ok" && again.value.kind === "done");
    assertEquals((await fs.readTextFile(known)).trim().split("\n").length, 1, "the host key is not pinned twice");
    assertEquals(new TextDecoder().decode((await m.executor.exec(["cat", "/home/admin/.ssh/authorized_keys"])).stdout).trim().split("\n").length, 2, "the line is not added twice");

    const executor = probeExecutor(e.reach, known, e.keyFile);
    assert(executor.kind === "ok");
    const seen = await observe(sendVia(executor.value));
    assert(seen.kind === "ok", seen.kind === "err" ? seen.error.message : "");
    assertEquals(seen.value.os.family, "ubuntu");
  });
  await m.stop();
});
