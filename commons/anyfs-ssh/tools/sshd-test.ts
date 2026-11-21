// Spec: 0004-anyfs-ssh-sshd-test FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * A throwaway OpenSSH server for the tests of the store (commons anyfs-ssh 0004-anyfs-ssh-sshd-test): the keys, the configuration and the logs are made in a folder of their own, the server listens on a free port of
 * the loopback and accepts one key for one account, and everything is taken away again when the function that uses it ends. Where the computer has no OpenSSH server the answer says so, and a test that needed
 * it is skipped with that sentence.
 *
 * ```sh
 * bun tools/sshd-test.ts check                         say whether a server can be made here
 * bun tools/sshd-test.ts run -- bun test suite/sshd.test.ts   run a command with ANYFS_SSH_TEST_* naming the server
 * ```
 *
 * @example
 * ```ts
 * import { withSshd } from "./sshd-test.ts";
 * const r = await withSshd(async (host) => host.port);
 * r.kind === "ran" ? r.value : r.reason;
 * ```
 *
 * @module
 */
import net from "node:net";
import os from "node:os";
import process from "node:process";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { type Executor, target } from "@intellectual-frontiers/headless/logical";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** The prefix of the variables that name the server to the tests. */
export const ENV_PREFIX = "ANYFS_SSH_TEST_";

/** The server, as a test reaches it. */
export type SshdHost = {
  readonly address: string;
  readonly port: number;
  readonly user: string;
  /** The file of the private key the server accepts. */
  readonly key: string;
  /** The file of known hosts that holds the server's own key, and no other. */
  readonly knownHosts: string;
  /** A folder of the account to make stores in. */
  readonly root: string;
  /** A short folder to keep the shared connections in. */
  readonly controlDir: string;
};

/** What a use of the server ended with: it ran, or it could not be made and why. */
export type Sshd<T> = { readonly kind: "ran"; readonly value: T } | { readonly kind: "skipped"; readonly reason: string };

/** The programs of OpenSSH that are needed, or what is missing. */
export type Programs = { readonly kind: "found"; readonly sshd: string; readonly keygen: string; readonly ssh: string } | { readonly kind: "missing"; readonly reason: string };

const SSHD_PLACES = ["/usr/sbin/sshd", "/usr/local/sbin/sshd", "/usr/bin/sshd", "/opt/homebrew/sbin/sshd", "/usr/libexec/sshd"] as const;

/** The programs of OpenSSH on this computer. */
export function programs(): Programs {
  const sshd = proc.which("sshd") ?? SSHD_PLACES.find((p) => proc.isExecutable(p));
  const keygen = proc.which("ssh-keygen");
  const ssh = proc.which("ssh");
  const lacking = [sshd === undefined ? "sshd" : "", keygen === undefined ? "ssh-keygen" : "", ssh === undefined ? "ssh" : ""].filter((s) => s !== "");
  if (sshd === undefined || keygen === undefined || ssh === undefined) return { kind: "missing", reason: `this computer has no ${lacking.join(", ")} (install the OpenSSH server and client to run the test against a real server)` };
  return { kind: "found", sshd, keygen, ssh };
}

/** The variables that name a server to the tests. */
export function envOf(host: SshdHost): Readonly<Record<string, string>> {
  return {
    [`${ENV_PREFIX}ADDRESS`]: host.address,
    [`${ENV_PREFIX}PORT`]: String(host.port),
    [`${ENV_PREFIX}USER`]: host.user,
    [`${ENV_PREFIX}KEY`]: host.key,
    [`${ENV_PREFIX}KNOWN_HOSTS`]: host.knownHosts,
    [`${ENV_PREFIX}ROOT`]: host.root,
    [`${ENV_PREFIX}CONTROL_DIR`]: host.controlDir,
  };
}

/** The executor that reaches the server by the real client, with the calls of a run sharing one connection (where the host names a folder for them). */
export function executorOf(host: SshdHost): Executor {
  const t = target({ id: "fleet-test", class: "server", address: host.address, ...(host.user === "" ? {} : { user: host.user }), port: host.port, credential: "test-key" });
  if (t.kind === "err") throw new Error(t.error);
  return sshExecutor(t.value, [t.value], {
    knownHostsRepository: host.knownHosts,
    knownHostsUser: host.knownHosts,
    identityFor: (name) => (name === "test-key" ? host.key : undefined),
    ...(host.controlDir === "" ? {} : { controlDir: host.controlDir }),
  });
}

