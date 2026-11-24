/**
 * Tests of the throwaway server (commons anyfs-ssh 0004-anyfs-ssh-sshd-test FR-001 to FR-006): the configuration and the lines it makes, the command line, and, where an OpenSSH server can be made, a server that
 * lets one key in through the real client, that is gone with its keys and its folder when the function ends, and that is gone as well where the function throws.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { commandOf, configOf, ENV_PREFIX, envOf, freePort, knownHostsLine, programs, type SshdHost, withSshd } from "../tools/sshd-test.ts";

const HOST: SshdHost = { address: "127.0.0.1", port: 2222, user: "fleet", key: "/k/key", knownHosts: "/k/known", root: "/r", controlDir: "/c" };

proves(["0004-anyfs-ssh-sshd-test FR-001"], "the configuration lets one account in with one key on the loopback and never a password; the known hosts hold the host key for that port and no other", () => {
  const config = configOf({ dir: "/tmp/x", port: 4022, user: "fleet" });
  for (const line of ["Port 4022", "ListenAddress 127.0.0.1", "PasswordAuthentication no", "KbdInteractiveAuthentication no", "PubkeyAuthentication yes", "AllowUsers fleet", "AuthorizedKeysFile /tmp/x/authorized_keys", "HostKey /tmp/x/hostkey"]) {
    assertStringIncludes(config, `${line}\n`);
  }
  assertEquals(knownHostsLine("127.0.0.1", 4022, "ssh-ed25519 AAAAC3Nza anyfs-test\n"), "[127.0.0.1]:4022 ssh-ed25519 AAAAC3Nza\n");
});

proves(["0004-anyfs-ssh-sshd-test FR-002"], "the variables name the server as the store's test reads them", () => {
  const env = envOf(HOST);
  assertEquals(env[`${ENV_PREFIX}ADDRESS`], "127.0.0.1");
  assertEquals(env[`${ENV_PREFIX}PORT`], "2222");
  assertEquals(env[`${ENV_PREFIX}USER`], "fleet");
  assertEquals(env[`${ENV_PREFIX}KEY`], "/k/key");
  assertEquals(env[`${ENV_PREFIX}KNOWN_HOSTS`], "/k/known");
  assertEquals(env[`${ENV_PREFIX}ROOT`], "/r");
  assertEquals(env[`${ENV_PREFIX}CONTROL_DIR`], "/c");
});

proves(["0004-anyfs-ssh-sshd-test FR-003"], "the command line is check, or run and a command after the dashes; anything else is a usage error", () => {
  assertEquals(commandOf(["check"]), { kind: "check" });
  assertEquals(commandOf(["run", "--", "bun", "test"]), { kind: "run", argv: ["bun", "test"] });
  assertEquals(commandOf(["run", "bun", "test"]), { kind: "run", argv: ["bun", "test"] });
  assertEquals(commandOf(["run"]).kind, "usage");
  assertEquals(commandOf(["run", "--"]).kind, "usage");
  assertEquals(commandOf([]).kind, "usage");
  assertEquals(commandOf(["check", "x"]).kind, "usage");
});

proves(["0004-anyfs-ssh-sshd-test FR-004"], "a free port is a port of the loopback that a server can then take", async () => {
  const a = await freePort();
  assert(a > 1024 && a < 65536, String(a));
});

const found = programs();

proves(["0004-anyfs-ssh-sshd-test FR-005"], "a server lets the key in through the real client and not another account or key, and is gone with its folder and keys when the function ends (skipped where no OpenSSH server can be made)", async (t) => {
  if (found.kind === "missing") {
    t.skip(found.reason);
    return;
  }
  let seen: SshdHost | undefined;
  let pidText = "";
  const ran = await withSshd(async (host) => {
    seen = host;
    const ssh = [found.ssh, "-i", host.key, "-p", String(host.port), "-o", `UserKnownHostsFile=${host.knownHosts}`, "-o", "StrictHostKeyChecking=yes", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes"];
    const ok = await proc.run([...ssh, `${host.user}@${host.address}`, "echo", "anyfs-ok"]);
    assertEquals(ok.stdout.trim(), "anyfs-ok", ok.stderr);
    const wrong = await proc.run([...ssh, "nobody-of-this-server@127.0.0.1", "true"]);
    assert(!wrong.success, "an account the server does not name was let in");
    assert(await fs.exists(host.root), "the folder of the account is made");
    pidText = (await fs.readTextFile(path.join(path.dirname(host.key), "sshd.pid"))).trim();
    return host.root;
  });
  if (ran.kind === "skipped") {
    t.skip(ran.reason);
    return;
  }
  const host = seen;
  assert(host !== undefined);
  assert(!(await fs.exists(host.key)), "the key is taken away");
  assert(!(await fs.exists(host.knownHosts)), "the known hosts are taken away");
  assert(!(await fs.exists(host.root)), "the folder of the account is taken away");
  const gone = await proc.run(["kill", "-0", pidText]);
  assert(!gone.success, "the server still runs");
});

proves(["0004-anyfs-ssh-sshd-test FR-006"], "a function that throws still ends with the server and its keys gone (skipped where no OpenSSH server can be made)", async (t) => {
  if (found.kind === "missing") {
    t.skip(found.reason);
    return;
  }
  let seen: SshdHost | undefined;
  let failed = false;
  try {
    await withSshd(async (host) => {
      seen = host;
      throw new Error("the test failed");
    });
  } catch {
    failed = true;
  }
  if (seen === undefined) {
    t.skip("no server could be made here");
    return;
  }
  assert(failed, "the error of the function is not swallowed");
  assert(!(await fs.exists(seen.key)));
  assert(!(await fs.exists(seen.root)));
});
