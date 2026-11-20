// Spec: 0001-ergonex FR-017
/**
 * The plan of `ergonex setup` (commons 0001-ergonex FR-017 to FR-020, 0002-workspace-model FR-030, FR-038, FR-039): setup is the only command that installs a tool or changes the host, it shows its plan first,
 * it carries its plan out unless `--dry-run` is given, which shows the plan and changes nothing, and the plan is a list of typed steps made by a pure function from
 * what was observed: it creates the root and a starter manifest where there is none, installs only the pinned artifacts of the catalog for this operating system and architecture, verifies
 * `git`, `bun` and `node` by probes and never installs them, and on Windows sets `core.longpaths` in each repository and the system setting where elevated, else prints the exact steps.
 *
 * @remarks
 * Pure: `setupPlan` takes the facts as an argument and reads nothing. The host layer (`host/apply.ts`) carries the steps out; a step of a kind with `ergonex:hostChange` (`InstallTool`,
 * `ConfigureHost`) is carried out there only where the arguments say `apply`. Every other command's plan holds none (`plan.ts` of the core: `setupApply`).
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Finding, exitStatusOf } from "../findings.ts";
import type { RepoPath } from "../types.ts";
import { type ToolArch, type ToolCatalog, type ToolOs, artifactFor } from "../tools/catalog.ts";
import { type Probe, describeProbe, probeFinding } from "../tools/probe.ts";
import { LONG_PATH_STEPS, longPathFindings } from "./windows.ts";

/** How a run of `ergonex setup` treats its steps: it carries them out (`apply`), or shows the plan and changes nothing (`dry-run`, `--dry-run`). */
export type SetupMode = "apply" | "dry-run";

/** What `ergonex setup` was asked. */
export type SetupArgs = {
  readonly mode: SetupMode;
  /** Whether to add the global Git include (`--git-include`): where a person can be asked, after the exact change is shown and a yes. */
  readonly gitInclude: boolean;
};

/** One step of the plan. */
export type SetupStep =
  | { readonly kind: "CreateRoot"; readonly path: string }
  | { readonly kind: "WriteStarterManifest"; readonly path: string }
  | {
      readonly kind: "VerifyTool";
      readonly tool: string;
      readonly probe: Probe;
    }
  | {
      readonly kind: "InstallTool";
      readonly tool: string;
      readonly version: string;
      readonly os: ToolOs;
      readonly arch: ToolArch;
      readonly url: string;
      readonly sha256: string;
      /** The folder it is installed into, `<data>/tools/<name>/<version>`. */
      readonly into: string;
    }
  | {
      readonly kind: "SkipTool";
      readonly tool: string;
      readonly reason: string;
    }
  | { readonly kind: "SetRepoLongPaths"; readonly repo: RepoPath }
  | { readonly kind: "SetSystemLongPaths" }
  | { readonly kind: "ExplainLongPaths"; readonly steps: readonly string[] }
  | { readonly kind: "AddGitInclude"; readonly file: string };

/** Whether a step changes the host (`ergonex:hostChange`): it installs a tool or configures the host outside the workspace's files. */
export function stepChangesHost(step: SetupStep): boolean {
  switch (step.kind) {
    case "InstallTool":
    case "SetSystemLongPaths":
    case "AddGitInclude":
      return true;
    case "CreateRoot":
    case "WriteStarterManifest":
    case "VerifyTool":
    case "SkipTool":
    case "SetRepoLongPaths":
    case "ExplainLongPaths":
      return false;
    default:
      return absurd(step);
  }
}

/** A step as one line. */
export function describeStep(step: SetupStep): string {
  switch (step.kind) {
    case "CreateRoot":
      return `create the root ${step.path}`;
    case "WriteStarterManifest":
      return `write a starter manifest at ${step.path}`;
    case "VerifyTool":
      return `verify ${describeProbe(step.probe)} (probed, never installed)`;
    case "InstallTool":
      return `install ${step.tool} ${step.version} for ${step.os} ${step.arch} from ${step.url} (SHA-256 ${step.sha256}) into ${step.into}/`;
    case "SkipTool":
      return `skip ${step.tool}: ${step.reason}`;
    case "SetRepoLongPaths":
      return `set core.longpaths in the local Git configuration of ${step.repo}`;
    case "SetSystemLongPaths":
      return "turn Windows long paths on for the system (the process is elevated)";
    case "ExplainLongPaths":
      return `Windows long paths cannot be turned on from here (the process is not elevated); steps to take:\n${step.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`;
    case "AddGitInclude":
      return `add one marked [include] of ${step.file} to the global Git configuration (the exact change is shown and you are asked first)`;
    default:
      return absurd(step);
  }
}

