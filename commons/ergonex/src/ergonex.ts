// Spec: 0002-workspace-model FR-046
/**
 * `ergonex`, the command of Intellectual Frontiers Workspaces (commons 0001-ergonex): a controller in the style of `git`, which runs the module `ergonex-<name>` for `ergonex <name>`, found among the typed built-in
 * modules, the modules the workspace registers in `<home>/.ergonex/modules.auto.json` and the executables named `ergonex-*` on the `PATH`, in that order. It manages only Intellectual Frontiers
 * Workspaces: it is not a general IFC or Mizan controller and does not front `ifc`.
 *
 * ```sh
 * bun commons/ts/workspaces/ergonex.ts <module> [options]     # or: ergonex <module> (the package's bin, on Bun or Node 26)
 * ```
 *
 * @remarks
 * A run ends in one of four statuses: 0 ok, 1 findings (a warning or an error; an informational finding alone is 0), 2 a command line that does not fit (an unknown module, command, option or
 * argument, or a name that is not a module name, which is never passed to a shell), 3 a host that cannot do it (no `git`, a root that does not exist or cannot be written, an evidence record that
 * cannot be written). Every run writes one evidence record under `<home>/.ergonex/evidence/`, in the shape of an IFQS test record, including a run that ends in 2 (a case that is `not_run`, with the
 * reason); the exceptions are the ones the specifications make (the printing form of `ergonex shell`, a Git hook, help) and a run where the workspace's own area is not there to hold it.
 *
 * Credits (commons 0002-workspace-model FR-046): the layout, and the ideas of `ensure`, `status` and `doctor`, are carried on from the earlier workspace tools, and their author is credited here; the ideas of a source
 * state and a target state, templates over data, `apply`, `diff`, `status`, `verify` and a state record are chezmoi's (Tom Payne and contributors, MIT license), taken as inspiration only: no chezmoi code
 * or program is used; and Git's `git-foo` convention, by which `git foo` runs the program `git-foo` found on the `PATH`, is the model of the modules of this command.
 *
 * @module
 */
import process from "node:process";
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { editDistance } from "./platform/k-args.ts";
import { existsSync } from "./platform/r-fs.ts";
import { join, resolve } from "./platform/r-path.ts";
import { build, cwd as workingFolder, env as processEnv, runtimeName, runtimeVersion, run as runProgram } from "./platform/r-proc.ts";
import { stderr, stdin, stdout } from "./platform/r-stdio.ts";
import { BUILTIN_MODULES } from "./commands/mod.ts";
import { topHelp } from "./commands/list.ts";
import { writeEvidence } from "./host/evidence.ts";
import { discoverModules, runExternal } from "./host/discovery.ts";
import { terminalInteract } from "./host/interact.ts";
import { readManifest, AREA, LOOPBACK_NOTICE, loopbackAllowed, loopbackFinding } from "./host/workspace.ts";
import { writeRunEvidence } from "./setup/host/evidence.ts";
import type { RunFacts } from "./setup/evidence.ts";
import { exitStatusOf, toSarif } from "./findings.ts";
import { homeOf } from "./layout.ts";
import { findModule } from "./modules/registry.ts";
import { moduleName, describeNameError, nearestNames } from "./modules/name.ts";
import {
  type BaseContext,
  type Context,
  dispatch,
  type Executed,
  type ExitStatus,
  exitCodeOf,
  type EvidenceFacts,
  type Globals,
  type ErgonexModule,
  type Interact,
  type Outcome,
  type Report,
} from "./modules/types.ts";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly out?: (text: string) => void;
  readonly err?: (text: string) => void;
  /** The modules held, built in: `BUILTIN_MODULES` by default. */
  readonly builtins?: readonly ErgonexModule[];
  readonly interact?: Interact;
  readonly stdin?: () => Promise<string>;
  /** The time in milliseconds since the Unix epoch. */
  readonly now?: () => number;
};

const line = (text: string): string => (text.endsWith("\n") ? text : `${text}\n`);

/** The `--home` an argument vector names, found without parsing the rest: only to look for a registered module, whose command then parses its words itself. */
function homeWord(words: readonly string[]): string | undefined {
  const i = words.indexOf("--home");
  if (i >= 0) return words[i + 1];
  return words.find((w) => w.startsWith("--home="))?.slice("--home=".length);
}

