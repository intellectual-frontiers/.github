/**
 * Tests of observing a machine of each family (commons linux-observe 0003-linux-observe-observe FR-003): the package program of the family asked and no other, a package that is not installed with no entry, the file a setting is read from, and, on real disposable machines of the library `lab` (Debian 13 and Rocky Linux 9), the same
 * requirements observed as they are. Skipped, with the reason, where there is no container runtime. Every name is made up.
 *
 * @module
 */
import { defineRequirement, type Requirement } from "@intellectual-frontiers/desired-os-state/governance";
import { type Executor, type Output } from "@intellectual-frontiers/headless/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { pacmanPackageShape, rpmPackageShape, settingFileOf } from "../src/logical/mod.ts";
import { observeRequirements } from "../src/physical/mod.ts";

function req(id: string, kind: string, desired: unknown): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive" });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function pretend(table: Record<string, string>): Executor & { readonly asked: string[][] } {
  const asked: string[][] = [];
  const out = (code: number, text: string): Output => ({ code, success: code === 0, signal: null, stdout: new TextEncoder().encode(text), stderr: new Uint8Array() });
  return { asked, exec: async (argv) => (asked.push([...argv]), argv.join(" ") in table ? out(0, table[argv.join(" ")] ?? "") : out(1, "")) };
}

proves(["0003-linux-observe-observe FR-003"], "a package is read by the program of the family, one that is not installed has no entry, and a setting is read from the file of its family", async () => {
  assertEquals(rpmPackageShape({ name: "curl" }, "8.0.1-1.el9\n"), { name: "curl" });
  assertEquals(rpmPackageShape({ name: "curl", version: "8.0.1-1.el9" }, "8.0.1-1.el9"), { name: "curl", version: "8.0.1-1.el9" });
  assertEquals(rpmPackageShape({ name: "curl" }, undefined), undefined);
  assertEquals(pacmanPackageShape({ name: "curl", version: "8.1-1" }, "curl 8.1-1\n"), { name: "curl", version: "8.1-1" });
  assertEquals([settingFileOf("rhel", "locale"), settingFileOf("debian", "locale"), settingFileOf("arch", "keyboard"), settingFileOf("debian", "keyboard"), settingFileOf("suse", "timezone")], ["/etc/locale.conf", "/etc/default/locale", undefined, "/etc/default/keyboard", "/etc/localtime"]);
  const reqs = [req("pkg.curl", "package", { name: "curl" }), req("pkg.none", "package", { name: "nonesuch" }), req("set.kb", "system-setting", { name: "keyboard", value: "us" })];
  const rhel = pretend({ "rpm -q --qf %{VERSION}-%{RELEASE} curl": "8.0.1-1.el9" });
  const seen = await observeRequirements(rhel, reqs, [], "rhel");
  assertEquals([...seen.keys()].map(String), ["pkg.curl"]);
  assertEquals([...new Set(rhel.asked.map((a) => a[0]))], ["rpm"], "only rpm, and nothing for the keyboard of a family that has no such file");
  const arch = pretend({ "pacman -Q curl": "curl 8.1-1\n" });
  assertEquals([...(await observeRequirements(arch, reqs, [], "arch")).keys()].map(String), ["pkg.curl"]);
  const deb = pretend({ "dpkg-query -W -f ${db:Status-Abbrev}|${Version} curl": "ii |8.5\n" });
  assertEquals([...(await observeRequirements(deb, reqs)).keys()].map(String), ["pkg.curl"]);
});

const reason = await runtimeUsable("docker");

for (const [image, family] of [["debian:13", "debian"], ["quay.io/rockylinux/rockylinux:9", "rhel"]] as const) {
  proves(["0003-linux-observe-observe FR-003"], `on a real ${image} machine a package that is installed, a service, a file and the time zone are observed as they are and one that is not there has no entry`, async (t) => {
    if (reason !== undefined) return t.skip(reason);
    const spec = readMachineSpec({ name: `fam-${family}`, image, users: [{ name: "admin", sudo: true }], packages: [], timezone: "America/New_York" });
    assert(spec.kind === "ok");
    const started = await startMachine(spec.value);
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const m = started.value;
    try {
      const ssh = family === "debian" ? "ssh.service" : "sshd.service";
      const seen = await observeRequirements(m.executor, [req("pkg.ssh", "package", { name: "openssh-server" }), req("pkg.none", "package", { name: "nonesuch-package" }), req("svc.ssh", "service", { name: ssh, running: true, enabled: true }), req("file.os", "file", { path: "/etc/os-release", content: "" }), req("set.tz", "system-setting", { name: "timezone", value: "America/New_York" }), req("set.kb", "system-setting", { name: "keyboard", value: "us" })], [], family);
      const by = Object.fromEntries([...seen.entries()].map(([k, v]) => [String(k), v]));
      assertEquals(by["pkg.ssh"], { name: "openssh-server" });
      assertEquals(by["pkg.none"], undefined);
      assertEquals(by["svc.ssh"], { name: ssh, running: true, enabled: true });
      assertEquals(by["set.tz"], { name: "timezone", value: "America/New_York" });
      assert(by["file.os"] !== undefined);
      if (family === "rhel") assertEquals(by["set.kb"], undefined, "no keyboard layout of that name on this family");
    } finally {
      await m.stop();
    }
  }, { timeout: 600_000 });
}
