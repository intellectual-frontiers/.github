// Spec: 0002-workspace-model FR-046
/**
 * `ergonex`, the command of Intellectual Frontiers Workspaces (commons 0001-ergonex): a program on Headless (`@intellectual-frontiers/headless`), the first real one. Its commands are declared in `commands/` with the facts of their actions
 * (what they may change, whether repeating them is safe, whether they preview) and Headless runs them: it parses the words, decides whether a run proceeds, previews, asks or is refused, draws the output (the report on standard output; the
 * problems, the verdict and the one `next:` command on standard error), writes the run log and keeps the hints in `<XDG_STATE_HOME>/ergonex`, explains its problem codes (`ergonex explain <code>`) and generates its help, completions and
 * man page. It manages only Intellectual Frontiers Workspaces: it is not a general IFC or Mizan controller and does not front `ifc`.
 *
 * ```sh
 * bun commons/ergonex/src/ergonex.ts <command> [options]     # or: ergonex <command> (the package's bin, on Bun or Node 26)
 * ```
 *
 * @remarks
 * A run ends in Headless' statuses: 0 ok, 1 findings (a warning or an error; an informational finding alone is 0), 2 a command line that does not fit, 3 a host that cannot do it (no `git`, a root that does not exist or cannot be written, an
 * evidence record that cannot be written), 4 where a check finds something pending. Every run of a command writes one evidence record under `<state>/evidence/`, in the shape of an IFQS test record (commands/define.ts); the exceptions are the
 * ones the specifications make (the printing form of `ergonex shell print`, a Git hook, a preview) and a run where the workspace's own area is not there to hold it.
 *
 * Git's convention is the model of the modules (`git foo` runs `git-foo`): where the first word is not a command of the program and a module `ergonex-<word>` is found (registered by the workspace or on the `PATH`), that program runs.
 *
 * Credits (commons 0002-workspace-model FR-046): the layout, and the ideas of `ensure`, `status` and `doctor`, are carried on from the earlier workspace tools, and their author is credited here; the ideas of a source
 * state and a target state, templates over data, `apply`, `diff`, `status`, `verify` and a state record are chezmoi's (Tom Payne and contributors, MIT license), taken as inspiration only: no chezmoi code
 * or program is used; and Git's `git-foo` convention, by which `git foo` runs the program `git-foo` found on the `PATH`, is the model of the modules of this command.
 *
 * @module
 */
import process from "node:process";
import { launch, type Io } from "@intellectual-frontiers/headless/cli";
import { BUILT_IN_WORDS } from "@intellectual-frontiers/headless/logical";
import { existsSync } from "./platform/r-fs.ts";
import { resolve } from "./platform/r-path.ts";
import { build, cwd as workingFolder, env as processEnv } from "./platform/r-proc.ts";
import { stdin, stdout, stderr } from "./platform/r-stdio.ts";
import { exitCodeOf } from "./modules/types.ts";
import { ergonexProgram, modulesOf, type ProgramHost } from "./commands/program.ts";
import { recordEvidence } from "./commands/define.ts";
import { discoverModules, runExternal } from "./host/discovery.ts";
import { placesOf } from "./host/locations.ts";
import { homeOf } from "./layout.ts";
import { findModule } from "./modules/registry.ts";
import { moduleName } from "./modules/name.ts";
import type { Context } from "./modules/types.ts";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  /** Where the report goes (standard output by default). */
  readonly out?: (text: string) => void;
  /** Where the problems and the verdict go (standard error by default). */
  readonly err?: (text: string) => void;
  /** What of the world of the run to replace (a terminal that answers, a line of input, a store of state): the rest is the process's. */
  readonly io?: Partial<Io>;
  readonly stdin?: () => Promise<string>;
  /** The time in milliseconds since the Unix epoch. */
  readonly now?: () => number;
};

/** The `--home` an argument vector names, found without parsing the rest: only to look for a registered module, whose command then parses its words itself. */
function homeWord(words: readonly string[]): string | undefined {
  const i = words.indexOf("--home");
  if (i >= 0) return words[i + 1];
  return words.find((w) => w.startsWith("--home="))?.slice("--home=".length);
}

/** Runs `ergonex` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const environment = deps.env ?? processEnv.toObject();
  const cwd = deps.cwd ?? workingFolder();
  const now = deps.now ?? Date.now;
  const windows = build.os === "windows";
  const os = build.os === "darwin" ? "darwin" : build.os === "windows" ? "windows" : "linux";
  const placed = placesOf((name) => environment[name], os);
  const homeFor = (override: string | undefined): string | undefined => {
    const h = homeOf({
      override: override === undefined ? undefined : resolve(cwd, override),
      workspacesHome: environment["ERGONEX_HOME"],
      home: windows ? environment["USERPROFILE"] : environment["HOME"],
      windows,
    });
    return h.kind === "ok" ? h.value : undefined;
  };
  const host: ProgramHost = {
    env: environment,
    cwd,
    today: new Date(now()).toISOString().slice(0, 10),
    platform: { os: build.os, arch: build.arch, windows },
    places: placed.kind === "ok" ? placed.value : undefined,
    homeFor,
    stdin: deps.stdin ?? (() => stdin.text()),
    argv,
    now,
  };
  const program = ergonexProgram(host);

  // a word that is not a command of the program may name a module, as `git foo` runs `git-foo`
  const [first, ...rest] = argv;
  const named = first === undefined || first.startsWith("-") ? undefined : moduleName(first);
  if (first !== undefined && named?.kind === "ok" && !program.children.some((n) => n.name === first) && !(BUILT_IN_WORDS as readonly string[]).includes(first)) {
    const ctx: Context = {
      ...host,
      builtins: modulesOf(program.children),
      interact: { terminal: false, confirm: () => Promise.resolve(undefined) },
      note: () => undefined,
      globals: {},
      home: homeFor(homeWord(rest)),
      mode: "apply",
    };
    const start = BigInt(now()) * 1_000_000n;
    const found = await discoverModules(ctx);
    const module = findModule(found.candidates, named.value);
    if (module !== undefined) {
      const ran = await runExternal(module, found.registered, rest);
      const code = ran.kind === "ok" ? ran.value : exitCodeOf("Environment");
      if (ran.kind === "err")
        stderr.writeSync(
          `ergonex: ${module.name}: the program ${ran.error.program} is ${ran.error.kind === "changed" ? "not the one the workspace registered (its SHA-256 differs); it was not run" : "not there"}\n`,
        );
      const status = code === 0 ? "Ok" : code === 2 ? "Usage" : code === 3 ? "Environment" : "Findings";
      const home = ctx.home;
      if (home !== undefined && existsSync(home)) await recordEvidence(ctx, host, named.value, start, { status, findings: [] });
      return code;
    }
  }

  return await launch(program, {
    argv,
    io: {
      env: (n) => {
        const v = environment[n];
        return v === "" ? undefined : v;
      },
      ...(deps.out === undefined && deps.err === undefined
        ? {}
        : {
            sink: {
              out: deps.out ?? ((t: string): void => void stdout.writeSync(t)),
              err: deps.err ?? ((t: string): void => void stderr.writeSync(t)),
            },
          }),
      ...deps.io,
    },
  });
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
