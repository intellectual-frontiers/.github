/**
 * Helpers of the tests: a temporary folder, a server on a free port with fast limits, the real OpenSSH client run as a program, key pairs made by `ssh-keygen`, and synthetic facts (no real host or operator names).
 *
 * @module
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Brand, Facts, ServerIdentity } from "../src/governance/mod.ts";
import { SERVER_POLICY_DEFAULTS } from "../src/governance/mod.ts";
import { createEnrollServer, fingerprintOfBlob, memoryStore } from "../src/physical/mod.ts";
import type { EnrollServer, EnrollServerOptions, EnrollStore } from "../src/physical/mod.ts";

/** A temporary folder, removed by `done`. */
export async function temp(): Promise<{ readonly dir: string; readonly done: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "ssh-server-"));
  return { dir, done: () => rm(dir, { recursive: true, force: true }) };
}

/** A synthetic brand: what a product passes to the library (the library has none of its own). */
export const TEST_BRAND: Brand = { name: "Synth", envPrefix: "SYNTH", stateDir: { posix: "/etc/synth", windows: "synth" }, keyComment: "synth-device", serverIdent: "synth-enroll_0.1", approveHint: (id, code) => `synth enroll approve ${id} --code ${code}` };

/** The identity of tests: a synthetic endpoint and brand. */
export const TEST_IDENTITY: ServerIdentity = { endpoint: { host: "synth-host", port: 2222 }, brand: TEST_BRAND };

/** The policy of tests: the defaults with short penalties and a roomy bucket. */
export const FAST: Partial<typeof SERVER_POLICY_DEFAULTS> = { penalty: { baseMs: 1, maxMs: 2 }, bucket: { capacity: 1000, refillPerSecond: 1000 }, handshakeTimeoutMs: 5000 };

/** A running server for a test. */
export type Fixture = { readonly server: EnrollServer; readonly store: EnrollStore; readonly port: number; readonly dir: string; readonly done: () => Promise<void> };

/** Start a server on a free loopback port with a store in memory, and its folder. */
export async function fixture(more: Partial<Omit<EnrollServerOptions, "policy">> & { readonly policy?: Partial<typeof SERVER_POLICY_DEFAULTS> } = {}): Promise<Fixture> {
  const t = await temp();
  const store = more.store ?? memoryStore();
  const server = await createEnrollServer({ port: 0, host: "127.0.0.1", ...more, hostKeyPath: join(t.dir, "host_key"), policy: { ...TEST_IDENTITY, ...FAST, ...(more.policy ?? {}) }, store });
  return { server, store, port: server.address.port, dir: t.dir, done: async () => { await server.close(); await t.done(); } };
}

/** What a run of the client gave. */
export type Ran = { readonly code: number | null; readonly stdout: string; readonly stderr: string };

/** The options every run of the client has: no host key prompt, no user config, quiet. */
export const SSH_BASE = ["-F", "none", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR", "-o", "ConnectTimeout=10", "-o", "PubkeyAuthentication=no", "-o", "PasswordAuthentication=no"] as const;

/** Run the OpenSSH client against a port. `input` is the standard input, and the client's stdin is closed after it. */
export function ssh(port: number, args: readonly string[], input = "", user = "s-enroll", base: readonly string[] = SSH_BASE, limitMs = 20_000): Promise<Ran> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [...base, "-p", String(port), `${user}@127.0.0.1`, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    const t = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`ssh took more than ${limitMs} ms`)); }, limitMs);
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

/** A key pair made by ssh-keygen in `dir`: the path of the private key and the fingerprint. */
export async function keyPair(dir: string, name: string): Promise<{ readonly path: string; readonly fingerprint: ReturnType<typeof fingerprintOfBlob>; readonly publicKey: string }> {
  const path = join(dir, name);
  await new Promise<void>((resolve, reject) => {
    const c = spawn("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", path, "-C", "synthetic-key"], { stdio: "ignore" });
    c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ssh-keygen ${code}`))));
  });
  const pub = (await readFile(`${path}.pub`, "utf8")).trim();
  const blob = Buffer.from(pub.split(" ")[1] as string, "base64");
  return { path, fingerprint: fingerprintOfBlob(blob), publicKey: pub.split(" ").slice(0, 2).join(" ") };
}

/** The options that make the client offer one key. */
export function withKey(path: string): readonly string[] {
  return ["-F", "none", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR", "-o", "ConnectTimeout=10", "-o", "IdentitiesOnly=yes", "-i", path, "-o", "PasswordAuthentication=no"];
}

/** Synthetic facts of device number `n`: synthetic-host-NN, with no real name. */
export function syntheticFacts(n = 1): Facts {
  const nn = String(n).padStart(2, "0");
  return {
    os: { family: "linux", name: "Debian GNU/Linux", version: "13", arch: "x86_64" },
    kernel: "Linux 6.12.0",
    hostname: `synthetic-host-${nn}`,
    machineId: `synthetic-machine-id-${nn}`,
    serial: `synthetic-serial-${nn}`,
    cpus: 4,
    memoryBytes: 8 * 1024 ** 3,
    disks: [{ name: "sda", sizeBytes: 100 * 1024 ** 3 }],
    nics: [{ name: "eth0", mac: `02:00:00:00:00:${nn}`, addresses: [`10.0.0.${n}/24`] }],
    hostKeys: [{ algo: "ssh-ed25519", fingerprint: `SHA256:${"A".repeat(43)}` as never }],
    adminUsers: ["root"],
    packageManager: "apt",
    sudo: "root",
    init: "systemd",
  };
}

export { SERVER_POLICY_DEFAULTS };
