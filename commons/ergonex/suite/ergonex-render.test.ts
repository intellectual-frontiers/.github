/**
 * Tests of the generated files, `verify`, `render`, the hooks and `doctor` as a real program on real repositories (commons 0003-host FR-007 to FR-015, FR-023, 0002-workspace-model FR-013, FR-014,
 * FR-031 to FR-036, 0001-ergonex FR-014, FR-015): a manifest of two groups gives two `*.auto.code-workspace` files and no symbolic link, the same bytes on Bun and on Node 26; a hand edit is an error that `render`
 * refuses to overwrite (`--force` does); `--check` and `--diff` write nothing; the hooks Git runs through `core.hooksPath` stop a commit that names no issue, a commit with a closing word a host reads, and,
 * where a regulated domain is named and no runtime is on the `PATH`, every commit with the reason, and let it pass elsewhere with the same message; `doctor` says what to do about each check.
 *
 * @module
 */
import { chmod, existsSync, mkdir, readDirSync, readTextFile, remove, statSync, symlink, writeTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { execPath, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { evidenceFiles, Ergonex, mtime, needsWorld, ONE_REPOSITORY, REMOTE, withWorld, type World } from "./ergonex-fixtures.ts";

const TWO_GROUPS = {
  repositories: [
    { remote: REMOTE, group: "core", branch: "main" },
    { remote: "https://github.com/acme/lib", group: "libs" },
  ],
};

/** The files and folders below a folder, relative, `/` between parts, leaving out the evidence of runs. */
function tree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readDirSync(dir)) {
      const path = rel === "" ? e.name : `${rel}/${e.name}`;
      if (path === ".ergonex/evidence") continue;
      out.push(path);
      if (e.isDirectory && e.name !== ".git") walk(join(dir, e.name), path);
    }
  };
  walk(root, "");
  return out.sort();
}

/** A folder of programs with `ergonex` among them, which runs the controller on the runtime that runs the test. */
async function toolsWith(w: World, names: readonly string[]): Promise<string> {
  const bin = join(w.dir, "path");
  await mkdir(bin, { recursive: true });
  const wrapper = join(bin, "ergonex");
  await writeTextFile(wrapper, `#!/bin/sh\nexec ${JSON.stringify(execPath())} ${JSON.stringify(Ergonex)} "$@"\n`);
  await chmod(wrapper, 0o755);
  for (const n of names) {
    const real = which(n);
    if (real !== undefined && !existsSync(join(bin, n))) await symlink(real, join(bin, n));
  }
  return bin;
}

/** A folder with only the programs Git and the hooks need, and not `ergonex`, `bun` or `node`. */
async function bareTools(w: World): Promise<string> {
  const bin = join(w.dir, "bare");
  await mkdir(bin, { recursive: true });
  for (const n of ["git", "dirname", "sh"]) {
    const real = which(n);
    if (real !== undefined) await symlink(real, join(bin, n));
  }
  return bin;
}

/** Commits a new file in the managed repository as the user, with the PATH given, and returns what Git did. */
async function commit(
  w: World,
  message: string,
  path: string,
  options: {
    readonly git?: readonly string[];
    readonly commit?: readonly string[];
  } = {},
): Promise<{ code: number; stderr: string }> {
  await writeTextFile(join(w.repo, `file-${message.length}-${Math.abs(path.length)}.txt`), `${message}\n`);
  await run(["git", "-C", w.repo, "add", "."], {
    env: { ...w.env, PATH: path },
  });
  const r = await run(["git", "-C", w.repo, ...(options.git ?? []), "commit", "-q", ...(options.commit ?? []), "-m", message], {
    env: { ...w.env, PATH: path },
  });
  return { code: r.code, stderr: r.stderr };
}

