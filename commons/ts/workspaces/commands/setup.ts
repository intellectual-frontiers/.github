/**
 * `ifws setup` (commons 0025-ifws FR-017 to FR-020): the one command that installs a tool or changes the host. `--dry-run` is the default and shows the plan; `--apply` is required to change anything and
 * with `--dry-run` is a usage error; it makes the root and the starter manifest, installs only the pinned artifacts of the catalog, probes `git`, `bun` and `node` and never installs them, on Windows
 * sets `core.longpaths` (and the system setting where elevated, else prints the steps), and with `--git-include` adds one marked `[include]` of the generated `git.auto.conf` to the global Git
 * configuration after showing the exact change and asking. This module wraps `setup/host/apply.ts`, which does the work, as a typed module and gives it the facts of this host.
 *
 * @remarks
 * The plan is printed on standard output and the change to the global Git configuration on standard error. The run's evidence is made by `setup/host/evidence.ts` (its facts are in the report). Setup takes the
 * workspace's one lock (`<home>/.if-workspaces/ifws.lock`), the same file as `apply`'s, so that the two never write at once.
 *
 * @module
 */
import { flag } from "../../kernel/args.ts";
import { err, ok } from "../../kernel/result.ts";
import { liveTransport } from "../../runtime/http-client.ts";
import { join } from "../../runtime/path.ts";
import { type Finding } from "../findings.ts";
import { policyOf } from "../policy.ts";
import { probeAll } from "../tools/host/probe.ts";
import { setup, setSystemLongPathsOnWindows, type SetupDeps } from "../setup/host/apply.ts";
import { parseSetupArgs } from "../setup/plan.ts";
import { defineCommand, GLOBAL_OPTIONS, type IfwsModule } from "../modules/types.ts";
import { AREA, loadFailureOutcome, loopbackAllowed, readManifest } from "../host/workspace.ts";
import { isElevated, probeLongPaths } from "../host/probe.ts";
import type { ToolCatalog } from "../tools/catalog.ts";
import type { RepoPath } from "../types.ts";
import { hostTarget } from "./tools.ts";
import { jsonOf } from "./common.ts";

const OPTIONS = {
  ...GLOBAL_OPTIONS,
  apply: flag({
    help: "Carry the plan out: make the root, install the pinned tools, set what the host needs. Without it nothing is changed.",
  }),
  dryRun: flag({ help: "Show the plan and change nothing (the default; with --apply it is a usage error)." }),
  gitInclude: flag({
    help: "Add one marked [include] of the generated git.auto.conf to your global Git configuration, after showing the change and asking.",
  }),
  yes: flag({ help: "Answer yes to the question of --git-include, for a run with no terminal." }),
};

const setupCommand = defineCommand({
  name: "setup",
  summary:
    "Show the plan to set the workspace up (dry run by default); with --apply, make the root, install the pinned tools and set the host.",
  options: OPTIONS,
  run: async (ctx, args) => {
    const o = args.options;
    const parsed = parseSetupArgs([
      ...(o.apply ? ["--apply"] : []),
      ...(o.dryRun ? ["--dry-run"] : []),
      ...(o.gitInclude ? ["--git-include"] : []),
      ...(o.yes ? ["--yes"] : []),
    ]);
    if (parsed.kind === "err") return err({ kind: "usage", message: parsed.error.message });
    const home = ctx.home;
    if (home === undefined)
      return err({
        kind: "environment",
        message: "no root can be found: set IFC_WORKSPACES_HOME, or HOME (USERPROFILE on Windows), or give --home",
      });
    const target = hostTarget(ctx.platform);
    if (target === undefined)
      return err({ kind: "environment", message: `ifws setup has no pinned tools for ${ctx.platform.os} ${ctx.platform.arch}` });

    let catalog: ToolCatalog = { tools: [] };
    let repos: readonly RepoPath[] = [];
    let policy = policyOf();
    const manifest = await readManifest(home, ctx.today, loopbackAllowed(ctx.env));
    if (manifest.kind === "ok") {
      catalog = manifest.value.catalog;
      repos = manifest.value.repositories.flatMap((r) => [r.path, ...r.worktrees.map((w) => w.path)]);
      policy = manifest.value.policy;
    } else if (manifest.error.kind === "manifest" || manifest.error.kind === "generate" || manifest.error.kind === "record") {
      // a manifest that does not decode stops the run before anything is changed
      return loadFailureOutcome(manifest.error, ctx);
    }

    const globalGit = ctx.env["GIT_CONFIG_GLOBAL"] ?? (ctx.env["HOME"] === undefined ? undefined : join(ctx.env["HOME"], ".gitconfig"));
    const deps: SetupDeps = {
      root: home,
      os: target.os,
      arch: target.arch,
      today: ctx.today,
      catalog,
      transport: liveTransport(),
      loopbackHttp: loopbackAllowed(ctx.env),
      probe: () => probeAll(),
      repos,
      policy,
      ...(ctx.platform.windows
        ? { windows: { longPathsEnabled: (await probeLongPaths()) === "enabled", elevated: await isElevated() } }
        : {}),
      setSystemLongPaths: setSystemLongPathsOnWindows,
      globalGitConfig: globalGit ?? join(home, ".gitconfig-not-found"),
      gitIncludeFile: join(home, AREA, "git.auto.conf"),
      ...(ctx.interact.terminal
        ? { confirm: async (q: string): Promise<boolean> => /^\s*y(es)?\s*$/i.test((await ctx.interact.ask(`${q} [y/N] `)) ?? "") }
        : {}),
      // the plan is the report (standard output); what else is said, the exact change to a file, goes to standard error
      say: (t) => {
        if (!t.startsWith("ifws setup")) ctx.note(t);
      },
    };
    if (o.gitInclude && globalGit === undefined)
      return err({ kind: "environment", message: "the global Git configuration cannot be found: HOME is not set" });
    const done = await setup(parsed.value, deps);
    if (done.kind === "err") return err(done.error);
    const r = done.value;
    const lines = r.outcomes.map((x) => `  ${x.result.padEnd(8)} ${x.message}`);
    const findings: readonly Finding[] = r.findings;
    return ok({
      text: [r.shown.trimEnd(), ...lines].join("\n"),
      data: {
        applied: r.applied,
        steps: jsonOf(r.plan.steps.map((s) => s.kind)),
        outcomes: jsonOf(r.outcomes.map((x) => ({ kind: x.step.kind, result: x.result, message: x.message }))),
      },
      findings,
      status: r.exit,
      facts: { applied: r.applied },
      runFacts: r.facts,
    });
  },
});

/** The module `ifws setup`. */
export const setupModule: IfwsModule = { name: "setup", summary: setupCommand.summary, commands: [setupCommand] };
