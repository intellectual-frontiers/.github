/**
 * What the tests of the `ifws` command share: a world made of real things, in a temporary folder. A bare Git repository stands as the remote the manifest names (`https://git.example.org/team/tool.git`,
 * which Git is told, by the environment of each run, to fetch from that folder: `url.<path>.insteadOf`, so that nothing reaches a network), a second clone of it that pushes what "another person" does,
 * a user's home with the sentinel files a profile manager would touch (`.gitconfig`, `.bashrc`, `.ssh/config`), and the root of the workspace. `ifws` is run as a real program on the runtime that runs
 * the test, with that environment, as a person runs it. Nothing here stands in for the code under test.
 *
 * @module
 */
import { makeTempDir, readFileSync, readTextFile, remove, writeTextFile, mkdir, existsSync, readDirSync, statSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { build, execPath, run, which } from "../runtime/proc.ts";
import { assert } from "../runtime/test.ts";
import { sha256 } from "../kernel/sha256.ts";

/** The package folder (`commons/ts`). */
export const PACKAGE = resolve(dirname(fromFileUrl(import.meta.url)), "..");
/** The controller, the file `ifws` is. */
export const IFWS = join(PACKAGE, "workspaces", "ifws.ts");
/** The launcher the package's `bin` names. */
export const LAUNCHER = join(PACKAGE, "node", "ifws.mjs");

/** Why a test of the command is skipped here, or nothing. */
export const needsWorld =
  which("git") === undefined || which("sh") === undefined
    ? { skip: "git or sh is not installed" }
    : build.os === "windows"
      ? { skip: "these tests run git and sh on Unix paths; the Windows job runs the pure tests" }
      : {};

/** What a run of `ifws` did. */
export type Ran = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** The URL the manifest names, which Git fetches from the bare repository on disk. */
export const REMOTE = "https://git.example.org/team/tool.git";

/** One world. */
export type World = {
  readonly dir: string;
  /** The root of the workspace. */
  readonly home: string;
  /** The user's home: its sentinel files must not change. */
  readonly user: string;
  /** The bare repository that stands as the remote. */
  readonly bare: string;
  /** The folder of the managed repository, once cloned. */
  readonly repo: string;
  readonly env: Record<string, string>;
  /** Runs `ifws` with these words on the runtime that runs the test. */
  ifws(...words: string[]): Promise<Ran>;
  /** Runs `ifws` on a given runtime program, through the launcher or the controller. */
  ifwsOn(program: string, entry: string, words: readonly string[], env?: Record<string, string>): Promise<Ran>;
  /** git as the user, in a folder. */
  git(cwd: string, ...args: string[]): Promise<string>;
  /** Writes the manifest (default export) of the workspace. */
  manifest(value: unknown): Promise<void>;
  /** Another person adds a commit to the remote. */
  advance(name: string): Promise<void>;
  /** A hash over everything in the user's home. */
  userDigest(): Promise<string>;
};

async function digestOf(folder: string): Promise<string> {
  const parts: string[] = [];
  const walk = async (dir: string, rel: string): Promise<void> => {
    for (const e of readDirSync(dir).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      if (e.isDirectory) await walk(p, `${rel}/${e.name}`);
      else parts.push(`${rel}/${e.name}:${await sha256(readFileSync(p))}`);
    }
  };
  await walk(folder, "");
  return await sha256(parts.join("\n"));
}

/** Makes a world, runs `f` in it and removes it. */
export async function withWorld(f: (w: World) => Promise<void>): Promise<void> {
  const dir = await makeTempDir({ prefix: "ifws-" });
  try {
    const user = join(dir, "user");
    const home = join(dir, "ws");
    const bare = join(dir, "remote.git");
    const seed = join(dir, "seed");
    await mkdir(join(user, ".ssh"), { recursive: true });
    await writeTextFile(
      join(user, ".gitconfig"),
      "[user]\n\tname = A Person\n\temail = a.person@example.org\n[commit]\n\tgpgsign = false\n",
    );
    await writeTextFile(join(user, ".bashrc"), "# a person's own start-up file\nexport EDITOR=vi\n");
    await writeTextFile(join(user, ".ssh", "config"), "Host example\n  User git\n");
    const env: Record<string, string> = {
      HOME: user,
      GIT_CONFIG_GLOBAL: join(user, ".gitconfig"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.${bare}.insteadOf`,
      GIT_CONFIG_VALUE_0: REMOTE,
      GIT_TERMINAL_PROMPT: "0",
      IFC_WORKSPACES_HOME: home,
      // Bun keeps a cache of what it transpiles under the user's home by default: not ifws's doing, and not wanted in a test of what ifws writes there
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
    };
    const git = async (cwd: string, ...args: string[]): Promise<string> => {
      const r = await run(["git", "-C", cwd, ...args], { env });
      assert(r.success, `git ${args.join(" ")} in ${cwd}: ${r.stderr}`);
      return r.stdout.trim();
    };
    await mkdir(seed, { recursive: true });
    await git(seed, "init", "-q", "-b", "main");
    await writeTextFile(join(seed, "README.md"), "# tool\n");
    await git(seed, "add", ".");
    await git(seed, "commit", "-q", "-m", "first");
    const cloned = await run(["git", "clone", "-q", "--bare", seed, bare], { env });
    assert(cloned.success, cloned.stderr);
    await git(seed, "remote", "add", "origin", bare);
    await git(seed, "fetch", "-q", "origin");
    await git(seed, "branch", "-q", "--set-upstream-to=origin/main", "main");
    let n = 0;
    const world: World = {
      dir,
      home,
      user,
      bare,
      repo: join(home, "git.example.org", "team", "tool"),
      env,
      ifws: (...words) => world.ifwsOn(execPath(), IFWS, words),
      ifwsOn: async (program, entry, words, extra = {}) => {
        const r = await run([program, entry, ...words], { env: { ...env, ...extra }, cwd: dir });
        return { code: r.code, stdout: r.stdout, stderr: r.stderr };
      },
      git,
      manifest: async (value) => {
        await mkdir(join(home, ".if-workspaces"), { recursive: true });
        await writeTextFile(join(home, ".if-workspaces", "workspace.ts"), `export default ${JSON.stringify(value, null, 2)};\n`);
      },
      advance: async (name) => {
        n++;
        await writeTextFile(join(seed, `${name}-${n}.txt`), `${name}\n`);
        await git(seed, "add", ".");
        await git(seed, "commit", "-q", "-m", name);
        await git(seed, "push", "-q", "origin", "main");
      },
      userDigest: () => digestOf(user),
    };
    await f(world);
  } finally {
    await remove(dir, { recursive: true });
  }
}

/** The manifest most tests use: the one repository, in the group `core`. */
export const ONE_REPOSITORY = { repositories: [{ remote: REMOTE, group: "core", branch: "main" }] };

/** The paths of every evidence record under a workspace, oldest first. */
export function evidenceFiles(home: string): string[] {
  const root = join(home, ".if-workspaces", "evidence");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readDirSync(dir)) {
      if (e.isDirectory) walk(join(dir, e.name));
      else out.push(join(dir, e.name));
    }
  };
  walk(root);
  return out.sort();
}

/** Reads a file as text, with CRLF made LF, as a file the repository checks out. */
export async function lf(path: string): Promise<string> {
  return (await readTextFile(path)).replaceAll("\r\n", "\n");
}

/** The modification time of a file in milliseconds. */
export function mtime(path: string): number {
  return statSync(path).mtime?.getTime() ?? 0;
}
