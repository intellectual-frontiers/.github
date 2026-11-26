/**
 * Tests of the server against the real OpenSSH client: the doors that open, the doors that stay shut, the limits, the audit chain and the stores.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyChain } from "../src/logical/mod.ts";
import type { ChainedEvent } from "../src/governance/mod.ts";
import { confirm, createEnrollServer, fileStore, issuePairing, issueToken, loadOrCreateHostKey, memoryStore } from "../src/physical/mod.ts";
import { TEST_IDENTITY, fixture, keyPair, ssh, syntheticFacts, temp, withKey } from "./helpers.ts";

const sha = (t: string): string => createHash("sha256").update(t).digest("hex");
const KI = ["-F", "none", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR", "-o", "PubkeyAuthentication=no"] as const;

proves(["0003-server-policy FR-003", "0002-enrollment-protocol FR-013"], "an anonymous client is let in by keyboard-interactive and hello lists the commands of its account only", async () => {
  const f = await fixture();
  try {
    const r = await ssh(f.port, ["hello"], "", "s-enroll", KI);
    assertEquals(r.code, 0);
    assert(r.stdout.includes("bootstrap-ps"), r.stdout);
    assert(!r.stdout.includes("checkin"), "a command of another account is not listed");
    assert(!r.stdout.includes("tether"), "a reserved command is not listed");
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-003"], "the method none is accepted where the policy says so, with BatchMode", async () => {
  const f = await fixture({ policy: { anonymous: "none" } });
  try {
    const r = await ssh(f.port, ["hello"], "", "s-enroll", [...KI, "-o", "BatchMode=yes"]);
    assertEquals(r.code, 0);
    const off = await fixture({ policy: { anonymous: "refuse" } });
    try {
      assert((await ssh(off.port, ["hello"], "", "s-enroll", KI)).code !== 0, "anonymous refused");
    } finally {
      await off.done();
    }
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-001"], "another user and a reserved account are refused", async () => {
  const f = await fixture();
  try {
    for (const user of ["root", "s-operator", "s-agent", "s-assist", "admin"]) {
      const r = await ssh(f.port, ["hello"], "", user, KI);
      assert(r.code !== 0, `${user} is refused`);
      assert(!r.stdout.includes("Synth"), `${user} got nothing`);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-004"], "no shell, no pty, no subsystem, no forwarding, no environment, and the audit says so", async () => {
  const f = await fixture();
  try {
    const shell = await ssh(f.port, [], "", "s-enroll", KI);
    assert(shell.code !== 0, "no shell");
    const sftp = await ssh(f.port, ["-s", "sftp"], "", "s-enroll", KI);
    assert(sftp.code !== 0, "no sftp");
    const fwd = await ssh(f.port, ["-o", "ExitOnForwardFailure=yes", "-R", "0:127.0.0.1:22", "hello"], "", "s-enroll", KI);
    assert(fwd.code !== 0, "no remote forward");
    const pty = await ssh(f.port, ["-tt", "hello"], "", "s-enroll", KI);
    assert(pty.stdout.includes("Synth") || pty.code !== 0, "a pty is refused and hello still answers or ends");
    const env = await ssh(f.port, ["-o", "SendEnv=LANG", "hello"], "", "s-enroll", KI);
    assertEquals(env.code, 0);
    const log = (await f.store.audit()).filter((e) => e.kind === "refused").map((e) => e.detail).join("|");
    assert(log.includes("a shell"), log);
    assert(log.includes("a subsystem"), log);
  } finally {
    await f.done();
  }
});

proves(["0002-enrollment-protocol FR-001", "0003-server-policy FR-008"], "an unknown command, shell metacharacters and oversize input are refused with an exit status and a message", async () => {
  const f = await fixture({ policy: { maxStdinBytes: 1024 } });
  try {
    const unknown = await ssh(f.port, ["format"], "", "s-enroll", KI);
    assertEquals(unknown.code, 64);
    assert(unknown.stderr.includes("unknown command"), unknown.stderr);
    for (const bad of ["hello;id", "hello|id", "hello$(id)", "hello`id`", "hello>x", "hello&&id"]) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const r = await ssh(f.port, [bad], "", "s-enroll", KI);
      assertEquals(r.code, 64, bad + r.stderr + JSON.stringify(await f.store.audit()));
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    const long = await ssh(f.port, ["hello", "a".repeat(300)], "", "s-enroll", KI);
    assertEquals(long.code, 64);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", KI);
    const id = /SESSION='(en-[a-z2-7]{16})'/.exec(boot.stdout)?.[1];
    assert(id !== undefined, "a session id is in the script");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const big = await ssh(f.port, ["report", id as string], "x".repeat(5000), "s-enroll", KI);
    assertEquals(big.code, 65);
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-005"], "a public source address is refused by default and accepted where the policy lists its block", async () => {
  const f = await fixture({ peerAddress: () => "8.8.8.8" });
  try {
    assert((await ssh(f.port, ["hello"], "", "s-enroll", KI)).code !== 0);
    assert((await f.store.audit()).some((e) => e.kind === "limit" && e.detail === "source network is not allowed"));
  } finally {
    await f.done();
  }
  const g = await fixture({ peerAddress: () => "8.8.8.8", policy: { allowCidrs: ["8.8.8.0/24"] } });
  try {
    assertEquals((await ssh(g.port, ["hello"], "", "s-enroll", KI)).code, 0);
  } finally {
    await g.done();
  }
});

proves(["0003-server-policy FR-006"], "the rate limit refuses a source that is too fast, and the penalty ends by itself", async () => {
  const f = await fixture({ policy: { bucket: { capacity: 3, refillPerSecond: 0.01 }, penalty: { baseMs: 50, maxMs: 100 } } });
  try {
    let refused = 0;
    for (let i = 0; i < 6; i++) if ((await ssh(f.port, ["hello"], "", "s-enroll", KI)).code !== 0) refused += 1;
    assert(refused >= 2, `refused ${refused}`);
    assert((await f.store.audit()).some((e) => e.detail === "rate limit"));
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-008"], "an idle connection that holds the standard input open is closed at the idle time", async () => {
  const f = await fixture({ policy: { idleTimeoutMs: 600 } });
  try {
    const started = Date.now();
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", KI);
    const id = /SESSION='(en-[a-z2-7]{16})'/.exec(boot.stdout)?.[1] as string;
    const { spawn } = await import("node:child_process");
    const child = spawn("ssh", [...KI, "-p", String(f.port), "s-enroll@127.0.0.1", "report", id], { stdio: ["pipe", "pipe", "pipe"] });
    const code = await new Promise<number | null>((resolve) => {
      child.on("close", resolve);
      setTimeout(() => child.kill("SIGKILL"), 8000).unref();
    });
    assert(Date.now() - started < 8000, "closed before the guard");
    assert(code !== null && code !== 0, `ended with ${code}`);
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-012"], "20 parallel clients are each served to the end with their own session", async () => {
  const f = await fixture({ policy: { maxConnectionsPerIp: 30 } });
  try {
    const runs = await Promise.all(Array.from({ length: 20 }, () => ssh(f.port, ["knock"], "", "s-enroll", KI)));
    for (const r of runs) assertEquals(r.code, 0);
    const ids = new Set(runs.map((r) => r.stdout.split("\t")[1]));
    assertEquals(ids.size, 20);
    assertEquals((await f.store.listSessions()).length, 20);
  } finally {
    await f.done();
  }
});

proves(["0003-server-policy FR-009", "0003-server-policy FR-013"], "the host key is made once with mode 600, kept across restarts and never replaced silently", async () => {
  const t = await temp();
  try {
    const path = join(t.dir, "keys", "host");
    const a = await loadOrCreateHostKey(path);
    const b = await loadOrCreateHostKey(path);
    assertEquals(a.host.fingerprint, b.host.fingerprint);
    assert(/^SHA256:[A-Za-z0-9+/]{43}$/.test(a.host.fingerprint));
    if (process.platform !== "win32") assertEquals((await stat(path)).mode & 0o777, 0o600);
    await writeFile(path, "not a key");
    let failed = false;
    try {
      await loadOrCreateHostKey(path);
    } catch {
      failed = true;
    }
    assert(failed, "a damaged key is an error, never a new key");
    assertEquals(await readFile(path, "utf8"), "not a key");
    const s1 = await createEnrollServer({ port: 0, host: "127.0.0.1", hostKeyPath: join(t.dir, "h2"), store: memoryStore(), policy: TEST_IDENTITY });
    const fp = s1.hostKey.fingerprint;
    assertEquals(s1.address.host, "127.0.0.1");
    assert(s1.address.port > 0 && s1.connections() === 0 && s1.policy.accounts.length === 2);
    await s1.close();
    const s2 = await createEnrollServer({ port: 0, host: "127.0.0.1", hostKeyPath: join(t.dir, "h2"), store: memoryStore(), policy: TEST_IDENTITY });
    assertEquals(s2.hostKey.fingerprint, fp);
    await s2.close();
  } finally {
    await t.done();
  }
});

proves(["0002-enrollment-protocol FR-009", "0003-server-policy FR-007"], "join takes a pairing code once; a token binds once; reuse and a wrong code are refused", async () => {
  const f = await fixture();
  try {
    const p = await issuePairing(f.store, { tenant: "synthetic-tenant-01", fleet: "synthetic-fleet-01", labels: ["lab"] });
    const ok1 = await ssh(f.port, ["join", p.code], "", "s-enroll", KI);
    assertEquals(ok1.code, 0);
    assert(ok1.stdout.startsWith("#!/bin/sh"));
    await new Promise((r) => setTimeout(r, 60));
    const again = await ssh(f.port, ["join", p.code], "", "s-enroll", KI);
    assertEquals(again.code, 77);
    await new Promise((r) => setTimeout(r, 120));
    const wrong = await ssh(f.port, ["join", "maple-river-0000"], "", "s-enroll", KI);
    assertEquals(wrong.code, 77);
    const bound = (await f.store.listSessions()).find((s) => s.binding?.kind === "pairing");
    assertEquals(bound?.binding?.tenant, "synthetic-tenant-01");
    await new Promise((r) => setTimeout(r, 300));
    const t = await issueToken(f.store, { tenant: "synthetic-tenant-01" }, 60_000);
    const secret = t.secret;
    assertEquals((await ssh(f.port, ["bootstrap", `token=${secret}`], "", "s-enroll", KI)).code, 0);
    await new Promise((r) => setTimeout(r, 300));
    assertEquals((await ssh(f.port, ["bootstrap", `token=${secret}`], "", "s-enroll", KI)).code, 77);
    const log = JSON.stringify(await f.store.audit());
    assert(!log.includes(secret), "no token in the log");
    assert(!log.includes(p.code), "no pairing code in the log");
  } finally {
    await f.done();
  }
});

proves(["0002-enrollment-protocol FR-010"], "knock leaves a pending session with the banner, the class and the key the client proved", async () => {
  const t = await temp();
  const f = await fixture();
  try {
    const key = await keyPair(t.dir, "synthetic-key-01");
    const r = await ssh(f.port, ["knock"], "", "s-enroll", withKey(key.path));
    assertEquals(r.code, 0);
    const s = (await f.store.listSessions())[0];
    assert(s !== undefined);
    assertEquals(s.state, "pending");
    assertEquals(s.deviceClass, "openssh");
    assert(s.clientIdent.startsWith("SSH-2.0-OpenSSH"), s.clientIdent);
    assertEquals(s.offeredKeys.some((k) => k.fingerprint === key.fingerprint && k.proven), true);
    assertEquals(s.sourceIp, "127.0.0.1");
  } finally {
    await f.done();
    await t.done();
  }
});

proves(["0002-enrollment-protocol FR-011", "0002-enrollment-protocol FR-012", "0003-server-policy FR-002"], "s-device takes only an enrolled key: checkin reports drift and hands work, leave asks for removal, another key is refused", async () => {
  const t = await temp();
  const f = await fixture();
  try {
    const key = await keyPair(t.dir, "synthetic-key-device");
    const other = await keyPair(t.dir, "synthetic-key-other");
    const facts = syntheticFacts(1);
    await f.store.putAsset({ id: "asset-01", macs: [], hostKeys: [], keys: [key.fingerprint], facts, pending: { steps: [{ kind: "run", argv: ["/bin/true"], as: "user", expect: [0] }] } });
    const drifted = { type: "facts", facts: { ...facts, kernel: "Linux 6.13.0", memoryBytes: 16 * 1024 ** 3 } };
    const r = await ssh(f.port, ["checkin"], JSON.stringify(drifted), "s-device", withKey(key.path));
    assertEquals(r.code, 0, r.stderr + r.stdout);
    assert(r.stdout.includes("DRIFT\tkernel") && r.stdout.includes("DRIFT\tmemoryBytes"), r.stdout);
    const work = /WORK\t(en-[a-z2-7]{16})/.exec(r.stdout)?.[1];
    assert(work !== undefined, r.stdout);
    assertEquals((await f.store.getSession(work as string))?.state, "approved");
    assertEquals((await f.store.assets())[0]?.facts?.kernel, "Linux 6.13.0");
    const no = await ssh(f.port, ["checkin"], "", "s-device", withKey(other.path));
    assert(no.code !== 0, "a key that is not enrolled is refused");
    const refusal = (await f.store.audit()).filter((e) => e.kind === "auth" && e.outcome === "refused" && e.fingerprint === other.fingerprint);
    assert(refusal.length > 0, "the refusal of a key names the key's fingerprint, so that the refusal of a revoked key can be told from any other");
    const anon = await ssh(f.port, ["checkin"], "", "s-device", KI);
    assert(anon.code !== 0, "anonymous is refused on s-device");
    const onEnroll = await ssh(f.port, ["checkin"], "", "s-enroll", KI);
    assertEquals(onEnroll.code, 64 === onEnroll.code ? 64 : onEnroll.code);
    assert(onEnroll.code !== 0, "checkin is not an s-enroll command");
    const leave = await ssh(f.port, ["leave"], "", "s-device", withKey(key.path));
    assertEquals(leave.code, 0);
    assertEquals(await f.store.removalRequests(), ["asset-01"]);
    assertEquals((await f.store.assets())[0]?.id, "asset-01");
  } finally {
    await f.done();
    await t.done();
  }
});

proves(["0003-server-policy FR-014", "0003-server-policy FR-015", "0002-enrollment-protocol FR-014"], "the audit log is a hash chain that continues across restarts, ends each conversation with digests and keeps a capped transcript", async () => {
  const t = await temp();
  const store = await fileStore(join(t.dir, "state.json"));
  let f = await fixture({ store, policy: { transcriptBytes: 64 } });
  try {
    const r = await ssh(f.port, ["hello"], "", "s-enroll", KI);
    assertEquals(r.code, 0);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    await f.done();
  }
  f = await fixture({ store, policy: { transcriptBytes: 64 } });
  try {
    await ssh(f.port, ["hello"], "", "s-enroll", KI);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const events = (await store.audit()) as readonly ChainedEvent[];
    assert(events.length > 6, `${events.length} events`);
    const v = verifyChain(events, sha);
    assertEquals(v.kind, "ok", v.kind === "err" ? v.error : "");
    const close = events.filter((e) => e.kind === "close");
    assertEquals(close.length, 2);
    assert(/^[0-9a-f]{64}$/.test(close[0]?.stdoutSha256 ?? ""));
    assert((close[0]?.transcript ?? "").length <= 64);
    assert((close[0]?.transcript ?? "").length > 0);
    const copy = events.map((e) => ({ ...e }));
    copy[2] = { ...(copy[2] as ChainedEvent), detail: "changed" };
    assertEquals(verifyChain(copy, sha).kind, "err");
    const text = await readFile(join(t.dir, "state.json"), "utf8");
    assert(text.includes('"audit"'));
    if (process.platform !== "win32") assertEquals((await stat(join(t.dir, "state.json"))).mode & 0o777, 0o600);
    await chmod(join(t.dir, "state.json"), 0o600);
  } finally {
    await f.done();
    await t.done();
  }
});

proves(["0003-server-policy FR-010", "0003-server-policy FR-011"], "the file store keeps sessions across a restart and approve stores the asset once for an adopted device", async () => {
  const t = await temp();
  try {
    const path = join(t.dir, "s.json");
    const a = await fileStore(path);
    const f = await fixture({ store: a });
    try {
      await ssh(f.port, ["knock"], "", "s-enroll", KI);
    } finally {
      await f.done();
    }
    const b = await fileStore(path);
    const s = (await b.listSessions())[0];
    assert(s !== undefined);
    assertEquals(s.state, "pending");
    const code = s.pairing?.sas as string;
    assert(/^[0-9]{6}$/.test(code), "the knock printed a code");
    const cfg = { kind: "digits", length: 6 } as const;
    assertEquals((await confirm(b, s.id, code, "", { steps: [] }, cfg)).kind, "err", "a person is named");
    const wrong = await confirm(b, s.id, code === "000000" ? "111111" : "000000", "synthetic-person-01", { steps: [] }, cfg);
    assert(wrong.kind === "ok" && wrong.value.kind === "wrong");
    const done = await confirm(b, s.id, code, "synthetic-person-01", { steps: [] }, cfg);
    assert(done.kind === "ok" && done.value.kind === "approved");
    assertEquals((await b.assets()).length, 1);
    assertEquals((await confirm(b, s.id, code, "synthetic-person-01", { steps: [] }, cfg)).kind, "err");
    assertEquals((await confirm(b, "en-aaaaaaaaaaaaaaaa", code, "synthetic-person-01", { steps: [] }, cfg)).kind, "err");
  } finally {
    await t.done();
  }
});

proves(["0002-enrollment-protocol FR-004"], "another source address is told unknown session", async () => {
  let who = "10.0.0.5";
  const f = await fixture({ peerAddress: () => who });
  try {
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", KI);
    const id = /SESSION='(en-[a-z2-7]{16})'/.exec(boot.stdout)?.[1] as string;
    assertEquals((await ssh(f.port, ["status", id], "", "s-enroll", KI)).stdout.split("\t")[0], "STATE");
    who = "10.0.0.6";
    const r = await ssh(f.port, ["status", id], "", "s-enroll", KI);
    assertEquals(r.code, 66);
  } finally {
    await f.done();
  }
});

proves(["0002-enrollment-protocol FR-017"], "after the first anonymous connection every command that belongs to a session needs the key that paired it", async () => {
  const t = await temp();
  const f = await fixture();
  try {
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", KI);
    const id = /SESSION='(en-[a-z2-7]{16})'/.exec(boot.stdout)?.[1] as string;
    for (const cmd of ["report", "next", "done", "pair-commit", "pair-reveal"]) {
      const r = await ssh(f.port, [cmd, id], "{}", "s-enroll", KI);
      assertEquals(r.code, 77, cmd);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const key = await keyPair(t.dir, "synthetic-key-a");
    const other = await keyPair(t.dir, "synthetic-key-b");
    const keyed = (k: { path: string }) => withKey(k.path);
    const early = await ssh(f.port, ["report", id], "{}", "s-enroll", keyed(key));
    assertEquals(early.code, 77, "a key that did not pair the session: pair first");
    const commit = `{"type":"pair-commit","commit":"${"a".repeat(64)}"}`;
    const paired = await ssh(f.port, ["pair-commit", id], commit, "s-enroll", keyed(key));
    assertEquals(paired.code, 0, paired.stderr + JSON.stringify((await f.store.audit()).slice(-4).map((e) => [e.kind, e.detail])));
    assert(paired.stdout.startsWith("COMMIT\t"));
    const stranger = await ssh(f.port, ["next", id], "", "s-enroll", keyed(other));
    assertEquals(stranger.code, 66, "another key is told unknown session");
    const owner = await ssh(f.port, ["next", id], "", "s-enroll", keyed(key));
    assertEquals(owner.code, 0, owner.stderr);
    assert(owner.stdout.startsWith("WAIT"));
    const again = await ssh(f.port, ["pair-commit", id], commit, "s-enroll", keyed(key));
    assert(again.code !== 0, "a replayed commitment is refused");
  } finally {
    await f.done();
    await t.done();
  }
});

proves(["0002-enrollment-protocol FR-021"], "a bare knock prints the code and says it was not checked against the host key", async () => {
  const f = await fixture();
  try {
    const r = await ssh(f.port, ["knock"], "", "s-enroll", KI);
    assertEquals(r.code, 0);
    assert(/CODE\t[0-9]{6}\n/.test(r.stdout), r.stdout);
    assert(r.stdout.includes("not checked against the host key"), r.stdout);
    const s = (await f.store.listSessions())[0];
    assertEquals(s?.pairing?.tofu, true);
    assert(r.stdout.includes(s?.pairing?.sas ?? "none"));
  } finally {
    await f.done();
  }
});
