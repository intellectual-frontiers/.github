// Spec: 0007-machine-probe-enroll FR-001, FR-002, FR-003
/**
 * Enrolling a machine for observation: the host keys it presents are shown by their fingerprints and nothing is done until the person gives the one they compared with the machine's own; then that host key, and only it, is pinned in a known-hosts file. In the mode `stdin` that is all: the
 * probe is piped to the person's own login each time and nothing is left on the machine. In the mode `install` a key is made for the probe (kept outside any repository) and, over the person's own ssh, the probe and one line that restricts the key to it are installed in the person's own account, and nothing else on the machine is changed. What is to be written where a program keeps its files (the reach, the
 * observation) is the caller's: this gives the data. The probe is then asked with the restricted key by `probeExecutor` and `observe`.
 *
 * @example
 * ```ts
 * import { parseSsh } from "./enroll.ts";
 * parseSsh("admin@synthetic-server-03.example:2222"); // { kind: "ok", value: { user: "admin", address: "synthetic-server-03.example", port: 2222 } }
 * ```
 *
 * @module
 */
import { copyFile, mkdtemp, rm, writeFile as writeTemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { target, type Executor, type Target } from "@intellectual-frontiers/headless/logical";
import { sshExecutor, type SshConfig } from "@intellectual-frontiers/headless/targets/ssh";
import { fs, path, proc } from "@intellectual-frontiers/system";
import type { ProbeReach, ReachMode } from "@intellectual-frontiers/machine-probe/governance";
import { probeKeyLine } from "./key.ts";
import { probeScriptPath } from "./scripts.ts";

/** `user@host[:port]` read, or why not. */
export function parseSsh(text: string): Result<{ readonly user: string; readonly address: string; readonly port?: number }, string> {
  const m = /^([A-Za-z0-9_][A-Za-z0-9._-]*)@([A-Za-z0-9][A-Za-z0-9.:-]*?)(?::([0-9]{1,5}))?$/.exec(text);
  if (m === null) return err("the address is user@host or user@host:port");
  const port = m[3] === undefined ? undefined : Number(m[3]);
  if (port !== undefined && (port < 1 || port > 65535)) return err("the port is 1 to 65535");
  return ok({ user: m[1] ?? "", address: m[2] ?? "", ...(port === undefined ? {} : { port }) });
}

/** The machine and the account to enroll it under. */
export type EnrollTarget = { readonly user: string; readonly address: string; readonly port?: number };

/** What enrolling is given beyond the machine: a name for it, the file that pins host keys, the folder of the probe's keys, the key the person reaches the machine with (the agent or the default key where none) and the fingerprint they compared (none until they have). */
export type EnrollOptions = { readonly asset: string; readonly knownHosts: string; readonly keys: string; readonly mode: ReachMode; readonly credential?: string; readonly identity?: string; readonly fingerprint?: string };

/** What enrolling came to: the fingerprints to compare and nothing done, or done, with the reach to keep, the file of the probe's private key and the line that was installed. */
export type Enrolled =
  | { readonly kind: "show"; readonly fingerprint: string; readonly address: string }
  | { readonly kind: "done"; readonly reach: ProbeReach; readonly keyFile: string; readonly line: string; readonly pinned: readonly string[] };

/** The reach of a machine as a target of the ssh client, for the credential given. */
function targetOf(asset: string, r: ProbeReach, credential: string | undefined): Result<Target, string> {
  return target({ id: asset, class: "server", address: r.address, user: r.user, ...(r.port === undefined ? {} : { port: r.port }), ...(credential === undefined ? {} : { credential }) });
}

/** Enrolls a machine (see the module). */
export async function enrollProbe(ssh: EnrollTarget, o: EnrollOptions): Promise<Result<Enrolled, string>> {
  const dir = await mkdtemp(`${tmpdir()}/probe-enroll-`);
  try {
    const scan = await proc.run(["ssh-keyscan", "-T", "5", "-t", "ed25519,ecdsa,rsa", ...(ssh.port === undefined ? [] : ["-p", String(ssh.port)]), ssh.address]);
    const lines = scan.stdout.split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    if (lines.length === 0) return err(`${ssh.address} gave no host key${scan.stderr.trim() === "" ? "" : `: ${scan.stderr.trim()}`}`);
    const prints: { readonly line: string; readonly fingerprint: string }[] = [];
    for (const [i, line] of lines.entries()) {
      const one = path.join(dir, `scanned-${i}`);
      await writeTemp(one, `${line}\n`);
      const shown = await proc.run(["ssh-keygen", "-l", "-f", one]);
      const m = /(SHA256:[A-Za-z0-9+/]+)\s.*\((\w+)\)/.exec(shown.stdout);
      if (m !== null) prints.push({ line, fingerprint: m[1] ?? "" });
    }
    if (prints.length === 0) return err(`${ssh.address} gave host keys that could not be read`);
    if (o.fingerprint === undefined || o.fingerprint === "") return ok({ kind: "show", fingerprint: prints.map((p) => p.fingerprint).join(" | "), address: ssh.address });
    const matched = prints.filter((p) => p.fingerprint === o.fingerprint);
    if (matched.length === 0) return err(`${ssh.address} presented ${prints.map((p) => p.fingerprint).join(", ")}, not ${o.fingerprint}: nothing was pinned`);
    const pinned = matched.map((p) => p.line);

    const have = (await fs.exists(o.knownHosts)) ? await fs.readTextFile(o.knownHosts) : "";
    const fresh = pinned.filter((l) => !have.split("\n").includes(l));
    if (fresh.length > 0) {
      await fs.mkdir(path.dirname(o.knownHosts), { recursive: true });
      await fs.writeTextFile(o.knownHosts, `${have}${have === "" || have.endsWith("\n") ? "" : "\n"}${fresh.join("\n")}\n`);
    }

    if (o.mode === "stdin") {
      const reach: ProbeReach = { address: ssh.address, ...(ssh.port === undefined ? {} : { port: ssh.port }), user: ssh.user, credential: o.credential ?? "person", mode: "stdin" };
      return ok({ kind: "done", reach, keyFile: "", line: "", pinned });
    }
    await fs.mkdir(o.keys, { recursive: true, mode: 0o700 });
    const credential = `${o.asset}-probe`;
    const keyFile = path.join(o.keys, credential);
    if (!(await fs.exists(keyFile))) {
      const made = await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", `probe@${o.asset}`, "-f", keyFile]);
      if (!made.success) return err(`the probe key was not made: ${made.stderr.trim()}`);
    }
    const line = probeKeyLine((await fs.readTextFile(`${keyFile}.pub`)).trim());
    if (line.kind === "err") return line;

    const reach: ProbeReach = { address: ssh.address, ...(ssh.port === undefined ? {} : { port: ssh.port }), user: ssh.user, credential, mode: "install" };
    const person = targetOf(o.asset, reach, o.identity === undefined ? undefined : "person");
    if (person.kind === "err") return person;
    const config: SshConfig = { knownHostsRepository: o.knownHosts, knownHostsUser: o.knownHosts, ...(o.identity === undefined ? {} : { identityFor: (n: string) => (n === "person" ? o.identity : undefined) }) };
    const executor = sshExecutor(person.value, [person.value], config);
    const script = path.join(dir, "machine-probe");
    await copyFile(probeScriptPath("posix"), script);
    for (const step of [
      () => executor.exec(["mkdir", "-p", ".local/bin"]),
      () => executor.put?.([script], ".local/bin") ?? Promise.reject(new Error("no copy")),
      () => executor.exec(["sh", "-c", 'IFS= read -r L && chmod 755 .local/bin/machine-probe && mkdir -p .ssh && chmod 700 .ssh && touch .ssh/authorized_keys && { grep -qxF "$L" .ssh/authorized_keys || printf "%s\\n" "$L" >> .ssh/authorized_keys; }'], { input: `${line.value}\n` }),
    ]) {
      const r = await step();
      if (!r.success) return err(`the probe was not installed under ${ssh.user} on ${ssh.address}: ${new TextDecoder().decode(r.stderr).trim() || `status ${r.code}`}`);
    }
    return ok({ kind: "done", reach, keyFile, line: line.value, pinned });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The way to log in to a machine read in the mode `stdin`: the ssh client with the pinned host keys and the person's own key, a file where one is given and the agent or the default key where none is. */
export function loginExecutor(reach: ProbeReach, knownHosts: string, identity?: string): Result<Executor, string> {
  const t = targetOf(reach.credential, reach, reach.credential);
  if (t.kind === "err") return t;
  return ok(sshExecutor(t.value, [t.value], { knownHostsRepository: knownHosts, knownHostsUser: knownHosts, ...(identity === undefined ? {} : { identityFor: (n: string) => (n === reach.credential ? identity : undefined) }) }));
}

/** The way to run the probe of an enrolled machine: the ssh client with the restricted key and the pinned host keys, and nothing the person's own key can do. */
export function probeExecutor(reach: ProbeReach, knownHosts: string, keyFile: string): Result<Executor, string> {
  const t = targetOf(reach.credential, reach, reach.credential);
  if (t.kind === "err") return t;
  return ok(sshExecutor(t.value, [t.value], { knownHostsRepository: knownHosts, knownHostsUser: knownHosts, identityFor: (n) => (n === reach.credential ? keyFile : undefined) }));
}
