// Spec: 0001-git-layers FR-002
/**
 * The one place the library runs Git: every call is `git` with the repository named by its Git folder, the configuration of a computer that would change what a command does turned off (no signing, no hooks,
 * no prompt, no pager), and the text of Git's messages in the language Git writes by default. A call that cannot start is a failed call, never a throw.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";

/** What one call of Git is given. */
export type Call = {
  readonly input?: string | Uint8Array;
  readonly env?: Readonly<Record<string, string>>;
  /** Run in this folder instead of the Git folder of the repository (for a working tree). */
  readonly cwd?: string;
  /** Leave the hooks of the repository on (they are off unless asked). */
  readonly hooks?: boolean;
};

/** A repository to run Git on. */
export type Git = {
  /** The Git folder, absolute: the repository itself for a bare one, `.git` for a working tree. */
  readonly gitDir: string;
  readonly bare: boolean;
  /** The folder of the working tree, where there is one. */
  readonly workTree?: string;
  /** Runs `git <args>` and keeps its output as bytes. */
  run(args: readonly string[], call?: Call): Promise<proc.Output>;
};

const NO_HOOKS = proc.build.os === "windows" ? "NUL" : "/dev/null";
const decoder = new TextDecoder();

/** The text of some output. */
export const textOf = (bytes: Uint8Array): string => decoder.decode(bytes);

/** A call that did not end with 0, as one sentence: the last lines Git wrote, or its status. */
export function failure(out: proc.Output): string {
  const said = textOf(out.stderr).trim() || textOf(out.stdout).trim();
  return said === "" ? `git ended with ${out.code}` : said.split("\n").slice(-3).join(" | ");
}

/** The repository at a folder, or why Git cannot work there. The folder is the working tree, the Git folder or a bare repository. */
export async function openGit(repo: string, program = "git"): Promise<Result<Git, string>> {
  if (!path.isAbsolute(repo)) return err(`${JSON.stringify(repo)} is not an absolute path`);
  let probe: proc.Output;
  try {
    probe = await proc.output([program, "-C", repo, "rev-parse", "--absolute-git-dir", "--is-bare-repository", "--show-toplevel"], { env: { GIT_TERMINAL_PROMPT: "0" } });
  } catch (thrown) {
    return err(`git cannot be run: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  const lines = textOf(probe.stdout).split("\n");
  const gitDir = (lines[0] ?? "").trim();
  if (gitDir === "") {
    // a bare repository has no top level, so `--show-toplevel` fails; ask without it
    const again = await proc.output([program, "-C", repo, "rev-parse", "--absolute-git-dir", "--is-bare-repository"], { env: { GIT_TERMINAL_PROMPT: "0" } });
    const l = textOf(again.stdout).split("\n");
    const dir = (l[0] ?? "").trim();
    if (!again.success || dir === "") return err(`${repo} is not a Git repository: ${failure(again)}`);
    return ok(make(program, dir, (l[1] ?? "").trim() === "true", undefined));
  }
  const bare = (lines[1] ?? "").trim() === "true";
  const top = (lines[2] ?? "").trim();
  return ok(make(program, gitDir, bare, bare || top === "" ? undefined : top));
}

function make(program: string, gitDir: string, bare: boolean, workTree: string | undefined): Git {
  return {
    gitDir,
    bare,
    ...(workTree === undefined ? {} : { workTree }),
    run(args, call = {}) {
      const base = call.cwd === undefined ? [`--git-dir=${gitDir}`] : [];
      const config = ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", "-c", "core.quotepath=off", ...(call.hooks === true ? [] : ["-c", `core.hooksPath=${NO_HOOKS}`])];
      return proc.output([program, ...base, ...config, ...args], {
        ...(call.cwd === undefined ? {} : { cwd: call.cwd }),
        ...(call.input === undefined ? {} : { input: call.input }),
        env: { GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", ...call.env },
      });
    },
  };
}
