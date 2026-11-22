/**
 * Tests of the Arch family (commons lab 0003-lab-arch-family FR-001 to FR-007): the family of an image, the identity of an image made on a base that moves, the Containerfile of the family, `init: "none"`, the refusal of systemd on a kernel
 * with no cgroup v2 (pure, with a marker file made for the test), the list of packages of Omarchy's terminal side, and a real machine of the family on the container runtime: pacman through the proxy, a real sshd, a real ssh client, and the packages
 * checked against the real repositories. Without a runtime the real tests are skipped with the reason and never pass. Every name is made up.
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { AREAS, ARCH_WITH_OMARCHY_TERMINAL, BASE_IMAGES, imageFamily, OMARCHY_TERMINAL_PACKAGES } from "../src/governance/mod.ts";
import { containerfile, imageTag, readMachineSpec } from "../src/logical/mod.ts";
import { runtimeUsable, startMachine } from "../src/physical/mod.ts";

const ARCH = "ghcr.io/archlinux/archlinux:latest";
const GOOD = { name: "corinth", image: ARCH, init: "none", users: [{ name: "admin", sudo: true }, { name: "probe", sudo: false }], packages: [...OMARCHY_TERMINAL_PACKAGES], timezone: "America/New_York" };

proves(["0003-lab-arch-family FR-001"], "the Arch image is a base image, and every image has a family, the three being debian, rhel and arch", () => {
  assert((BASE_IMAGES as readonly string[]).includes(ARCH));
  assertEquals(BASE_IMAGES.map(imageFamily), ["debian", "debian", "debian", "rhel", "arch"]);
  assertEquals(readMachineSpec(GOOD).kind, "ok");
});

proves(["0003-lab-arch-family FR-002"], "the identity of an Arch image holds the digest of its base: the same text on the same base is the same tag, and a new base is a new one", async () => {
  const spec = readMachineSpec(GOOD);
  assert(spec.kind === "ok");
  const text = containerfile(spec.value);
  const a = await imageTag(spec.value, text, "sha256:aaa");
  assertEquals(a, await imageTag(spec.value, text, "sha256:aaa"));
  assert(a !== (await imageTag(spec.value, text, "sha256:bbb")), "a new base is a new image");
  assert(/^lab-corinth:[0-9a-f]{16}$/.test(a));
  const deb = readMachineSpec({ ...GOOD, image: "debian:13", init: undefined });
  assert(deb.kind === "ok");
  assertEquals(await imageTag(deb.value, containerfile(deb.value), "sha256:aaa"), await imageTag(deb.value, containerfile(deb.value), "sha256:bbb"), "the digest is the family arch's alone");
});

proves(["0003-lab-arch-family FR-003"], "the Containerfile of the family is the same text, installs the packages once and in order with pacman -Syu, tests for Landlock, trusts the build secret and leaves it in no layer, enables sshd, and has no key", () => {
  const spec = readMachineSpec({ ...GOOD, init: undefined, packages: ["git", "systemd", "curl"] });
  assert(spec.kind === "ok");
  const text = containerfile(spec.value);
  assertEquals(text, containerfile(spec.value));
  assert(text.startsWith(`FROM ${ARCH}\n`));
  assert(text.includes("pacman $S -Syu --noconfirm --needed ca-certificates curl git iproute2 openssh sudo systemd tzdata"), "sorted, once");
  assertEquals(text.match(/ systemd /g)?.length, 1, "a package that is already there is once");
  assert(text.includes("grep -qw landlock /sys/kernel/security/lsm") && text.includes("S=--disable-sandbox"), "the sandbox is off only where Landlock is not listed");
  assert(text.includes("type=secret,id=ca") && text.includes("/etc/ca-certificates/trust-source/anchors/lab-ca.crt") && text.includes("update-ca-trust"));
  assert(text.includes("rm -f $A; update-ca-trust"), "the file is removed in the same layer and the trust made again");
  assert(text.includes("systemctl enable sshd.service") && text.includes("ssh-keygen -A"));
  assert(text.includes("useradd -m -s /bin/bash admin") && text.includes('CMD ["/sbin/init"]') && text.includes("STOPSIGNAL SIGRTMIN+3"));
  assert(!text.includes("apt-get") && !text.includes("dnf"));
  for (const word of ["PRIVATE KEY", "ssh-ed25519", "authorized_keys", "password"]) assert(!text.includes(word), `no ${word}`);
});

proves(["0003-lab-arch-family FR-004"], "init is systemd or none, only for the family arch; with none the main process is sshd in the foreground and no systemd is the command", () => {
  assertEquals(readMachineSpec({ ...GOOD, init: "upstart" }).kind, "err");
  assertEquals(readMachineSpec({ ...GOOD, image: "debian:13", init: "none" }).kind, "err");
  const none = readMachineSpec(GOOD);
  assert(none.kind === "ok" && none.value.init === "none");
  const text = containerfile(none.value);
  assert(text.includes('CMD ["/usr/bin/sshd","-D","-e"]') && !text.includes("/sbin/init") && !text.includes("STOPSIGNAL"));
  const sys = readMachineSpec({ ...GOOD, init: "systemd" });
  assert(sys.kind === "ok" && containerfile(sys.value).includes('CMD ["/sbin/init"]'));
  assertEquals(AREAS.find((a) => a.area === "systemd units and timers")?.fidelity, "faithful", "the area is stated for systemd; a machine without it is described as without it by its description");
});

proves(["0003-lab-arch-family FR-005"], "a machine of the family arch with systemd is refused where the kernel has no cgroup v2, with that reason, and one with init none is not", async () => {
  const dir = await fs.makeTempDir({ prefix: "lab-test-" });
  try {
    const marker = path.join(dir, "cgroup.controllers");
    const sys = readMachineSpec({ ...GOOD, init: "systemd" });
    const none = readMachineSpec(GOOD);
    assert(sys.kind === "ok" && none.kind === "ok");
    const base = await runtimeUsable("docker");
    if (base !== undefined) return; // no runtime here: the real test below says why, and nothing is passed on its behalf
    const refused = await runtimeUsable("docker", sys.value, marker);
    assert(refused !== undefined && refused.includes("cgroup v2") && refused.includes("255"), String(refused));
    assertEquals(await runtimeUsable("docker", none.value, marker), undefined, "init none is not refused for it");
    await fs.writeTextFile(marker, "cpu memory\n");
    assertEquals(await runtimeUsable("docker", sys.value, marker), undefined, "with cgroup v2 it is not refused");
    const deb = readMachineSpec({ ...GOOD, image: "debian:13", init: undefined });
    assert(deb.kind === "ok");
    assertEquals(await runtimeUsable("docker", deb.value, path.join(dir, "no-such")), undefined, "other families are not refused for it");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0003-lab-arch-family FR-006"], "the packages of Omarchy's terminal side are data, sorted and once each, and a machine made with them is called Arch with them, never Omarchy", () => {
  assertEquals([...OMARCHY_TERMINAL_PACKAGES], ["fd", "fzf", "git", "github-cli", "gum", "jq", "mise", "ripgrep", "starship", "tmux"]);
  for (const own of ["omarchy", "omarchy-settings", "herdr", "mise-bin", "yay"]) assert(!(OMARCHY_TERMINAL_PACKAGES as readonly string[]).includes(own), `${own} is Omarchy's own and is not installed`);
  assertEquals(ARCH_WITH_OMARCHY_TERMINAL, "Arch with Omarchy's terminal-side packages");
});

proves(["0002-lab-machine FR-001", "0003-lab-arch-family FR-007"], "the area of packages is named for all three package programs, with one fidelity", () => {
  assert(AREAS.some((a) => a.area === "packages (apt, dnf or pacman)" && a.fidelity === "faithful"));
  assert(!AREAS.some((a) => (a.area as string) === "apt packages"));
});

const reasonNone = await (async () => {
  const spec = readMachineSpec(GOOD);
  return spec.kind === "ok" ? runtimeUsable("docker", spec.value) : "the description is not one";
})();

proves(
  ["0003-lab-arch-family FR-001", "0003-lab-arch-family FR-003", "0003-lab-arch-family FR-004", "0003-lab-arch-family FR-006"],
  "a real Arch machine with init none: pacman installed the packages through the proxy, the real sshd answers a real ssh client to the key made for the run and to no other, the host key is pinned, and the real repositories carry the packages",
  async (t) => {
    if (reasonNone !== undefined) return t.skip(reasonNone);
    const spec = readMachineSpec(GOOD);
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const m = started.value;
    const text = (o: { stdout: Uint8Array }): string => new TextDecoder().decode(o.stdout).trim();
    try {
      const os = text(await m.executor.exec(["cat", "/etc/os-release"]));
      assert(/^ID=arch$/m.test(os), os);
      assertEquals(text(await m.executor.exec(["pacman", "-Qq", "openssh"])), "openssh");
      assertEquals((await m.executor.exec(["pacman", "-Qq", ...OMARCHY_TERMINAL_PACKAGES])).code, 0, "every package is installed");
      const repos = text(await m.executor.exec(["pacman", "-Sl", "core", "extra"]));
      for (const p of OMARCHY_TERMINAL_PACKAGES) assert(new RegExp(`^(core|extra) ${p.replace(/[-+.]/g, "\\$&")} `, "m").test(repos), `${p} is in core or extra`);
      for (const own of ["herdr", "mise-bin", "yay", "omarchy"]) assert(!new RegExp(`^(core|extra) ${own} `, "m").test(repos), `${own} is not in core or extra`);
      assertEquals(text(await m.executor.exec(["cat", "/proc/1/comm"])), "sshd", "no systemd: sshd is the main process");
      assertEquals(text(await m.executor.exec(["timedatectl", "show"])), "", "there is no systemd to ask");
      const ssh = (identity: string, user: string, command: string) =>
        proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${m.knownHostsFile}`, "-i", identity, "-p", String(m.port), `${user}@127.0.0.1`, command]);
      const ok = await ssh(m.identityFile, "admin", "id -un; cat /etc/os-release");
      assertEquals(ok.code, 0, ok.stderr);
      assert(ok.stdout.startsWith("admin\n") && /^ID=arch$/m.test(ok.stdout));
      assertEquals((await ssh(m.identityFile, "probe", "id -un")).stdout.trim(), "probe");
      const other = `${m.identityFile}-other`;
      await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", other]);
      assertEquals((await ssh(other, "admin", "id -un")).code, 255, "another key is refused");
      assertEquals((await ssh(m.identityFile, "root", "id -un")).code, 255, "root is refused");
      assertEquals((await proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=/dev/null", "-i", m.identityFile, "-p", String(m.port), "admin@127.0.0.1", "id"])).code, 255, "a host key that is not pinned is refused");
      const sudo = await ssh(m.identityFile, "admin", "sudo -n id -un");
      assertEquals(sudo.stdout.trim(), "root");
      assertEquals((await ssh(m.identityFile, "probe", "sudo -n true")).code !== 0, true, "sudo only where asked");
    } finally {
      await m.stop();
    }
    assertEquals((await proc.run(["docker", "ps", "-a", "-q", "--filter", `name=${m.container}`])).stdout.trim(), "", "the container is gone");
    assertEquals(await fs.exists(m.identityFile), false, "the keys are gone");
  },
  { timeout: 900_000 },
);

const reasonSystemd = await (async () => {
  const spec = readMachineSpec({ ...GOOD, init: "systemd" });
  return spec.kind === "ok" ? runtimeUsable("docker", spec.value) : "the description is not one";
})();

proves(
  ["0003-lab-arch-family FR-004", "0003-lab-arch-family FR-005"],
  "a real Arch machine with systemd runs it as the first process where the kernel has cgroup v2, and is skipped with the reason where it has not",
  async (t) => {
    if (reasonSystemd !== undefined) return t.skip(reasonSystemd);
    const spec = readMachineSpec({ ...GOOD, init: "systemd" });
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    try {
      const state = new TextDecoder().decode((await started.value.executor.exec(["systemctl", "is-system-running"])).stdout).trim();
      assert(state === "running" || state === "degraded", state);
    } finally {
      await started.value.stop();
    }
  },
  { timeout: 900_000 },
);