/** The status a report ends in. */
function statusOfReport(r: Report): ExitStatus {
  return r.status ?? exitStatusOf(r.findings);
}

/** Runs `ergonex` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const environment = deps.env ?? processEnv.toObject();
  const cwd = deps.cwd ?? workingFolder();
  const out = deps.out ?? ((t: string): void => void stdout.writeSync(t));
  const note = deps.err ?? ((t: string): void => void stderr.writeSync(t));
  const builtins = deps.builtins ?? BUILTIN_MODULES;
  const now = deps.now ?? Date.now;
  const start = BigInt(now()) * 1_000_000n;
  const today = new Date(now()).toISOString().slice(0, 10);
  const windows = build.os === "windows";

  const homeFor = (override: string | undefined): string | undefined => {
    const h = homeOf({
      override: override === undefined ? undefined : resolve(cwd, override),
      workspacesHome: environment["ERGONEX_HOME"],
      home: windows ? environment["USERPROFILE"] : environment["HOME"],
      windows,
    });
    return h.kind === "ok" ? h.value : undefined;
  };
  const base: BaseContext = {
    env: environment,
    cwd,
    today,
    platform: { os: build.os, arch: build.arch, windows },
    builtins,
    interact: deps.interact ?? terminalInteract(),
    homeFor,
    stdin: deps.stdin ?? (() => stdin.text()),
    note: (t) => note(line(t)),
  };

  // what the run is, as the evidence will say
  let command = "usage";
  let words: readonly string[] = argv;
  let executed: Executed | undefined;
  let external: { readonly code: number } | undefined;
  let outcome: Outcome;

  const [first, ...rest] = argv;
  if (first === undefined) {
    note(line(topHelp(builtins)));
    outcome = err({
      kind: "usage",
      message: "no module is named; the modules are listed above",
    });
  } else if (first === "--help" || first === "-h") {
    out(line(topHelp(builtins)));
    return 0;
  } else if (first.startsWith("-")) {
    outcome = err({
      kind: "usage",
      message: `${first} is not an option of ergonex: options come after the module's name (\`ergonex <module> ${first}\`); \`ergonex --help\` lists the modules`,
    });
  } else {
    const named = moduleName(first);
    if (named.kind === "err") {
      outcome = err({
        kind: "usage",
        message: `${JSON.stringify(first)} is not a module name: ${describeNameError(named.error)}; nothing was run`,
      });
    } else {
      command = named.value;
      words = rest;
      const mine = builtins.find((m) => m.name === named.value);
      if (mine !== undefined) {
        const d = dispatch(mine, rest);
        switch (d.kind) {
          case "command":
            executed = await d.command.execute(d.words, base);
            outcome = executed.outcome;
            if (mine.commands.length > 1) command = `${mine.name} ${d.command.name}`;
            break;
          case "help":
            out(
              line(
                [
                  `ergonex ${mine.name}: ${mine.summary}`,
                  "",
                  ...mine.commands.map((c) => `  ergonex ${mine.name} ${c.name}  ${c.summary}`),
                ].join("\n"),
              ),
            );
            return 0;
          case "unknown": {
            const near = nearestNames(d.word, d.known);
            outcome = err({
              kind: "usage",
              message: `${d.word} is not a command of ergonex ${mine.name} (${d.known.join(", ")})${near.length === 0 ? "" : `; did you mean ${near.join(", ")}?`}`,
            });
            break;
          }
          default:
            return absurd(d);
        }
      } else {
        const ctx: Context = {
          ...base,
          globals: { json: false, sarif: false, noColor: false },
          home: homeFor(homeWord(rest)),
        };
        const found = await discoverModules(ctx);
        const module = findModule(found.candidates, named.value);
        if (module === undefined) {
          const all = [
            ...builtins.map((m) => m.name),
            ...found.candidates.registered.map((m) => m.name),
            ...found.candidates.path.map((m) => m.name),
          ];
          const near = nearestNames(named.value, [...new Set(all)]).filter((n) => editDistance(named.value, n) <= 2);
          outcome = err({
            kind: "usage",
            message: `${named.value} is not an ergonex module${near.length === 0 ? "; none is near it" : `; did you mean ${near.join(", ")}?`} (\`ergonex list\` names them)`,
          });
        } else {
          const ran = await runExternal(module, found.registered, rest);
          if (ran.kind === "err") {
            outcome =
              ran.error.kind === "changed"
                ? err({
                    kind: "environment",
                    message: `${module.name}: the program ${ran.error.program} is not the one the workspace registered (its SHA-256 differs); it was not run`,
                  })
                : err({
                    kind: "environment",
                    message: `${module.name}: the program ${ran.error.program} is not there`,
                  });
          } else {
            external = { code: ran.value };
            outcome = ok({
              text: "",
              data: null,
              findings: [],
              status: ran.value === 0 ? "Ok" : ran.value === 2 ? "Usage" : ran.value === 3 ? "Environment" : "Findings",
            });
          }
        }
      }
    }
  }

  // the loopback switch is never silent: one line on standard error and an informational finding in the report (0002-workspace-model FR-037)
  const loopback = executed !== undefined && loopbackAllowed(environment);
  if (loopback) note(line(LOOPBACK_NOTICE));

  // the output of the run
  const globals: Globals = executed?.globals ?? {
    json: false,
    sarif: false,
    noColor: false,
  };
  let status: ExitStatus;
  let code: number;
  let facts: EvidenceFacts | undefined;
  let runFacts: RunFacts | undefined;
  let findings: Report["findings"] = [];
  let noEvidence: boolean;
  let notRun: string | undefined;
  if (outcome.kind === "ok") {
    const r = outcome.value;
    status = statusOfReport(r);
    code = external?.code ?? exitCodeOf(status);
    findings = loopback ? [...r.findings, loopbackFinding(today)] : r.findings;
    facts = r.facts;
    runFacts = r.runFacts;
    noEvidence = r.noEvidence === true;
    if (globals.sarif) out(line(JSON.stringify(toSarif(findings), null, 2)));
    else if (globals.json) out(line(JSON.stringify({ command, status, exitCode: code, data: r.data, findings }, null, 2)));
    else if (r.text !== "") out(line(r.text));
  } else {
    status = outcome.error.kind === "usage" ? "Usage" : "Environment";
    noEvidence = outcome.error.noEvidence === true;
    code = exitCodeOf(status);
    notRun = outcome.error.message.split("\n")[0] ?? "";
    note(line(`ergonex: ${executed === undefined ? "" : `${command}: `}${outcome.error.message}`));
  }

  // the evidence record, where the workspace has a place for it
  const home = homeFor(globals.home);
  if (!noEvidence && home !== undefined && existsSync(join(home, AREA))) {
    const policy = await readManifest(home, today, loopbackAllowed(environment));
    const regulated = policy.kind === "ok" && policy.value.policy.regulatedDomain.length > 0;
    const tools = [...(facts?.tools ?? []), { name: runtimeName(), version: runtimeVersion() }];
    if (regulated && !tools.some((t) => t.name === "git")) {
      const g = await runProgram(["git", "--version"]).catch(() => undefined);
      const v = g?.success === true ? /(\d+\.\d+(?:\.\d+)?)/.exec(g.stdout)?.[1] : undefined;
      if (v !== undefined) tools.push({ name: "git", version: v });
    }
    const end = BigInt(now()) * 1_000_000n;
    // the evidence of `setup` and `tools` is made by the setup module's writer from the facts of the run; every other run's by this one's
    const failure: string | undefined =
      runFacts !== undefined
        ? await writeRunEvidence({ home, start, end, env: environment }, { ...runFacts, exit: status }).then((w) =>
            w.kind === "err" ? w.error : undefined,
          )
        : await writeEvidence(
            home,
            {
              command,
              words,
              status,
              findings,
              ...(notRun === undefined ? {} : { notRun }),
              facts: { ...facts, tools },
              start,
              end,
            },
            regulated,
          ).then((w) => (w.kind === "err" ? w.error.reason : undefined));
    if (failure !== undefined) {
      note(line(`ergonex: the evidence record could not be written (${failure}); the run is reported as a failure of the host`));
      return exitCodeOf("Environment");
    }
  }
  return code;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
