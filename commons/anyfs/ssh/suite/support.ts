/**
 * What the tests stand a host on: an executor that runs the real helper on this computer, in a folder of its own, by the same path an ssh executor takes (the argument vector is quoted into one
 * command that a shell reads back), so that what the store sends is quoted, run and answered as it would be over ssh. The shell the helper runs under, and the tools the host has, are chosen.
 *
 * @module
 */
import { remoteCommand } from "@intellectual-frontiers/headless/targets/ssh";
import type { Executor, Output, RunOptions } from "@intellectual-frontiers/headless/logical";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** The utilities the helper uses besides the shell's own. */
export const UTILITIES = ["cat", "mkdir", "rm", "mv", "ln", "find", "sort", "head", "wc", "sleep", "kill", "stat", "chmod", "rmdir", "sed", "date"] as const;

/** A host of the tests. */
export type FakeHost = {
  readonly executor: Executor;
  /** The argument vectors the executor was given. */
  readonly calls: string[][];
  /** The folder of the host that stands for the account's home. */
  readonly home: string;
  /** A folder of the host to make a store in. */
  readonly root: string;
  readonly cleanup: () => Promise<void>;
};

/** What the fake host is made with. */
export type FakeOptions = {
  /** The shell that `sh` is on the host: `dash` or `bash`. `sh` of this computer where left out. */
  readonly shell?: string;
  /** The tools of the SHA-256 the host has: all of what this computer has where left out; `[]` for a host with none. */
  readonly hashTools?: readonly string[];
  /** Answers every call as a lost connection. */
  readonly lost?: boolean;
};

/** A tool of the system's own folders: never one that a wrapper earlier in the path stands in for. */
const system = (tool: string): string | undefined => ["/usr/bin", "/bin", "/usr/local/bin"].map((d) => `${d}/${tool}`).find((f) => proc.isExecutable(f));

const HASH_TOOLS = ["sha256sum", "shasum", "openssl", "sha256"] as const;

const refusedOutput = (message: string): Output => ({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode(`${message}\n`) });

/** A host on this computer. */
export async function fakeHost(options: FakeOptions = {}): Promise<FakeHost> {
  const base = await fs.realPath(await fs.makeTempDir({ prefix: "anyfs-ssh-" }));
  const bin = path.join(base, "bin");
  const home = path.join(base, "home");
  const root = path.join(base, "fleet");
  await fs.mkdir(bin, { recursive: true });
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(root, { recursive: true });
  const shell = system(options.shell ?? "sh");
  if (shell === undefined) throw new Error(`there is no ${options.shell ?? "sh"} on this computer`);
  await fs.symlink(shell, path.join(bin, "sh"));
  for (const tool of [...UTILITIES, ...(options.hashTools ?? HASH_TOOLS)]) {
    const there = system(tool);
    if (there !== undefined) await fs.symlink(there, path.join(bin, tool));
  }
  const env = { PATH: bin, HOME: home, LC_ALL: "C" };
  const calls: string[][] = [];
  const executor: Executor = {
    exec(argv: readonly string[], opts: RunOptions = {}) {
      calls.push([...argv]);
      if (options.lost === true) return Promise.resolve(refusedOutput("ssh: connect to host example port 22: Connection timed out"));
      const remote = remoteCommand(argv);
      if (remote.kind === "err") return Promise.resolve(refusedOutput(remote.error));
      return proc.output(["/bin/sh", "-c", remote.value], { env, clearEnv: true, ...(opts.input === undefined ? { stdin: "null" as const } : { input: opts.input }), ...(opts.signal === undefined ? {} : { signal: opts.signal }) });
    },
  };
  return { executor, calls, home, root, cleanup: () => fs.remove(base, { recursive: true }) };
}

/** Runs the helper script itself, by a shell, in the way a host runs it: the script as the argument of `sh -c`. */
export async function runHelper(host: FakeHost, script: string, command: string, args: readonly string[], input?: Uint8Array): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
  const out = await host.executor.exec(["sh", "-c", script, "anyfs-helper", command, host.root, ...args], input === undefined ? {} : { input });
  return { code: out.code, stdout: new TextDecoder().decode(out.stdout), stderr: new TextDecoder().decode(out.stderr) };
}
