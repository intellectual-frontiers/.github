/**
 * Tests of the one-command installers of agora (erga's 274-agora FR-096), run on IFC TypeScript (Bun or Node 26) with the real programs: real `sh` and real
 * `git`, against real repositories in a temporary folder that Git's own `url.<base>.insteadOf` makes the repositories of `https://github.com/intellectual-frontiers/`.
 * Nothing stands in for Git or GitHub CLI. Not run: GitHub CLI's sign-in (it needs a GitHub account and a browser), and the PowerShell installer's Windows steps, including turning on
 * Windows' long paths (they need Windows and an administrator's prompt), which the last test reads for their order and content.
 *
 * @module
 */
import { fs, path, proc } from "../commons/ts/runtime/mod.ts";
import { assert, assertEquals, proves } from "../commons/ts/runtime/test.ts";

const ROOT = path.resolve(
  path.dirname(path.fromFileUrl(import.meta.url)),
  "..",
);
const SH = path.join(ROOT, "bin", "agora-install.sh");
const R = ["erga 274-agora FR-096"] as const;
const IDENTITY = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.org",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.org",
};

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
    await fs.mkdir(path.join(seed, "docs"), { recursive: true });
    await fs.writeTextFile(path.join(seed, "docs", "a.txt"), "a\n");
    await fs.writeTextFile(path.join(seed, "docs", "b.txt"), "b\n");
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

const install = (env: Record<string, string>) =>
  proc.run(["sh", SH], { env, clearEnv: true });

