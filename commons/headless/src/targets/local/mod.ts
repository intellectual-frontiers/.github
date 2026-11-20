// Spec: 0005-reach-and-targets FR-004
// Spec: 0007-ssh-coverage FR-003, FR-004
/**
 * The local target (commons headless 0005-reach-and-targets FR-004; 0007-ssh-coverage FR-003, FR-004): an `Executor` that runs the program here, through the system's `proc`. It adds
 * nothing and takes nothing away: the options and the output are `proc`'s own, so a command run here is the command run anywhere else, with only the executor changed. `put` and `get`
 * copy files with the system's file functions (no shell), and `spawn` starts the program with piped streams.
 *
 * @example
 * ```ts
 * import { localExecutor } from "@intellectual-frontiers/headless/targets/local";
 * // const out = await localExecutor().exec(["git", "--version"]);
 * ```
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import type { Executor, Output } from "@intellectual-frontiers/headless/logical";

const done = (code: number, message = ""): Output => ({ code, success: code === 0, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode(message === "" ? "" : `${message}\n`) });

/** The executor that runs a program on this machine. */
export function localExecutor(): Executor {
  return {
    exec: (argv, opts) => proc.output(argv, opts),
    async put(files, remoteDir) {
      try {
        await fs.mkdir(remoteDir, { recursive: true });
        for (const f of files) await fs.copyFile(f, path.join(remoteDir, path.basename(f)));
        return done(0);
      } catch (e) {
        return done(1, e instanceof Error ? e.message : String(e));
      }
    },
    async get(remote, local) {
      try {
        await fs.copyFile(remote, local);
        return done(0);
      } catch (e) {
        return done(1, e instanceof Error ? e.message : String(e));
      }
    },
    spawn: (argv, opts) => proc.spawn(argv, { ...opts, stdin: "piped", stdout: "piped", stderr: "piped" }),
  };
}
