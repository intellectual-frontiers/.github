/**
 * Tests of `ifws plan`, `apply` and `status` as a real program on real repositories (commons 0023-if-workspaces FR-021 to FR-030, 0025-ifws FR-012, FR-013, FR-016, 0024-ifws-host FR-013, FR-020): a
 * manifest names a repository whose remote is a bare repository on disk (Git is told to fetch the manifest's URL from it), `ifws apply` clones it at the path that mirrors the URL and sets its local
 * Git configuration, a second plan holds only skips, a remote that moved on is fast-forwarded, a repository with uncommitted changes, with commits of its own, with a lock file, on the wrong remote or not
 * a repository is left as it is and reported, the user's own files and global Git configuration are not touched, and two runs do not write at once. Worktrees are made only where someone else or
 * uncommitted work is on the repository. A user's account, a browser and a network are not needed and not used.
 *
 * @module
 */
import { existsSync, mkdir, readDirSync, readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { acquireLock } from "../runtime/lock.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { evidenceFiles, needsWorld, ONE_REPOSITORY, REMOTE, withWorld } from "./ifws-fixtures.ts";

const SKIPS_ONLY = /\n {2}(?!skip )\S/;

proves(
  ["0023-if-workspaces FR-006", "0023-if-workspaces FR-021", "0023-if-workspaces FR-022", "0023-if-workspaces FR-024", "0025-ifws FR-012"],
  "a plan clones the missing repository at the path that mirrors its URL and changes nothing; apply makes the clone, and the next plan holds only skips",
  async () => {
    await withWorld(async (w) => {
      assertEquals((await w.ifws("init")).code, 0);
      await w.manifest(ONE_REPOSITORY);
      const before = existsSync(w.repo);
      const plan = await w.ifws("plan");
      assertEquals(plan.code, 0, plan.stderr);
      assertStringIncludes(plan.stdout, `clone ${REMOTE} into git.example.org/team/tool`);
      assert(!before && !existsSync(w.repo), "a plan changed something");
      assert(!existsSync(join(w.home, "AGENTS.auto.md")), "a plan wrote a generated file");

      const applied = await w.ifws("apply");
      assertEquals(applied.code, 0, applied.stderr + applied.stdout);
      assert(existsSync(join(w.repo, ".git")), "apply did not clone");
      assertEquals(await w.git(w.repo, "rev-parse", "--abbrev-ref", "HEAD"), "main");
      // the manifest's URL, never a path or a credential, is the remote
      assertEquals(await w.git(w.repo, "config", "--get", "remote.origin.url"), REMOTE);

      const again = await w.ifws("plan");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "nothing to do: every action is a skip");
      const lines = again.stdout
        .split("\n")
        .slice(1)
        .filter((l) => l.trim() !== "");
      assert(
        lines.every((l) => l.trim().startsWith("skip ")),
        `the second plan has more than skips: ${again.stdout}`,
      );
      assert(!SKIPS_ONLY.test(`\n${again.stdout.split("\n").slice(1).join("\n")}`) || lines.every((l) => l.trim().startsWith("skip ")));
      const twice = await w.ifws("apply");
      assertEquals(twice.code, 0, twice.stderr);
      assertStringIncludes(twice.stdout, "0 done");
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-025", "0025-ifws FR-023", "0023-if-workspaces FR-002"],
  "apply is idempotent: a second run changes no file, no configuration and no state record",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ifws("apply")).code, 0);
      const files = [".if-workspaces/state.auto.json", "AGENTS.auto.md", "core.auto.code-workspace", ".if-workspaces/hooks/commit-msg"];
      const first = await Promise.all(files.map((f) => readTextFile(join(w.home, f))));
      const config = await readTextFile(join(w.repo, ".git", "config"));
      await new Promise((r) => setTimeout(r, 20));
      assertEquals((await w.ifws("apply")).code, 0);
      assertEquals(await Promise.all(files.map((f) => readTextFile(join(w.home, f)))), first);
      assertEquals(await readTextFile(join(w.repo, ".git", "config")), config);
      // the root holds the repositories' hosts and the workspace's own area, and the area holds what the specification names
      const allowedRoot = [".if-workspaces", "git.example.org", "AGENTS.auto.md", "core.auto.code-workspace", "lefthook.auto.yml"];
      assertEquals(
        readDirSync(w.home)
          .map((e) => e.name)
          .filter((n) => !allowedRoot.includes(n)),
        [],
      );
      const area = readDirSync(join(w.home, ".if-workspaces"))
        .map((e) => e.name)
        .sort();
      assertEquals(area, ["evidence", "git.auto.conf", "hooks", "modules.auto.json", "state.auto.json", "tools.auto.json", "workspace.ts"]);
    });
  },
  needsWorld,
);

