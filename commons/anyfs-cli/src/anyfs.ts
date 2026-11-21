// Spec: 0004-anyfs-cli-surfaces FR-016
/**
 * `anyfs`, the program (commons anyfs-cli 0004-anyfs-cli-surfaces FR-016): a command line on Headless over the stores of a configuration, or of the places a word names. Its words are parsed, a run proceeds, previews, asks
 * or is refused as the facts of its verbs say, the output is drawn (or the one JSON document of `--json`), the problems come with the verdict and the one `next:` command on standard error, and the program explains its
 * problem codes (`anyfs explain <code>`) and generates its help, completions and man page. The tier it holds is the one the variable `ANYFS_TIER` names: reader or writer, writer where it says nothing.
 *
 * ```sh
 * anyfs ls fleet:/machines
 * anyfs --config ci/anyfs.config.ts sync --dry-run ./fleet s3backup:/fleet
 * ```
 *
 * @remarks
 * A run ends in Headless' statuses: 0 ok, 1 findings (a name that is not there, two files that differ, a plan with conflicts), 2 a command line that does not fit, 3 a computer that cannot do it (a store that does not
 * open, a missing ssh program). `help`, `explain`, `places` and `doctor` run where there is no configuration, and say so.
 *
 * @example
 * ```ts
 * import { main } from "./anyfs.ts";
 * const status = await main(["help"], { cwd: "/tmp", out: () => undefined, err: () => undefined });
 * status; // 0
 * ```
 *
 * @module
 */
import process from "node:process";
import { launch } from "@intellectual-frontiers/headless/cli";
import type { RunLocal } from "@intellectual-frontiers/headless/targets/ssh";
import { EMPTY_CONFIG, type Config, type Host } from "@intellectual-frontiers/anyfs-cli/logical";
import { findConfigFile, loadConfigFile, type ConfigProblem } from "./physical/config-load.ts";
import { anyfsProgram, heldTier } from "./physical/program.ts";
import { processCwd, processEnvFn, systemWorld } from "./physical/world.ts";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  /** Where the report goes (standard output by default). */
  readonly out?: (text: string) => void;
  /** Where the problems and the verdict go (standard error by default). */
  readonly err?: (text: string) => void;
  readonly readStdin?: () => Promise<Uint8Array>;
  readonly writeStdout?: (bytes: Uint8Array) => void;
  /** The folder of the state; the program's own where it is left out. */
  readonly stateDir?: string;
  /** How the ssh program is run; the system's where it is left out. */
  readonly run?: RunLocal;
};

/** The words of the command line without `--config FILE` (or `--config=FILE`), and the file it named. */
export function takeConfigOption(argv: readonly string[]): { readonly argv: readonly string[]; readonly config: string | undefined } {
  const rest: string[] = [];
  let config: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") {
      rest.push(...argv.slice(i));
      break;
    }
    if (a === "--config") {
      config = argv[i + 1];
      i++;
    } else if (a.startsWith("--config=")) config = a.slice("--config=".length);
    else rest.push(a);
  }
  return { argv: rest, config };
}

/** Runs `anyfs` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const env = deps.env === undefined ? processEnvFn() : (name: string): string | undefined => (deps.env?.[name] === "" ? undefined : deps.env?.[name]);
  const cwd = deps.cwd ?? processCwd();
  const words = takeConfigOption(argv);
  const file = findConfigFile(cwd, words.config, env);
  let config: Config = EMPTY_CONFIG;
  let problem: ConfigProblem | undefined;
  if (file !== undefined) {
    const loaded = await loadConfigFile(file);
    if (loaded.kind === "ok") config = loaded.value;
    else problem = loaded.error;
  } else if (words.config !== undefined) problem = { code: "E-CONFIG-LOAD", message: `${words.config} does not exist` };
  const held = heldTier(env);
  if ("unknown" in held) {
    (deps.err ?? ((t: string) => void process.stderr.write(t)))(`anyfs: ${held.unknown} is not a tier (reader, writer)\n`);
    return 2;
  }
  const json = words.argv.slice(0, words.argv.indexOf("--") === -1 ? undefined : words.argv.indexOf("--")).includes("--json");
  const host: Host = {
    env,
    config,
    ...(problem === undefined ? {} : { configProblem: problem }),
    ...(file === undefined ? {} : { configFile: file }),
    world: systemWorld({ env, cwd, json, config, ...(deps.stateDir === undefined ? {} : { stateDir: deps.stateDir }), ...(deps.run === undefined ? {} : { run: deps.run }), ...(deps.readStdin === undefined ? {} : { readStdin: deps.readStdin }), ...(deps.writeStdout === undefined ? {} : { writeStdout: deps.writeStdout }) }),
  };
  const program = anyfsProgram(host, deps.run);
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
