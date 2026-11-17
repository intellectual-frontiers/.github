/**
 * `ifws`, the command of Intellectual Frontiers Workspaces (commons 0025-ifws): a controller in the style of `git`, which runs the module `ifws-<name>` for `ifws <name>`, found among the typed built-in
 * modules, the modules the workspace registers in `<home>/.if-workspaces/modules.auto.json` and the executables named `ifws-*` on the `PATH`, in that order. It manages only Intellectual Frontiers
 * Workspaces: it is not a general IFC or Mizan controller and does not front `ifc`.
 *
 * ```sh
 * bun commons/ts/workspaces/ifws.ts <module> [options]     # or: ifws <module> (the package's bin, on Bun or Node 26)
 * ```
 *
 * @remarks
 * A run ends in one of four statuses: 0 ok, 1 findings (a warning or an error; an informational finding alone is 0), 2 a command line that does not fit (an unknown module, command, option or
 * argument, or a name that is not a module name, which is never passed to a shell), 3 a host that cannot do it (no `git`, a root that does not exist or cannot be written, an evidence record that
 * cannot be written). Every run writes one evidence record under `<home>/.if-workspaces/evidence/`, in the shape of an IFQS test record, including a run that ends in 2 (a case that is `not_run`, with the
 * reason); the exceptions are the ones the specifications make (the printing form of `ifws shell`, a Git hook, help) and a run where the workspace's own area is not there to hold it.
 *
 * @module
 */
import process from "node:process";
import { absurd } from "../kernel/absurd.ts";
import { err, ok } from "../kernel/result.ts";
import { editDistance } from "../kernel/args.ts";
import { existsSync } from "../runtime/fs.ts";
import { join, resolve } from "../runtime/path.ts";
import { build, cwd as workingFolder, env as processEnv, runtimeName, runtimeVersion, run as runProgram } from "../runtime/proc.ts";
import { stderr, stdin, stdout } from "../runtime/stdio.ts";
import { BUILTIN_MODULES } from "./commands/mod.ts";
import { topHelp } from "./commands/list.ts";
import { writeEvidence } from "./host/evidence.ts";
import { discoverModules, runExternal } from "./host/discovery.ts";
import { terminalInteract } from "./host/interact.ts";
import { readManifest, AREA } from "./host/workspace.ts";
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
  type IfwsModule,
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
  readonly builtins?: readonly IfwsModule[];
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

/** Runs `ifws` with the words after its name; returns the exit status. */
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
      workspacesHome: environment["IFC_WORKSPACES_HOME"],
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
    outcome = err({ kind: "usage", message: "no module is named; the modules are listed above" });
  } else if (first === "--help" || first === "-h") {
    out(line(topHelp(builtins)));
    return 0;
  } else if (first.startsWith("-")) {
    outcome = err({
      kind: "usage",
      message: `${first} is not an option of ifws: options come after the module's name (\`ifws <module> ${first}\`); \`ifws --help\` lists the modules`,
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
                [`ifws ${mine.name}: ${mine.summary}`, "", ...mine.commands.map((c) => `  ifws ${mine.name} ${c.name}  ${c.summary}`)].join(
                  "\n",
                ),
              ),
            );
            return 0;
          case "unknown": {
            const near = nearestNames(d.word, d.known);
            outcome = err({
              kind: "usage",
              message: `${d.word} is not a command of ifws ${mine.name} (${d.known.join(", ")})${near.length === 0 ? "" : `; did you mean ${near.join(", ")}?`}`,
            });
            break;
          }
          default:
            return absurd(d);
        }
      } else {
        const ctx: Context = { ...base, globals: { json: false, sarif: false, noColor: false }, home: homeFor(homeWord(rest)) };
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
            message: `${named.value} is not an ifws module${near.length === 0 ? "; none is near it" : `; did you mean ${near.join(", ")}?`} (\`ifws list\` names them)`,
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
                : err({ kind: "environment", message: `${module.name}: the program ${ran.error.program} is not there` });
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

  // the output of the run
  const globals: Globals = executed?.globals ?? { json: false, sarif: false, noColor: false };
  let status: ExitStatus;
  let code: number;
  let facts: EvidenceFacts | undefined;
  let findings: Report["findings"] = [];
  let noEvidence = false;
  let notRun: string | undefined;
  if (outcome.kind === "ok") {
    const r = outcome.value;
    status = statusOfReport(r);
    code = external?.code ?? exitCodeOf(status);
    findings = r.findings;
    facts = r.facts;
    noEvidence = r.noEvidence === true;
    if (globals.sarif) out(line(JSON.stringify(toSarif(r.findings), null, 2)));
    else if (globals.json) out(line(JSON.stringify({ command, status, exitCode: code, data: r.data, findings: r.findings }, null, 2)));
    else if (r.text !== "") out(line(r.text));
  } else {
    status = outcome.error.kind === "usage" ? "Usage" : "Environment";
    code = exitCodeOf(status);
    notRun = outcome.error.message.split("\n")[0] ?? "";
    note(line(`ifws: ${executed === undefined ? "" : `${command}: `}${outcome.error.message}`));
  }

  // the evidence record, where the workspace has a place for it
  const home = homeFor(globals.home);
  if (!noEvidence && home !== undefined && existsSync(join(home, AREA))) {
    const policy = await readManifest(home, today);
    const regulated = policy.kind === "ok" && policy.value.policy.regulatedDomain.length > 0;
    const tools = [...(facts?.tools ?? []), { name: runtimeName(), version: runtimeVersion() }];
    if (regulated && !tools.some((t) => t.name === "git")) {
      const g = await runProgram(["git", "--version"]).catch(() => undefined);
      const v = g?.success === true ? /(\d+\.\d+(?:\.\d+)?)/.exec(g.stdout)?.[1] : undefined;
      if (v !== undefined) tools.push({ name: "git", version: v });
    }
    const written = await writeEvidence(
      home,
      {
        command,
        words,
        status,
        findings,
        ...(notRun === undefined ? {} : { notRun }),
        facts: { ...facts, tools },
        start,
        end: BigInt(now()) * 1_000_000n,
      },
      regulated,
    );
    if (written.kind === "err") {
      note(
        line(
          `ifws: the evidence record could not be written (${written.error.kind === "write" ? written.error.reason : written.error.reason}); the run is reported as a failure of the host`,
        ),
      );
      return exitCodeOf("Environment");
    }
  }
  return code;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