/** What is observed of the host for the plan. */
export type SetupFacts = {
  readonly root: string;
  readonly rootExists: boolean;
  /** The path where a starter manifest goes, and whether one is there. */
  readonly manifestPath: string;
  readonly manifestExists: boolean;
  readonly os: ToolOs;
  readonly arch: ToolArch;
  readonly catalog: ToolCatalog;
  /** The tools already installed whole, as `name@version`. */
  readonly installed: readonly string[];
  readonly probes: readonly Probe[];
  /** The repositories of the manifest, for `core.longpaths` (Windows only). */
  readonly repos: readonly RepoPath[];
  readonly longPathsEnabled: boolean;
  readonly elevated: boolean;
  /** The workspace's paths as Windows writes them, for the finding that a path is too long. */
  readonly windowsPaths: readonly string[];
  /** The file the global Git include would include. */
  readonly gitIncludeFile: string;
  /** The tools folder, `<data>/tools`, which the installs go into. */
  readonly toolsRoot: string;
};

/** The plan of `ergonex setup`: its steps in a fixed order, and the findings it makes. */
export type SetupPlan = {
  readonly steps: readonly SetupStep[];
  readonly findings: readonly Finding[];
  /** Whether it was made to be carried out (`--apply`); a dry run shows it and does nothing. */
  readonly apply: boolean;
  /** `Ok` where every step can be carried out and nothing is left to the person; `Findings` where a probe failed, a path is too long or the steps of long paths are the person's. */
  readonly exit: "Ok" | "Findings";
};

/** The plan: the root and the starter manifest, the probes, the pinned installs, the Windows long-path steps and the global Git include, in that order; deterministic for the same facts. */
export function setupPlan(args: SetupArgs, facts: SetupFacts, today: string): SetupPlan {
  const steps: SetupStep[] = [];
  const findings: Finding[] = [];
  if (!facts.rootExists) steps.push({ kind: "CreateRoot", path: facts.root });
  if (!facts.manifestExists) steps.push({ kind: "WriteStarterManifest", path: facts.manifestPath });
  for (const probe of facts.probes) {
    steps.push({ kind: "VerifyTool", tool: probe.tool, probe });
    const f = probeFinding(probe, today);
    if (f !== undefined) findings.push(f);
  }
  for (const tool of [...facts.catalog.tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const a = artifactFor(tool, facts.os, facts.arch);
    if (a === undefined) {
      steps.push({
        kind: "SkipTool",
        tool: tool.name,
        reason: `the catalog pins no artifact for ${facts.os} ${facts.arch}`,
      });
      continue;
    }
    if (facts.installed.includes(`${tool.name}@${tool.version}`)) {
      steps.push({
        kind: "SkipTool",
        tool: tool.name,
        reason: `${tool.version} is already installed`,
      });
      continue;
    }
    steps.push({
      kind: "InstallTool",
      tool: tool.name,
      version: tool.version,
      os: a.os,
      arch: a.arch,
      url: a.url,
      sha256: a.sha256,
      into: `${facts.toolsRoot}/${tool.name}/${tool.version}`,
    });
  }
  let left = false;
  if (facts.os === "windows") {
    for (const repo of [...facts.repos].sort()) steps.push({ kind: "SetRepoLongPaths", repo });
    if (!facts.longPathsEnabled) {
      if (facts.elevated) steps.push({ kind: "SetSystemLongPaths" });
      else {
        steps.push({ kind: "ExplainLongPaths", steps: LONG_PATH_STEPS });
        left = true;
      }
      findings.push(...longPathFindings({ os: facts.os, longPathsEnabled: false, paths: facts.windowsPaths }, today));
    }
  }
  if (args.gitInclude) steps.push({ kind: "AddGitInclude", file: facts.gitIncludeFile });
  const exit = left || exitStatusOf(findings) === "Findings" ? "Findings" : "Ok";
  return { steps, findings, apply: args.mode === "apply", exit };
}

/** The plan as text: a header that says whether it will be carried out, one line for each step, and what is left to do. */
export function showPlan(plan: SetupPlan): string {
  const head = plan.apply
    ? "ergonex setup: carrying out this plan"
    : "ergonex setup --dry-run (nothing is changed; run `ergonex setup` to carry this plan out)";
  const body = plan.steps.length === 0 ? ["  nothing to do"] : plan.steps.map((s) => `  - ${describeStep(s)}`);
  return `${[head, ...body].join("\n")}\n`;
}