/** The place of the server, as the store names it. */
export function placeOf(host: SshdHost): { readonly host: string; readonly user?: string; readonly port: number } {
  return { host: host.address, ...(host.user === "" ? {} : { user: host.user }), port: host.port };
}

/** The line of known hosts for a server: its host key, for the address and port, and nothing else. */
export function knownHostsLine(address: string, port: number, hostPublicKey: string): string {
  const [type, key] = hostPublicKey.trim().split(/\s+/);
  return `[${address}]:${port} ${type ?? ""} ${key ?? ""}\n`;
}

/** The configuration of the server: one account, one key, no password, the loopback and the given port. */
export function configOf(options: { readonly dir: string; readonly port: number; readonly user: string }): string {
  return [
    `Port ${options.port}`,
    "ListenAddress 127.0.0.1",
    `HostKey ${options.dir}/hostkey`,
    `PidFile ${options.dir}/sshd.pid`,
    `AuthorizedKeysFile ${options.dir}/authorized_keys`,
    "PasswordAuthentication no",
    "KbdInteractiveAuthentication no",
    "PubkeyAuthentication yes",
    "UsePAM no",
    "StrictModes no",
    "PermitRootLogin no",
    "PermitUserEnvironment no",
    `AllowUsers ${options.user}`,
    "",
  ].join("\n");
}

/** A free port of the loopback, which another process may take before the server does. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error("no port was given"))));
    });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function accepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function listens(port: number, ended: () => boolean, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until && !ended()) {
    if (await accepts(port)) return true;
    await sleep(100);
  }
  return false;
}

/** The account the server lets in: the user of the process, or `fleet` where the process is root (made where it is not there). */
async function account(): Promise<{ readonly kind: "ok"; readonly user: string; readonly home: string | undefined } | { readonly kind: "no"; readonly reason: string }> {
  if (!proc.isRoot()) return { kind: "ok", user: os.userInfo().username, home: undefined };
  const user = "fleet";
  const there = await proc.run(["getent", "passwd", user]);
  if (!there.success) {
    const made = await proc.run(["useradd", "-m", "-s", "/bin/sh", user]);
    if (!made.success) return { kind: "no", reason: `the account ${user} could not be made: ${made.stderr.trim()}` };
  }
  // an account with no password is locked, and sshd refuses a locked account even for a key: a password that nothing matches opens it to keys only
  const opened = await proc.run(["usermod", "-p", "*", user]);
  if (!opened.success) return { kind: "no", reason: `the account ${user} could not be opened to keys: ${opened.stderr.trim()}` };
  const entry = (await proc.run(["getent", "passwd", user])).stdout.trim().split(":");
  return { kind: "ok", user, home: entry[5] };
}

/**
 * Makes the server, runs `fn` with the host it names, and takes everything away again, whatever `fn` does. Where no server can be made the answer says why and `fn` does not run.
 */