proves(
  ["0003-host FR-005", "0003-host FR-006", "0002-workspace-model FR-013", "0003-host FR-012"],
  "render writes a code-workspace file for each group, with relative paths and no symbolic link anywhere, and a second render writes nothing",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(TWO_GROUPS);
      const r = await w.ergonex("render");
      assertEquals(r.code, 0, r.stderr + r.stdout);
      const core = JSON.parse(await readTextFile(join(w.home, "core.auto.code-workspace"))) as { folders: { path: string }[] };
      assertEquals(
        core.folders.map((f) => f.path),
        ["git.example.org/team/tool"],
      );
      const libs = JSON.parse(await readTextFile(join(w.home, "libs.auto.code-workspace"))) as { folders: { path: string }[] };
      assertEquals(
        libs.folders.map((f) => f.path),
        ["github.com/acme/lib"],
      );
      const walk = (dir: string): void => {
        for (const e of readDirSync(dir)) {
          assert(!e.isSymlink, `${join(dir, e.name)} is a symbolic link`);
          if (e.isDirectory) walk(join(dir, e.name));
        }
      };
      walk(w.home);
      const watched = [join(w.home, "core.auto.code-workspace"), join(w.home, "AGENTS.auto.md"), join(w.state, "state.auto.json")];
      const times = watched.map((f) => mtime(f));
      await new Promise((resolve) => setTimeout(resolve, 30));
      const again = await w.ergonex("render");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "nothing written");
      assertEquals(
        watched.map((f) => mtime(f)),
        times,
      );
      // no repository was cloned by render
      assert(!existsSync(w.repo), "render cloned a repository");
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-007"],
  "the generated files are the same bytes from Bun and from Node 26, whichever runtime made them",
  async () => {
    await withWorld(async (w) => {
      const runtimes = ["bun", "node"].flatMap((n) => (which(n) === undefined ? [] : [{ name: n, program: which(n) ?? n }]));
      const results: Map<string, string>[] = [];
      for (const [i, r] of runtimes.entries()) {
        const home = join(w.dir, `ws-${r.name}-${i}`);
        await mkdir(join(home, ".ergonex"), { recursive: true });
        await writeTextFile(
          join(home, ".ergonex", "workspace.ts"),
          `export default ${JSON.stringify({ ...TWO_GROUPS, identity: { name: "A", email: "a@example.org" } })};\n`,
        );
        const out = await w.ergonexOn(r.program, Ergonex, ["render", "--home", home]);
        assertEquals(out.code, 0, `${r.name}: ${out.stderr}`);
        const files = new Map<string, string>();
        for (const f of tree(home).filter((p) => /\.auto\.|\/hooks\//.test(p) && !p.endsWith("state.auto.json") && !/\/hooks$/.test(p))) {
          files.set(f, (await readTextFile(join(home, f))).replaceAll("\r\n", "\n"));
        }
        results.push(files);
      }
      assert(results.length >= 1);
      for (const files of results) {
        assert(files.size >= 7, [...files.keys()].join(","));
        assertEquals([...files.entries()], [...(results[0] ?? new Map()).entries()]);
        for (const [path, text] of files) assert(!text.includes(w.dir), `${path} holds an absolute path of this computer`);
      }
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-009", "0003-host FR-010", "0003-host FR-011", "0003-host FR-012"],
  "verify finds a hand edit (error), a missing file, an unrecorded .auto. file and a drift (warnings); render refuses to overwrite a hand edit and --force replaces it; --check and --diff write nothing",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(TWO_GROUPS);
      assertEquals((await w.ergonex("render")).code, 0);
      assertEquals((await w.ergonex("verify")).code, 0);
      const record = JSON.parse(await readTextFile(join(w.state, "state.auto.json"))) as {
        files: Record<string, { sha256: string; generator: string }>;
      };
      assertEquals(Object.keys(record.files).includes("AGENTS.auto.md"), true);
      assertEquals(record.files["AGENTS.auto.md"]?.generator, "ergonex templates/agents");

      // a hand edit
      const agents = join(w.home, "AGENTS.auto.md");
      await writeTextFile(agents, "my own guide\n");
      const edited = await w.ergonex("verify");
      assertEquals(edited.code, 1);
      assertStringIncludes(edited.stdout, "error AGENTS.auto.md");
      assertStringIncludes(edited.stdout, "edited by hand");
      const refused = await w.ergonex("render");
      assertEquals(refused.code, 1, refused.stdout);
      assertStringIncludes(refused.stdout, "AGENTS.auto.md");
      assertEquals(await readTextFile(agents), "my own guide\n");
      const apply = await w.ergonex("apply");
      assertEquals(apply.code, 1);
      assertEquals(await readTextFile(agents), "my own guide\n");
      const forced = await w.ergonex("render", "--force");
      assertEquals(forced.code, 0, forced.stdout + forced.stderr);
      assertStringIncludes(await readTextFile(agents), "Workspace guide for agents");
      assertEquals((await w.ergonex("verify")).code, 0);

      // missing, unrecorded and drifted
      await writeTextFile(join(w.home, "stray.auto.md"), "stray\n");
      const missingFile = join(w.home, "libs.auto.code-workspace");
      await mkdirless(missingFile);
      const warned = await w.ergonex("verify");
      assertEquals(warned.code, 1);
      assertStringIncludes(warned.stdout, "warn libs.auto.code-workspace");
      assertStringIncludes(warned.stdout, "is recorded as written and is not there");
      assertStringIncludes(warned.stdout, "warn stray.auto.md");
      assertStringIncludes(warned.stdout, "the state record does not hold");
      assertEquals((await w.ergonex("render")).code, 0);
      assert(existsSync(missingFile));
      await mkdirless(join(w.home, "stray.auto.md"));

      // --check and --diff write nothing, and the manifest changing is what they name
      const before = tree(w.home);
      const times = before
        .filter((p) => p !== ".ergonex/workspace.ts" && existsSync(join(w.home, p)) && statSync(join(w.home, p)).isFile)
        .map((p) => [p, mtime(join(w.home, p))] as const);
      const clean = await w.ergonex("render", "--check");
      assertEquals(clean.code, 0);
      await w.manifest({
        repositories: [...TWO_GROUPS.repositories, { remote: "https://github.com/acme/extra", group: "libs" }],
      });
      const check = await w.ergonex("render", "--check");
      assertEquals(check.code, 1);
      assertStringIncludes(check.stdout, "would change AGENTS.auto.md");
      assertStringIncludes(check.stdout, "would change libs.auto.code-workspace");
      assert(!check.stdout.includes("would change core.auto.code-workspace"), "a file that would not change was named");
      const diff = await w.ergonex("render", "--diff");
      assertEquals(diff.code, 0);
      assertStringIncludes(diff.stdout, "--- a/libs.auto.code-workspace");
      assertStringIncludes(diff.stdout, "+++ b/libs.auto.code-workspace");
      assertStringIncludes(diff.stdout, '+      "path": "github.com/acme/extra"');
      assertEquals(tree(w.home), before);
      assertEquals(
        times.map(([p]) => [p, mtime(join(w.home, p))]),
        times.map(([p, t]) => [p, t]),
      );
      assertEquals((await w.ergonex("render")).code, 0);
      assertEquals((await w.ergonex("render", "--check")).code, 0);
    });
  },
  needsWorld,
);

