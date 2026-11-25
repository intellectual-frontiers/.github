/**
 * Tests of the disposable machine (commons lab 0002-lab-machine FR-001 to FR-005): the areas and what a container stands in for, the machine description and its Containerfile (pure), and a real machine on the container runtime where
 * there is one: systemd, sshd on its own port for a key made for the run, the host key pinned, and everything removed. Without a runtime the real tests are skipped with the reason and never pass. Every name is made up.
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";
import { fs } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { AREAS, BASE_IMAGES, NOT_FAITHFUL } from "../src/governance/mod.ts";
import { containerfile, readMachineSpec } from "../src/logical/mod.ts";
import { runtimeUsable, startMachine } from "../src/physical/mod.ts";

const GOOD = { name: "synthetic-server-02", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }, { name: "probe", sudo: false }], packages: ["rsync", "curl"], timezone: "America/New_York" };

proves(["0002-lab-machine FR-001"], "every area has a statement of fidelity with its reason, and the areas a container does not stand in for are listed", () => {
  assertEquals(new Set(AREAS.map((a) => a.area)).size, 13);
  for (const a of AREAS) assert(a.note.length > 10, `${a.area} has its reason`);
  assertEquals(AREAS.find((a) => a.area === "firewall")?.fidelity, "not faithful");
  assertEquals(AREAS.find((a) => a.area === "sshd and a restricted key")?.fidelity, "faithful");
  assertEquals(NOT_FAITHFUL, ["host name", "firewall", "kernel settings", "mounts and disks", "UEFI, Secure Boot and boot", "hardware facts", "power cycle"]);
});

proves(["0002-lab-machine FR-002"], "a description is read only where it is well formed, and every reason it is not is given", () => {
  assertEquals(readMachineSpec(GOOD).kind, "ok");
  const bad = readMachineSpec({ name: "Synthetic-Server-02", image: "debian:12", users: [{ name: "root", sudo: true }, { name: "a", sudo: true }, { name: "a", sudo: false }], packages: ["ok", "bad name"], timezone: "somewhere" });
  assert(bad.kind === "err" && bad.error.length === 6, JSON.stringify(bad));
  assertEquals(readMachineSpec({ ...GOOD, users: [] }).kind, "err");
  assertEquals(readMachineSpec(null).kind, "err");
  assertEquals(readMachineSpec({ ...GOOD, name: "synthetic-workstation-01" }).kind, "ok", "digits and hyphens are in a name");
  assertEquals(readMachineSpec({ ...GOOD, name: "1synthetic" }).kind, "err", "a name starts with a letter");
  assertEquals(readMachineSpec({ ...GOOD, timezone: undefined }).kind, "ok");
});

proves(["0002-lab-machine FR-003"], "the Containerfile is the same text for the same description, runs systemd, has sshd as a service, the users, the packages once in order and the time zone, and no key", () => {
  const spec = readMachineSpec(GOOD);
  assert(spec.kind === "ok");
  const text = containerfile(spec.value);
  assertEquals(text, containerfile(spec.value));
  assert(text.startsWith("FROM ubuntu:24.04\n") && text.includes('CMD ["/sbin/init"]') && text.includes("STOPSIGNAL SIGRTMIN+3"));
  assert(text.includes("systemctl disable ssh.socket") && text.includes("systemctl enable ssh.service"));
  assert(text.includes("useradd -m -s /bin/bash admin") && text.includes("/etc/sudoers.d/90-admin") && !text.includes("90-probe"), "sudo only where asked");
  assert(text.includes("curl dbus openssh-server") || text.includes("ca-certificates curl dbus"), "the packages are sorted");
  assertEquals(text.match(/rsync/g)?.length, 1);
  assert(text.includes("/usr/share/zoneinfo/America/New_York"));
  for (const word of ["PRIVATE KEY", "ssh-ed25519", "authorized_keys", "password"]) assert(!text.includes(word), `no ${word}`);
  const dup = readMachineSpec({ ...GOOD, packages: ["curl", "dbus"] });
  assert(dup.kind === "ok" && containerfile(dup.value).match(/\bdbus\b/g)?.length === 1, "a package that is already there is once");
});

proves(["0002-lab-machine FR-002", "0002-lab-machine FR-003"], "each base image is read, and the Containerfile of the RHEL family installs with dnf, starts sshd and systemd of its own path, and has no apt", () => {
  for (const image of BASE_IMAGES) assertEquals(readMachineSpec({ ...GOOD, image }).kind, "ok", image);
  assertEquals(readMachineSpec({ ...GOOD, image: "alpine:3" }).kind, "err");
  const spec = readMachineSpec({ ...GOOD, image: "quay.io/rockylinux/rockylinux:9" });
  assert(spec.kind === "ok");
  const text = containerfile(spec.value);
  assert(text.startsWith("FROM quay.io/rockylinux/rockylinux:9\n") && text.includes("dnf -y $O install") && text.includes("type=secret,id=ca") && text.includes("systemctl enable sshd.service") && text.includes('CMD ["/usr/sbin/init"]'));
  assert(!text.includes("apt-get") && !text.includes("DEBIAN_FRONTEND"));
  const deb = readMachineSpec({ ...GOOD, image: "debian:13" });
  assert(deb.kind === "ok" && containerfile(deb.value).includes("apt-get install") && containerfile(deb.value).includes("systemctl enable ssh.service"));
});

const reason = await runtimeUsable("docker");

proves(["0002-lab-machine FR-005"], "the reason containers cannot be run is given, or nothing where they can", async () => {
  assertEquals(await runtimeUsable("no-such-runtime" as never), "no-such-runtime is not installed");
  assert(reason === undefined || reason.length > 10);
});

proves(
  ["0002-lab-machine FR-004"],
  "a machine runs systemd, its sshd answers to the key made for the run and to no other, its host key is pinned, and stop removes the container and the keys, twice safely",
  async (t) => {
    if (reason !== undefined) return t.skip(reason);
    const spec = readMachineSpec(GOOD);
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const m = started.value;
    try {
      const state = new TextDecoder().decode((await m.executor.exec(["systemctl", "is-system-running"])).stdout).trim();
      assert(state === "running" || state === "degraded", `systemd is ${state}`);
      assertEquals(new TextDecoder().decode((await m.executor.exec(["timedatectl", "show", "-p", "Timezone", "--value"])).stdout).trim(), "America/New_York");
      const ssh = (identity: string, user: string, command: string) =>
        proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${m.knownHostsFile}`, "-i", identity, "-p", String(m.port), `${user}@127.0.0.1`, command]);
      const ok = await ssh(m.identityFile, "admin", "id -un");
      assertEquals([ok.code, ok.stdout.trim()], [0, "admin"]);
      assertEquals((await ssh(m.identityFile, "probe", "id -un")).stdout.trim(), "probe");
      const other = `${m.identityFile}-other`;
      await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", other]);
      assertEquals((await ssh(other, "admin", "id -un")).code, 255, "another key is refused");
      const root = await ssh(m.identityFile, "root", "id -un");
      assertEquals(root.code, 255, "root is refused");
      const wrongHost = await proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=/dev/null", "-i", m.identityFile, "-p", String(m.port), "admin@127.0.0.1", "id"]);
      assertEquals(wrongHost.code, 255, "a host key that is not pinned is refused");
    } finally {
      await m.stop();
    }
    assertEquals((await proc.run(["docker", "ps", "-a", "-q", "--filter", `name=${m.container}`])).stdout.trim(), "", "the container is gone");
    assertEquals(await fs.exists(m.identityFile), false, "the keys are gone");
    await m.stop();
    const bad = await startMachine({ ...spec.value, packages: ["no-such-package-in-the-archive"] });
    assertEquals(bad.kind, "err");
    assertEquals((await proc.run(["docker", "ps", "-a", "-q", "--filter", "label=lab=machine"])).stdout.trim(), "", "nothing is left after a start that failed");
  },
  { timeout: 600_000 },
);