export async function withSshd<T>(fn: (host: SshdHost) => Promise<T>): Promise<Sshd<T>> {
  const found = programs();
  if (found.kind === "missing") return { kind: "skipped", reason: found.reason };
  const who = await account();
  if (who.kind === "no") return { kind: "skipped", reason: who.reason };
  const base = (await fs.exists("/tmp")) ? "/tmp" : os.tmpdir();
  const dir = await fs.realPath(await fs.makeTempDir({ dir: base, prefix: "anyfs-sshd-" }));
  let remoteRoot = path.join(dir, "root");
  const removals: string[] = [dir];
  let child: ReturnType<typeof proc.spawn> | undefined;
  try {
    // the server reads the keys as root, and the account reads the list of the keys it accepts: the folder may be entered and nothing in it listed
    await fs.chmod(dir, 0o711);
    const keyfile = async (name: string): Promise<void> => {
      const made = await proc.run([found.keygen, "-q", "-t", "ed25519", "-N", "", "-C", "anyfs-test", "-f", path.join(dir, name)]);
      if (!made.success) throw new Error(`ssh-keygen: ${made.stderr.trim()}`);
    };
    await keyfile("hostkey");
    await keyfile("clientkey");
    const clientPublic = await fs.readTextFile(path.join(dir, "clientkey.pub"));
    await fs.writeTextFile(path.join(dir, "authorized_keys"), clientPublic, { mode: 0o644 });
    const port = await freePort();
    await fs.writeTextFile(path.join(dir, "sshd_config"), configOf({ dir, port, user: who.user }));
    await fs.writeTextFile(path.join(dir, "known_hosts"), knownHostsLine("127.0.0.1", port, await fs.readTextFile(path.join(dir, "hostkey.pub"))));
    const controlDir = path.join(dir, "ctl");
    await fs.mkdir(controlDir, { mode: 0o700 });
    if (who.home !== undefined) {
      remoteRoot = path.join(who.home, `anyfs-test-${path.basename(dir)}`);
      await proc.must(["install", "-d", "-m", "700", "-o", who.user, remoteRoot]);
      removals.push(remoteRoot);
    } else await fs.mkdir(remoteRoot, { mode: 0o700 });
    await fs.mkdir("/run/sshd", { recursive: true }).catch(() => undefined);
    child = proc.spawn([found.sshd, "-D", "-E", path.join(dir, "sshd.log"), "-f", path.join(dir, "sshd_config")], { stdin: "null", stdout: "null", stderr: "null" });
    let ended = false;
    void child.status.then(
      () => (ended = true),
      () => (ended = true),
    );
    if (!(await listens(port, () => ended, 15000))) {
      const log = (await fs.readTextFile(path.join(dir, "sshd.log")).catch(() => "")).trim().split("\n").slice(-3).join(" | ");
      return { kind: "skipped", reason: `an sshd could not be started here${log === "" ? "" : `: ${log}`}` };
    }
    const host: SshdHost = { address: "127.0.0.1", port, user: who.user, key: path.join(dir, "clientkey"), knownHosts: path.join(dir, "known_hosts"), root: remoteRoot, controlDir };
    return { kind: "ran", value: await fn(host) };
  } finally {
    if (child !== undefined) {
      child.kill("SIGTERM");
      await Promise.race([child.status.catch(() => undefined), sleep(5000)]);
      child.kill("SIGKILL");
    }
    // the shared connections end with the server; a master that is left is stopped by its socket
    for (const target of removals) await fs.remove(target, { recursive: true }).catch(() => undefined);
  }
}

/** What the command line asked. */
export type Command = { readonly kind: "check" } | { readonly kind: "run"; readonly argv: readonly string[] } | { readonly kind: "usage"; readonly message: string };

/** The command of an argument list: `check`, or `run -- <command...>`. */
export function commandOf(args: readonly string[]): Command {
  const [verb, ...rest] = args;
  if (verb === "check" && rest.length === 0) return { kind: "check" };
  if (verb === "run") {
    const argv = rest[0] === "--" ? rest.slice(1) : rest;
    return argv.length === 0 ? { kind: "usage", message: "run needs a command after --" } : { kind: "run", argv };
  }
  return { kind: "usage", message: "usage: bun tools/sshd-test.ts check | run -- <command...>" };
}

async function main(args: readonly string[]): Promise<number> {
  const command = commandOf(args);
  if (command.kind === "usage") {
    process.stderr.write(`${command.message}\n`);
    return 2;
  }
  if (command.kind === "check") {
    const found = programs();
    process.stdout.write(found.kind === "found" ? `an OpenSSH server can be made here (${found.sshd})\n` : `${found.reason}\n`);
    return found.kind === "found" ? 0 : 1;
  }
  const argv = command.argv;
  const outcome = await withSshd(async (host) => {
    const child = proc.spawn(argv, { env: envOf(host), stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const stop = (): void => child.kill("SIGTERM");
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const status = await child.status;
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    return status.code;
  });
  if (outcome.kind === "ran") return outcome.value;
  // no server: the command runs without one, and a test that needs it says it is skipped
  process.stderr.write(`no ssh server for the command: ${outcome.reason}\n`);
  const bare = proc.spawn(argv, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  return (await bare.status).code;
}

if (import.meta.main) process.exit(await main(proc.args));
