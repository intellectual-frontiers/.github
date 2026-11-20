// Spec: 0001-ergonex FR-017
/**
 * `ergonex setup` (commons 0001-ergonex FR-017 to FR-020, 0002-workspace-model FR-030, FR-038, FR-039): shows its plan first and, unless `--apply` is given, changes nothing; with `--apply` it creates the
 * root and a starter manifest where there is none, installs the pinned artifacts of the catalog for this system (a hash that differs writes nothing), verifies `git`, `bun` and `node` by probes and
 * never installs them, on Windows sets `core.longpaths` in each repository's local configuration and the system setting where elevated (else returns the exact steps), and, with `--git-include`,
 * adds one marked `[include]` to the global Git configuration after showing the exact change and asking.
 *
 * @remarks
 * `setup(args, deps)` returns a `Result` of a report; the lead wires it as the module `ergonex setup` (M5's `ErgonexModule` contract is not in this tree). It is the ONLY function that carries out a
 * step with `ergonex:hostChange` (`InstallTool`, `SetSystemLongPaths`, `AddGitInclude`), and only where `args.apply` is true: `applyStep` is not exported. The report holds the run's facts for the
 * evidence record (`facts`), which the controller writes with `writeRunEvidence`.
 *
 * @limits The system long-path setting runs `reg add` and is not tested here (it needs Windows and an elevated process; a test gives the function that stands for it). The shell snippet block
 * (`ergonex shell --install`) is the shell module's.
 *
 * @module
 */
import { movedPath, type Places } from "../../places.ts";
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto";
import { exists, mkdir, readTextOr, writeTextFile } from "../../platform/r-fs.ts";
import type { Transport } from "../../platform/r-http-client.ts";
import { acquireLock } from "../../platform/r-lock.ts";
import { dirname, join } from "../../platform/r-path.ts";
import { NotFound } from "../../platform/r-errors.ts";
import { output } from "../../platform/r-proc.ts";
import { type Finding, exitStatusOf } from "../../findings.ts";
import { policyOf, type Policy } from "../../policy.ts";
import { resolveInside } from "../../scan/boundary.ts";
import { type ToolArch, type ToolCatalog, type ToolOs, toolNamed } from "../../tools/catalog.ts";
import { describeInstallError } from "../../tools/install.ts";
import { type Probe, probedVersions } from "../../tools/probe.ts";
import { installTool, verifyTool } from "../../tools/host/install.ts";
import type { RepoPath } from "../../types.ts";
import type { RunFacts } from "../evidence.ts";
import { changeShown, includeBlock, withInclude } from "../gitconfig.ts";
import {
  type SetupArgs,
  type SetupPlan,
  type SetupFacts,
  type SetupStep,
  setupPlan,
  showPlan,
  stepChangesHost,
  describeStep,
} from "../plan.ts";
import { MANIFEST_FILE, starterManifest } from "../starter.ts";
import { longPathsCommand, repoLongPathsCommand } from "../windows.ts";

/** What `ergonex setup` needs from the host. */
export type SetupDeps = {
  /** The workspace's root. */
  readonly root: string;
  /** Where Ergonex keeps what it remembers and installs (0031-install-locations). */
  readonly places: Places;
  readonly os: ToolOs;
  readonly arch: ToolArch;
  /** Today, `YYYY-MM-DD`: nothing here reads a clock. */
  readonly today: string;
  readonly catalog: ToolCatalog;
  readonly transport: Transport;
  /** Also accept `http` to the loopback interface as a pin: for a test's own server only. */
  readonly loopbackHttp?: boolean;
  /** How the probes are made (`probeAll` for the real ones). */
  readonly probe: () => Promise<readonly Probe[]>;
  /** The repositories of the manifest, with their paths below the root. */
  readonly repos: readonly RepoPath[];
  /** The policy of the manifest (for the evidence). */
  readonly policy?: Policy;
  /** Windows: whether long paths are on for the system and whether the process is elevated. */
  readonly windows?: {
    readonly longPathsEnabled: boolean;
    readonly elevated: boolean;
  };
  /** Windows: turns the system setting on; the real one runs `reg add`. */
  readonly setSystemLongPaths?: () => Promise<Result<void, string>>;
  /** The user's global Git configuration file and the file generated in the workspace that it would include. */
  readonly globalGitConfig: string;
  readonly gitIncludeFile: string;
  /** Asks a question and says the answer; undefined where there is no terminal. */
  readonly confirm?: (question: string) => Promise<boolean>;
  /** What is shown (the plan, a change): standard output's `write` by default is the caller's. */
  readonly say?: (text: string) => void;
};

/** What happened to a step. */
export type StepOutcome = {
  readonly step: SetupStep;
  readonly result: "done" | "skipped" | "failed" | "declined";
  readonly message: string;
};

/** What `ergonex setup` reports. */
export type SetupReport = {
  readonly plan: SetupPlan;
  /** The plan as shown. */
  readonly shown: string;
  /** Whether the plan was carried out (`ergonex:applied`). */
  readonly applied: boolean;
  readonly outcomes: readonly StepOutcome[];
  readonly findings: readonly Finding[];
  readonly exit: "Ok" | "Findings";
  /** The run's facts, for its evidence record. */
  readonly facts: RunFacts;
};

