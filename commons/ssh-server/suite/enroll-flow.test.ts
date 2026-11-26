/**
 * The whole enrollment with the real script (POSIX sh) run on this machine against the server, and a person simulated through the store: hello, bootstrap, report, pending, approve, next, consent, the typed plan, done, enrolled. And the refusals of the script.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { EnrollPolicy, InstallPlan } from "../src/governance/mod.ts";
import { confirm, issuePairing, issueToken, refuse } from "../src/physical/mod.ts";
import type { EnrollStore } from "../src/physical/mod.ts";
import { renderOneLiner } from "@intellectual-frontiers/ssh-server/logical";
import { fixture, keyPair, ssh, temp } from "./helpers.ts";
import type { Fixture } from "./helpers.ts";

const KI = ["-F", "none", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR", "-o", "PubkeyAuthentication=no"] as const;

type Ran = { readonly code: number | null; readonly stdout: string; readonly stderr: string };

/** A device that runs the script with sh, as `... bootstrap | sh` does: the script comes in on the standard input. It keeps the code the script printed, which is what a person reads and types. */
type Device = { readonly done: Promise<Ran>; readonly code: () => Promise<string> };

function startScript(f: Fixture, script: string, env: Record<string, string> = {}, detached = false): Device {
  let stdout = "";
  let stderr = "";
  const dir = join(f.dir, `device-${Math.random().toString(16).slice(2)}`);
  const child = spawn("sh", [], {
    stdio: ["pipe", "pipe", "pipe"],
    detached,
    env: { ...process.env, SYNTH_HOST: "127.0.0.1", SYNTH_PORT: String(f.port), SYNTH_SSH_OPTS: "-F none -o LogLevel=ERROR", SYNTH_POLL: "1", SYNTH_WAIT_MAX: "30", SYNTH_DIR: dir, ...env },
  });
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  const done = new Promise<Ran>((resolve) => {
    const t = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.on("close", (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
  });
  child.stdin.end(script);
  const code = async (): Promise<string> => {
    for (let i = 0; i < 400; i++) {
      const m = /Your pairing code is: (\S+)/.exec(stdout);
      if (m?.[1] !== undefined) return m[1];
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`the device printed no code: ${stdout}${stderr}`);
  };
  return { done, code };
}

/** Run to the end with the person simulated: they read the code the device printed and type it into the controller. */
async function runWithPerson(f: Fixture, script: string, plan: InstallPlan, env: Record<string, string> = {}, detached = false): Promise<Ran> {
  const dev = startScript(f, script, env, detached);
  const typed = await dev.code();
  const id = await waitForSession(f.store);
  const r = await confirm(f.store, id, typed, "synthetic-person-01", plan, f.server.policy.pairing);
  assert(r.kind === "ok" && r.value.kind === "approved", JSON.stringify(r));
  return dev.done;
}

async function bootstrap(f: Fixture, more: string[] = []): Promise<string> {
  const r = await ssh(f.port, ["bootstrap", ...more], "", "s-enroll", KI);
  assertEquals(r.code, 0, r.stderr);
  return r.stdout;
}

/** The id of the session that waits for a person. */
async function waitForSession(store: EnrollStore): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const s = (await store.listSessions()).find((x) => x.state === "interrogated");
    if (s !== undefined) return s.id;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("no session was waiting for a person");
}

const echoPlan: InstallPlan = { steps: [{ kind: "run", argv: ["/bin/echo", "synthetic-step-ran"], as: "user", expect: [0] }] };

proves(["0004-scripts FR-003", "0004-scripts FR-007", "0002-enrollment-protocol FR-008"], "the full dialogue: facts, pending, approve by a person, consent, the typed plan runs without a shell, done, enrolled", async () => {
  const f = await fixture();
  try {
    const script = await bootstrap(f);
    const r = await runWithPerson(f, script, echoPlan, { SYNTH_CONSENT: "yes" });
    assertEquals(r.code, 0, r.stdout + r.stderr);
    assert(r.stdout.includes("This script will:"), "it says what it will do first");
    assert(r.stdout.includes("step 0: run"), r.stdout);
    assert(r.stdout.includes("synthetic-step-ran"), r.stdout);
    assert(r.stdout.includes("this machine is enrolled"), r.stdout);
    const s = (await f.store.listSessions())[0];
    assertEquals(s?.state, "enrolled");
    assertEquals(s?.consent, true);
    assertEquals(s?.facts?.os.family, "linux");
    assertEquals(s?.facts?.hostname, spawnSync("hostname", { encoding: "utf8" }).stdout.trim());
    assert((s?.facts?.cpus ?? 0) > 0 && (s?.facts?.memoryBytes ?? 0) > 0);
    assert((s?.facts?.nics.length ?? 0) > 0, "network interfaces reported");
    assertEquals(s?.decision?.by, "synthetic-person-01");
    assert(/^[0-9a-f]{64}$/.test(s?.scriptSha256 ?? ""), "the hash of the script is kept");
    const hashed = (await f.store.audit()).find((e) => e.kind === "script" && e.scriptSha256 !== undefined);
    assertEquals(hashed?.scriptSha256, s?.scriptSha256);
    const asset = (await f.store.assets())[0];
    assertEquals(asset?.machineId, s?.facts?.machineId);
  } finally {
    await f.done();
  }
});

proves(["0002-enrollment-protocol FR-008"], "a person refuses: the script ends and installs nothing; and the device that declines ends the session as refused", async () => {
  const f = await fixture();
  try {
    const script = await bootstrap(f);
    const dev = startScript(f, script, { SYNTH_CONSENT: "yes" });
    await dev.code();
    assertEquals((await refuse(f.store, await waitForSession(f.store), "synthetic-person-01", "not ours")).kind, "ok");
    const r = await dev.done;
    assertEquals(r.code, 0, r.stderr);
    assert(r.stdout.includes("REFUSED"), r.stdout);
    assert(!r.stdout.includes("step 0:"));
  } finally {
    await f.done();
  }
  const g = await fixture();
  try {
    const script = await bootstrap(g);
    const r = await runWithPerson(g, script, echoPlan, {}, true);
    assert(r.stdout.includes("declined: nothing was installed"), r.stdout);
    assert(!r.stdout.includes("step 0:"), "no step ran");
    assertEquals((await g.store.listSessions())[0]?.state, "refused");
    assertEquals((await g.store.listSessions())[0]?.consent, false);
  } finally {
    await g.done();
  }
});

proves(["0004-scripts FR-007", "0004-scripts FR-011"], "a download whose SHA-256 is wrong stops the install; a right one is verified before the installer runs", async () => {
  const key = join(process.env["TMPDIR"] ?? "/tmp", `synthetic-${process.pid}.key`);
  const crt = `${key}.crt`;
  const made = spawnSync("openssl", ["req", "-x509", "-newkey", "ed25519", "-nodes", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", key, "-out", crt, "-days", "1"], { stdio: "ignore" });
  if (made.status !== 0) return;
  const body = Buffer.from("synthetic package bytes\n");
  const good = (await import("node:crypto")).createHash("sha256").update(body).digest("hex");
  const web = createServer({ key: readFileSync(key), cert: readFileSync(crt) }, (_q, res) => res.end(body));
  await new Promise<void>((r) => web.listen(0, "127.0.0.1", r));
  const url = `https://127.0.0.1:${(web.address() as AddressInfo).port}/synthetic-package_1.0_amd64.deb`;
  const f = await fixture();
  try {
    for (const [sha, want] of [["0".repeat(64), "does not match the plan"], [good, "sha256 verified"]] as const) {
      const script = await bootstrap(f);
      const plan: InstallPlan = { steps: [{ kind: "install-package", osFamily: "linux", name: "synthetic-package", version: "1.0", url, sha256: sha, installer: "deb" }] };
      const r = await runWithPerson(f, script, plan, { SYNTH_CONSENT: "yes", CURL_CA_BUNDLE: crt, SSL_CERT_FILE: crt });
      assert((r.stdout + r.stderr).includes(want), `${want}: ${r.stdout}${r.stderr}`);
      const state = (await f.store.listSessions()).find((s) => s.plan?.steps[0]?.kind === "install-package")?.state;
      if (sha !== good) assertEquals(state, "failed", "a required download that does not match ends the session as failed");
    }
    // the same wrong hash on an optional step does not stop the enrollment: the session is enrolled and says why the step was not done
    const optional = await bootstrap(f);
    const optionalPlan: InstallPlan = { steps: [{ kind: "install-package", osFamily: "linux", name: "synthetic-package", version: "1.0", url, sha256: "0".repeat(64), installer: "deb", optional: true }] };
    const o = await runWithPerson(f, optional, optionalPlan, { SYNTH_CONSENT: "yes", CURL_CA_BUNDLE: crt, SSL_CERT_FILE: crt });
    assertEquals(o.code, 0, o.stdout + o.stderr);
    assert(o.stdout.includes("this machine is enrolled"), o.stdout);
    const last = (await f.store.listSessions()).filter((s) => s.plan?.steps[0]?.kind === "install-package").at(-1);
    assertEquals(last?.state, "enrolled");
    assertEquals(last?.outcome?.steps[0]?.optional, true);
    assert(last?.outcome?.steps[0]?.detail.includes("does not match the plan"), JSON.stringify(last?.outcome));
  } finally {
    await f.done();
    web.close();
    writeFileSync(key, "");
  }
});

proves(["0005-enrollment-policy FR-001", "0005-enrollment-policy FR-002", "0002-enrollment-protocol FR-009"], "a token in scope and a pairing code approve without a person, with the rule and the explanation in the audit", async () => {
  const policy: EnrollPolicy = { rules: [{ kind: "token", tenant: "synthetic-tenant-01" }, { kind: "pairing-code" }] };
  const f = await fixture({ enroll: policy, planFor: () => echoPlan });
  try {
    const tok = await issueToken(f.store, { tenant: "synthetic-tenant-01", fleet: "synthetic-fleet-01", labels: ["lab"] }, 60_000);
    const script = await bootstrap(f, [`token=${tok.secret}`]);
    const r = await startScript(f, script, { SYNTH_CONSENT: "yes" }).done;
    assertEquals(r.code, 0, r.stdout + r.stderr);
    assert(r.stdout.includes("synthetic-step-ran"));
    const s = (await f.store.listSessions())[0];
    assertEquals(s?.decision?.by, "policy");
    assertEquals(s?.decision?.rule, 0);
    assert((s?.decision?.explanation ?? "").includes("token"));
    const decision = (await f.store.audit()).find((e) => e.kind === "decision");
    assertEquals(decision?.rule, 0);
    const p = await issuePairing(f.store, { tenant: "synthetic-tenant-02" });
    const joined = await ssh(f.port, ["join", p.code], "", "s-enroll", KI);
    const r2 = await startScript(f, joined.stdout, { SYNTH_CONSENT: "yes" }).done;
    assertEquals(r2.code, 0, r2.stdout + r2.stderr);
    const second = (await f.store.listSessions()).find((x) => x.binding?.kind === "pairing");
    assertEquals(second?.decision?.rule, 1);
    assertEquals(second?.state, "enrolled");
  } finally {
    await f.done();
  }
});

proves(["0005-enrollment-policy FR-003"], "a device that an asset already describes is adopted and not duplicated", async () => {
  const f = await fixture();
  try {
    const machineId = ["/etc/machine-id", "/var/lib/dbus/machine-id"].map((p) => { try { return readFileSync(p, "utf8").trim(); } catch { return ""; } }).find((x) => x !== "") ?? "unknown";
    await f.store.putAsset({ id: "asset-existing", machineId, macs: [], hostKeys: [], keys: [] });
    const script = await bootstrap(f);
    const r = await runWithPerson(f, script, { steps: [] }, { SYNTH_CONSENT: "yes" });
    assertEquals(r.code, 0, r.stdout + r.stderr);
    const assets = await f.store.assets();
    assertEquals(assets.length, 1);
    assertEquals(assets[0]?.id, "asset-existing");
    assert(assets[0]?.facts !== undefined, "merged");
    assertEquals((await f.store.listSessions())[0]?.assetId, "asset-existing");
  } finally {
    await f.done();
  }
});

proves(["0002-enrollment-protocol FR-019"], "three wrong codes typed by the person burn the session: the device is told, the audit says E-SSH-PAIRING-BURNED", async () => {
  const f = await fixture();
  try {
    const script = await bootstrap(f);
    const dev = startScript(f, script, { SYNTH_CONSENT: "yes" });
    const code = await dev.code();
    const id = await waitForSession(f.store);
    const wrong = code === "000000" ? "111111" : "000000";
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await confirm(f.store, id, wrong, "synthetic-person-01", { steps: [] }, f.server.policy.pairing);
      assert(r.kind === "ok");
      kinds.push(r.value.kind);
    }
    assertEquals(kinds, ["wrong", "wrong", "burned"]);
    const r = await dev.done;
    assert(r.stdout.includes("REFUSED"), r.stdout);
    assertEquals((await f.store.getSession(id))?.state, "refused");
    assert((await f.store.audit()).some((e) => e.kind === "pairing" && e.detail.includes("E-SSH-PAIRING-BURNED")));
  } finally {
    await f.done();
  }
});

proves(["0004-scripts FR-010", "0002-enrollment-protocol FR-018"], "the host key embedded in the script is checked strictly: a script that holds another key stops at the first connection, with no session and no facts", async () => {
  const f = await fixture();
  const other = await fixture();
  try {
    const script = await bootstrap(f);
    const forged = script.replace(/HKB64='[^']*'/, `HKB64='${other.server.hostKey.publicKey.split(" ")[1]}'`);
    assert(forged !== script, "the key was replaced");
    const dev = startScript(f, forged, { SYNTH_CONSENT: "yes" });
    const r = await dev.done;
    assert(r.code !== 0, "the script stops");
    assert(!r.stdout.includes("Your pairing code"), r.stdout);
    assertEquals((await f.store.listSessions())[0]?.facts, undefined);
    assertEquals((await f.store.listSessions())[0]?.deviceKey, undefined);
  } finally {
    await f.done();
    await other.done();
  }
});

proves(["0004-scripts FR-010"], "the one-liners embed the known_hosts line and check it strictly with the real OpenSSH client, by a temporary file and by KnownHostsCommand; another key is refused", async () => {
  const f = await fixture();
  const other = await fixture();
  try {
    const endpoint = { host: "127.0.0.1", port: f.port };
    for (const via of ["tmpfile", "known-hosts-command"] as const) {
      const line = renderOneLiner("sh", endpoint, f.server.hostKey.publicKey, via);
      assert(line.kind === "ok");
      assert(line.value.includes("StrictHostKeyChecking=yes") && line.value.includes("PubkeyAuthentication=no"), line.value);
      const run = (text: string): Promise<Ran> => new Promise((resolve) => {
        const c = spawn("sh", ["-c", text.replace("| sh", "| head -n 1")], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        c.stdout.on("data", (d: Buffer) => (stdout += d));
        c.stderr.on("data", (d: Buffer) => (stderr += d));
        c.on("close", (code) => resolve({ code, stdout, stderr }));
      });
      const good = await run(line.value.replace("ssh ", "ssh -F none -o LogLevel=ERROR "));
      assert(good.stdout.startsWith("#!/bin/sh"), `${via}: ${good.stdout}${good.stderr}`);
      const bad = renderOneLiner("sh", endpoint, other.server.hostKey.publicKey, via);
      assert(bad.kind === "ok");
      const refused = await run(bad.value.replace("ssh ", "ssh -F none -o LogLevel=ERROR "));
      assert(!refused.stdout.startsWith("#!/bin/sh"), "another host key is refused");
      assert(refused.stderr.includes("Host key verification failed") || refused.stderr.includes("REMOTE HOST IDENTIFICATION"), refused.stderr);
    }
    const ps = renderOneLiner("ps", { host: "synth-host", port: 2222 }, f.server.hostKey.publicKey);
    assert(ps.kind === "ok" && ps.value.includes("bootstrap-ps | pwsh") && ps.value.includes("StrictHostKeyChecking=yes"), JSON.stringify(ps));
    assertEquals(renderOneLiner("sh", endpoint, "not a key").kind, "err");
  } finally {
    await f.done();
    await other.done();
  }
});

proves(["0002-enrollment-protocol FR-011", "0002-enrollment-protocol FR-022", "0002-enrollment-protocol FR-023"], "after enrollment the device keeps its key and the pinned host key, and reconnects as s-device by that key; then it rotates its key without a person, and revokes it", async () => {
  const f = await fixture();
  const t = await temp();
  try {
    const script = await bootstrap(f);
    const plan: InstallPlan = { steps: [{ kind: "pin-controller", host: "127.0.0.1", port: f.port, publicKey: f.server.hostKey.publicKey }, { kind: "run", argv: ["/bin/true"], as: "user", expect: [0] }] };
    const dir = join(t.dir, "device");
    const r = await runWithPerson(f, script, plan, { SYNTH_CONSENT: "yes", SYNTH_DIR: dir });
    assertEquals(r.code, 0, r.stdout + r.stderr);
    assert(r.stdout.includes("enrolled"));
    const key = join(dir, "device_key");
    const known = join(dir, "known_hosts");
    assert(readFileSync(known, "utf8").includes(f.server.hostKey.publicKey), "the controller key is pinned");
    const strict = ["-F", "none", "-o", "LogLevel=ERROR", "-o", "IdentitiesOnly=yes", "-i", key, "-o", `UserKnownHostsFile=${known}`, "-o", "StrictHostKeyChecking=yes", "-o", "PasswordAuthentication=no", "-o", "ConnectTimeout=10"];
    const facts = JSON.stringify({ type: "facts", facts: (await f.store.listSessions())[0]?.facts });
    const checkin = await ssh(f.port, ["checkin"], facts, "s-device", strict);
    assertEquals(checkin.code, 0, checkin.stderr);
    assert(checkin.stdout.startsWith("OK"));
    // rotation: a new key announced over the old key, confirmed by proving it, and the old key stops
    const newKey = await keyPair(t.dir, "synthetic-new-key");
    const announce = await ssh(f.port, ["rekey"], JSON.stringify({ type: "rekey", publicKey: newKey.publicKey }), "s-device", strict);
    assertEquals(announce.code, 0, announce.stderr);
    const viaNew = ["-F", "none", "-o", "LogLevel=ERROR", "-o", "IdentitiesOnly=yes", "-i", newKey.path, "-o", `UserKnownHostsFile=${known}`, "-o", "StrictHostKeyChecking=yes", "-o", "PasswordAuthentication=no"];
    assertEquals((await ssh(f.port, ["checkin"], "", "s-device", viaNew)).code === 0, false, "a new key does nothing before it is confirmed");
    const confirmed = await ssh(f.port, ["rekey-confirm"], "", "s-device", viaNew);
    assertEquals(confirmed.code, 0, confirmed.stderr);
    assertEquals((await f.store.assets())[0]?.keys, [newKey.fingerprint]);
    assert((await ssh(f.port, ["checkin"], "", "s-device", strict)).code !== 0, "the old key stops");
    assertEquals((await ssh(f.port, ["checkin"], "", "s-device", viaNew)).code, 0);
    const revoke = await ssh(f.port, ["revoke"], "", "s-device", viaNew);
    assertEquals(revoke.code, 0, revoke.stderr);
    assert((await ssh(f.port, ["checkin"], "", "s-device", viaNew)).code !== 0, "nothing proves after a revoke");
    assertEquals((await f.store.assets())[0]?.revoked, true);
    assert((await f.store.audit()).some((e) => e.detail.includes("revoked by the device")));
  } finally {
    await f.done();
    await t.done();
  }
});
