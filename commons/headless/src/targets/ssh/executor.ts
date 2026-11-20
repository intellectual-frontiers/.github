// Spec: 0005-reach-and-targets FR-005, FR-006
/**
 * The ssh executor (commons headless 0005-reach-and-targets FR-005): an `Executor` that runs the program on a target through the system's OpenSSH client, with
 * the one set of options of `argv.ts`, and no SSH protocol of its own. The argument vector given to `exec` is quoted into the one remote command; a script is run
 * as `sh -s` with the script on the standard input, which is how a host with nothing of ours on it is first set up (no agent is needed on the server).
 *
 * @example
 * ```ts
 * import { sshExecutor } from "./executor.ts";
 * // const exec = sshExecutor(alpha, [alpha], config).exec; await exec(["ops", "run", "--json", "status"]);
 * ```
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import type { Executor, Output, RunOptions, Target } from "@intellectual-frontiers/headless/logical";
import { remoteCommand, shQuote, sshArgv, type SshConfig } from "./argv.ts";

/** Runs a local program: the system's `proc.output`, or a stand-in in a test. */
export type RunLocal = (argv: readonly string[], opts?: RunOptions) => Promise<Output>;

const refused = (message: string): Output => ({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode(`${message}\n`) });

/** The executor for one target; `run` is the system's by default. A call that cannot be made (a word with a NUL, a credential that does not resolve) is an exit of 255 with the reason, as a connection that did not happen. */
export function sshExecutor(t: Target, all: readonly Target[], config: SshConfig, run: RunLocal = (argv, opts) => proc.output(argv, opts)): Executor {
  return {
    exec(argv, opts = {}) {
      const remote = remoteCommand(argv);
      if (remote.kind === "err") return Promise.resolve(refused(remote.error));
      const full = sshArgv(t, all, config, remote.value);
      return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, opts);
    },
  };
}

/** Runs a script on a target as `sh -s -- <args>` with the script on its standard input: the bootstrap of a host that has no program of ours on it. */
export function runScript(t: Target, all: readonly Target[], config: SshConfig, script: string, args: readonly string[] = [], run: RunLocal = (argv, opts) => proc.output(argv, opts), opts: RunOptions = {}): Promise<Output> {
  const full = sshArgv(t, all, config, ["sh", "-s", "--", ...args].map(shQuote).join(" "));
  return full.kind === "err" ? Promise.resolve(refused(full.error)) : run(full.value, { ...opts, input: script });
}