/** Why `ergonex setup` could not run at all. */
export type SetupError = { readonly kind: "usage"; readonly message: string } | { readonly kind: "environment"; readonly message: string };

/** The real turn-on of the system long-path setting: `reg add` on Windows. */
export async function setSystemLongPathsOnWindows(): Promise<Result<void, string>> {
  const argv = longPathsCommand();
  try {
    const out = await output(argv, { stdout: "piped", stderr: "piped" });
    return out.success ? ok(undefined) : err(new TextDecoder().decode(out.stderr).trim() || `reg exited ${out.code}`);
  } catch (e) {
    return err(e instanceof NotFound ? "reg is not on the path" : e instanceof Error ? e.message : String(e));
  }
}

async function observe(deps: SetupDeps): Promise<SetupFacts> {
  const manifest = resolveInside(deps.root, MANIFEST_FILE);
  const manifestPath = manifest.kind === "ok" ? manifest.value : `${deps.root}/${MANIFEST_FILE}`;
  const installed: string[] = [];
  for (const t of deps.catalog.tools) {
    const v = await verifyTool(deps.places, t, deps.os, deps.arch);
    if (v.kind === "ok" && v.value.length === 0) installed.push(`${t.name}@${t.version}`);
  }
  const rootText = await readTextOr(movedPath(deps.places, ".ergonex/state.auto.json") ?? join(deps.root, ".ergonex", "state.auto.json"));
  const rootExists = rootText !== undefined || (await readTextOr(manifestPath)) !== undefined || (await exists(deps.root));
  return {
    root: deps.root,
    rootExists,
    manifestPath,
    manifestExists: (await readTextOr(manifestPath)) !== undefined,
    os: deps.os,
    arch: deps.arch,
    catalog: deps.catalog,
    installed,
    probes: await deps.probe(),
    repos: deps.repos,
    longPathsEnabled: deps.windows?.longPathsEnabled ?? true,
    elevated: deps.windows?.elevated ?? false,
    windowsPaths: deps.repos.map((r) => `${deps.root}\\${r.replaceAll("/", "\\")}`),
    gitIncludeFile: deps.gitIncludeFile,
    toolsRoot: deps.places.tools,
  };
}

async function applyStep(deps: SetupDeps, args: SetupArgs, step: SetupStep, findings: Finding[]): Promise<StepOutcome> {
  const ok_ = (message: string): StepOutcome => ({
    step,
    result: "done",
    message,
  });
  const failed = (message: string, rule: string, subject: string): StepOutcome => {
    findings.push({
      ruleId: rule,
      severity: "Error",
      message,
      subject,
      firstSeen: deps.today,
    });
    return { step, result: "failed", message };
  };
  switch (step.kind) {
    case "CreateRoot":
      await mkdir(step.path, { recursive: true });
      return ok_(`created ${step.path}`);
    case "WriteStarterManifest":
      try {
        await mkdir(dirname(step.path), { recursive: true });
        await writeTextFile(step.path, starterManifest(), { createNew: true });
        return ok_(`wrote ${step.path}`);
      } catch (e) {
        return failed(
          `the starter manifest was not written: ${e instanceof Error ? e.message : String(e)}`,
          "ergonex/setup-manifest",
          step.path,
        );
      }
    case "VerifyTool":
      return {
        step,
        result: "skipped",
        message: "probed only; setup never installs git, bun or node",
      };
    case "SkipTool":
      return { step, result: "skipped", message: step.reason };
    case "InstallTool": {
      const tool = toolNamed(deps.catalog, step.tool);
      if (tool === undefined) return failed(`${step.tool} is not in the catalog`, "ergonex/setup-install", step.tool);
      const r = await installTool(
        {
          places: deps.places,
          transport: deps.transport,
          os: deps.os,
          arch: deps.arch,
          ...(deps.loopbackHttp === true ? { loopbackHttp: true } : {}),
        },
        tool,
      );
      if (r.kind === "err") return failed(describeInstallError(r.error), "ergonex/setup-install", step.tool);
      return ok_(
        r.value.already
          ? `${step.tool} ${step.version} was already installed`
          : `installed ${step.tool} ${step.version} into ${r.value.dir}`,
      );
    }
    case "SetRepoLongPaths": {
      const dir = resolveInside(deps.root, step.repo);
      if (dir.kind === "err") return failed(`${step.repo} is outside the root`, "ergonex/setup-longpaths", step.repo);
      if ((await readTextOr(join(dir.value, ".git", "config"))) === undefined)
        return {
          step,
          result: "skipped",
          message: `${step.repo} is not cloned yet`,
        };
      const out = await output(["git", "-C", dir.value, ...repoLongPathsCommand()], { stdout: "piped", stderr: "piped" });
      return out.success
        ? ok_(`set core.longpaths in ${step.repo}`)
        : failed(`git could not set core.longpaths in ${step.repo}`, "ergonex/setup-longpaths", step.repo);
    }
    case "SetSystemLongPaths": {
      const r = await (deps.setSystemLongPaths ?? setSystemLongPathsOnWindows)();
      return r.kind === "ok"
        ? ok_("turned Windows long paths on for the system")
        : failed(`Windows long paths could not be turned on: ${r.error}`, "ergonex/setup-longpaths", "windows");
    }
    case "ExplainLongPaths":
      return {
        step,
        result: "skipped",
        message: "the steps are printed for the person to take",
      };
    case "AddGitInclude": {
      const block = includeBlock(step.file);
      if (block.kind === "err") return failed(block.error, "ergonex/setup-git-include", deps.globalGitConfig);
      const before = (await readTextOr(deps.globalGitConfig)) ?? "";
      const after = withInclude(before, block.value);
      if (after.kind === "err") return failed(after.error, "ergonex/setup-git-include", deps.globalGitConfig);
      if (after.value === before)
        return {
          step,
          result: "skipped",
          message: "the global Git configuration already holds the block",
        };
      const diff = changeShown(deps.globalGitConfig, before, after.value);
      (deps.say ?? ((): void => undefined))(diff);
      const yes = args.yes
        ? true
        : deps.confirm === undefined
          ? undefined
          : await deps.confirm("Write this change to your global Git configuration?");
      if (yes === undefined)
        return failed(
          "there is no terminal to ask on, and --yes was not given; the global Git configuration was not changed",
          "ergonex/setup-git-include",
          deps.globalGitConfig,
        );
      if (!yes)
        return {
          step,
          result: "declined",
          message: "the global Git configuration was not changed",
        };
      await mkdir(dirname(deps.globalGitConfig), { recursive: true });
      await writeTextFile(deps.globalGitConfig, after.value);
      return ok_(`added the marked [include] to ${deps.globalGitConfig}`);
    }
    default:
      return absurd(step);
  }
}

