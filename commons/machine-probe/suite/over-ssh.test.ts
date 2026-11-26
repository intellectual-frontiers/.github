/**
 * The probe over a real sshd (commons machine-probe 0002-machine-probe-contract FR-005): a disposable machine of the library `lab` (a container with systemd and sshd; what a container cannot show is named in `lab`) with the probe installed for an
 * account and a key restricted to it. The key opens no shell, runs nothing else and forwards no port; a machine whose host key is not pinned is refused; an estate tells the machine aligned with what is declared of it, then drifted when an
 * administrator is added, and a stopped machine is unreachable and never observed. Without a container runtime the test is skipped with the reason. Every name is made up.
 *
 * @module
 */
import { target } from "@intellectual-frontiers/headless/logical";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { operationalTruth, defineAsset } from "@intellectual-frontiers/estate";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { observedState, evaluate } from "../src/logical/mod.ts";
import { observe, posixScriptPath, probeKeyLine, sendVia } from "../src/physical/mod.ts";

const reason = await runtimeUsable("docker");

proves(
  ["0002-machine-probe-contract FR-005"],
  "on a real sshd the restricted key runs only the probe, opens no shell and forwards no port, a host key that is not pinned is refused, drift is told when an administrator is added, and a stopped machine is unreachable",
  async (t) => {
    if (reason !== undefined) return t.skip(reason);
    const spec = readMachineSpec({ name: "synthetic-server-03", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }, { name: "probe", sudo: false }], packages: [] });
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const m = started.value;
    try {
      const dir = path.dirname(m.identityFile);
      // install the probe for the account, and the key restricted to it, in place of the key the lab gave
      const script = path.join(dir, "machine-probe");
      await fs.copyFile(posixScriptPath(), script);
      const put = await m.executor.put?.([script], "/home/probe/.local/bin");
      assertEquals(put?.code, 0);
      const probeKey = path.join(dir, "probe_key");
      await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "probe@fleet", "-f", probeKey]);
      const line = probeKeyLine((await fs.readTextFile(`${probeKey}.pub`)).trim());
      assert(line.kind === "ok");
      const installed = await m.executor.exec(["sh", "-c", "chmod 755 /home/probe/.local/bin/machine-probe && chown -R probe:probe /home/probe/.local && cat > /home/probe/.ssh/authorized_keys"], { input: `${line.value}\n` });
      assertEquals(installed.code, 0, new TextDecoder().decode(installed.stderr));

      const tgt = target({ id: "synthetic-server-03", class: "server", address: "127.0.0.1", user: "probe", port: m.port, credential: "probe" });
      assert(tgt.kind === "ok");
      const executor = sshExecutor(tgt.value, [tgt.value], { knownHostsRepository: m.knownHostsFile, knownHostsUser: m.knownHostsFile, identityFor: () => probeKey });
      const send = sendVia(executor);
      const ssh = (extra: readonly string[], command?: string) =>
        proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${m.knownHostsFile}`, "-i", probeKey, "-p", String(m.port), ...extra, "probe@127.0.0.1", ...(command === undefined ? [] : [command])]);

      await t.step("the probe answers, as it would for the fleet", async () => {
        const o = await observe(send);
        assert(o.kind === "ok", o.kind === "err" ? o.error.message : "");
        assertEquals([o.value.os.family, o.value.os.version], ["ubuntu", "24.04"]);
        const policies = evaluate(o.value, o.value.at);
        assert(policies.length >= 6 && policies.every((p) => p.controls.length > 0));
      });

      await t.step("the key opens no shell and runs nothing but the probe", async () => {
        for (const command of ["id", "facts; id", "sh", "cat /etc/passwd", "facts && id", "version; touch /tmp/pwned"]) {
          const r = await ssh([], command);
          assert(r.code === 2 || (command === "version; touch /tmp/pwned" && r.code === 2), `${command} ended with ${r.code}`);
          assertEquals(r.stdout, "", `${command} printed nothing`);
        }
        const none = await ssh([]);
        assert(none.stdout.startsWith("@probe\n"), "no command gives the facts, not a shell");
        const tty = await proc.run(["ssh", "-tt", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${m.knownHostsFile}`, "-i", probeKey, "-p", String(m.port), "probe@127.0.0.1", "id"]);
        assert(!tty.stdout.includes("uid="), "no terminal and no id");
        const pwned = await m.executor.exec(["test", "-e", "/tmp/pwned"]);
        assertEquals(pwned.code, 1, "the second command did not run");
      });

      await t.step("the key forwards no port", async () => {
        const fwd = await ssh(["-o", "ExitOnForwardFailure=yes", "-R", "0:127.0.0.1:22"], "facts");
        assertEquals(fwd.code, 255);
      });

      await t.step("a machine whose host key is not pinned is refused", async () => {
        const other = path.join(dir, "other_known_hosts");
        await fs.writeTextFile(other, "");
        const r = await proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${other}`, "-i", probeKey, "-p", String(m.port), "probe@127.0.0.1", "facts"]);
        assertEquals(r.code, 255);
        assertEquals(r.stdout, "");
      });

      await t.step("an estate tells it aligned, and drifted when an administrator is added", async () => {
        const asset = defineAsset({ id: "synthetic-server-03", kind: "server", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } });
        assert(asset.kind === "ok");
        const first = await observe(send);
        assert(first.kind === "ok");
        const declared = observedState(first.value);
        const now = new Date().toISOString();
        const aligned = operationalTruth({ asset: asset.value, declared, observed: { at: first.value.at, source: "machine-probe", state: observedState(first.value) }, now, within: "PT24H" });
        assert(aligned.kind === "ok" && aligned.value.alignment === "aligned" && aligned.value.source === "machine-probe");
        const add = await m.executor.exec(["usermod", "-aG", "sudo", "probe"]);
        assertEquals(add.code, 0);
        const second = await observe(send);
        assert(second.kind === "ok");
        const drifted = operationalTruth({ asset: asset.value, declared, observed: { at: second.value.at, source: "machine-probe", state: observedState(second.value) }, now, within: "PT24H" });
        assert(drifted.kind === "ok" && drifted.value.alignment === "drifted" && drifted.value.difference !== null);
        assert(JSON.stringify(drifted.value.difference).includes("admins"), JSON.stringify(drifted.value.difference));
      });

      await t.step("a stopped machine is unreachable and never observed", async () => {
        await m.stop();
        const gone = await observe(send);
        assert(gone.kind === "err" && gone.error.kind === "unreachable", gone.kind === "err" ? gone.error.message : "an observation of a stopped machine");
      });
    } finally {
      await m.stop();
    }
  },
  { timeout: 900_000 },
);
