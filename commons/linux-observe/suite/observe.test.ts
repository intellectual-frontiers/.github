/**
 * Tests of observing a Linux machine with no change (commons linux-observe 0002-linux-observe-shapes, 0003-linux-observe-observe): what each program prints read in the shape a requirement declares (pure), the whole observation through a way of running programs that answers from a table and records what it
 * was asked (only programs that read are run, and a prefix that raises rights is put in front), and, on a real disposable machine of the library `lab`, a machine made as declared observed equal to what is declared, one that differs observed as it is, and one that lacks the resource with no entry.
 * Every name is made up.
 *
 * @module
 */
import { defineRequirement, type JsonValue, type Requirement } from "@intellectual-frontiers/archon/governance";
import { sameJson } from "@intellectual-frontiers/archon/governance";
import { textOf, type Executor, type Output } from "@intellectual-frontiers/headless/logical";
import { readMachineSpec } from "@intellectual-frontiers/lab/logical";
import { runtimeUsable, startMachine } from "@intellectual-frontiers/lab/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { groupShape, keyFileOf, keyShape, packageShape, parseStat, pathShape, serviceShape, settingShape, userShape } from "../src/logical/mod.ts";
import { observeRequirements, READERS } from "../src/physical/mod.ts";

function req(id: string, kind: string, desired: unknown): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive" });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

proves(["0002-linux-observe-shapes FR-001"], "a user, a group and a service are read in the shape declared: only the fields declared, the groups named that the user is in, and a service that is always there to ask about", () => {
  assertEquals(userShape({ name: "ada", uid: 1000, comment: "Ada", shell: "/bin/bash", home: "/home/ada", groups: ["sudo", "docker", "nobody"] }, "ada:x:1000:1000:Ada:/home/ada:/bin/bash\n", "ada sudo staff\n"), { name: "ada", uid: 1000, comment: "Ada", shell: "/bin/bash", home: "/home/ada", groups: ["sudo"] });
  assertEquals(userShape({ name: "ada" }, "ada:x:1000:1000:Ada:/home/ada:/bin/bash\n", undefined), { name: "ada" });
  assertEquals(userShape({ name: "ada" }, undefined, undefined), undefined);
  assertEquals([groupShape({ name: "g" }, "g:x:1001:\n"), groupShape({ name: "g" }, undefined)], [{ name: "g" }, undefined]);
  assertEquals(serviceShape({ name: "cron" }, "active\n", "enabled\n"), { name: "cron", running: true, enabled: true });
  assertEquals(serviceShape({ name: "cron" }, "inactive\n", "disabled\n"), { name: "cron", running: false, enabled: false });
});

proves(["0002-linux-observe-shapes FR-002"], "a file and a directory are read with their owner, group and mode as declared (a mode as long as it is written) and a file's content, and what is of the other kind is not there", () => {
  const st = parseStat("regular file|ada|staff|640\n");
  assertEquals(pathShape("file", { path: "/x", content: "c", owner: "ada", mode: "0640" }, st, "hello\n"), { path: "/x", content: "hello\n", owner: "ada", mode: "0640" });
  assertEquals(pathShape("file", { path: "/x", content: "c" }, st, "hello\n"), { path: "/x", content: "hello\n" });
  assertEquals(pathShape("directory", { path: "/x" }, st, undefined), undefined, "a file is not a directory");
  assertEquals(pathShape("directory", { path: "/d", group: "staff", mode: "750" }, parseStat("directory|root|staff|750\n"), undefined), { path: "/d", group: "staff", mode: "750" });
  assertEquals([parseStat(""), pathShape("file", { path: "/x" }, undefined, undefined)], [undefined, undefined]);
});

proves(["0002-linux-observe-shapes FR-003"], "a key, a package and a setting of the system are read from what holds them, and are not there where what holds them says so", () => {
  assertEquals(keyShape({ user: "ada", key: "ssh-ed25519 AAAA" }, "ssh-rsa BBBB\nssh-ed25519 AAAA\n"), { user: "ada", key: "ssh-ed25519 AAAA" });
  assertEquals([keyShape({ user: "ada", key: "ssh-ed25519 AAAA" }, "ssh-rsa BBBB\n"), keyShape({ user: "ada", key: "k" }, undefined)], [undefined, undefined]);
  assertEquals([keyFileOf({ user: "ada" }), keyFileOf({ user: "root" }), keyFileOf({ user: "ada", path: "/k" })], ["/home/ada/.ssh/authorized_keys", "/root/.ssh/authorized_keys", "/k"]);
  assertEquals(packageShape({ name: "git" }, "ii |1:2.43.0\n"), { name: "git" });
  assertEquals(packageShape({ name: "git", version: "1:2.43.0" }, "ii |1:2.43.0"), { name: "git", version: "1:2.43.0" });
  assertEquals([packageShape({ name: "git" }, "rc |1:2.43.0"), packageShape({ name: "git" }, undefined)], [undefined, undefined]);
  assertEquals(settingShape("timezone", "/usr/share/zoneinfo/America/New_York\n"), { name: "timezone", value: "America/New_York" });
  assertEquals(settingShape("keyboard", 'XKBMODEL="pc105"\nXKBLAYOUT="us"\n'), { name: "keyboard", value: "us" });
  assertEquals(settingShape("locale", "LANG=en_US.UTF-8\n"), { name: "locale", value: "en_US.UTF-8" });
  assertEquals([settingShape("locale", "LC_ALL=C\n"), settingShape("timezone", undefined)], [undefined, undefined]);
});

