/**
 * A real `sshd` for the tests of `remote` (commons ergonex 0006-agents): an OpenSSH server started on a loopback port with its own host key, one account made for the run (and removed at its end) and a
 * client key that account accepts. Nothing stands in for the server: `ssh`, `ssh-keyscan` and `ssh-keygen` are the system's. Needs root (to make the account and to run `sshd`), `sshd`, `ssh` and
 * `useradd`; where one is missing the tests that need it are skipped by name and say what is missing.
 *
 * @module
 */
import { chmod, makeTempDir, remove, writeTextFile, mkdir, readTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { build, execPath, run, which } from "../src/platform/r-proc.ts";
import { LAUNCHER } from "./ergonex-fixtures.ts";

/** What is missing for a real sshd, or nothing. */
export function sshdMissing(): string | undefined {
  if (build.os !== "linux") return "a real sshd is run only on Linux";
  for (const p of ["sshd", "ssh", "ssh-keygen", "ssh-keyscan", "useradd", "userdel"]) if (which(p) === undefined && !(p === "sshd" && which("/usr/sbin/sshd") !== undefined)) return `${p} is not installed on this machine`;
  if (typeof process.getuid === "function" && process.getuid() !== 0) return "the sshd test needs root to make an account";
  return undefined;
}

/** A running sshd. */
export type Sshd = {
  readonly dir: string;
  readonly port: number;
  readonly user: string;
  /** The home of the account on the machine. */
  readonly userHome: string;
  /** The private key the client logs in with. */
  readonly identity: string;
  /** The fingerprint (SHA256:...) of the host's ed25519 key. */
  readonly fingerprint: string;
  /** The public key file of the client. */
  readonly publicKey: string;
  /** The host key's public line. */
  readonly hostPublic: string;
  stop(): Promise<void>;
};

const out = async (argv: readonly string[]): Promise<string> => {
  const r = await run(argv);
  if (!r.success) throw new Error(`${argv.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

/** Starts a real sshd and an account; `authorizedPrefix` is put before the client's key in `authorized_keys` (a forced command, for example). */
export async function startSshd(o: { readonly authorizedPrefix?: string; readonly withErgonex?: boolean } = {}): Promise<Sshd> {
  const dir = await makeTempDir({ prefix: "ergonex-sshd-" });
  await chmod(dir, 0o755);
  const user = `ergt${Math.random().toString(36).slice(2, 8)}`;
  await out(["useradd", "-m", "-s", "/bin/sh", user]);
  await out(["passwd", "-u", user]).catch(() => "");
  await run(["usermod", "-p", "*", user]);
  const userHome = (await out(["getent", "passwd", user])).split(":")[5] ?? `/home/${user}`;
  await out(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", join(dir, "host_key")]);
  await out(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", join(dir, "client_key")]);
  await chmod(join(dir, "client_key"), 0o600);
  const hostPublic = (await readTextFile(join(dir, "host_key.pub"))).trim();
  const pub = (await readTextFile(join(dir, "client_key.pub"))).trim();
  const fingerprint = /(SHA256:\S+)/.exec(await out(["ssh-keygen", "-lf", join(dir, "host_key.pub")]))?.[1] ?? "";
  await mkdir(join(userHome, ".ssh"), { recursive: true });
  await writeTextFile(join(userHome, ".ssh", "authorized_keys"), `${o.authorizedPrefix === undefined ? "" : `${o.authorizedPrefix} `}${pub}\n`);
  await out(["chown", "-R", `${user}:`, join(userHome, ".ssh")]);
  await chmod(join(userHome, ".ssh"), 0o700);
  await chmod(join(userHome, ".ssh", "authorized_keys"), 0o600);
  if (o.withErgonex !== false) {
    // the program on the machine: the launcher of this checkout, on a copy of this runtime the account can read, in the folder a bootstrapped machine keeps it (FR-034)
    const bun = join(dir, "runtime");
    await run(["cp", execPath(), bun]);
    await chmod(bun, 0o755);
    await mkdir(join(userHome, ".local", "bin"), { recursive: true });
    await writeTextFile(join(userHome, ".local", "bin", "ergonex"), `#!/bin/sh\nexec ${bun} ${LAUNCHER} "$@"\n`);
    await chmod(join(userHome, ".local", "bin", "ergonex"), 0o755);
    await out(["chown", "-R", `${user}:`, join(userHome, ".local")]);
  }
  await mkdir("/run/sshd", { recursive: true });
  const port = 20000 + Math.floor(Math.random() * 20000);
  await writeTextFile(
    join(dir, "sshd_config"),
    [`Port ${port}`, "ListenAddress 127.0.0.1", `HostKey ${join(dir, "host_key")}`, `PidFile ${join(dir, "sshd.pid")}`, "PasswordAuthentication no", "KbdInteractiveAuthentication no", "PubkeyAuthentication yes", "UsePAM no", `AllowUsers ${user}`, "StrictModes no", "PermitUserEnvironment no", "LogLevel ERROR", ""].join("\n"),
  );
  const sshd = which("sshd") ?? "/usr/sbin/sshd";
  await out([sshd, "-t", "-f", join(dir, "sshd_config")]);
  await out([sshd, "-f", join(dir, "sshd_config")]);
  return {
    dir,
    port,
    user,
    userHome,
    identity: join(dir, "client_key"),
    publicKey: join(dir, "client_key.pub"),
    fingerprint,
    hostPublic,
    stop: async () => {
      const pid = await readTextFile(join(dir, "sshd.pid")).catch(() => "");
      if (pid.trim() !== "") await run(["kill", pid.trim()]);
      await run(["userdel", "-r", "-f", user]);
      await remove(dir, { recursive: true }).catch(() => undefined);
    },
  };
}
