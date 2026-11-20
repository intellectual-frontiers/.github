// Spec: 0005-reach-and-targets FR-005, FR-006
// Spec: 0007-ssh-coverage FR-001, FR-003, FR-006
/**
 * The one place the arguments of the system's OpenSSH client are made (commons headless 0005-reach-and-targets FR-005, FR-006; 0007-ssh-coverage FR-001, FR-003, FR-006). `ssh` joins what
 * it is given after the host into one string for the remote shell; `proc.run` does not, so the remote command is quoted here word by word and sent as ONE argument. The options every
 * call needs are here and nowhere else, in three families: `batch` (never a question: `BatchMode`, a connect time out, keep-alive, no terminal, a host key that does not match is
 * refused, the repository's known hosts then the user's), `pinned` (the same with only the one file of the keys pinned for this host) and `interactive` (the client may ask, for a
 * password or a passphrase, and only where the action's reach policy says it needs a terminal). The files are copied by `scp` with the same care: argv only, no shell expansion.
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
import { interactiveAllowed, type ReachPolicy } from "@intellectual-frontiers/headless/governance";
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

/** The families of options: `batch` never asks, `pinned` trusts only the keys pinned for the host, `interactive` may ask (for a password or a passphrase). */
export type SshFamily = "batch" | "pinned" | "interactive";

/** What the client's calls are configured with: the files of known hosts, where the shared connections live, the times, the family, and how a credential reference becomes a key file. */
export type SshConfig = {
  /** The program, `ssh` by default. */
  readonly program?: string;
  /** The program that copies files, `scp` by default. */
  readonly scpProgram?: string;
  /** The repository's known hosts (from Git), consulted first; for the family `pinned`, the one file of the keys pinned for the host (often a temporary file). */
  readonly knownHostsRepository: string;
  /** The user's known hosts, consulted after; not consulted in the family `pinned`. */
  readonly knownHostsUser: string;
  /** The folder the control sockets are in; with none, the connection is not shared. */
  readonly controlDir?: string;
  readonly connectTimeoutSec?: number;
  readonly serverAliveSec?: number;
  /** `batch` by default. */
  readonly family?: SshFamily;
  /** Whether a terminal is asked of the remote (`-t`); only in the family `interactive`. */
  readonly pty?: boolean;
  /** The path of the key file a credential reference names (never a key's value); a reference it does not know is an error. */
  readonly identityFor?: (name: string) => string | undefined;
};

/**
 * The configuration for an action: the family `interactive` and a terminal are allowed only where the action's reach policy says it needs a terminal (`needsTty`), which no channel
 * but a person's own terminal has; anything else keeps the family it was given, `batch` by default.
 */
export function configForReach(config: SshConfig, reach: ReachPolicy, family: SshFamily, pty = false): Result<SshConfig, string> {
  if ((family === "interactive" || pty) && !interactiveAllowed(reach)) return err("an interactive ssh call, or a terminal, needs the action's reach policy to say it needs a terminal (needsTty)");
  if (pty && family !== "interactive") return err("a terminal is asked only in the family interactive");
  return ok({ ...config, family, pty });
}

const NO_SPACE = /^\S+$/;

