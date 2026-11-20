// Spec: 0006-repoctl-surfaces FR-006
/**
 * `repoctl`, the operations program of this repository (commons repoctl 0006-repoctl-surfaces): a program on Headless. Its verbs are declared with the facts of their actions and Headless runs them: it parses the words, decides whether a
 * run proceeds, previews, asks or is refused, draws the output (the report on standard output; the problems, the verdict and the one `next:` command on standard error), explains the problem codes (`repoctl explain <code>`) and generates its
 * help, completions and man page. The tier the program holds is the host's (`REPOCTL_TIER`: public, contributor, releaser; contributor where it says nothing).
 *
 * ```sh
 * bun run repoctl check          # at the root of the repository
 * bun commons/repoctl/src/repoctl.ts <verb> [options]
 * ```
 *
 * @remarks
 * A run ends in Headless' statuses: 0 ok, 1 findings, 2 a command line that does not fit, 3 a host that cannot do it, 4 where a check finds something pending. The checkout is the nearest folder above the working folder that has
 * `commons/libraries/library.ts`.
 *
 * @example
 * ```ts
 * import { main } from "./repoctl.ts";
 * const status = await main(["help"], { cwd: "/tmp", out: () => undefined, err: () => undefined });
 * status; // 0
 * ```
 *
 * @module
 */
import process from "node:process";
import { err, ok } from "@intellectual-frontiers/core";
import { launch } from "@intellectual-frontiers/headless/cli";
import { rootAbove } from "@intellectual-frontiers/libraries/link";
import { env as processEnv, cwd as workingFolder } from "@intellectual-frontiers/system/proc";
import { heldTier, repoctlProgram, systemWorld } from "./physical/mod.ts";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  /** Where the report goes (standard output by default). */
  readonly out?: (text: string) => void;
  /** Where the problems and the verdict go (standard error by default). */
  readonly err?: (text: string) => void;
};

/** Runs `repoctl` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const environment = deps.env ?? processEnv.toObject();
  const env = (name: string): string | undefined => {
    const v = environment[name];
    return v === "" ? undefined : v;
  };
  const cwd = deps.cwd ?? workingFolder();
  const held = heldTier(env);
  if ("unknown" in held) {
    (deps.err ?? ((t: string) => void process.stderr.write(t)))(`repoctl: ${held.unknown} is not a tier (public, contributor, releaser)\n`);
    return 2;
  }
  const program = repoctlProgram({
    env,
    world: () => {
      const repo = rootAbove(cwd);
      return repo === undefined ? err("this folder is not in the repository: no commons/libraries/library.ts above it") : ok(systemWorld(repo, env));
    },
  });
  return await launch(program, {
    argv,
    io: {
      env,
      tier: held.tier,
      ...(deps.out === undefined && deps.err === undefined
        ? {}
        : { sink: { out: deps.out ?? ((t: string): void => void process.stdout.write(t)), err: deps.err ?? ((t: string): void => void process.stderr.write(t)) } }),
    },
  });
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