/** The SHA-256 of a plan: of its text, so that the evidence names the plan that was shown. */
export function planHash(plan: SetupPlan): Promise<string> {
  return sha256(`${plan.steps.map((s) => describeStep(s)).join("\n")}\n`);
}

/**
 * Runs `ergonex setup`: shows the plan; with `args.apply` carries out each step in order (one at a time, under the lock of the workspace, a failed step does not stop the rest and is an error
 * finding), without it changes nothing. `--git-include` with no terminal and no `--yes` is a usage error, said before anything changes.
 */
export async function setup(args: SetupArgs, deps: SetupDeps): Promise<Result<SetupReport, SetupError>> {
  if (args.apply && args.gitInclude && !args.yes && deps.confirm === undefined) {
    return err({
      kind: "usage",
      message:
        "ergonex setup --apply --git-include asks before it writes the global Git configuration, and there is no terminal; say --yes to answer yes",
    });
  }
  const facts = await observe(deps);
  const plan = setupPlan(args, facts, deps.today);
  const shown = showPlan(plan);
  (deps.say ?? ((): void => undefined))(shown);
  const outcomes: StepOutcome[] = [];
  const findings: Finding[] = [...plan.findings];
  let applied = false;
  if (args.apply) {
    await mkdir(deps.root, { recursive: true });
    await mkdir(join(deps.root, ".ergonex"), { recursive: true });
    const lockPath = movedPath(deps.places, ".ergonex/ergonex.lock") ?? join(deps.root, ".ergonex", "ergonex.lock");
    await mkdir(dirname(lockPath), { recursive: true });
    const held = await acquireLock(lockPath, { wait: false, command: "setup" });
    if (held === undefined)
      return err({
        kind: "environment",
        message: "another ergonex run holds the workspace's lock; wait for it to finish and run setup again",
      });
    try {
      for (const step of plan.steps) {
        if (stepChangesHost(step) && !args.apply) continue;
        outcomes.push(await applyStep(deps, args, step, findings));
      }
    } finally {
      held.release();
    }
    applied = outcomes.every((o) => o.result !== "failed");
  }
  const exit = plan.exit === "Findings" || exitStatusOf(findings) === "Findings" ? "Findings" : "Ok";
  const policy = deps.policy ?? policyOf();
  const runFacts: RunFacts = {
    command: "setup",
    argv: [...(args.apply ? ["--apply"] : []), ...(args.gitInclude ? ["--git-include"] : []), ...(args.yes ? ["--yes"] : [])],
    planSha256: await planHash(plan),
    tools: {
      ...probedVersions(facts.probes),
      ...installedVersions(deps.catalog, outcomes),
    },
    findings,
    exit,
    notRun: args.apply
      ? []
      : [
          {
            name: "ergonex/setup-apply",
            reason: "a dry run: --apply was not given, so no step was carried out",
          },
        ],
    policy,
  };
  return ok({
    plan,
    shown,
    applied,
    outcomes,
    findings,
    exit,
    facts: runFacts,
  });
}

function installedVersions(catalog: ToolCatalog, outcomes: readonly StepOutcome[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const o of outcomes)
    if (o.step.kind === "InstallTool" && o.result === "done") out[o.step.tool] = toolNamed(catalog, o.step.tool)?.version ?? o.step.version;
  return out;
}
