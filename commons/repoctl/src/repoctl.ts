// Spec: 0006-repoctl-surfaces FR-006
/**
 * `repoctl`, the operations program of a repository (commons repoctl 0006-repoctl-surfaces; 0010-repoctl-host): a generic host on Headless driven by the typed configuration `repoctl.config.ts` at the root of the repository it operates (or the file
 * `--config FILE` names). Its verbs are declared with the facts of their actions and Headless runs them: it parses the words, decides whether a run proceeds, previews, asks or is refused, draws the output (the report on standard output; the
 * problems, the verdict and the one `next:` command on standard error), explains the problem codes (`repoctl explain <code>`) and generates its help, completions and man page. The tier the program holds is the host's (the configuration names the
 * variable, `REPOCTL_TIER` by default: public, contributor, releaser; contributor where it says nothing).
 *
 * ```sh
 * repoctl check                          # at the root of a repository that has a repoctl.config.ts
 * repoctl --config ci/repoctl.config.ts sync --check
 * ```
 *
 * @remarks
 * A run ends in Headless' statuses: 0 ok, 1 findings, 2 a command line that does not fit, 3 a host that cannot do it (a repository with no usable configuration is one), 4 where a check finds something pending. The repository's root is the folder
 * of the configuration file. `help`, `explain` and `doctor` run where there is no configuration, and say so.
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
import { launch } from "@intellectual-frontiers/headless/cli";
import { ok } from "@intellectual-frontiers/core";
import { env as processEnv, cwd as workingFolder } from "@intellectual-frontiers/system/proc";
import { dirname } from "@intellectual-frontiers/system/path";
import { bareConfig, findConfigFile, heldTier, loadConfigFile, repoctlProgram, systemWorld, type ConfigProblem, type Host } from "./physical/mod.ts";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  /** Where the report goes (standard output by default). */
  readonly out?: (text: string) => void;
  /** Where the problems and the verdict go (standard error by default). */
  readonly err?: (text: string) => void;
};

/** The words of the command line without `--config FILE` (or `--config=FILE`), and the file it named. */
export function takeConfigOption(argv: readonly string[]): { readonly argv: readonly string[]; readonly config: string | undefined } {
  const rest: string[] = [];
  let config: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--config") {
      config = argv[i + 1];
      i++;
    } else if (a.startsWith("--config=")) config = a.slice("--config=".length);
    else rest.push(a);
  }
  return { argv: rest, config };
}

/** Runs `repoctl` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const environment = deps.env ?? processEnv.toObject();
  const env = (name: string): string | undefined => {
    const v = environment[name];
    return v === "" ? undefined : v;
  };
  const cwd = deps.cwd ?? workingFolder();
  const words = takeConfigOption(argv);
  const file = findConfigFile(cwd, words.config);
  let problem: ConfigProblem | undefined;
  let root = cwd;
  let config = bareConfig();
  if (file === undefined) problem = { code: "E-CONFIG-MISSING", message: words.config === undefined ? "no repoctl.config.ts in this folder or above it" : `${words.config} does not exist` };
  else {
    const loaded = await loadConfigFile(file);
    if (loaded.kind === "ok") {
      root = loaded.value.root;
      config = loaded.value.config;
    } else {
      problem = loaded.error;
      root = dirname(file);
    }
  }
  const held = heldTier(env, config);
  if ("unknown" in held) {
    (deps.err ?? ((t: string) => void process.stderr.write(t)))(`repoctl: ${held.unknown} is not a tier (public, contributor, releaser)\n`);
    return 2;
  }
  const host: Host = { env, config, ...(problem === undefined ? {} : { configProblem: problem }), world: () => ok(systemWorld(root, env, config)) };
  const program = repoctlProgram(host);
  return await launch(program, {
    argv: words.argv,
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
