// Spec: 0005-reach-and-targets FR-005, FR-006
// Spec: 0007-ssh-coverage FR-003, FR-004
/**
 * The ssh executor (commons headless 0005-reach-and-targets FR-005; 0007-ssh-coverage FR-003, FR-004): an `Executor` that runs the program on a target through the system's OpenSSH
 * client, with the one set of options of `argv.ts`, and no SSH protocol of its own. The argument vector given to `exec` is quoted into the one remote command (and `exec` gives its
 * output when the program has ended: it does not stream); `put` and `get` copy files with `scp`; `spawn` starts the client with piped streams for a protocol talked over its standard input
 * and output (an MCP server over `ssh -T`); a script is run as `sh -s` with the script on the standard input, which is how a host with nothing of ours on it is first set up.
 *
 * @example
 * ```ts
 * import { sshExecutor } from "./executor.ts";
 * // const ex = sshExecutor(alpha, [alpha], config); await ex.exec(["ops", "run", "--json", "status"]); const s = ex.spawn?.(["ops", "mcp"]);
 * ```
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import type { Executor, Output, RunOptions, Session, SpawnOptions, Target } from "@intellectual-frontiers/headless/logical";
import { remoteCommand, scpArgv, shQuote, sshArgv, type SshConfig } from "./argv.ts";

/** Runs a local program: the system's `proc.output`, or a stand-in in a test. */
export type RunLocal = (argv: readonly string[], opts?: RunOptions) => Promise<Output>;

/** Starts a local program with piped streams: the system's `proc.spawn`, or a stand-in in a test. */
export type SpawnLocal = (argv: readonly string[], opts?: SpawnOptions) => Session;

/** What the executor runs the client with: both default to the system's. */
export type SshDeps = { readonly run?: RunLocal; readonly spawn?: SpawnLocal };

const refused = (message: string): Output => ({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode(`${message}\n`) });

const systemRun: RunLocal = (argv, opts) => proc.output(argv, opts);
const systemSpawn: SpawnLocal = (argv, opts) => proc.spawn(argv, { ...opts, stdin: "piped", stdout: "piped", stderr: "piped" });

/** The executor for one target; `deps` are the system's by default (a function is taken as `run`, as before). A call that cannot be made (a word with a NUL, a credential that does not resolve, a path a shell could expand) is an exit of 255 with the reason, as a connection that did not happen; `spawn` throws it, there being no output to give it in. */
export function sshExecutor(t: Target, all: readonly Target[], config: SshConfig, deps: SshDeps | RunLocal = {}): Executor {
  const d: SshDeps = typeof deps === "function" ? { run: deps } : deps;
  const run = d.run ?? systemRun;
  const spawnLocal = d.spawn ?? systemSpawn;
  return {
    exec(argv, opts = {}) {
      const remote = remoteCommand(argv);
      if (remote.kind === "err") return Promise.resolve(refused(remote.error));
      const full = sshArgv(t, all, config, remote.value);
      return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, opts);
    },
    put(files, remoteDir, opts = {}) {
      const full = scpArgv(t, all, config, { kind: "put", files, remoteDir });
      return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, opts);
    },
    get(remote, local, opts = {}) {
      const full = scpArgv(t, all, config, { kind: "get", remote, local });
      return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, opts);
    },
    spawn(argv, opts = {}) {
      const remote = remoteCommand(argv);
      if (remote.kind === "err") throw new Error(remote.error);
      const full = sshArgv(t, all, config, remote.value);
      if (full.kind === "err") throw new Error(full.error);
      return spawnLocal(full.value, opts);
    },
  };
}

/** Runs a script on a target as `sh -s -- <args>` with the script on its standard input: the bootstrap of a host that has no program of ours on it. */
export function runScript(t: Target, all: readonly Target[], config: SshConfig, script: string, args: readonly string[] = [], run: RunLocal = systemRun, opts: RunOptions = {}): Promise<Output> {
  const full = sshArgv(t, all, config, ["sh", "-s", "--", ...args].map(shQuote).join(" "));
  return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, { ...opts, input: script });
}
