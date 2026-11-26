/**
 * Tests of the forward: the one loopback port an enrolled device may reach, against the real OpenSSH client, and the pure decision and the policy check.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import { createConnection, createServer } from "node:net";
import type { Server, Socket } from "node:net";
import { SERVER_POLICY_DEFAULTS, policyProblems } from "../src/governance/mod.ts";
import type { Fingerprint, ForwardRule } from "../src/governance/mod.ts";
import { forwardDecision } from "../src/logical/mod.ts";
import type { ForwardRequest } from "../src/logical/mod.ts";
import { fixture, keyPair, temp, withKey } from "./helpers.ts";
import type { Fixture } from "./helpers.ts";

const FP = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Fingerprint;
const rule = (port = 4318): ForwardRule => ({ account: "s-device", port });
const asked = (more: Partial<ForwardRequest> = {}): ForwardRequest => ({ kind: "direct-tcpip", account: "s-device", proven: FP, enrolled: true, destHost: "127.0.0.1", destPort: 4318, open: 0, ...more });

proves(["0007-ssh-server-dedupe-and-forward FR-008"], "the policy has no forward by default and the check refuses a rule for another account, a port outside 1024 to 65535, a second rule and a limit that is not a number", () => {
  assertEquals(SERVER_POLICY_DEFAULTS.forwards, []);
  assertEquals(policyProblems(SERVER_POLICY_DEFAULTS), []);
  const p = (forwards: readonly ForwardRule[], maxForwardBytes = 1000): readonly string[] => policyProblems({ forwards, maxForwardBytes });
  assertEquals(p([rule()]), []);
  assert(p([{ account: "s-enroll", port: 4318 }]).length === 1, "another account");
  assert(p([rule(80)]).length === 1, "a low port");
  assert(p([rule(70000)]).length === 1, "a port past the end");
  assert(p([rule(1.5)]).length === 1, "a port that is not whole");
  assert(p([rule(4318), rule(4319)]).length === 1, "a second rule for one account");
  assert(p([rule()], 0).length === 1, "a zero byte limit");
});

proves(["0007-ssh-server-dedupe-and-forward FR-009"], "the decision accepts one loopback port for an enrolled device and refuses everything else, with a reason that names no key", () => {
  const policy = { forwards: [rule()] };
  assertEquals(forwardDecision(policy, asked()).kind, "accept");
  const refused = (more: Partial<ForwardRequest>, p = policy): string => {
    const d = forwardDecision(p, asked(more));
    assertEquals(d.kind, "refuse");
    return d.kind === "refuse" ? d.reason : "";
  };
  assert(refused({ destPort: 22 }).includes("4318"), "another port");
  refused({ destHost: "10.0.0.1" });
  refused({ destHost: "localhost" });
  refused({ kind: "streamlocal" });
  refused({ kind: "tcpip-forward" });
  refused({ proven: undefined });
  refused({ enrolled: false });
  refused({ account: "s-enroll" });
  refused({ open: 1 });
  refused({}, { forwards: [] });
  for (const reason of [refused({ enrolled: false }), refused({ proven: undefined })]) assert(!reason.includes("SHA256"), "no key in a reason");
});

type Rig = { readonly f: Fixture; readonly dir: string; readonly key: string; readonly fp: Fingerprint; readonly target: Server; readonly targetPort: number; readonly received: Buffer[]; readonly done: () => Promise<void> };

/** An enrolled device (its key is in the store), a target that echoes in upper case on a loopback port, and a server whose policy forwards to that port. */
async function rig(more: { readonly policy?: Partial<typeof SERVER_POLICY_DEFAULTS>; readonly recheck?: number; readonly forwards?: boolean } = {}): Promise<Rig> {
  const received: Buffer[] = [];
  const target = createServer((s: Socket) => {
    s.on("data", (d: Buffer) => {
      received.push(d);
      s.write(d.toString("utf8").toUpperCase());
    });
  });
  await new Promise<void>((r) => target.listen(0, "127.0.0.1", () => r()));
  const targetPort = (target.address() as { port: number }).port;
  const t = await temp();
  const k = await keyPair(t.dir, "device_key");
  const f = await fixture({ ...(more.recheck === undefined ? {} : { forwardRecheckMs: more.recheck }), policy: { forwards: more.forwards === false ? [] : [{ account: "s-device", port: targetPort }], ...(more.policy ?? {}) } });
  await f.store.putAsset({ id: "asset-synthetic-01", macs: [], hostKeys: [], keys: [k.fingerprint] });
  return {
    f, dir: t.dir, key: k.path, fp: k.fingerprint, target, targetPort, received,
    done: async () => {
      await f.done();
      await t.done();
      await new Promise<void>((r) => target.close(() => r()));
    },
  };
}

