/**
 * Tests of the observation of a repository with the real `git` (commons 0002-workspace-model FR-022, FR-026, FR-028): each of the ten states of `ergonex:RepoState` is made in a temporary folder with real
 * repositories (a bare repository stands as the remote, a clone as the workspace's checkout, a second clone as another person's), observed by `workspaces/host/observe.ts` and classified, and the plan
 * made from what was observed holds the state's default action. The remote's URL is the one the manifest names (`https://git.example.org/team/tool.git`), and Git is told, in the clone's own
 * configuration, to fetch it from the bare repository on disk (`url.<path>.insteadOf`), so nothing reaches a network. The user's own Git configuration is replaced by an empty one.
 *
 * @module
 */
import { parseRemote } from "@intellectual-frontiers/commons/ts/githost";
import type { RepoRef } from "@intellectual-frontiers/commons/ts/githost";
import { mkdir, withTempDir, writeTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { observe, observeFacts } from "../src/host/observe.ts";
import { plan } from "../src/plan.ts";
import { repoPath } from "../src/portable.ts";
import type { RepoState } from "../src/state.ts";

const skip = which("git") === undefined ? { skip: "git is not installed" } : {};
const ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};
const URL = "https://git.example.org/team/tool.git";
const expected: RepoRef = (() => {
  const r = parseRemote(URL);
  if (r.kind === "err") throw new Error("the fixture's remote");
  return r.value;
})();

/** git in `cwd` as a throwaway committer, failing the test where it fails. */
async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await run(["git", "-C", cwd, "-c", "user.name=ci", "-c", "user.email=ci@example.com", "-c", "commit.gpgsign=false", ...args], {
    env: ENV,
  });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A bare remote with one commit on `main`, and a function that makes a clone of it that fetches from it as the manifest's URL. */
async function world(dir: string): Promise<{
  readonly bare: string;
  readonly clone: (name: string) => Promise<string>;
}> {
  const seed = join(dir, "seed");
  const bare = join(dir, "remote.git");
  await mkdir(seed);
  await git(seed, "init", "-q", "-b", "main");
  await writeTextFile(join(seed, "a.txt"), "one\n");
  await git(seed, "add", "a.txt");
  await git(seed, "commit", "-q", "-m", "first");
  await run(["git", "clone", "-q", "--bare", seed, bare], { env: ENV });
  const clone = async (name: string): Promise<string> => {
    const folder = join(dir, name);
    await run(["git", "clone", "-q", bare, folder], { env: ENV });
    await git(folder, "remote", "set-url", "origin", URL);
    await git(folder, "config", `url.${bare}.insteadOf`, URL);
    return folder;
  };
  return { bare, clone };
}

const stateOf = async (folder: string, fetch = true): Promise<RepoState> => {
  const r = await observe(folder, expected, { fetch, env: ENV });
  if (r.kind === "err") throw new Error(r.error.kind);
  return r.value;
};
const kinds = (s: RepoState): string => s.kind;

proves(
  ["0002-workspace-model FR-022"],
  "each of the ten states is observed in a real repository, exactly one each",
  async () => {
    await withTempDir(async (dir) => {
      const w = await world(dir);
      const seen: Record<string, RepoState> = {};

      // Missing: nothing at the path, or an empty folder where a clone can go
      seen["Missing"] = await stateOf(join(dir, "nothing-here"));
      await mkdir(join(dir, "empty"));
      assertEquals(kinds(await stateOf(join(dir, "empty"))), "Missing");

      // Clean
      const clean = await w.clone("clean");
      seen["Clean"] = await stateOf(clean);

      // Dirty: a changed tracked file, and (alone) an untracked file
      const dirty = await w.clone("dirty");
      await writeTextFile(join(dirty, "a.txt"), "changed\n");
      seen["Dirty"] = await stateOf(dirty);
      const untracked = await w.clone("untracked");
      await writeTextFile(join(untracked, "new.txt"), "x\n");
      assertEquals(kinds(await stateOf(untracked)), "Dirty");

      // Ahead: a commit the remote does not have
      const ahead = await w.clone("ahead");
      await writeTextFile(join(ahead, "b.txt"), "b\n");
      await git(ahead, "add", "b.txt");
      await git(ahead, "commit", "-q", "-m", "local");
      seen["Ahead"] = await stateOf(ahead);

      // Behind and Diverged: another person pushes to the remote
      const behind = await w.clone("behind");
      const diverged = await w.clone("diverged");
      await writeTextFile(join(diverged, "c.txt"), "c\n");
      await git(diverged, "add", "c.txt");
      await git(diverged, "commit", "-q", "-m", "mine");
      const other = await w.clone("other");
      await writeTextFile(join(other, "d.txt"), "d\n");
      await git(other, "add", "d.txt");
      await git(other, "commit", "-q", "-m", "theirs");
      await git(other, "push", "-q", "origin", "main");
      seen["Behind"] = await stateOf(behind);
      seen["Diverged"] = await stateOf(diverged);
      // without a fetch the state is of the remote as last fetched: nothing is behind yet
      assertEquals(kinds(await stateOf(clean, false)), "Clean");

      // Locked: a Git lock file is there; it is not removed
      const locked = await w.clone("locked");
      await writeTextFile(join(locked, ".git", "index.lock"), "");
      seen["Locked"] = await stateOf(locked);
      const facts = await observeFacts(locked, { env: ENV });
      assert(facts.kind === "ok" && facts.value.kind === "repository" && facts.value.lockFile);
      // a lock on a branch's own reference is a lock too
      const refLock = await w.clone("reflock");
      await writeTextFile(join(refLock, ".git", "refs", "heads", "main.lock"), "");
      assertEquals(kinds(await stateOf(refLock)), "Locked");

      // Detached
      const detached = await w.clone("detached");
      await git(detached, "checkout", "-q", "--detach");
      seen["Detached"] = await stateOf(detached);

      // WrongRemote: a clone of another remote is at the path; and a repository with no remote
      const wrong = await w.clone("wrong");
      await git(wrong, "remote", "set-url", "origin", "https://user:ghp_SECRET0123@gitlab.com/someone/else.git");
      seen["WrongRemote"] = await stateOf(wrong, false);
      const noRemote = join(dir, "no-remote");
      await mkdir(noRemote);
      await git(noRemote, "init", "-q", "-b", "main");
      assertEquals(kinds(await stateOf(noRemote)), "WrongRemote");

      // NotARepo: plain files, a file where a folder should be, and a folder inside another repository (which is not itself one)
      const plain = join(dir, "plain");
      await mkdir(plain);
      await writeTextFile(join(plain, "notes.txt"), "not git\n");
      seen["NotARepo"] = await stateOf(plain);
      await writeTextFile(join(dir, "a-file"), "x");
      assertEquals(kinds(await stateOf(join(dir, "a-file"))), "NotARepo");
      await mkdir(join(clean, "sub"));
      await writeTextFile(join(clean, "sub", "f"), "x");
      assertEquals(kinds(await stateOf(join(clean, "sub"))), "NotARepo");

      assertEquals(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.kind])), {
        Missing: "Missing",
        Clean: "Clean",
        Dirty: "Dirty",
        Ahead: "Ahead",
        Behind: "Behind",
        Diverged: "Diverged",
        Locked: "Locked",
        Detached: "Detached",
        WrongRemote: "WrongRemote",
        NotARepo: "NotARepo",
      });
      assertEquals(seen["Ahead"], { kind: "Ahead", commits: 1 });
      assertEquals(seen["Behind"], { kind: "Behind", commits: 1 });
      assertEquals(seen["Diverged"], { kind: "Diverged", ahead: 1, behind: 1 });
      // the wrong remote is told by host and path: the credential in it is not kept
      assertEquals(seen["WrongRemote"], {
        kind: "WrongRemote",
        found: "gitlab.com/someone/else",
      });
      assert(!JSON.stringify(seen).includes("SECRET"));
      // the lock was not removed, and a state is observed without changing the repository
      assertEquals(kinds(await stateOf(locked)), "Locked");
    });
  },
  skip,
);