/** The destination of a target, `user@host`; an IPv6 address is in brackets where scp needs them. */
function destination(t: Target, bracket = false): string {
  const host = bracket && t.address.includes(":") ? `[${t.address}]` : t.address;
  return t.user === undefined ? host : `${t.user}@${host}`;
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

const o = (k: string, v: string): readonly string[] => ["-o", `${k}=${v}`];

/** The options of the connection that `ssh` and `scp` share: the times, the host key policy, the family's rules, the shared connection, the key by reference and the jump chain. The port is the caller's (`-p` for ssh, `-P` for scp). */
function connectionOptions(t: Target, all: readonly Target[], config: SshConfig): Result<readonly string[], string> {
  if (!NO_SPACE.test(config.knownHostsRepository) || !NO_SPACE.test(config.knownHostsUser)) return err("the paths of the known-hosts files may not hold a space");
  const family = config.family ?? "batch";
  if (config.pty === true && family !== "interactive") return err("a terminal is asked only in the family interactive");
  const jump = jumpChain(t, all);
  if (jump.kind === "err") return jump;
  const identity = t.credential === undefined ? undefined : config.identityFor?.(t.credential.name);
  if (t.credential !== undefined && identity === undefined) return err(`${t.id}: the credential ${t.credential.name} is not one this program can resolve`);
  const known = family === "pinned" ? config.knownHostsRepository : `${config.knownHostsRepository} ${config.knownHostsUser}`;
  return ok([
    ...(family === "interactive" ? [] : o("BatchMode", "yes")),
    ...o("ConnectTimeout", String(config.connectTimeoutSec ?? 10)),
    ...o("ServerAliveInterval", String(config.serverAliveSec ?? 15)),
    ...o("ServerAliveCountMax", "3"),
    ...o("StrictHostKeyChecking", "yes"),
    ...o("UserKnownHostsFile", known),
    ...(family === "interactive" ? [] : [...o("PasswordAuthentication", "no"), ...o("KbdInteractiveAuthentication", "no")]),
    ...(config.controlDir === undefined ? [] : [...o("ControlMaster", "auto"), ...o("ControlPath", `${config.controlDir}/%C`), ...o("ControlPersist", "60")]),
    ...(identity === undefined ? [] : [...o("IdentitiesOnly", "yes"), "-i", identity]),
    ...(jump.value === "" ? [] : ["-J", jump.value]),
  ]);
}

/**
 * The argument vector that runs `remote` (already one string, see `remoteCommand`) on a target: `-T` (no terminal; `-t` only where the interactive family is given a terminal), the
 * options of the family, the port, then `--` and the destination so that nothing after it can be read as an option. Nothing here accepts a host key: there is no `accept-new` and no `no`.
 */
export function sshArgv(t: Target, all: readonly Target[], config: SshConfig, remote: string): Result<readonly string[], string> {
  const common = connectionOptions(t, all, config);
  if (common.kind === "err") return common;
  return ok([config.program ?? "ssh", config.pty === true ? "-t" : "-T", ...common.value, ...(t.port === undefined ? [] : ["-p", String(t.port)]), "--", destination(t), remote]);
}

/** A remote path that a remote shell cannot expand or split: letters, digits and `_@%+=:,./-`; no space, quote, glob, `$`, backtick, `;`, `&`, `|`, `<`, `>`, parenthesis, brace, `~` or backslash. */
export function safeRemotePath(path: string): boolean {
  return path !== "" && SAFE.test(path) && !path.startsWith("-") && !path.includes("..");
}

/** A local path as an argument of scp: one that begins with a dash, or that holds a colon (which scp reads as `host:path`), is made relative with `./`. */
export function localForScp(path: string): string {
  return path.startsWith("-") || (path.includes(":") && !/^[A-Za-z]:[\\/]/.test(path) && !path.startsWith("/") && !path.startsWith("./")) ? `./${path}` : path;
}

/** What to copy: the files to put in a remote folder, or a remote file to get to a local path. */
export type Transfer = { readonly kind: "put"; readonly files: readonly string[]; readonly remoteDir: string } | { readonly kind: "get"; readonly remote: string; readonly local: string };

/**
 * The argument vector of `scp` for a transfer: `-q`, the options of the family, the port as `-P`, `--`, then the files and the remote place as `user@host:path`. Every word is its own
 * argument, nothing goes through a shell here, and a remote path that a remote shell could expand or split is refused (the legacy protocol reads it with a shell).
 */
export function scpArgv(t: Target, all: readonly Target[], config: SshConfig, transfer: Transfer): Result<readonly string[], string> {
  if (config.pty === true) return err("a file is not copied through a terminal");
  const common = connectionOptions(t, all, config);
  if (common.kind === "err") return common;
  const remote = transfer.kind === "put" ? transfer.remoteDir : transfer.remote;
  if (!safeRemotePath(remote)) return err(`${JSON.stringify(remote)} is not a remote path that a shell cannot expand: letters, digits and _@%+=:,./- only`);
  const place = `${destination(t, true)}:${remote}${transfer.kind === "put" ? "/" : ""}`;
  const files = transfer.kind === "put" ? transfer.files : [];
  if (transfer.kind === "put" && files.length === 0) return err("there is nothing to copy");
  if ([...files, transfer.kind === "get" ? transfer.local : ""].some((f) => f.includes("\u0000"))) return err("a path holds a NUL");
  const head = [config.scpProgram ?? "scp", "-q", ...common.value, ...(t.port === undefined ? [] : ["-P", String(t.port)]), "--"];
  return ok(transfer.kind === "put" ? [...head, ...files.map(localForScp), place] : [...head, place, localForScp(transfer.local)]);
}
