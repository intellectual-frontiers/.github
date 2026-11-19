// Spec: 0001-ergonex FR-013
/**
 * `ergonex status` (commons 0001-ergonex FR-013): every repository of the manifest, one line each in the order of its path, with its state, how many commits it is ahead of and behind its upstream, its stashes,
 * its untracked files and whether it is locked. It does not use the network unless `--fetch` is given, and it ends with findings where a repository is diverged, locked, on the wrong remote or not a
 * repository.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { flag } from "../platform/k-args.ts";
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { existsSync } from "../platform/r-fs.ts";
import { run } from "../platform/r-proc.ts";
import type { Finding } from "../findings.ts";
import { classify, type RepoState } from "../state.ts";
import { defineCommand, GLOBAL_OPTIONS, type ErgonexModule } from "../modules/types.ts";
import { foldKey } from "../portable.ts";
import { observeFacts } from "../host/observe.ts";
import { native } from "../host/workspace.ts";
import { jsonOf, textOf, withWorkspace } from "./common.ts";

const GIT_ENV = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};

async function count(folder: string, args: readonly string[]): Promise<number> {
  const r = await run(["git", "-C", folder, ...args], { env: GIT_ENV });
  return r.success ? r.stdout.split("\n").filter((l) => l.trim() !== "").length : 0;
}

/** What a state says in a word or two, with the numbers it carries. */
function describeState(s: RepoState): string {
  switch (s.kind) {
    case "Ahead":
      return `Ahead ${s.commits}`;
    case "Behind":
      return `Behind ${s.commits}`;
    case "Diverged":
      return `Diverged +${s.ahead}/-${s.behind}`;
    case "WrongRemote":
      return `WrongRemote (${s.found})`;
    case "Missing":
    case "Clean":
    case "Dirty":
    case "Locked":
    case "Detached":
    case "NotARepo":
      return s.kind;
    default:
      return absurd(s);
  }
}

const OPTIONS = {
  ...GLOBAL_OPTIONS,
  fetch: flag({
    help: "Fetch each repository's remote first (the only use of the network).",
  }),
};

const status = defineCommand({
  name: "status",
  summary: "List every repository of the manifest with its state, how far it is ahead and behind, its stashes, untracked files and lock.",
  options: OPTIONS,
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const rows: {
        readonly path: string;
        readonly state: RepoState;
        readonly ahead: number;
        readonly behind: number;
        readonly stashes: number;
        readonly untracked: number;
        readonly locked: boolean;
      }[] = [];
      const findings: Finding[] = [];
      const repos = [...loaded.manifest.repositories].sort((a, b) =>
        foldKey(a.path) < foldKey(b.path) ? -1 : foldKey(a.path) > foldKey(b.path) ? 1 : 0,
      );
      for (const r of repos) {
        const folder = native(loaded.home, r.path);
        const facts = await observeFacts(folder, { fetch: args.options.fetch });
        if (facts.kind === "err")
          return err({
            kind: "environment",
            message: `git cannot be run (${facts.error.program} is not installed or not on the PATH)`,
          });
        const state = classify(facts.value, r.ref);
        const here = facts.value.kind === "repository";
        const row = {
          path: r.path as string,
          state,
          ahead: facts.value.kind === "repository" ? facts.value.ahead : 0,
          behind: facts.value.kind === "repository" ? facts.value.behind : 0,
          stashes: here && existsSync(folder) ? await count(folder, ["stash", "list"]) : 0,
          untracked: here ? await count(folder, ["ls-files", "--others", "--exclude-standard"]) : 0,
          locked: facts.value.kind === "repository" && facts.value.lockFile,
        };
        rows.push(row);
        const at = (ruleId: string, severity: Finding["severity"], message: string): number =>
          findings.push({
            ruleId,
            severity,
            message,
            subject: r.path,
            firstSeen: ctx.today,
          });
        switch (state.kind) {
          case "Diverged":
            at(
              "ergonex/repository-diverged",
              "Warning",
              `${r.path} has ${state.ahead} commit(s) its remote does not and the remote has ${state.behind} it does not; only a person merges`,
            );
            break;
          case "Locked":
            at(
              "ergonex/repository-locked",
              "Warning",
              `${r.path} has a Git lock file; another process may be working in it, and ergonex does not remove the lock`,
            );
            break;
          case "WrongRemote":
            at(
              "ergonex/wrong-remote",
              "Error",
              `${r.path} is a clone of ${state.found}, not the repository the manifest names; it is never overwritten`,
            );
            break;
          case "NotARepo":
            at("ergonex/not-a-repository", "Error", `${r.path} is a folder that is not a Git repository; it is never overwritten`);
            break;
          case "Missing":
          case "Clean":
          case "Dirty":
          case "Ahead":
          case "Behind":
          case "Detached":
            break;
          default:
            return absurd(state);
        }
      }
      const width = Math.max(0, ...rows.map((r) => r.path.length));
      const lines = rows.map(
        (r) =>
          `${r.path.padEnd(width)}  ${describeState(r.state).padEnd(12)} ahead ${r.ahead} behind ${r.behind}  stashes ${r.stashes}  untracked ${r.untracked}  ${r.locked ? "locked" : "unlocked"}`,
      );
      return ok({
        text: textOf(rows.length === 0 ? ["the manifest names no repository"] : lines, findings),
        data: {
          repositories: jsonOf(rows.map((r) => ({ ...r, state: r.state.kind }))),
        },
        findings,
      });
    }),
});

/** The module `ergonex status`. */
export const statusModule: ErgonexModule = {
  name: "status",
  summary: status.summary,
  commands: [status],
};
