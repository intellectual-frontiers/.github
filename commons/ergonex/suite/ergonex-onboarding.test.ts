/**
 * From nothing to a workspace (commons ergonex 0004-onboarding FR-002, FR-003, FR-006, FR-007): where `init` puts `ergonex` (already there, or by the runtime's global install, and no file of ours), the plain words of a run
 * with no command, the doctor's check of the token for reading packages, and a home whose name has a space and a letter outside ASCII. The orchestration is run on a host that is made up; the program is run as a program.
 *
 * @module
 */
import { exists, makeTempDir, mkdir, readTextFile, remove, withTempDir } from "../src/platform/r-fs.ts";
import { dirname, join } from "../src/platform/r-path.ts";
import { run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { guidanceFor } from "../src/commands/guidance.ts";
import { type Launch, globalInstall, isRegistryCopy, launchFor } from "../src/setup/onpath.ts";
import { type PathDeps, putOnPath } from "../src/setup/host/path.ts";
import { scopesOf, tokenChecks } from "../src/token.ts";
import { Ergonex } from "./ergonex-fixtures.ts";

const bun = which("bun");
const needsBun = bun === undefined ? { skip: "bun is not installed" } : {};

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

/** A host that is made up: what is on the path and what the programs answer. */
function fakeHost(o: { which?: string; runs?: Record<string, number> } = {}) {
  const ran: string[][] = [];
  const deps: PathDeps = {
    which: (name) => (name === "ergonex" ? o.which : undefined),
    run: (argv) => {
      ran.push([...argv]);
      const code = o.runs?.[argv[0] ?? ""] ?? 0;
      return Promise.resolve({
        code,
        stdout: "",
        stderr: code === 0 ? "" : "404 not found\nsecond line",
      });
    },
  };
  return { deps, ran };
}

proves(
  ["0004-onboarding FR-002"],
  "a copy a package manager keeps is told from a checkout, and the global install is Bun's or npm's",
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
  },
);

proves(
  ["0004-onboarding FR-002", "0031-install-locations FR-005"],
  "init puts ergonex on the path by asking least of the person: already there, then the runtime's global install, and nothing of ours is written; a checkout is not installed; it says each thing and never fails",
  async () => {
    // already there: nothing is run
    const there = fakeHost({ which: "/usr/local/bin/ergonex" });
    const r1 = await putOnPath(there.deps, registry);
    assertEquals([r1.data.how, there.ran.length], ["already", 0]);
    assertStringIncludes(r1.lines.join("\n"), "/usr/local/bin/ergonex");
    // from a registry: the global install by the runtime that ran it, and that is all
    const inst = fakeHost();
    const r2 = await putOnPath(inst.deps, registry);
    assertEquals([r2.data.how, inst.ran], ["installed", [["bun", "add", "-g", "@intellectual-frontiers/ergonex@0.1.0"]]]);
    // where the install fails: the reason in one line, and the command to run by hand, or bunx
    const bad = fakeHost({ runs: { bun: 1 } });
    const r3 = await putOnPath(bad.deps, registry);
    assertEquals(r3.data.how, "failed");
    assertStringIncludes(r3.lines[0] ?? "", "404 not found");
    assertStringIncludes(r3.lines[0] ?? "", "bunx @intellectual-frontiers/ergonex@0.1.0");
    assert(!(r3.lines[0] ?? "").includes("second line"), "one line of the reason");
    // Node: npm, and npx
    const node = fakeHost({ runs: { npm: 1 } });
    const r4 = await putOnPath(node.deps, { ...registry, runtime: "node" });
    assertEquals(node.ran, [["npm", "install", "-g", "@intellectual-frontiers/ergonex@0.1.0"]]);
    assertStringIncludes(r4.lines[0] ?? "", "npx @intellectual-frontiers/ergonex@0.1.0");
    // a checkout is not installed: nothing is run, and what to do is said
    const dev = fakeHost();
    const r5 = await putOnPath(dev.deps, local);
    assertEquals([r5.data.how, dev.ran.length], ["checkout", 0]);
    assertStringIncludes(r5.lines[0] ?? "", "bun /work/ergonex/bin/ergonex.mjs");
  },
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