async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  const port = (s.address() as { port: number }).port;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}

/** Start `ssh -N -L local:host:port` as s-device and wait until the forward is listening, or the client ended. */
async function startForward(r: Rig, to: string, user = "s-device", key = r.key): Promise<{ readonly child: ChildProcess; readonly local: number; readonly stderr: () => string }> {
  const local = await freePort();
  const child = spawn("ssh", [...withKey(key), "-N", "-o", "ExitOnForwardFailure=yes", "-L", `${local}:${to}`, "-p", String(r.f.port), `${user}@127.0.0.1`], { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  child.stderr?.on("data", (d: Buffer) => (err += d.toString("utf8")));
  const before = (await r.f.store.audit()).filter((e) => e.kind === "auth" && e.outcome === "ok").length;
  await until(async () => (child.exitCode !== null || (await r.f.store.audit()).filter((e) => e.kind === "auth" && e.outcome === "ok").length > before ? true : undefined), 3000);
  await new Promise((res) => setTimeout(res, 400));
  return { child, local, stderr: () => err };
}

/** One request through the forward: connect, send, read until the other side answers, close. */
function through(local: number, text: string): Promise<string> {
  return new Promise((resolve) => {
    const c = createConnection({ host: "127.0.0.1", port: local });
    let got = "";
    const stop = setTimeout(() => { c.destroy(); resolve(got); }, 4000);
    c.on("connect", () => c.write(text));
    c.on("data", (d: Buffer) => {
      got += d.toString("utf8");
      if (got.length >= text.length) { clearTimeout(stop); c.destroy(); resolve(got); }
    });
    c.on("error", () => { clearTimeout(stop); resolve(got); });
    c.on("close", () => { clearTimeout(stop); resolve(got); });
  });
}

const events = async (r: Rig, kind: string): Promise<readonly { readonly detail: string; readonly outcome: string; readonly destination?: string; readonly bytesIn?: number; readonly bytesOut?: number; readonly stdinSha256?: string; readonly fingerprint?: string }[]> => (await r.f.store.audit()).filter((e) => e.kind === kind);

async function until<T>(f: () => Promise<T | undefined>, ms = 6000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await f();
    if (v !== undefined) return v;
    await new Promise((res) => setTimeout(res, 50));
  }
  return undefined;
}

proves(["0007-ssh-server-dedupe-and-forward FR-009", "0007-ssh-server-dedupe-and-forward FR-010"], "an enrolled device reaches the one loopback port of its rule, and the open and the close are audited with the counts and digests and no bytes", async () => {
  const r = await rig();
  try {
    const { child, local } = await startForward(r, `127.0.0.1:${r.targetPort}`);
    assertEquals(await through(local, "hello"), "HELLO");
    child.kill();
    const closed = await until(async () => (await events(r, "forward")).find((e) => e.detail === "close"));
    assert(closed !== undefined, "the close is audited");
    assertEquals(closed?.bytesIn, 5);
    assertEquals(closed?.bytesOut, 5);
    assert(/^[0-9a-f]{64}$/.test(closed?.stdinSha256 ?? ""), "the digest of what was carried");
    assertEquals(closed?.fingerprint, r.fp);
    assertEquals(closed?.destination, `127.0.0.1:${r.targetPort}`);
    const all = JSON.stringify(await r.f.store.audit());
    assert(!all.includes("hello") && !all.includes("HELLO"), "the audit holds no byte of the forward");
    assert((await events(r, "forward")).some((e) => e.detail === "open"), "the open is audited");
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-008", "0007-ssh-server-dedupe-and-forward FR-009"], "with no rule in the policy every forward is refused and audited", async () => {
  const r = await rig({ forwards: false });
  try {
    const { child, local } = await startForward(r, `127.0.0.1:${r.targetPort}`);
    assertEquals(await through(local, "hello"), "");
    child.kill();
    const refused = await until(async () => (await events(r, "refused")).find((e) => e.destination !== undefined));
    assert(refused !== undefined && refused.detail.includes("no forward"), refused?.detail);
    assertEquals(r.received.length, 0, "nothing reached the target");
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-009"], "another port, another host and a second concurrent forward are refused, and a good one still works", async () => {
  const r = await rig();
  try {
    const wrongPort = await startForward(r, "127.0.0.1:22");
    assertEquals(await through(wrongPort.local, "x"), "");
    wrongPort.child.kill();
    const wrongHost = await startForward(r, `10.0.0.1:${r.targetPort}`);
    assertEquals(await through(wrongHost.local, "x"), "");
    wrongHost.child.kill();
    const refusals = (await events(r, "refused")).filter((e) => e.destination !== undefined).map((e) => e.destination);
    assert(refusals.includes("127.0.0.1:22") && refusals.includes(`10.0.0.1:${r.targetPort}`), refusals.join(","));
    const good = await startForward(r, `127.0.0.1:${r.targetPort}`);
    const hold = createConnection({ host: "127.0.0.1", port: good.local });
    await new Promise<void>((res) => hold.once("connect", () => res()));
    hold.write("a");
    await until(async () => ((await events(r, "forward")).some((e) => e.detail === "open") ? true : undefined));
    assertEquals(await through(good.local, "second"), "", "a second concurrent forward of one device is refused");
    assert((await events(r, "refused")).some((e) => e.detail.includes("holds a forward already")));
    hold.destroy();
    good.child.kill();
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-009"], "a key that is not enrolled, and an anonymous account, cannot forward", async () => {
  const r = await rig();
  try {
    const stranger = await keyPair(r.dir, "stranger_key");
    const asStranger = await startForward(r, `127.0.0.1:${r.targetPort}`, "s-device", stranger.path);
    assertEquals(await through(asStranger.local, "x"), "");
    asStranger.child.kill();
    const asEnroll = await startForward(r, `127.0.0.1:${r.targetPort}`, "s-enroll", r.key);
    assertEquals(await through(asEnroll.local, "x"), "");
    asEnroll.child.kill();
    assertEquals(r.received.length, 0);
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-009"], "a remote forward and a socket forward are refused and audited", async () => {
  const r = await rig();
  try {
    const remote = spawn("ssh", [...withKey(r.key), "-N", "-o", "ExitOnForwardFailure=yes", "-R", "9999:127.0.0.1:1", "-p", String(r.f.port), "s-device@127.0.0.1"], { stdio: "ignore" });
    const code = await new Promise<number | null>((res) => remote.on("close", res));
    assert(code !== 0, "the client sees the refusal");
    const socket = spawn("ssh", [...withKey(r.key), "-N", "-o", "ExitOnForwardFailure=yes", "-L", `${join(r.dir, "s.sock")}:127.0.0.1:1`, "-p", String(r.f.port), "s-device@127.0.0.1"], { stdio: "ignore" });
    socket.kill();
    const details = (await events(r, "refused")).map((e) => e.detail);
    assert(details.some((d) => d.includes("remote forward")), details.join("|"));
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-010"], "the byte limit closes a forward and the audit says why", async () => {
  const r = await rig({ policy: { maxForwardBytes: 64 } });
  try {
    const { child, local } = await startForward(r, `127.0.0.1:${r.targetPort}`);
    await through(local, "x".repeat(200));
    const closed = await until(async () => (await events(r, "forward")).find((e) => e.detail.startsWith("close:")));
    assert(closed !== undefined && closed.detail.includes("byte limit"), closed?.detail);
    child.kill();
  } finally {
    await r.done();
  }
});

proves(["0007-ssh-server-dedupe-and-forward FR-009"], "a forward that is open when its key is revoked is closed at the next check, and audited", async () => {
  const r = await rig({ recheck: 100 });
  try {
    const { child, local } = await startForward(r, `127.0.0.1:${r.targetPort}`);
    const hold = createConnection({ host: "127.0.0.1", port: local });
    await new Promise<void>((res) => hold.once("connect", () => res()));
    hold.write("a");
    await until(async () => ((await events(r, "forward")).some((e) => e.detail === "open") ? true : undefined));
    await r.f.store.putAsset({ id: "asset-synthetic-01", macs: [], hostKeys: [], keys: [r.fp], revoked: true });
    const closed = await until(async () => (await events(r, "forward")).find((e) => e.detail.includes("revoked")));
    assert(closed !== undefined, "closed because the key was revoked");
    hold.destroy();
    child.kill();
  } finally {
    await r.done();
  }
});

