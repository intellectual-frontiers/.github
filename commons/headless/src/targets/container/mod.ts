// Spec: 0005-reach-and-targets FR-011
/**
 * The container target (commons headless 0005-reach-and-targets FR-011): an `Executor` that runs a program in a running container through the container runtime (`docker` or `podman`): `exec` is the runtime's `exec`, `put` and `get`
 * are its `cp`, and `spawn` is `exec -i` with piped streams. Each call is an argument vector with no shell between, and a name that could be taken for an option is refused as a call that could not be made (255), as the ssh target does.
 *
 * @example
 * ```ts
 * import { containerExecutor } from "@intellectual-frontiers/headless/targets/container";
 * // const out = await containerExecutor("docker", "synthetic-server-02").exec(["systemctl", "is-system-running"]);
 * ```
 *
 * @module
 */
import { path, proc } from "@intellectual-frontiers/system";
import type { Executor, Output } from "@intellectual-frontiers/headless/logical";

/** The container runtimes whose command line this adapter speaks. */
export type Runtime = "docker" | "podman";

const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const refused = (message: string): Output => ({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode(`${message}\n`) });

/** The executor for one running container. */
export function containerExecutor(runtime: Runtime, container: string, deps: { readonly run?: (argv: readonly string[], opts?: proc.RunOptions) => Promise<Output> } = {}): Executor {
  const run = deps.run ?? ((argv, opts) => proc.output(argv, opts));
  const bad = NAME.test(container) ? undefined : `${JSON.stringify(container)} is not a container name`;
  const envArgs = (env: Readonly<Record<string, string>> | undefined): string[] => Object.entries(env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  return {
    exec(argv, opts = {}) {
      if (bad !== undefined) return Promise.resolve(refused(bad));
      if (argv.length === 0) return Promise.resolve(refused("there is nothing to run"));
      const { env: _env, cwd: _cwd, ...rest } = opts;
      const full = [runtime, "exec", ...(opts.input === undefined ? [] : ["-i"]), ...envArgs(opts.env), ...(opts.cwd === undefined ? [] : ["-w", opts.cwd]), container, ...argv];
      return run(full, rest);
    },
    async put(files, remoteDir, opts = {}) {
      if (bad !== undefined) return refused(bad);
      const made = await run([runtime, "exec", container, "mkdir", "-p", remoteDir], opts);
      if (!made.success) return made;
      let last = made;
      for (const f of files) {
        last = await run([runtime, "cp", f, `${container}:${path.join(remoteDir, path.basename(f))}`], opts);
        if (!last.success) return last;
      }
      return last;
    },
    get(remote, local, opts = {}) {
      if (bad !== undefined) return Promise.resolve(refused(bad));
      return run([runtime, "cp", `${container}:${remote}`, local], opts);
    },
    spawn(argv, opts = {}) {
      if (bad !== undefined) throw new Error(bad);
      return proc.spawn([runtime, "exec", "-i", ...envArgs(opts.env), container, ...argv], { ...opts, stdin: "piped", stdout: "piped", stderr: "piped" });
    },
  };
}
