// Spec: 0002-libraries-ci-findings FR-007
/**
 * The history of findings (commons 0038-build-policy FR-012): the orphan branch `findings-history` of the repository, one new file for each run at `runs/YYYY/MM/DD/<workflow>-<run id>.json`, written by a commit that adds a file and changes none, pushed
 * as a fast-forward and, where the branch moved meanwhile, retried from the new tip and never forced. Real `git` is the only thing it uses (no package), so that the job that keeps the history needs nothing installed. `read` gives the files of the branch for the
 * site, oldest first.
 *
 * @example
 * ```ts
 * import { BRANCH, runPath } from "./history.ts";
 * runPath({ id: "9", workflow: "ci", commit: "c", at: "2026-11-22T10:00:00Z" }); // "runs/2026/11/22/ci-9.json"
 * ```
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { decodeFindingsFile, type FindingsFile, type RunInfo } from "./findings.ts";

/** The branch that keeps the history. */
export const BRANCH = "findings-history";

/** Where the file of a run is on the branch. */
export function runPath(run: RunInfo): string {
  const day = run.at.slice(0, 10).split("-");
  return `runs/${day[0]}/${day[1]}/${day[2]}/${run.workflow.replace(/[^A-Za-z0-9._-]+/g, "_")}-${run.id}.json`;
}

const git = (cwd: string, args: readonly string[]): string => execFileSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });

/** What keeping a run came to. */
export type Kept = { readonly kind: "kept"; readonly path: string; readonly attempts: number } | { readonly kind: "exists"; readonly path: string } | { readonly kind: "failed"; readonly error: string };

/**
 * Adds the file of a run to the branch of a repository (`remote` is the address of the repository, whose branch is read and pushed): the branch is made orphan where it is not there, a file already on it is never replaced,
 * and a push that is not a fast-forward is retried from the new tip, up to `attempts` times, and never forced.
 */
export function keepRun(_repo: string, remote: string, file: FindingsFile, o: { readonly attempts?: number; readonly name?: string; readonly email?: string } = {}): Kept {
  const attempts = o.attempts ?? 5;
  const path = runPath(file.run);
  const work = mkdtempSync(join(tmpdir(), "findings-history-"));
  try {
    git(work, ["init", "-q"]);
    git(work, ["config", "user.name", o.name ?? "findings-history"]);
    git(work, ["config", "user.email", o.email ?? "findings-history@users.noreply.github.com"]);
    git(work, ["remote", "add", "origin", remote]);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let tip: string | undefined;
      try {
        git(work, ["fetch", "-q", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
        tip = git(work, ["rev-parse", `refs/remotes/origin/${BRANCH}`]).trim();
      } catch {
        tip = undefined;
      }
      if (tip === undefined) git(work, ["checkout", "-q", "--orphan", BRANCH]);
      else git(work, ["checkout", "-q", "-B", BRANCH, tip]);
      const target = join(work, path);
      if (existsSync(target)) return { kind: "exists", path };
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`);
      git(work, ["add", "--", path]);
      git(work, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `findings of ${file.run.workflow} run ${file.run.id}`, "-m", `commit ${file.run.commit}`]);
      try {
        git(work, ["push", "-q", "origin", `HEAD:refs/heads/${BRANCH}`]);
        return { kind: "kept", path, attempts: attempt };
      } catch (e) {
        if (attempt === attempts) return { kind: "failed", error: e instanceof Error ? e.message : String(e) };
        // the branch moved: the next attempt starts from its new tip (never a force)
        git(work, ["reset", "-q", "--hard"]);
      }
    }
    return { kind: "failed", error: "no attempt was made" };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The files of the branch that the repository has, oldest first, as text (what the site reads); none where the branch is not there. */
export function readHistory(repo: string, ref: string = `refs/remotes/origin/${BRANCH}`): readonly { readonly path: string; readonly text: string }[] {
  let names: string;
  try {
    names = git(repo, ["ls-tree", "-r", "--name-only", ref]);
  } catch {
    return [];
  }
  return names.split("\n").filter((n) => /^runs\/.*\.json$/.test(n)).sort().map((path) => ({ path, text: git(repo, ["show", `${ref}:${path}`]) }));
}

/** The text of a file of a folder, or `undefined`. */
export const readText = (p: string): string | undefined => (existsSync(p) ? readFileSync(p, "utf8") : undefined);

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (n: string): string | undefined => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
  const from = arg("--file");
  const remote = arg("--remote");
  if (from === undefined || remote === undefined) {
    process.stderr.write("usage: bun history.ts --file FINDINGS.json --remote URL\n");
    process.exitCode = 2;
  } else {
    const text = readText(from);
    const decoded = text === undefined ? undefined : decodeFindingsFile(JSON.parse(text));
    if (decoded === undefined || decoded.kind === "err") {
      process.stdout.write(`history: ${from} is not a findings file${decoded === undefined ? "" : ` (${decoded.error})`}; nothing was kept\n`);
    } else {
      const kept = keepRun(".", remote, decoded.value);
      process.stdout.write(`history: ${kept.kind}${kept.kind === "failed" ? ` (${kept.error.split("\n")[0]})` : ` ${kept.path}`}\n`);
    }
  }
}
