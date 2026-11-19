// Spec: 0001-ergonex FR-016
/**
 * `ergonex worktree create|list|prune` (commons 0001-ergonex FR-016, 0002-workspace-model FR-007, FR-027, FR-034): `create` makes a worktree at `<home>/.worktrees/<host>/<path>/<repo>/<branch-slug>` on a branch
 * named for its issue, only where another person or agent, or uncommitted work, is on the repository, and otherwise says that the repository's own checkout is the place and makes none unless
 * `--always` is given; `list` shows the worktrees of the managed repositories; `prune` removes only a worktree that has no uncommitted change and no unpushed commit, and only with `--allow-destructive`.
 *
 * @remarks
 * A branch is named for its issue where it begins with the issue's number (`10-ergonex-host`, `issue-10`, or a specification's own number as in `0020-ifccm`): `branchNamesIssue` is the one place that says
 * so, until the rules of branches are in 0020-ifccm, which this command applies and does not extend (0002-workspace-model FR-034).
 *
 * @module
 */
import { flag } from "../platform/k-args.ts";
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { existsSync, mkdir, realPath } from "../platform/r-fs.ts";
import { dirname } from "../platform/r-path.ts";
import type { Finding } from "../findings.ts";
import { worktreePathOf, worktreeWanted } from "../layout.ts";
import type { ManifestRepo } from "../manifest.ts";
import { foldKey } from "../portable.ts";
import { branchName, describeBrandError } from "../types.ts";
import { observe } from "../host/observe.ts";
import { acquireLock, describeHolder, readHolder } from "../platform/r-lock.ts";
import { createWorktree, listWorktrees, localWork, removeWorktree } from "../host/worktrees.ts";
import { AREA, native } from "../host/workspace.ts";
import { defineCommand, GLOBAL_OPTIONS, type ErgonexModule } from "../modules/types.ts";
import { jsonOf, textOf, withWorkspace } from "./common.ts";

/** Whether a branch is named for its issue: it begins with the issue's number, alone or after `issue-`, and goes on only after `-` or `/`. */
export function branchNamesIssue(branch: string): boolean {
  return /^(?:issue-)?\d+(?:[-/][A-Za-z0-9._/-]+)?$/.test(branch);
}

/** The repository of the manifest a word names: its path, or its name where only one repository has it. */
function resolveRepo(repos: readonly ManifestRepo[], word: string): { readonly repo: ManifestRepo } | { readonly problem: string } {
  const key = foldKey(word);
  const exact = repos.filter((r) => foldKey(r.path) === key);
  const byName = repos.filter((r) => foldKey(r.path.split("/").at(-1) ?? "") === key);
  const found = exact.length > 0 ? exact : byName;
  const [only, ...more] = found;
  if (only === undefined) return { problem: `${word} is not a repository of the manifest` };
  if (more.length > 0)
    return {
      problem: `${word} names more than one repository (${found.map((r) => r.path).join(", ")}); give its whole path`,
    };
  return { repo: only };
}

const CREATE_OPTIONS = {
  ...GLOBAL_OPTIONS,
  always: flag({
    help: "Make the worktree even where the repository's own checkout is free.",
  }),
};

const create = defineCommand({
  name: "create",
  summary: "Make a worktree for an issue's branch, only where someone else or uncommitted work is on the repository.",
  options: CREATE_OPTIONS,
  operands: [
    {
      name: "REPOSITORY",
      help: "The repository: its path in the workspace, or its name where that is only one.",
      arity: "one",
    },
    {
      name: "BRANCH",
      help: "The branch, named for its issue (`10-ergonex-host`, `issue-10`, `0020-ifccm`).",
      arity: "one",
    },
  ],
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const [word = "", branchWord = ""] = args.positionals;
      const branch = branchName(branchWord);
      if (branch.kind === "err")
        return err({
          kind: "usage",
          message: `${JSON.stringify(branchWord)} is not a branch name: ${describeBrandError(branch.error)}`,
        });
      if (!branchNamesIssue(branch.value))
        return err({
          kind: "usage",
          message: `${branch.value} is not named for its issue: a worktree's branch begins with its issue's number (\`10-ergonex-host\`, \`issue-10\`, \`0020-ifccm\`)`,
        });
      const found = resolveRepo(loaded.manifest.repositories, word);
      if ("problem" in found) return err({ kind: "usage", message: found.problem });
      const repo = found.repo;
      const folder = native(loaded, repo.path);
      const state = await observe(folder, repo.ref);
      if (state.kind === "err")
        return err({
          kind: "environment",
          message: `git cannot be run (${state.error.program} is not installed or not on the PATH)`,
        });
      const s = state.value;
      if (s.kind === "Missing" || s.kind === "Locked" || s.kind === "WrongRemote" || s.kind === "NotARepo") {
        const finding: Finding = {
          ruleId: "ergonex/worktree-base",
          severity: "Warning",
          message: `${repo.path} is ${s.kind}; run \`ergonex status\`, and \`ergonex apply\` where it is missing`,
          subject: repo.path,
          firstSeen: ctx.today,
        };
        return ok({
          text: textOf([`no worktree made: ${repo.path} is ${s.kind}`], [finding]),
          data: { made: false },
          findings: [finding],
        });
      }
      const worktrees = await listWorktrees(folder);
      const otherWorker = worktrees.kind === "ok" && worktrees.value.length > 1;
      if (!worktreeWanted({ uncommittedWork: s.kind === "Dirty", otherWorker }) && !args.options.always) {
        return ok({
          text: `no worktree made: nobody else is working in ${repo.path} and it has no uncommitted work, so its own checkout (${folder}) is the place to work; give --always to make one anyway`,
          data: { made: false, place: folder },
          findings: [],
        });
      }
      const path = worktreePathOf(repo.ref, branch.value);
      if (path.kind === "err")
        return err({
          kind: "usage",
          message: `the branch ${branch.value} cannot be a worktree's folder on every system`,
        });
      const target = native(loaded, path.value);
      const lockPath = native(loaded, `${AREA}/ergonex.lock`);
      await mkdir(dirname(lockPath), { recursive: true });
      const held = await acquireLock(lockPath, {
        wait: false,
        command: "ergonex worktree create",
      });
      if (held === undefined) {
        const holder = await readHolder(lockPath);
        return err({
          kind: "environment",
          message: `another run of ergonex holds the workspace: ${holder === undefined ? "another run" : describeHolder(holder)}`,
        });
      }
      try {
        const made = await createWorktree(folder, target, branch.value);
        if (made.kind === "err")
          return err({
            kind: "environment",
            message: `the worktree could not be made: ${made.error}`,
          });
        return ok({
          text: `made ${path.value} on ${branch.value}`,
          data: { made: true, path: path.value, branch: branch.value },
          findings: [],
        });
      } finally {
        held.release();
      }
    }),
});

