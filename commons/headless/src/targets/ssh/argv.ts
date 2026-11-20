// Spec: 0005-reach-and-targets FR-005, FR-006
/**
 * The one place the arguments of the system's OpenSSH client are made (commons headless 0005-reach-and-targets FR-005, FR-006). `ssh` joins what it is given after the
 * host into one string for the remote shell; `proc.run` does not, so the remote command is quoted here word by word and sent as ONE argument. The options that
 * every call needs are here and nowhere else: batch mode (never a question), a connect time out, keep-alive, no terminal, the connection shared by a control
 * master, the keys of the repository's known hosts first and the user's after, and a host key that does not match is refused.
 *
 * @example
 * ```ts
 * import { shQuote } from "./argv.ts";
 * shQuote("it's here"); // "'it'\\''s here'"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Target } from "@intellectual-frontiers/headless/logical";

const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** A word as one word of a POSIX shell: as it is where it needs no quoting, else in single quotes with each single quote written `'\''`. */
export function shQuote(word: string): string {
  return word !== "" && SAFE.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/** An argument vector as the one string the remote shell reads back as that vector; a word with a NUL (which no shell can hold) is refused. */
export function remoteCommand(argv: readonly string[]): Result<string, string> {
  if (argv.length === 0) return err("there is nothing to run");
  if (argv.some((w) => w.includes("\u0000"))) return err("a word of the command holds a NUL, which a shell cannot");
  return ok(argv.map(shQuote).join(" "));
}

/** What the client's calls are configured with: the files of known hosts, where the shared connections live, the times, and how a credential reference becomes a key file. */
export type SshConfig = {
  /** The program, `ssh` by default. */
  readonly program?: string;
  /** The repository's known hosts (from Git), consulted first. */
  readonly knownHostsRepository: string;
  /** The user's known hosts, consulted after. */
  readonly knownHostsUser: string;
  /** The folder the control sockets are in; with none, the connection is not shared. */
  readonly controlDir?: string;
  readonly connectTimeoutSec?: number;
  readonly serverAliveSec?: number;
  /** The path of the key file a credential reference names (never a key's value); a reference it does not know is an error. */
  readonly identityFor?: (name: string) => string | undefined;
};

const NO_SPACE = /^\S+$/;

/** The destination of a target, `user@host`. */
function destination(t: Target): string {
  return t.user === undefined ? t.address : `${t.user}@${t.address}`;
}

/** The jump hosts as `-J` takes them: each the target of that id, `user@host:port`, in order. */
function jumpChain(t: Target, all: readonly Target[]): Result<string, string> {
  const hops: string[] = [];
  for (const id of t.jump) {
    const j = all.find((x) => x.id === id);
    if (j === undefined) return err(`${t.id}: the target to jump through, ${id}, is not known`);
    hops.push(`${destination(j)}${j.port === undefined ? "" : `:${j.port}`}`);
  }
  return ok(hops.join(","));
}

/**
 * The argument vector that runs `remote` (already one string, see `remoteCommand`) on a target, or `undefined` for the remote to open a shell that reads a script
 * on its standard input (`sh -s`): `-T` (no terminal), batch mode, the times, `StrictHostKeyChecking=yes`, the two known-hosts files, no password and no
 * keyboard prompts, the shared connection, the key by reference, the port and the jump chain, then `--` and the destination so that nothing after it can be read as an
 * option. Nothing here accepts a host key: there is no `accept-new` and no `no`.
 */
export function sshArgv(t: Target, all: readonly Target[], config: SshConfig, remote: string): Result<readonly string[], string> {
  if (!NO_SPACE.test(config.knownHostsRepository) || !NO_SPACE.test(config.knownHostsUser)) return err("the paths of the known-hosts files may not hold a space");
  const jump = jumpChain(t, all);
  if (jump.kind === "err") return jump;
  const identity = t.credential === undefined ? undefined : config.identityFor?.(t.credential.name);
  if (t.credential !== undefined && identity === undefined) return err(`${t.id}: the credential ${t.credential.name} is not one this program can resolve`);
  const o = (k: string, v: string): readonly string[] => ["-o", `${k}=${v}`];
  return ok([
    config.program ?? "ssh",
    "-T",
    ...o("BatchMode", "yes"),
    ...o("ConnectTimeout", String(config.connectTimeoutSec ?? 10)),
    ...o("ServerAliveInterval", String(config.serverAliveSec ?? 15)),
    ...o("ServerAliveCountMax", "3"),
    ...o("StrictHostKeyChecking", "yes"),
    ...o("UserKnownHostsFile", `${config.knownHostsRepository} ${config.knownHostsUser}`),
    ...o("PasswordAuthentication", "no"),
    ...o("KbdInteractiveAuthentication", "no"),
    ...(config.controlDir === undefined ? [] : [...o("ControlMaster", "auto"), ...o("ControlPath", `${config.controlDir}/%C`), ...o("ControlPersist", "60")]),
    ...(identity === undefined ? [] : [...o("IdentitiesOnly", "yes"), "-i", identity]),
    ...(t.port === undefined ? [] : ["-p", String(t.port)]),
    ...(jump.value === "" ? [] : ["-J", jump.value]),
    "--",
    destination(t),
    remote,
  ]);
}
