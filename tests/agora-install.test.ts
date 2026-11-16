/**
 * Tests of the one-command installers of agora (erga's 274-agora FR-096), run on IFC TypeScript (Bun or Node 26) with the real programs: real `sh` and real
 * `git`, against real repositories in a temporary folder that Git's own `url.<base>.insteadOf` makes the repositories of `https://github.com/intellectual-frontiers/`.
 * Nothing stands in for Git or GitHub CLI. The one thing not run is GitHub CLI's sign-in, which needs a GitHub account and a browser.
 *
 * @module
 */
import { fs, path, proc } from "../commons/ts/runtime/mod.ts";
import { assert, assertEquals, proves } from "../commons/ts/runtime/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const SH = path.join(ROOT, "bin", "agora-install.sh");
const R = ["erga 274-agora FR-096"] as const;
const IDENTITY = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.org" };

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await proc.run(["git", ...args], { cwd, env: IDENTITY });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A place with the two repositories as GitHub would serve them (`.github.git`, `erga.git`), a workspace and a record the erga installer writes to. */
async function place(): Promise<{
  readonly top: string;
  readonly origins: string;
  readonly workspace: string;
  readonly record: string;
  readonly env: Record<string, string>;
}> {
  const top = await fs.makeTempDir({ prefix: "agora-install-" });
  const origins = path.join(top, "origins");
  const record = path.join(top, "record");
  for (const repo of [".github", "erga"]) {
    const bare = path.join(origins, `${repo}.git`);
    const seed = path.join(top, `seed-${repo}`);
    await fs.mkdir(bare, { recursive: true });
    await git(bare, "init", "--bare", "-b", "main");
    await fs.mkdir(path.join(seed, "bin"), { recursive: true });
    await git(seed, "init", "-b", "main");
    // What erga's installer is, for this test: it says it ran, and in which commit of which copy.
    await fs.writeTextFile(
      path.join(seed, "bin", "install.sh"),
      `#!/bin/sh\necho "installer ran in $(git -C "$(dirname "$0")/.." rev-parse --short HEAD)" >> "${record}"\n`,
    );
    await fs.writeTextFile(path.join(seed, "notes.txt"), "one\n");
    await git(seed, "add", ".");
    await git(seed, "commit", "-m", "first");
    await git(seed, "remote", "add", "origin", bare);
    await git(seed, "push", "-u", "origin", "main");
  }
  const workspace = path.join(top, "workspace");
  const env = {
    HOME: path.join(top, "home"),
    PATH: "/usr/bin:/bin",
    ERGA_WORKSPACES: workspace,
    // Git's own mapping of the GitHub address to the folder of repositories: nothing in the installer knows of it.
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.${origins}/.insteadOf`,
    GIT_CONFIG_VALUE_0: "https://github.com/intellectual-frontiers/",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    ...IDENTITY,
  };
  return { top, origins, workspace, record, env };
}

const install = (env: Record<string, string>) => proc.run(["sh", SH], { env, clearEnv: true });

proves(R, "agora-install.sh copies .github and erga into the workspace, side by side, and runs erga's installer", async () => {
  if (proc.build.os === "windows") return;
  const p = await place();
  try {
    const r = await install(p.env);
    assertEquals(r.code, 0);
    for (const repo of [".github", "erga"]) assert(await fs.exists(path.join(p.workspace, repo, ".git")), `${repo} is in the workspace`);
    assert(r.stdout.includes(`copying .github to ${p.workspace}/.github`), r.stdout);
    assert(r.stdout.includes(`copying erga to ${p.workspace}/erga`), r.stdout);
    const head = await git(path.join(p.workspace, "erga"), "rev-parse", "--short", "HEAD");
    assertEquals((await fs.readTextFile(p.record)).trim(), `installer ran in ${head}`);
  } finally {
    await fs.remove(p.top, { recursive: true });
  }
});

proves(R, "repositories already there are said to be, brought up to date by a real fast-forward, and the install goes on", async () => {
  if (proc.build.os === "windows") return;
  const p = await place();
  try {
    assertEquals((await install(p.env)).code, 0);
    // Someone pushes to erga's origin.
    const other = path.join(p.top, "other");
    await git(p.top, "clone", "-q", path.join(p.origins, "erga.git"), other);
    await fs.writeTextFile(path.join(other, "notes.txt"), "two\n");
    await git(other, "commit", "-qam", "second");
    await git(other, "push", "-q", "origin", "main");
    await fs.remove(p.record);
    const r = await install(p.env);
    assertEquals(r.code, 0);
    assert(r.stdout.includes(`✅ .github is already in ${p.workspace}/.github; bringing it up to date`), r.stdout);
    assert(r.stdout.includes(`✅ erga is already in ${p.workspace}/erga; bringing it up to date`), r.stdout);
    assert(!r.stdout.includes("copying"), r.stdout);
    assertEquals(await git(path.join(p.workspace, "erga"), "rev-parse", "HEAD"), await git(other, "rev-parse", "HEAD"));
    assertEquals((await fs.readTextFile(p.record)).trim(), `installer ran in ${await git(other, "rev-parse", "--short", "HEAD")}`);
  } finally {
    await fs.remove(p.top, { recursive: true });
  }
});

proves(R, "a copy that cannot be fast-forwarded is said and left as it is, and the install goes on", async () => {
  if (proc.build.os === "windows") return;
  const p = await place();
  try {
    assertEquals((await install(p.env)).code, 0);
    const mine = path.join(p.workspace, "erga");
    await fs.writeTextFile(path.join(mine, "notes.txt"), "my own change\n");
    await git(mine, "commit", "-qam", "mine");
    const other = path.join(p.top, "other");
    await git(p.top, "clone", "-q", path.join(p.origins, "erga.git"), other);
    await fs.writeTextFile(path.join(other, "notes.txt"), "theirs\n");
    await git(other, "commit", "-qam", "theirs");
    await git(other, "push", "-q", "origin", "main");
    const before = await git(mine, "rev-parse", "HEAD");
    const r = await install(p.env);
    assertEquals(r.code, 0);
    assert(r.stdout.includes("erga could not be fast-forwarded, so it is left as it is"), r.stdout);
    assertEquals(await git(mine, "rev-parse", "HEAD"), before);
    assertEquals(await fs.readTextFile(path.join(mine, "notes.txt")), "my own change\n");
  } finally {
    await fs.remove(p.top, { recursive: true });
  }
});

proves(
  R,
  "where erga cannot be read and GitHub CLI is not installed, it says so with the one line that installs Git and GitHub CLI, and exits 3",
  async () => {
    if (proc.build.os === "windows") return;
    const p = await place();
    try {
      // A PATH of the real tools the script uses, and no GitHub CLI; erga's address maps to a folder that has no repositories.
      const tools = path.join(p.top, "tools");
      await fs.mkdir(tools);
      for (const name of ["sh", "uname", "dirname", "mkdir", "cat"]) {
        const real = proc.which(name);
        if (real !== undefined) await fs.symlink(real, path.join(tools, name));
      }
      await fs.symlink(proc.which("git") ?? "git", path.join(tools, "git"));
      const env = { ...p.env, PATH: tools, GIT_CONFIG_KEY_0: `url.${path.join(p.top, "nowhere")}/.insteadOf` };
      const r = await install(env);
      assertEquals(r.code, 3);
      assert(r.stderr.includes("GitHub CLI is not installed, and erga cannot be read without signing in"), r.stderr);
      assert(
        /apt-get install -y git gh|pacman -S --needed git github-cli|dnf install -y git gh|brew install git gh/.test(r.stderr),
        r.stderr,
      );
      assertEquals(await fs.exists(p.workspace), false);
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

proves(R, "agora-install.ps1 does the same in the same order: Git, readable or sign in, both repositories, erga's installer", async () => {
  const ps = await fs.readTextFile(path.join(ROOT, "bin", "agora-install.ps1"));
  const order = [
    "Get-Command git",
    "ls-remote --exit-code",
    "Get-Command gh",
    "gh auth login --hostname github.com --git-protocol https --web",
    "gh auth setup-git",
    "function Sync-Repo",
    "is already in $dest; bringing it up to date",
    "pull --ff-only",
    "git clone",
    "Sync-Repo '.github'",
    "Sync-Repo 'erga'",
    "bin\\install.ps1",
  ];
  let at = -1;
  for (const needle of order) {
    const i = ps.indexOf(needle, at + 1);
    assert(i > at, `${needle} comes in order`);
    at = i;
  }
  assert(ps.includes("winget install --id Git.Git -e; winget install --id GitHub.cli -e"));
});