proves(
  ["0024-ifws-host FR-013", "0024-ifws-host FR-020", "0023-if-workspaces FR-003", "0023-if-workspaces FR-004"],
  "apply sets the hooks path and the policy's settings in the repository's own configuration and writes nothing to the user's global Git configuration or any file of the user's home",
  async () => {
    await withWorld(async (w) => {
      const digest = await w.userDigest();
      await w.ifws("init");
      await w.manifest({
        ...ONE_REPOSITORY,
        identity: { name: "Workspace Person", email: "workspace@example.org" },
        policy: { requiresSignedCommits: true },
        signing: { format: "ssh", key: "/keys/id.pub" },
      });
      const applied = await w.ifws("apply");
      assertEquals(applied.code, 0, applied.stderr + applied.stdout);
      const local = async (key: string): Promise<string> => await w.git(w.repo, "config", "--local", "--get", key);
      assertEquals(await local("core.hooksPath"), join(w.home, ".if-workspaces", "hooks"));
      assertEquals(await local("commit.gpgsign"), "true");
      assertEquals(await local("gpg.format"), "ssh");
      assertEquals(await local("user.signingkey"), "/keys/id.pub");
      assertEquals(await local("user.name"), "Workspace Person");
      assertEquals(await local("user.email"), "workspace@example.org");
      // the global configuration, the start-up file and the SSH configuration are as they were
      assertEquals(await w.userDigest(), digest);
      // a setting that was elsewhere is replaced and shown in the plan
      await w.git(w.repo, "config", "--local", "core.hooksPath", "/elsewhere");
      const plan = await w.ifws("plan");
      assertStringIncludes(plan.stdout, "set core.hooksPath");
      assertEquals((await w.ifws("apply")).code, 0);
      assertEquals(await local("core.hooksPath"), join(w.home, ".if-workspaces", "hooks"));
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-026", "0025-ifws FR-013", "0023-if-workspaces FR-022"],
  "a repository that is behind is fast-forwarded by apply, status shows it before and after, and nothing uses the network unless --fetch is given",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      await w.ifws("apply");
      await w.advance("second");
      const quiet = await w.ifws("status");
      assertEquals(quiet.code, 0);
      assertStringIncludes(quiet.stdout, "Clean");
      assertStringIncludes(quiet.stdout, "ahead 0 behind 0");
      const fetched = await w.ifws("status", "--fetch");
      assertEquals(fetched.code, 0, fetched.stderr);
      assertStringIncludes(fetched.stdout, "Behind 1");
      assertStringIncludes(fetched.stdout, "behind 1");
      const head = await w.git(w.repo, "rev-parse", "HEAD");
      const applied = await w.ifws("apply");
      assertEquals(applied.code, 0, applied.stderr);
      assertStringIncludes(applied.stdout, "fast-forward");
      const after = await w.git(w.repo, "rev-parse", "HEAD");
      assert(after !== head, "the branch did not move");
      assertEquals(after, await w.git(w.repo, "rev-parse", "origin/main"));
      const status = await w.ifws("status");
      assertStringIncludes(status.stdout, "ahead 0 behind 0");
      assertStringIncludes((await w.ifws("plan")).stdout, "nothing to do");
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-022", "0023-if-workspaces FR-026", "0023-if-workspaces FR-027", "0025-ifws FR-013"],
  "a repository with uncommitted changes, with commits of its own or diverged is skipped with its reason and nothing in it is touched; status ends with findings for a diverged one",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      await w.ifws("apply");
      // uncommitted work, and a remote that moved on
      await writeTextFile(join(w.repo, "README.md"), "# my own edit\n");
      await w.advance("remote-one");
      assertEquals((await w.ifws("status", "--fetch")).code, 0);
      const dirty = await w.ifws("apply");
      assertEquals(dirty.code, 0);
      assertEquals(await readTextFile(join(w.repo, "README.md")), "# my own edit\n");
      assertStringIncludes((await w.ifws("plan")).stdout, "uncommitted changes");
      await w.git(w.repo, "checkout", "--", "README.md");
      // a commit of its own: ahead, and then diverged
      await writeTextFile(join(w.repo, "mine.txt"), "mine\n");
      await w.git(w.repo, "add", ".");
      await w.git(w.repo, "commit", "-q", "-m", "mine");
      const mine = await w.git(w.repo, "rev-parse", "HEAD");
      const diverged = await w.ifws("status");
      assertEquals(diverged.code, 1, diverged.stdout);
      assertStringIncludes(diverged.stdout, "Diverged +1/-1");
      assertStringIncludes(diverged.stdout, "only a person merges");
      const applied = await w.ifws("apply");
      assertEquals(applied.code, 1, applied.stdout);
      assertEquals(await w.git(w.repo, "rev-parse", "HEAD"), mine, "apply moved a diverged branch");
      assert(existsSync(join(w.repo, "mine.txt")));
      // only ahead: skipped, no finding
      await w.git(w.repo, "reset", "-q", "--hard", "origin/main");
      await writeTextFile(join(w.repo, "mine.txt"), "mine\n");
      await w.git(w.repo, "add", ".");
      await w.git(w.repo, "commit", "-q", "-m", "mine again");
      const ahead = await w.ifws("plan");
      assertStringIncludes(ahead.stdout, "its remote does not");
      assertEquals(ahead.code, 0);
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-028", "0023-if-workspaces FR-027"],
  "a Git lock file makes the repository locked: it is not acted on, the lock is not removed, and status ends with findings",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      await w.ifws("apply");
      await w.advance("while-locked");
      await w.ifws("status", "--fetch");
      const lock = join(w.repo, ".git", "index.lock");
      await writeTextFile(lock, "");
      const status = await w.ifws("status");
      assertEquals(status.code, 1, status.stdout);
      assertStringIncludes(status.stdout, "Locked");
      assertStringIncludes(status.stdout, "locked");
      const head = await w.git(w.repo, "rev-parse", "HEAD").catch(() => "");
      const applied = await w.ifws("apply");
      assertEquals(applied.code, 1, applied.stdout);
      assert(existsSync(lock), "the lock file was removed");
      assertEquals(await w.git(w.repo, "rev-parse", "HEAD").catch(() => ""), head);
      await remove(lock);
      assertEquals((await w.ifws("apply")).code, 0);
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-022", "0023-if-workspaces FR-027", "0025-ifws FR-013"],
  "a folder that holds another remote's clone, or that is not a repository, is refused and never overwritten",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      await mkdir(w.repo, { recursive: true });
      await writeTextFile(join(w.repo, "notes.txt"), "not a repository\n");
      const notRepo = await w.ifws("apply");
      assertEquals(notRepo.code, 1, notRepo.stdout);
      assertStringIncludes(notRepo.stdout, "not a Git repository");
      assertEquals(await readTextFile(join(w.repo, "notes.txt")), "not a repository\n");
      assertEquals((await w.ifws("status")).code, 1);
      await remove(w.repo, { recursive: true });
      // another remote's clone at the path
      await mkdir(w.repo, { recursive: true });
      await w.git(w.repo, "init", "-q", "-b", "main");
      await w.git(w.repo, "remote", "add", "origin", "https://git.example.org/other/thing.git");
      const wrong = await w.ifws("apply");
      assertEquals(wrong.code, 1, wrong.stdout);
      assertStringIncludes(wrong.stdout, "git.example.org/other/thing");
      assertEquals(await w.git(w.repo, "config", "--get", "remote.origin.url"), "https://git.example.org/other/thing.git");
      const status = await w.ifws("status");
      assertEquals(status.code, 1);
      assertStringIncludes(status.stdout, "WrongRemote");
      assertStringIncludes(status.stdout, "never overwritten");
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-028"],
  "two runs of ifws on one workspace do not write at once: the second refuses, naming the first, and a lock whose holder is gone is taken over",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      const lockPath = join(w.home, ".if-workspaces", "ifws.lock");
      const held = await acquireLock(lockPath, { wait: false, command: "ifws apply (the first run)" });
      assert(held !== undefined);
      try {
        const second = await w.ifws("apply");
        assertEquals(second.code, 3, second.stdout);
        assertStringIncludes(second.stderr, "ifws apply (the first run)");
        assert(!existsSync(w.repo), "the second run wrote while the first held the lock");
      } finally {
        held?.release();
      }
      await writeTextFile(
        lockPath,
        `${JSON.stringify({ pid: 2 ** 22 + 1, command: "a run that is gone", since: "2026-01-01T00:00:00Z", token: "x" })}\n`,
      );
      assertEquals((await w.ifws("apply")).code, 0);
      assert(existsSync(w.repo));
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-029", "0023-if-workspaces FR-027", "0023-if-workspaces FR-030", "0025-ifws FR-012", "0025-ifws FR-017"],
  "a generated file that is no longer generated is removed only with --allow-destructive and only while it is as written; apply never installs a tool or changes the host, and a dry run of setup changes nothing",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest({ ...ONE_REPOSITORY, direnv: false });
      await w.ifws("apply");
      assert(existsSync(join(w.home, "core.auto.code-workspace")));
      // the group goes away: its file is no longer generated
      await w.manifest({ repositories: [{ remote: REMOTE, branch: "main" }] });
      const plan = await w.ifws("plan");
      assertStringIncludes(plan.stdout, "remove the generated file core.auto.code-workspace");
      const kept = await w.ifws("apply");
      assertEquals(kept.code, 0, kept.stderr);
      assert(existsSync(join(w.home, "core.auto.code-workspace")), "a destructive action ran without --allow-destructive");
      assertStringIncludes(kept.stdout, "--allow-destructive");
      // edited by hand: never removed, even with the flag
      await writeTextFile(join(w.home, "core.auto.code-workspace"), '{ "mine": true }\n');
      const edited = await w.ifws("apply", "--allow-destructive");
      assertEquals(edited.code, 1, edited.stdout);
      assertEquals(await readTextFile(join(w.home, "core.auto.code-workspace")), '{ "mine": true }\n');
      // as written: removed
      await w.manifest(ONE_REPOSITORY);
      await w.ifws("render", "--force");
      await w.manifest({ repositories: [{ remote: REMOTE, branch: "main" }] });
      const removed = await w.ifws("apply", "--allow-destructive");
      assertEquals(removed.code, 0, removed.stdout + removed.stderr);
      assert(!existsSync(join(w.home, "core.auto.code-workspace")));
      // setup and tools are modules; neither plan nor apply holds a step that installs or changes the host, and a dry run of setup changes nothing
      const list = await w.ifws("list", "--json");
      const names = (JSON.parse(list.stdout) as { data: { modules: { name: string }[] } }).data.modules.map((m) => m.name);
      assert(names.includes("setup") && names.includes("tools"), names.join(","));
      const before = readDirSync(w.home)
        .map((e) => e.name)
        .sort();
      const dry = await w.ifws("setup");
      assertStringIncludes(dry.stdout, "dry run: nothing is changed");
      assertEquals(
        readDirSync(w.home)
          .map((e) => e.name)
          .sort(),
        before,
      );
      for (const text of [plan.stdout, kept.stdout]) assert(!/install |change the host/.test(text), text);
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-016", "0023-if-workspaces FR-007", "0023-if-workspaces FR-027", "0023-if-workspaces FR-034"],
  "worktree create makes a worktree only where someone else or uncommitted work is on the repository, on a branch named for its issue; list shows it; prune removes only one with no work, and only with --allow-destructive",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      await w.ifws("apply");
      const own = await w.ifws("worktree", "create", "tool", "10-ifws-host");
      assertEquals(own.code, 0, own.stderr);
      assertStringIncludes(own.stdout, "its own checkout");
      assert(!existsSync(join(w.home, ".worktrees")), "a worktree was made where the checkout is free");
      // a branch that names no issue is a usage error, however it is asked
      const bad = await w.ifws("worktree", "create", "tool", "feature-x", "--always");
      assertEquals(bad.code, 2);
      assertStringIncludes(bad.stderr, "named for its issue");
      // uncommitted work on the repository
      await writeTextFile(join(w.repo, "wip.txt"), "work in progress\n");
      const made = await w.ifws("worktree", "create", "git.example.org/team/tool", "10-ifws-host");
      assertEquals(made.code, 0, made.stderr);
      const place = join(w.home, ".worktrees", "git.example.org", "team", "tool", "10-ifws-host");
      assert(existsSync(join(place, ".git")), `no worktree at ${place}: ${made.stdout}`);
      assertEquals(await w.git(place, "rev-parse", "--abbrev-ref", "HEAD"), "10-ifws-host");
      assert(existsSync(join(w.repo, "wip.txt")), "the work in progress was disturbed");
      const listed = await w.ifws("worktree", "list");
      assertStringIncludes(listed.stdout, "10-ifws-host");
      // a worktree with an uncommitted change is kept, and so is one with a commit that is on no remote
      await writeTextFile(join(place, "change.txt"), "x\n");
      const kept = await w.ifws("worktree", "prune", "--allow-destructive");
      assertStringIncludes(kept.stdout, "kept");
      assert(existsSync(place));
      await w.git(place, "add", ".");
      await w.git(place, "commit", "-q", "-m", "unpushed");
      assertStringIncludes((await w.ifws("worktree", "prune", "--allow-destructive")).stdout, "unpushed commit");
      assert(existsSync(place));
      // as the work is pushed away, it holds nothing: named without the flag, removed with it
      await w.git(place, "push", "-q", "origin", "10-ifws-host");
      const named = await w.ifws("worktree", "prune");
      assertStringIncludes(named.stdout, "would remove");
      assert(existsSync(place), "prune removed without --allow-destructive");
      const gone = await w.ifws("worktree", "prune", "--allow-destructive");
      assertStringIncludes(gone.stdout, "removed");
      assert(!existsSync(place));
    });
  },
  needsWorld,
);

proves(
  ["0023-if-workspaces FR-041"],
  "every apply and plan wrote exactly one evidence record each",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      const before = evidenceFiles(w.home).length;
      await w.ifws("plan");
      await w.ifws("apply");
      await w.ifws("status");
      assertEquals(evidenceFiles(w.home).length, before + 3);
    });
  },
  needsWorld,
);