function pretend(table: Record<string, string>): Executor & { readonly asked: string[][] } {
  const asked: string[][] = [];
  const out = (code: number, text: string): Output => ({ code, success: code === 0, signal: null, stdout: new TextEncoder().encode(text), stderr: new Uint8Array() });
  return { asked, exec: async (argv) => (asked.push([...argv]), argv.join(" ") in table ? out(0, table[argv.join(" ")] ?? "") : out(2, "")) };
}

const ALL = [
  req("group.lab", "group", { name: "labgroup" }),
  req("user.lab", "user", { name: "labuser", shell: "/bin/bash", groups: ["labgroup"] }),
  req("dir.lab", "directory", { path: "/srv/lab", owner: "labuser", mode: "0750" }),
  req("file.lab", "file", { path: "/srv/lab/motd", content: "hello\n", owner: "labuser", mode: "0640" }),
  req("svc.lab", "service", { name: "labd", running: true, enabled: true }),
  req("key.lab", "ssh-authorized-key", { user: "labuser", key: "ssh-ed25519 AAAA" }),
  req("pkg.lab", "package", { name: "git" }),
  req("tz.lab", "system-setting", { name: "timezone", value: "America/New_York" }),
];

proves(["0003-linux-observe-observe FR-001"], "the whole observation runs only programs that read, puts the prefix that raises rights in front of each, and gives an entry only for a resource that is there", async () => {
  const fake = pretend({
    "sudo -n getent group labgroup": "labgroup:x:1001:\n",
    "sudo -n getent passwd labuser": "labuser:x:1001:1001::/home/labuser:/bin/bash\n",
    "sudo -n id -nG labuser": "labuser labgroup\n",
    "sudo -n stat -c %F|%U|%G|%a /srv/lab": "directory|labuser|labuser|750\n",
    "sudo -n stat -c %F|%U|%G|%a /srv/lab/motd": "regular file|labuser|labuser|640\n",
    "sudo -n cat /srv/lab/motd": "hello\n",
    "sudo -n systemctl is-active labd": "inactive\n",
    "sudo -n systemctl is-enabled labd": "disabled\n",
    "sudo -n readlink /etc/localtime": "/usr/share/zoneinfo/America/New_York\n",
  });
  const o = await observeRequirements(fake, ALL, ["sudo", "-n"]);
  assertEquals([...o.keys()].map(String), ["group.lab", "user.lab", "dir.lab", "file.lab", "svc.lab", "tz.lab"], "no key file and no package: no entry");
  assertEquals(o.get(ALL[4]!.id), { name: "labd", running: false, enabled: false });
  for (const a of fake.asked) {
    assertEquals(a.slice(0, 2), ["sudo", "-n"]);
    assert((READERS as readonly string[]).includes(a[2] ?? ""), `${a.join(" ")} is not a program that reads`);
  }
  assertEquals((await observeRequirements(pretend({}), [req("x", "directory", "not an object")])).size, 0, "a requirement whose desired state is not an object is skipped");
});

const reason = await runtimeUsable("docker");

proves(["0003-linux-observe-observe FR-002"], "on a real machine: what is made as declared is observed equal to what is declared, what differs is observed as it is, and what is missing has no entry", async (t) => {
  if (reason !== undefined) return t.skip(reason);
  const spec = readMachineSpec({ name: "athens", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: ["git"] });
  assert(spec.kind === "ok");
  const started = await startMachine(spec.value);
  assert(started.kind === "ok", started.kind === "err" ? started.error : "");
  const m = started.value;
  try {
    const sh = async (...argv: string[]) => {
      const r = await m.executor.exec(argv);
      assert(r.success, `${argv.join(" ")}: ${textOf(r.stderr)}`);
    };
    await sh("groupadd", "labgroup");
    await sh("useradd", "-m", "-s", "/bin/bash", "-G", "labgroup", "labuser");
    await sh("install", "-d", "-o", "labuser", "-m", "0750", "/srv/lab");
    await m.executor.exec(["tee", "/srv/lab/motd"], { input: "hello\n" });
    await sh("chown", "labuser", "/srv/lab/motd");
    await sh("chmod", "0640", "/srv/lab/motd");
    await sh("install", "-d", "-m", "0700", "-o", "labuser", "/home/labuser/.ssh");
    await m.executor.exec(["tee", "/home/labuser/.ssh/authorized_keys"], { input: "ssh-ed25519 AAAA\n" });
    await sh("ln", "-sf", "/usr/share/zoneinfo/America/New_York", "/etc/localtime");
    const asDeclared = [...ALL.filter((r) => String(r.kind) !== "service"), req("svc.ssh", "service", { name: "ssh", running: true, enabled: true })];
    const o = await observeRequirements(m.executor, asDeclared);
    for (const r of asDeclared) {
      const seen = o.get(r.id) as JsonValue | undefined;
      assert(seen !== undefined && sameJson(seen, r.desired), `${r.id}: declared ${JSON.stringify(r.desired)}, observed ${JSON.stringify(seen)}`);
    }
    // the machine differs from the declaration: what is observed is what is there
    await m.executor.exec(["tee", "/srv/lab/motd"], { input: "changed\n" });
    const differ = await observeRequirements(m.executor, [ALL[3]!, req("user.nobody", "user", { name: "nobodyhere" }), req("pkg.nope", "package", { name: "no-such-package" })]);
    assertEquals(differ.get(ALL[3]!.id), { path: "/srv/lab/motd", content: "changed\n", owner: "labuser", mode: "0640" });
    assertEquals([...differ.keys()].map(String), ["file.lab"], "a user and a package that are not there have no entry");
  } finally {
    await m.stop();
  }
});
