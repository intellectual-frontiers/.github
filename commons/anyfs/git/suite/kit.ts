/**
 * What the tests share: a repository in a temporary folder (bare or with a working tree), the identity commits are by, a path and a text as values, and Git run for a test to look at what the stores did.
 *
 * @module
 */
import { fs, path as osPath, proc } from "@intellectual-frontiers/system";
import { type Path, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { gitRefStore, type GitRef, parseIdentity, type Identity } from "../src/mod.ts";

export const who: Identity = (() => {
  const r = parseIdentity("Fleet Collector", "collector@example.test");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
})();

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

/** Runs Git in a folder as the test's own, with no configuration of a computer in the way. */
export async function git(dir: string, ...args: readonly string[]): Promise<string> {
  const out = await proc.run(["git", "-C", dir, ...args], {
    env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" },
  });
  if (!out.success) throw new Error(`git ${args.join(" ")} in ${dir}: ${out.stderr.trim() || out.stdout.trim()}`);
  return out.stdout;
}

/** A repository in a new temporary folder: with a working tree and one commit on `main` (not bare), or bare and empty. Gone when `use` ends. */
export async function withRepo<T>(kind: "worktree" | "bare", use: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.makeTempDir({ prefix: "anyfs-git-" });
  try {
    if (kind === "bare") {
      await git(dir, "init", "-q", "--bare", "-b", "main");
    } else {
      await git(dir, "init", "-q", "-b", "main");
      await fs.writeTextFile(osPath.join(dir, "work.txt"), "work\n");
      await git(dir, "add", "work.txt");
      await git(dir, "commit", "-q", "-m", "first");
    }
    return await use(dir);
  } finally {
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  }
}

/** The store of a branch in a repository, or the failure of the test. */
export async function refIn(dir: string, branch = "fleet", extra: Partial<Parameters<typeof gitRefStore>[0]> = {}): Promise<GitRef> {
  const r = await gitRefStore({ repo: dir, branch, commit: { author: who, clock: () => Date.UTC(2026, 0, 1) }, ...extra });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** How many commits a branch has. */
export async function commitsOf(dir: string, branch: string): Promise<number> {
  return Number((await git(dir, "rev-list", "--count", `refs/heads/${branch}`)).trim());
}

export { fs, osPath, proc };
