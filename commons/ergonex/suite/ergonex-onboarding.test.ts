/**
 * From nothing to a workspace (commons ergonex 0004-onboarding FR-002, FR-003, FR-006, FR-007): where `init` puts `ergonex` (already there, the global install, or the command files), the plain words of a run
 * with no command, the doctor's check of the token for reading packages, and a home whose name has a space and a letter outside ASCII. The orchestration is run on a host that is made up; the command files are
 * written and run for real, and the program is run as a program.
 *
 * @module
 */
import { chmod, exists, makeTempDir, mkdir, readTextFile, remove, withTempDir, writeTextFile } from "../src/platform/r-fs.ts";
import { dirname, join } from "../src/platform/r-path.ts";
import { build, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { guidanceFor } from "../src/commands/guidance.ts";
import {
  type Launch,
  SHIM_MARK,
  cmdUnsafe,
  globalInstall,
  isRegistryCopy,
  launchFor,
  shellFrom,
  shimCmd,
  shimSh,
  userPathScript,
} from "../src/setup/onpath.ts";
import { type PathDeps, putOnPath } from "../src/setup/host/path.ts";
import { scopesOf, tokenChecks } from "../src/token.ts";
import { Ergonex } from "./ergonex-fixtures.ts";

const windows = build.os === "windows";
const bun = which("bun");
const needsBun = bun === undefined ? { skip: "bun is not installed" } : {};
const needsSh =
  bun === undefined || windows
    ? {
        skip: "bun is not installed, or this is Windows, where the command file is a .cmd",
      }
    : {};

const registry: Launch = {
  kind: "registry",
  runtime: "bun",
  spec: "@intellectual-frontiers/ergonex@0.1.0",
};
const local: Launch = {
  kind: "local",
  runtime: "bun",
  entry: "/work/ergonex/bin/ergonex.mjs",
};

/** A host that is made up: what is on the path, what the programs answer, and the files in memory. */
function fakeHost(
  o: {
    which?: string;
    runs?: Record<string, number>;
    failMkdir?: boolean;
    files?: Record<string, string>;
  } = {},
) {
  const files = new Map(Object.entries(o.files ?? {}));
  const ran: string[][] = [];
  const written: string[] = [];
  const deps: PathDeps = {
    which: (name) => (name === "ergonex" ? o.which : undefined),
    run: (argv) => {
      ran.push([...argv]);
      const code = o.runs?.[argv[0] ?? ""] ?? 0;
      return Promise.resolve({
        code,
        stdout: argv[0] === "powershell" ? "added\n" : "",
        stderr: code === 0 ? "" : "404 not found\nsecond line",
      });
    },
    read: (p) => Promise.resolve(files.get(p)),
    write: (p, t) => {
      files.set(p, t);
      written.push(p);
      return Promise.resolve();
    },
    mkdir: () => (o.failMkdir === true ? Promise.reject(new Error("no right to write here")) : Promise.resolve()),
  };
  return { deps, files, ran, written };
}

proves(
  ["0004-onboarding FR-002"],
  "a copy a package manager keeps is told from a checkout; the global install is Bun's or npm's; the shims pass every argument on as one, and the shim of Windows has the line ends cmd reads and refuses a path it cannot hold",
  () => {
    assertEquals(isRegistryCopy("/home/a/.bun/install/cache/@intellectual-frontiers/ergonex@0.1.0/bin/ergonex.mjs"), true);
    assertEquals(isRegistryCopy("C:\\Users\\a\\AppData\\Local\\npm-cache\\_npx\\1234\\node_modules\\x\\bin\\ergonex.mjs"), true);
    assertEquals(isRegistryCopy("/home/a/node_modules/@intellectual-frontiers/ergonex/bin/ergonex.mjs"), true);
    assertEquals(isRegistryCopy("/home/a/workspaces/github.com/org/.github/commons/ergonex/bin/ergonex.mjs"), false);
    assertEquals(
      launchFor({
        runtime: "bun",
        entry: "/home/a/node_modules/x/bin/ergonex.mjs",
        version: "0.1.0",
      }),
      registry,
    );
    assertEquals(
      launchFor({
        runtime: "node",
        entry: "/w/ergonex/bin/ergonex.mjs",
        version: "0.1.0",
      }),
      { kind: "local", runtime: "node", entry: "/w/ergonex/bin/ergonex.mjs" },
    );
    assertEquals(globalInstall(registry), ["bun", "add", "-g", "@intellectual-frontiers/ergonex@0.1.0"]);
    assertEquals(globalInstall({ ...registry, runtime: "node" }), ["npm", "install", "-g", "@intellectual-frontiers/ergonex@0.1.0"]);
    assertEquals(
      shimSh(registry),
      `#!/bin/sh\n# ${SHIM_MARK}; run \`ergonex init\` again to rewrite it\nexec bunx '@intellectual-frontiers/ergonex@0.1.0' "$@"\n`,
    );
    assertStringIncludes(shimSh({ ...registry, runtime: "node" }), "exec npx --yes '@intellectual-frontiers/ergonex@0.1.0' \"$@\"");
    assertStringIncludes(
      shimSh({
        kind: "local",
        runtime: "node",
        entry: "/a b/it's here/ergonex.mjs",
      }),
      `exec node '/a b/it'\\''s here/ergonex.mjs' "$@"`,
    );
    const cmd = shimCmd(local);
    assert(cmd.startsWith("@echo off\r\n") && cmd.endsWith("\r\n") && !/[^\r]\n/.test(cmd), "the lines of a .cmd end with CR LF");
    assertStringIncludes(cmd, 'bun "/work/ergonex/bin/ergonex.mjs" %*');
    assertEquals([cmdUnsafe("C:\\a b\\c"), cmdUnsafe("C:\\100%\\c"), cmdUnsafe('C:\\"q"')], [false, true, true]);
    assertStringIncludes(userPathScript("C:\\Users\\o'brien\\w\\.ergonex\\bin"), "'C:\\Users\\o''brien\\w\\.ergonex\\bin'");
    assertEquals(
      [shellFrom("/bin/zsh"), shellFrom("/usr/bin/fish"), shellFrom(undefined), shellFrom("/bin/dash"), shellFrom("C:\\x\\nu")],
      ["zsh", "fish", "bash", "bash", "nu"],
    );
  },
);

proves(
  ["0004-onboarding FR-002"],
  "init puts ergonex on the path in the order that asks least: already there, the global install, then the command files (and on Windows the user's path), and it says each thing and never fails",
  async () => {
    const bin = "/home/a/workspaces/.ergonex/bin";
    const base = { bin, shellVar: "/bin/zsh", changePath: true } as const;
    // already there: nothing is written or run
    const there = fakeHost({ which: "/usr/local/bin/ergonex" });
    const r1 = await putOnPath(there.deps, {
      ...base,
      launch: registry,
      windows: false,
    });
    assertEquals([r1.data.how, there.ran.length, there.written.length], ["already", 0, 0]);
    assertStringIncludes(r1.lines.join("\n"), "/usr/local/bin/ergonex");
    // from a registry: the global install by the runtime that ran it
    const inst = fakeHost();
    const r2 = await putOnPath(inst.deps, {
      ...base,
      launch: registry,
      windows: false,
    });
    assertEquals(
      [r2.data.how, inst.ran, inst.written.length],
      ["installed", [["bun", "add", "-g", "@intellectual-frontiers/ergonex@0.1.0"]], 0],
    );
    // from a registry where the install fails: the reason in a line, then the command file, and the command that puts it on the path
    const bad = fakeHost({ runs: { bun: 1 } });
    const r3 = await putOnPath(bad.deps, {
      ...base,
      launch: registry,
      windows: false,
    });
    assertEquals([r3.data.how, r3.data.files, bad.written], ["shim", [`${bin}/ergonex`], [`${bin}/ergonex`]]);
    assertStringIncludes(r3.lines[0] ?? "", "404 not found");
    assert(!(r3.lines[0] ?? "").includes("second line"), "one line of the reason");
    assertStringIncludes(r3.lines.join("\n"), `${bin}/ergonex shell zsh --install`);
    // a checkout: no install is tried
    const dev = fakeHost();
    const r4 = await putOnPath(dev.deps, {
      ...base,
      launch: local,
      windows: false,
    });
    assertEquals([r4.data.how, dev.ran.length], ["shim", 0]);
    assertStringIncludes(dev.files.get(`${bin}/ergonex`) ?? "", "exec bun '/work/ergonex/bin/ergonex.mjs'");
    // Windows: both files, and the user's path through PowerShell, unless --no-path
    const win = fakeHost();
    const r5 = await putOnPath(win.deps, {
      ...base,
      launch: local,
      windows: true,
    });
    assertEquals([r5.data.how, r5.data.files, r5.data.pathChanged], ["shim", [`${bin}/ergonex`, `${bin}/ergonex.cmd`], true]);
    assertEquals(win.ran.length, 1);
    assertEquals(win.ran[0]?.slice(0, 3), ["powershell", "-NoProfile", "-NonInteractive"]);
    assertStringIncludes(win.ran[0]?.[4] ?? "", "SetEnvironmentVariable('Path'");
    const keep = fakeHost();
    const r6 = await putOnPath(keep.deps, {
      ...base,
      launch: local,
      windows: true,
      changePath: false,
    });
    assertEquals([r6.data.pathChanged, keep.ran.length], [false, 0]);
    assertStringIncludes(r6.lines.join("\n"), "add that folder to your path");
    // a file that is not ergonex's is left; one that is, is rewritten; one that is as it should be is not written again
    const mixed = fakeHost({
      files: {
        [`${bin}/ergonex`]: "#!/bin/sh\necho mine\n",
        [`${bin}/ergonex.cmd`]: `@echo off\r\nrem ${SHIM_MARK}; old\r\nold\r\n`,
      },
    });
    const r7 = await putOnPath(mixed.deps, {
      ...base,
      launch: local,
      windows: true,
    });
    assertEquals(mixed.written, [`${bin}/ergonex.cmd`]);
    assertStringIncludes(r7.lines.join("\n"), "is not a file ergonex wrote");
    const again = fakeHost({ files: Object.fromEntries(mixed.files) });
    await putOnPath(again.deps, { ...base, launch: local, windows: true });
    assertEquals(again.written, []);
    // a folder that cannot be written is said, and the run goes on
    const locked = fakeHost({ failMkdir: true });
    const r8 = await putOnPath(locked.deps, {
      ...base,
      launch: local,
      windows: false,
    });
    assertEquals(r8.data.how, "failed");
    assertStringIncludes(r8.lines.join("\n"), "no right to write here");
    // Windows: a checkout in a folder with a % in its name cannot be a .cmd
    const pct = await putOnPath(fakeHost().deps, {
      ...base,
      launch: { kind: "local", runtime: "bun", entry: "C:\\100%\\ergonex.mjs" },
      windows: true,
    });
    assertEquals(pct.data.how, "failed");
  },
);

proves(
  ["0004-onboarding FR-002", "0004-onboarding FR-007"],
  "the command file that init writes starts ergonex from the checkout and passes an argument with a space or a quote on as one, from a folder whose name has both",
  async () => {
    await withTempDir(async (dir) => {
      const folder = join(dir, "it's a folder");
      await mkdir(folder);
      const entry = join(folder, "ergonex.mjs");
      await writeTextFile(entry, "console.log(JSON.stringify(process.argv.slice(2)));\n");
      const sh = join(dir, "ergonex");
      await writeTextFile(sh, shimSh({ kind: "local", runtime: "bun", entry }));
      await chmod(sh, 0o755);
      const r = await run([sh, "a b", "c'd", "ñandú"], {
        env: { PATH: `${dirname(bun ?? "")}:/usr/bin:/bin`, HOME: dir },
        clearEnv: true,
      });
      assertEquals(r.code, 0, r.stderr);
      assertEquals(JSON.parse(r.stdout), ["a b", "c'd", "ñandú"]);
    });
  },
  needsSh,
);

proves(
  ["0004-onboarding FR-003"],
  "a run with no command says in plain words what to do next, whether there is no root, no workspace or a workspace, and is not an error",
  async () => {
    assertStringIncludes(guidanceFor({ home: undefined, hasWorkspace: false }), "ergonex init --home");
    assertStringIncludes(guidanceFor({ home: "/home/a/workspaces", hasWorkspace: false }), "ergonex init");
    const has = guidanceFor({ home: "/home/a/workspaces", hasWorkspace: true });
    for (const word of ["ergonex status", "ergonex doctor", "ergonex plan", "ergonex help"]) assertStringIncludes(has, word);
    for (const text of [has, guidanceFor({ home: "/h", hasWorkspace: false })])
      assert(!/ergonex:|Error|at \w+\.ts|stack/.test(text), "an internal word");
    await withTempDir(async (dir) => {
      const go = (home: string) =>
        run([bun ?? "bun", Ergonex], {
          env: {
            ERGONEX_HOME: home,
            HOME: dir,
            USERPROFILE: dir,
            PATH: dirname(bun ?? ""),
          },
          clearEnv: true,
        });
      const none = await go(join(dir, "nothing-here"));
      assertEquals(none.code, 0, none.stderr);
      assertStringIncludes(none.stdout, "ergonex init");
      await mkdir(join(dir, "mine", ".ergonex"), { recursive: true });
      const some = await go(join(dir, "mine"));
      assertEquals(some.code, 0, some.stderr);
      assertStringIncludes(some.stdout, "ergonex doctor");
    });
  },
  needsBun,
);

proves(
  ["0004-onboarding FR-006"],
  "the token's check says whether it is set, whether GitHub CLI is there and, where GitHub was asked, whether it may read packages, each with the command that fixes it",
  () => {
    const f = {
      tokenSet: true,
      ghInstalled: true,
      fetched: true,
      scopes: ["repo", "read:org"] as readonly string[] | undefined,
    };
    const level = (x: Partial<typeof f>) => tokenChecks({ ...f, ...x }).map((c) => c.level);
    assertEquals(level({ scopes: ["repo", "read:packages"] }), ["ok"]);
    assertEquals(level({ scopes: ["write:packages"] }), ["ok"]);
    assertEquals(level({}), ["warn"]);
    assertStringIncludes(tokenChecks(f)[0]?.message ?? "", "gh auth refresh -s read:packages");
    assertStringIncludes(tokenChecks(f)[0]?.message ?? "", "repo, read:org");
    assertEquals(level({ scopes: undefined }), ["suggest"]);
    assertEquals(level({ fetched: false }), ["ok"]);
    assertStringIncludes(tokenChecks({ ...f, fetched: false })[0]?.message ?? "", "ergonex doctor --fetch");
    assertStringIncludes(tokenChecks({ ...f, tokenSet: false })[0]?.message ?? "", "ergonex shell <your shell> --install");
    assertStringIncludes(tokenChecks({ ...f, tokenSet: false, ghInstalled: false })[0]?.message ?? "", "https://cli.github.com");
    assert(tokenChecks({ ...f, tokenSet: true }).every((c) => c.subject === "ERGONEX_GITHUB_TOKEN"));
    assertEquals(scopesOf("HTTP/2.0 200 OK\nX-Oauth-Scopes: repo, read:packages\nX-Accepted-Oauth-Scopes: \n"), ["repo", "read:packages"]);
    assertEquals(scopesOf("HTTP/2.0 200 OK\r\nx-oauth-scopes: \r\n"), []);
    assertEquals(scopesOf("HTTP/2.0 200 OK\n"), undefined);
  },
);

proves(
  ["0004-onboarding FR-007"],
  "init works on a home whose name has a space and a letter outside ASCII, and makes the root, the area and the starter manifest there",
  async () => {
    const dir = await makeTempDir();
    try {
      const home = join(dir, "mi carpeta ñandú");
      const r = await run([bun ?? "bun", Ergonex, "init", "--home", home, "--no-install"], {
        env: { HOME: dir, USERPROFILE: dir, PATH: dirname(bun ?? "") },
        clearEnv: true,
      });
      assertEquals(r.code, 0, r.stderr);
      assert(await exists(join(home, ".ergonex", "workspace.ts")), "the starter manifest");
      assertStringIncludes(await readTextFile(join(home, ".ergonex", "workspace.ts")), "export");
      assertStringIncludes(r.stdout, "mi carpeta ñandú");
    } finally {
      await remove(dir, { recursive: true }).catch(() => {});
    }
  },
  needsBun,
);
