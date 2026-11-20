/**
 * Tests of `runtime/git.ts` on a temporary repository made with `git init`: the commit at `HEAD`, a clean and a dirty tree, the paths
 * changed between two commits (spaces, non-ASCII names and a rename included), a file's bytes at a revision, and the errors: a folder that
 * is not a repository, a repository with no commit, an unknown revision or path, a revision that reads as an option, and no `git`.
 *
 * @module
 */
import { changedPaths, commitIdOf, fileAt, formatGitError, head, isClean } from "../src/git.ts";
import { mkdir, remove, rename, withTempDir, writeFile, writeTextFile } from "../src/fs.ts";
import { join } from "../src/path.ts";
import { run, which } from "../src/proc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = "0001-system FR-014";
const skip = which("git") === undefined ? { skip: "git is not installed" } : {};

/** git run in `repo` as a throwaway committer, failing the test where it fails. */
async function git(repo: string, ...args: string[]): Promise<string> {
  const r = await run(
    [
      "git",
      "-C",
      repo,
      "-c",
      "user.name=ci",
      "-c",
      "user.email=ci@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.autocrlf=false",
      ...args,
    ],
    { env: { GIT_TERMINAL_PROMPT: "0" } },
  );
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

const SPACED = "docs/a file with spaces.md";
const UNICODE = "données/été 日本.txt";

proves(
  [FR],
  "head, isClean, changedPaths and fileAt read a repository, with spaces and non-ASCII paths kept",
  async () => {
    await withTempDir(async (repo) => {
      await git(repo, "init", "-q", "-b", "main");
      assertEquals((await head(repo)).kind === "err" ? "err" : "ok", "err");
      await mkdir(join(repo, "docs"));
      await mkdir(join(repo, "données"));
      await writeTextFile(join(repo, SPACED), "one\n");
      await writeTextFile(join(repo, "keep.txt"), "keep\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "first");
      const first = await git(repo, "rev-parse", "HEAD");
      const h1 = await head(repo);
      const id = commitIdOf(first);
      assert(id !== undefined, first);
      assertEquals(h1, { kind: "ok", value: id });
      assertEquals(await isClean(repo), { kind: "ok", value: true });

      await writeTextFile(join(repo, SPACED), "two\n");
      assertEquals(await isClean(repo), { kind: "ok", value: false });
      await writeFile(join(repo, UNICODE), Uint8Array.of(0, 1, 2, 255));
      await rename(join(repo, "keep.txt"), join(repo, "kept.txt"));
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "second");
      const second = await git(repo, "rev-parse", "HEAD");
      assertEquals(await isClean(repo), { kind: "ok", value: true });
      await writeTextFile(join(repo, "untracked.txt"), "u");
      assertEquals(await isClean(repo), { kind: "ok", value: false });
      await remove(join(repo, "untracked.txt"));

      const changed = await changedPaths(repo, first, second);
      assert(changed.kind === "ok", JSON.stringify(changed));
      assertEquals([...changed.value].sort(), [SPACED, UNICODE, "keep.txt", "kept.txt"].sort());
      assertEquals(await changedPaths(repo, "HEAD", "HEAD"), { kind: "ok", value: [] });

      const before = await fileAt(repo, first, SPACED);
      assertEquals(before.kind === "ok" ? new TextDecoder().decode(before.value) : before, "one\n");
      const bytes = await fileAt(repo, "HEAD", UNICODE);
      assertEquals(bytes.kind === "ok" ? [...bytes.value] : bytes, [0, 1, 2, 255]);
      const absent = await fileAt(repo, first, UNICODE);
      assertEquals(absent.kind === "err" ? absent.error.kind : "ok", "no-such-path");
    });
  },
  skip,
);

proves(
  [FR],
  "a folder that is not a repository, an unknown revision, an option-like revision and a missing git are errors, never throws",
  async () => {
    await withTempDir(async (dir) => {
      const notRepo = await head(join(dir, "nowhere"));
      assertEquals(notRepo.kind === "err" ? notRepo.error.kind : "ok", "not-a-repository");
      const empty = await isClean(dir);
      // the temporary folder may sit inside some repository on a developer's machine; on its own it is not one
      if (empty.kind === "err") assertEquals(empty.error.kind, "not-a-repository");
      const repo = join(dir, "r");
      await mkdir(repo);
      await git(repo, "init", "-q");
      await writeTextFile(join(repo, "a"), "a");
      await git(repo, "add", "a");
      await git(repo, "commit", "-q", "-m", "a");
      const unknown = await changedPaths(repo, "HEAD", "no-such-branch");
      assertEquals(unknown.kind === "err" ? unknown.error.kind : "ok", "bad-revision");
      const option = await fileAt(repo, "--output=/tmp/x", "a");
      assertEquals(option.kind === "err" ? option.error.kind : "ok", "bad-revision");
      const missing = await head(repo, { program: "ifc-no-such-git" });
      assertEquals(missing, { kind: "err", error: { kind: "git-missing", program: "ifc-no-such-git" } });
      assert(missing.kind === "err" && formatGitError(missing.error).includes("not installed"));
    });
  },
  skip,
);

proves([FR], "a commit id is 40 or 64 lower-case hexadecimal digits", () => {
  assert(commitIdOf("a".repeat(40)) !== undefined && commitIdOf("0".repeat(64)) !== undefined);
  assertEquals([commitIdOf("A".repeat(40)), commitIdOf("a".repeat(41)), commitIdOf("HEAD")], [undefined, undefined, undefined]);
});