const list = defineCommand({
  name: "list",
  summary: "List the worktrees of the managed repositories.",
  options: { ...GLOBAL_OPTIONS },
  run: (ctx) =>
    withWorkspace(ctx, async (loaded) => {
      const rows: {
        readonly repo: string;
        readonly path: string;
        readonly branch: string;
      }[] = [];
      for (const repo of loaded.manifest.repositories) {
        const folder = native(loaded, repo.path);
        if (!existsSync(folder)) continue;
        const all = await listWorktrees(folder);
        if (all.kind === "err") continue;
        for (const w of all.value.filter((x) => !x.main))
          rows.push({
            repo: repo.path,
            path: w.path,
            branch: w.branch ?? "(detached)",
          });
      }
      return ok({
        text:
          rows.length === 0
            ? "no worktrees: every repository's own checkout is the place to work"
            : rows.map((r) => `${r.repo}  ${r.branch}  ${r.path}`).join("\n"),
        data: { worktrees: jsonOf(rows) },
        findings: [],
      });
    }),
});

const PRUNE_OPTIONS = {
  ...GLOBAL_OPTIONS,
  allowDestructive: flag({
    help: "Remove the worktrees that hold no work; without it they are only named.",
  }),
};

const prune = defineCommand({
  name: "prune",
  summary: "Remove the worktrees that have no uncommitted change and no unpushed commit; only with --allow-destructive.",
  options: PRUNE_OPTIONS,
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      // Git prints a worktree's real path (on macOS /private/var for /var), so the base is the root's real path too
      const realHome = await realPath(loaded.home).catch(() => loaded.home);
      const base = `${realHome.replaceAll("\\", "/")}/.worktrees/`;
      const lines: string[] = [];
      const done: string[] = [];
      for (const repo of loaded.manifest.repositories) {
        const folder = native(loaded, repo.path);
        if (!existsSync(folder)) continue;
        const all = await listWorktrees(folder);
        if (all.kind === "err") continue;
        for (const w of all.value.filter((x) => !x.main && foldKey(x.path.replaceAll("\\", "/")).startsWith(foldKey(base)))) {
          const work = await localWork(w.path);
          if (work.kind === "err") {
            lines.push(`kept ${w.path}: ${work.error}`);
            continue;
          }
          if (work.value.dirty || work.value.unpushed > 0) {
            lines.push(
              `kept ${w.path}: it has ${work.value.dirty ? "uncommitted changes" : ""}${work.value.dirty && work.value.unpushed > 0 ? " and " : ""}${work.value.unpushed > 0 ? `${work.value.unpushed} unpushed commit(s)` : ""}`,
            );
            continue;
          }
          if (!args.options.allowDestructive) {
            lines.push(`would remove ${w.path}: it holds no work; give --allow-destructive to remove it`);
            continue;
          }
          const gone = await removeWorktree(folder, w.path);
          lines.push(gone.kind === "ok" ? `removed ${w.path}` : `kept ${w.path}: ${gone.error}`);
          if (gone.kind === "ok") done.push(w.path);
        }
      }
      return ok({
        text: lines.length === 0 ? "no worktree of the workspace to prune" : lines.join("\n"),
        data: { removed: done },
        findings: [],
      });
    }),
});

/** The module `ergonex worktree`. */
export const worktreeModule: ErgonexModule = {
  name: "worktree",
  summary: "Make, list and prune the worktrees of the managed repositories.",
  commands: [create, list, prune],
};
