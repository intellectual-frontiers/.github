/**
 * Tests of the one forward the ssh target builds (spec 0016-headless-ssh-forward): the argument vector, the family, the ports, the state, and the ban on a forward made by hand.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { target, type Target } from "../src/logical/mod.ts";
import { forwardState, sshForwardArgv, type SshConfig } from "../src/targets/ssh/argv.ts";
import { sshArgumentFindings } from "../src/targets/ssh/ban.ts";

const T = (): Target => {
  const r = target({ id: "controller", class: "server", address: "controller.example", user: "s-device", port: 2222, credential: "device" });
  if (!isOk(r)) throw new Error(r.error);
  return r.value;
};
const PINNED: SshConfig = { knownHostsRepository: "/dev/pinned_hosts", knownHostsUser: "/unused", family: "pinned", controlDir: "/run/ctl", identityFor: (n) => (n === "device" ? "/keys/device" : undefined) };

proves(["0016-headless-ssh-forward FR-001", "0016-headless-ssh-forward FR-003"], "a forward is one -N -L between two loopback ports with ExitOnForwardFailure and the pinned host key, and no reverse or dynamic forward can be made", () => {
  const t = T();
  const r = sshForwardArgv(t, [t], PINNED, { localPort: 14318, remotePort: 14318 });
  assert(isOk(r));
  if (!isOk(r)) return;
  const v = r.value;
  assertEquals(v[0], "ssh");
  assert(v.includes("-N") && v.includes("ExitOnForwardFailure=yes") && v.includes("StrictHostKeyChecking=yes") && v.includes("BatchMode=yes") && v.includes("UserKnownHostsFile=/dev/pinned_hosts"), v.join(" "));
  assertEquals(v[v.indexOf("-L") + 1], "127.0.0.1:14318:127.0.0.1:14318");
  assertEquals(v.filter((a) => a === "-L").length, 1);
  assert(!v.includes("-R") && !v.includes("-D"), "no reverse or dynamic forward");
  assert(!v.some((a) => a.startsWith("ControlMaster")), "a forward is not a shared connection");
  assertEquals(v.slice(-2), ["--", "s-device@controller.example"]);
  assert(v.includes("/keys/device") && v.includes("2222"));
});

proves(["0016-headless-ssh-forward FR-001"], "a forward is refused in any family but pinned and for a port outside 1024 to 65535", () => {
  const t = T();
  assert(isErr(sshForwardArgv(t, [t], { ...PINNED, family: "batch" }, { localPort: 14318, remotePort: 14318 })));
  assert(isErr(sshForwardArgv(t, [t], { ...PINNED, family: "interactive" }, { localPort: 14318, remotePort: 14318 })));
  assert(isErr(sshForwardArgv(t, [t], PINNED, { localPort: 80, remotePort: 14318 })));
  assert(isErr(sshForwardArgv(t, [t], PINNED, { localPort: 14318, remotePort: 70000 })));
  assert(isErr(sshForwardArgv(t, [t], PINNED, { localPort: 14318.5, remotePort: 14318 })));
});

proves(["0016-headless-ssh-forward FR-006"], "the state of a forward is up where its local port accepted a connection and down otherwise", () => {
  assertEquals(forwardState(true), "up");
  assertEquals(forwardState(false), "down");
});

proves(["0016-headless-ssh-forward FR-002"], "the ban finds a forward made by hand and keeps finding a hand-built argument", () => {
  const f = (text: string): number => sshArgumentFindings([{ path: "a.ts", text }]).length;
  assertEquals(f('run(["ssh", "-N", "-L", "14318:127.0.0.1:14318", host]);'), 1);
  assertEquals(f('run(["ssh", "-R", "9:127.0.0.1:1", host]);'), 1);
  assertEquals(f('run(["ssh", "-D", "1080", host]);'), 1);
  assertEquals(f('run(["ssh", "-o", "BatchMode=yes", host, cmd]);'), 1);
  assertEquals(f("// ssh -L 1:2:3 in a comment"), 0);
  assertEquals(f('run(["echo", "-L"]);'), 0);
});
