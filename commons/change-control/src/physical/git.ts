// Spec: 0003-change-control-git FR-001, FR-002
/**
 * The commits of a range, read with Git's own commands and its own verification of signatures (`gpg.format=ssh` with the `allowed_signers` of the fleet), and nothing changed: only `log`, `rev-parse` and `merge-base` are run, the revisions are checked before they are handed to Git, and the signers' file is written to a
 * folder of its own and removed.
 *
 * @example
 * ```ts
 * import { readCommits } from "./git.ts";
 * // const commits = await readCommits(repo, "origin/main", "HEAD", allowedSignersText);
 * ```
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { SignatureState } from "@intellectual-frontiers/change-control/governance";
import type { Commit } from "@intellectual-frontiers/change-control/logical";

const REV = /^[A-Za-z0-9][A-Za-z0-9._/@~^-]{0,99}$/;
const ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_OPTIONAL_LOCKS: "0" };

async function git(repo: string, args: readonly string[]): Promise<Result<string, string>> {
  const r = await proc.run(["git", "-C", repo, ...args], { env: ENV });
  return r.success ? ok(r.stdout) : err(r.stderr.trim() || `git ended with ${r.code}`);
}

const STATES = new Set(["G", "B", "U", "X", "Y", "R", "E", "N"]);

/** The commits after `from` up to `to` (all of them up to `to` where `from` is empty), oldest first, merges left out (their parents are judged), each with the paths it changed and the state of its signature against the signers' text. */
export async function readCommits(repo: string, from: string, to: string, allowedSignersText: string): Promise<Result<readonly Commit[], string>> {
  for (const r of [from, to]) if (r !== "" && !REV.test(r)) return err(`${JSON.stringify(r)} is not a revision`);
  const dir = await fs.makeTempDir({ prefix: "change-control-" });
  try {
    const file = path.join(dir, "allowed_signers");
    await fs.writeTextFile(file, allowedSignersText);
    const range = from === "" ? to : `${from}..${to}`;
    const log = await git(repo, ["-c", "gpg.format=ssh", "-c", `gpg.ssh.allowedSignersFile=${file}`, "log", "--no-merges", "--reverse", "--name-only", "--format=%x1e%H%x1f%an%x1f%s%x1f%G?%x1f%GS%x1f%aI%x1f%b%x1d", range]);
    if (log.kind === "err") return log;
    const commits: Commit[] = [];
    for (const rec of log.value.split("\x1e").filter((r) => r.trim() !== "")) {
      const [head = "", filesText = ""] = rec.split("\x1d");
      const [sha = "", author = "", subject = "", state = "N", signer = "", at = "", body = ""] = head.split("\x1f");
      commits.push({ sha, author, subject, body, files: filesText.split("\n").map((f) => f.trim()).filter((f) => f !== ""), signature: (STATES.has(state) ? state : "E") as SignatureState, signer: signer.trim(), at: at.trim() });
    }
    return ok(commits);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}

/** The commit a revision names, or why none. */
export async function resolve(repo: string, rev: string): Promise<Result<string, string>> {
  if (!REV.test(rev)) return err(`${JSON.stringify(rev)} is not a revision`);
  const r = await git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return r.kind === "err" || r.value.trim() === "" ? err(`${rev} is not a commit of the repository`) : ok(r.value.trim());
}