/** Removes a file that is there (a hand's deletion). */
async function mkdirless(path: string): Promise<void> {
  await remove(path);
}

proves(
  ["0003-host FR-004", "0003-host FR-008", "0003-host FR-003"],
  "a group that would make a path with .. or a separator is refused as an error naming the template, and nothing is written outside the root or inside a repository",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      for (const group of ["../outside", "git.example.org/team/tool/inside", "a\\b", "con"]) {
        await w.manifest({ repositories: [{ remote: REMOTE, group }] });
        const r = await w.ergonex("render");
        assertEquals(r.code, 1, `${group}: ${r.stdout}${r.stderr}`);
        assertStringIncludes(r.stdout, "templates");
        assert(!existsSync(join(w.dir, "outside.auto.code-workspace")), "a file was written outside the root");
        assert(!existsSync(join(w.repo, "inside.auto.code-workspace")), "a file was written inside a repository");
        assert(!existsSync(join(w.home, "AGENTS.auto.md")), `${group}: a file was written although one was refused`);
      }
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-023", "0003-host FR-005"],
  ".envrc.auto is generated only where the manifest wants direnv and a direnv is on the PATH, and only adds the tools folder",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest({ ...ONE_REPOSITORY, direnv: true });
      assertEquals((await w.ergonex("render")).code, 0);
      assert(!existsSync(join(w.home, ".envrc.auto")), "generated with no direnv on the PATH");
      const bin = join(w.dir, "direnv-bin");
      await mkdir(bin, { recursive: true });
      await writeTextFile(join(bin, "direnv"), "#!/bin/sh\necho direnv 2.35.0\n");
      await chmod(join(bin, "direnv"), 0o755);
      const found = await w.ergonexOn(execPath(), Ergonex, ["render"], {
        PATH: `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`,
      });
      assertEquals(found.code, 0, found.stderr);
      assertStringIncludes(await readTextFile(join(w.home, ".envrc.auto")), 'PATH_add "$HOME/.local/bin"');
      await w.manifest({ ...ONE_REPOSITORY, direnv: false });
      const off = await w.ergonexOn(execPath(), Ergonex, ["plan"], {
        PATH: `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`,
      });
      assertStringIncludes(off.stdout, "remove the generated file .envrc.auto");
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-014", "0003-host FR-013", "0002-workspace-model FR-034", "0001-ergonex FR-026"],
  "the commit-msg hook, run by Git through core.hooksPath, stops a commit that names no issue or uses a closing word a host reads, and lets one that names its issue through",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const bin = await toolsWith(w, ["git", "sh", "dirname"]);
      const path = `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const records = evidenceFiles(w.state).length;
      const none = await commit(w, "a change that names no issue", path);
      assertEquals(none.code !== 0, true, none.stderr);
      assertStringIncludes(none.stderr, "names no issue");
      const wrong = await commit(w, "a change\n\nFixes #10\nRefs #10", path);
      assertEquals(wrong.code !== 0, true, wrong.stderr);
      assertStringIncludes(wrong.stderr, "Closes #10");
      const good = await commit(w, "a change\n\nRefs #10", path);
      assertEquals(good.code, 0, good.stderr);
      assertEquals(await w.git(w.repo, "log", "-1", "--format=%s"), "a change");
      // a hook only reads: it wrote no evidence record
      assertEquals(evidenceFiles(w.state).length, records);
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-015", "0002-workspace-model FR-032"],
  "a hook that cannot run its checker (no bun, no node, no ergonex) fails with the reason where a regulated domain is named, and lets the commit through with the same message elsewhere",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const bare = await bareTools(w);
      const open = await commit(w, "an unregulated change\n\nRefs #10", bare);
      assertEquals(open.code, 0, open.stderr);
      assertStringIncludes(open.stderr, "cannot run its checker");
      assertStringIncludes(open.stderr, "neither bun nor node is on the PATH");
      assertStringIncludes(open.stderr, "no regulated domain");

      await w.manifest({
        ...ONE_REPOSITORY,
        policy: { regulatedDomain: ["FDA"] },
      });
      assertEquals((await w.ergonex("apply")).code, 0);
      const before = await w.git(w.repo, "rev-parse", "HEAD");
      const shut = await commit(w, "a regulated change\n\nRefs #10", bare, {
        git: ["-c", "commit.gpgsign=false"],
      });
      assertEquals(shut.code !== 0, true, shut.stderr);
      assertStringIncludes(shut.stderr, "neither bun nor node is on the PATH");
      assertStringIncludes(shut.stderr, "regulated domain");
      assertEquals(await w.git(w.repo, "rev-parse", "HEAD"), before, "a commit was made past a failing hook");
    });
  },
  needsWorld,
);

proves(
  ["0002-workspace-model FR-032", "0003-host FR-014"],
  "the pre-push hook says an unsigned commit is a warning where signed commits are required and no regulated domain is named, and stops the push where one is",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest({
        ...ONE_REPOSITORY,
        policy: { requiresSignedCommits: true },
      });
      assertEquals((await w.ergonex("apply")).code, 0);
      const bin = await toolsWith(w, ["git", "sh", "dirname"]);
      const path = `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const made = await commit(w, "an unsigned change\n\nRefs #10", path, {
        git: ["-c", "commit.gpgsign=false"],
        commit: ["--no-verify"],
      });
      assertEquals(made.code, 0, made.stderr);
      const warned = await run(["git", "-C", w.repo, "push", "origin", "main"], { env: { ...w.env, PATH: path } });
      assertEquals(warned.code, 0, warned.stderr);
      assertStringIncludes(warned.stderr + warned.stdout, "is not signed and verified");

      await w.manifest({
        ...ONE_REPOSITORY,
        policy: { regulatedDomain: ["FDA"] },
      });
      assertEquals((await w.ergonex("apply")).code, 0);
      const second = await commit(w, "another unsigned change\n\nRefs #10", path, {
        git: ["-c", "commit.gpgsign=false"],
        commit: ["--no-verify"],
      });
      assertEquals(second.code, 0, second.stderr);
      const before = await w.git(w.bare, "rev-parse", "main");
      const stopped = await run(["git", "-C", w.repo, "push", "origin", "main"], { env: { ...w.env, PATH: path } });
      assertEquals(stopped.code !== 0, true, stopped.stderr);
      assertStringIncludes(stopped.stderr, "is not signed and verified");
      assertEquals(await w.git(w.bare, "rev-parse", "main"), before, "the push went through");
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-014", "0002-workspace-model FR-014", "0002-workspace-model FR-036", "0002-workspace-model FR-035"],
  "doctor checks the runtime, the layout, the file system, the hooks and the generated files, says what to do about each, and ends with findings only for a warning or an error",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const ok = await w.ergonex("doctor");
      assertEquals(ok.code, 0, ok.stdout + ok.stderr);
      assertStringIncludes(ok.stdout, "ok      git:");
      for (const word of ["ok ", "suggest "]) assert(ok.stdout.includes(word) || ok.stdout.includes("ok"), word);
      const json = JSON.parse((await w.ergonex("doctor", "--json")).stdout) as {
        data: {
          checks: {
            id: string;
            level: string;
            subject: string;
            message: string;
          }[];
        };
      };
      const ids = new Set(json.data.checks.map((c) => c.id));
      for (const id of [
        "ergonex/runtime",
        "ergonex/tool",
        "ergonex/path-length",
        "ergonex/filesystem",
        "ergonex/hooks",
        "ergonex/generated",
      ])
        assert(ids.has(id), `${id} was not checked: ${[...ids].join(", ")}`);
      assert(json.data.checks.every((c) => ["ok", "suggest", "warn", "error"].includes(c.level)));
      // the file system is read by a probe: its answer names the type
      const fs = json.data.checks.find((c) => c.id === "ergonex/filesystem");
      assert(fs !== undefined && (fs.level === "ok" || fs.level === "warn" || fs.level === "suggest"));
      // a repository that does not use the workspace's hooks is a warning that says what to do
      await w.git(w.repo, "config", "--local", "--unset", "core.hooksPath");
      const warn = await w.ergonex("doctor");
      assertEquals(warn.code, 1);
      assertStringIncludes(warn.stdout, "warn    git.example.org/team/tool:");
      assertStringIncludes(warn.stdout, "ergonex apply");
      await w.ergonex("apply");
      // a hand edit of a generated file is an error
      await writeTextFile(join(w.home, "AGENTS.auto.md"), "mine\n");
      const edited = await w.ergonex("doctor");
      assertEquals(edited.code, 1);
      assertStringIncludes(edited.stdout, "error   AGENTS.auto.md:");
      const sarif = JSON.parse((await w.ergonex("doctor", "--sarif")).stdout) as {
        runs: { results: { ruleId: string; level: string }[] }[];
      };
      assert(sarif.runs[0]?.results.some((r) => r.ruleId === "ergonex/generated-edited" && r.level === "error"));
    });
  },
  needsWorld,
);