proves(
  ["0002-workspace-model FR-022", "0002-workspace-model FR-026"],
  "the plan made from real repositories holds the default action of each, and a dirty repository behind its remote is skipped",
  async () => {
    await withTempDir(async (dir) => {
      const w = await world(dir);
      const behind = await w.clone("behind");
      const dirtyBehind = await w.clone("dirty-behind");
      await writeTextFile(join(dirtyBehind, "a.txt"), "mine\n");
      const other = await w.clone("other");
      await writeTextFile(join(other, "z.txt"), "z\n");
      await git(other, "add", "z.txt");
      await git(other, "commit", "-q", "-m", "more");
      await git(other, "push", "-q", "origin", "main");

      const paths = {
        behind: repoPath(["git.example.org", "team", "behind"]),
        dirty: repoPath(["git.example.org", "team", "dirty-behind"]),
        missing: repoPath(["git.example.org", "team", "missing"]),
      };
      for (const p of Object.values(paths)) assert(p.kind === "ok");
      if (paths.behind.kind !== "ok" || paths.dirty.kind !== "ok" || paths.missing.kind !== "ok") return;
      const desiredRepo = (path: typeof paths.behind.value): Parameters<typeof plan>[0]["repos"][number] => ({
        path,
        ref: expected,
        cloneUrl: URL,
        settings: {},
      });
      const observed = {
        repos: {
          [paths.behind.value]: {
            state: await stateOf(behind),
            config: {},
            busy: false,
          },
          [paths.dirty.value]: {
            state: await stateOf(dirtyBehind),
            config: {},
            busy: false,
          },
        },
        worktrees: {},
        files: {},
      };
      const p = plan(
        {
          repos: [desiredRepo(paths.behind.value), desiredRepo(paths.dirty.value), desiredRepo(paths.missing.value)],
          worktrees: [],
          files: [],
          hostChanges: [],
        },
        observed,
      );
      assertEquals(
        p.actions.map((a) => `${a.kind} ${a.target}`),
        ["FastForward git.example.org/team/behind", "Skip git.example.org/team/dirty-behind", "Clone git.example.org/team/missing"],
      );
      // the fast-forward the plan names really is one: Git does it with no merge commit and no rebase
      await git(behind, "merge", "--ff-only", "-q", "origin/main");
      assertEquals(kinds(await stateOf(behind)), "Clean");
      // the dirty repository was not touched, and its file is as the person left it
      assertEquals(kinds(await stateOf(dirtyBehind)), "Dirty");
    });
  },
  skip,
);

proves(
  ["0002-workspace-model FR-028"],
  "a lock file makes the repository Locked, and observing it does not remove the lock",
  async () => {
    await withTempDir(async (dir) => {
      const w = await world(dir);
      const repo = await w.clone("r");
      for (const name of ["index.lock", "HEAD.lock", "shallow.lock", "config.lock"]) {
        const lock = join(repo, ".git", name);
        await writeTextFile(lock, "");
        assertEquals(kinds(await stateOf(repo)), "Locked", name);
        const still = await run(["test", "-e", lock]);
        assert(still.success, `${name} was removed`);
        await run(["rm", lock]);
        assertEquals(kinds(await stateOf(repo)), "Clean", name);
      }
    });
  },
  skip,
);