proves(
  R,
  "agora-install.sh copies .github and erga into the workspace, side by side, and runs erga's installer",
  async () => {
    if (proc.build.os === "windows") return;
    const p = await place();
    try {
      const r = await install(p.env);
      assertEquals(r.code, 0);
      for (const repo of [".github", "erga"])
        assert(
          await fs.exists(path.join(p.workspace, repo, ".git")),
          `${repo} is in the workspace`,
        );
      assert(
        r.stdout.includes(`copying .github to ${p.workspace}/.github`),
        r.stdout,
      );
      assert(
        r.stdout.includes(`copying erga to ${p.workspace}/erga`),
        r.stdout,
      );
      const head = await git(
        path.join(p.workspace, "erga"),
        "rev-parse",
        "--short",
        "HEAD",
      );
      assertEquals(
        (await fs.readTextFile(p.record)).trim(),
        `installer ran in ${head}`,
      );
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

proves(
  R,
  "repositories already there are said to be, brought up to date by a real fast-forward, and the install goes on",
  async () => {
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
      assert(
        r.stdout.includes(
          `✅ .github is already in ${p.workspace}/.github; bringing it up to date`,
        ),
        r.stdout,
      );
      assert(
        r.stdout.includes(
          `✅ erga is already in ${p.workspace}/erga; bringing it up to date`,
        ),
        r.stdout,
      );
      assert(!r.stdout.includes("copying"), r.stdout);
      assertEquals(
        await git(path.join(p.workspace, "erga"), "rev-parse", "HEAD"),
        await git(other, "rev-parse", "HEAD"),
      );
      assertEquals(
        (await fs.readTextFile(p.record)).trim(),
        `installer ran in ${await git(other, "rev-parse", "--short", "HEAD")}`,
      );
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

proves(
  R,
  "a copy that an earlier install did not finish gets back the files it lacks, and only those, and is then brought up to date",
  async () => {
    if (proc.build.os === "windows") return;
    const p = await place();
    try {
      assertEquals((await install(p.env)).code, 0);
      const mine = path.join(p.workspace, "erga");
      // The earlier copy stopped part way: two files are missing; and a file the person changed is theirs.
      await fs.remove(path.join(mine, "docs", "a.txt"));
      await fs.remove(path.join(mine, "docs", "b.txt"));
      await fs.writeTextFile(path.join(mine, "scratch.txt"), "mine\n");
      const other = path.join(p.top, "other");
      await git(p.top, "clone", "-q", path.join(p.origins, "erga.git"), other);
      await fs.writeTextFile(path.join(other, "notes.txt"), "two\n");
      await git(other, "commit", "-qam", "second");
      await git(other, "push", "-q", "origin", "main");
      const r = await install(p.env);
      assertEquals(r.code, 0);
      assert(
        r.stdout.includes(
          "restoring the 2 files an earlier copy of erga did not finish",
        ),
        r.stdout,
      );
      assert(!r.stdout.includes("could not be fast-forwarded"), r.stdout);
      assertEquals(
        await fs.readTextFile(path.join(mine, "docs", "a.txt")),
        "a\n",
      );
      assertEquals(
        await fs.readTextFile(path.join(mine, "docs", "b.txt")),
        "b\n",
      );
      assertEquals(
        await fs.readTextFile(path.join(mine, "scratch.txt")),
        "mine\n",
      );
      assertEquals(
        await git(mine, "rev-parse", "HEAD"),
        await git(other, "rev-parse", "HEAD"),
      );
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

proves(
  R,
  "a copy that cannot be fast-forwarded is said and left as it is, and the install goes on",
  async () => {
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
      assert(
        r.stdout.includes(
          "erga could not be fast-forwarded, so it is left as it is",
        ),
        r.stdout,
      );
      assertEquals(await git(mine, "rev-parse", "HEAD"), before);
      assertEquals(
        await fs.readTextFile(path.join(mine, "notes.txt")),
        "my own change\n",
      );
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

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
      const env = {
        ...p.env,
        PATH: tools,
        GIT_CONFIG_KEY_0: `url.${path.join(p.top, "nowhere")}/.insteadOf`,
      };
      const r = await install(env);
      assertEquals(r.code, 3);
      assert(
        r.stderr.includes(
          "GitHub CLI is not installed, and erga cannot be read without signing in",
        ),
        r.stderr,
      );
      assert(
        /apt-get install -y git gh|pacman -S --needed git github-cli|dnf install -y git gh|brew install git gh/.test(
          r.stderr,
        ),
        r.stderr,
      );
      assertEquals(await fs.exists(p.workspace), false);
    } finally {
      await fs.remove(p.top, { recursive: true });
    }
  },
);

proves(
  R,
  "agora-install.ps1, which `irm | iex` runs inside the person's own session, never ends or changes that session, so the window stays open",
  async () => {
    const ps = await fs.readTextFile(
      path.join(ROOT, "bin", "agora-install.ps1"),
    );
    const code = ps
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    // No `exit` statement (which closes the window of an `iex`), and no class (which a second `iex` in the same session cannot redefine).
    assert(!/(^|[\s;{(])exit(\s|;|$)/m.test(code), "no exit statement");
    assert(!/^\s*class\s/m.test(code), "no class");
    // Everything runs in one function, whose settings are its own; what it needs of the session's environment it puts back; the result is $LASTEXITCODE.
    assert(code.includes("function Install-Agora {"), "one function");
    assert(
      code.indexOf("$ErrorActionPreference = 'Stop'") >
        code.indexOf("function Install-Agora {"),
      "its error handling is the function's own",
    );
    assert(
      code.includes("throw [System.OperationCanceledException]::new($What)") &&
        code.includes("catch [System.OperationCanceledException]"),
      "a stop is caught, not an exit",
    );
    assert(
      code.includes("$global:LASTEXITCODE = $agoraInstallCode"),
      "the result is left in LASTEXITCODE",
    );
    assert(
      code.includes("Remove-Item Env:GIT_TERMINAL_PROMPT") &&
        code.includes("$env:GIT_TERMINAL_PROMPT = $before"),
      "the Git variable is put back",
    );
    // A window opened only to run the command waits for Enter; one the person opened does not.
    assert(
      code.includes("Read-Host 'Press Enter to close this window'") &&
        code.includes("-noexit"),
      "a one-shot window waits",
    );
    assert(
      code.trimEnd().endsWith("Wait-BeforeClose"),
      "the wait is the last thing it does",
    );
  },
);

proves(
  R,
  "agora-install.ps1 does the same in the same order: Git, readable or sign in, both repositories, erga's installer",
  async () => {
    const ps = await fs.readTextFile(
      path.join(ROOT, "bin", "agora-install.ps1"),
    );
    const order = [
      "Get-Command git",
      "LongPathsEnabled",
      "Start-Process powershell -Verb RunAs",
      "git config --global core.longpaths true",
      "ls-remote --exit-code",
      "Get-Command gh",
      "gh auth login --hostname github.com --git-protocol https --web",
      "gh auth setup-git",
      "function Sync-Repo",
      "is already in $dest; bringing it up to date",
      "ls-files --deleted",
      "restore --pathspec-from-file=-",
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
    assert(
      ps.includes(
        "winget install --id Git.Git -e; winget install --id GitHub.cli -e",
      ),
    );
    assert(
      ps.includes("HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem"),
      "the registry key of Windows' long paths",
    );
    assert(
      ps.includes(
        "Set-ItemProperty -Path '$fileSystem' -Name LongPathsEnabled -Type DWord -Value 1",
      ),
      "the one value it sets",
    );
  },
);
