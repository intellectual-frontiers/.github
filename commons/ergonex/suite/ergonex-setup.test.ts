/**
 * Tests of `ergonex setup` and the evidence of a run (commons 0001-ergonex FR-017 to FR-020, 0002-workspace-model FR-012, FR-030, FR-036, FR-038, FR-039, FR-041 to FR-043, 0003-host FR-016): the dry
 * run is the default and changes nothing, `--apply` carries the plan out (the root, a starter manifest, the pinned install from a real HTTP server on the loopback interface, `core.longpaths` set by
 * the real `git` in a real repository, the global Git include in a real temporary configuration file that the real `git config` reads back), a hash that differs writes nothing, and every run
 * leaves one evidence record that holds no credential. The server is a stand-in for the HOST that publishes the artifacts, which is outside the code under test. NOT tested: the system
 * long-path setting itself (`reg add` needs Windows and an elevated process; the test gives the function that stands for it and checks it is called only where elevated), and a terminal prompt (the
 * answer is given by the test).
 *
 * @module
 */
import { mkdir, exists, makeTempDir, readTextFile, remove, walkFiles, writeTextFile } from "../src/platform/r-fs.ts";
import { liveTransport } from "../src/platform/r-http-client.ts";
import { join } from "../src/platform/r-path.ts";
import { build, run } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { formatQualityError, readQuality } from "@intellectual-frontiers/commons/ts/quality";
import { type Finding } from "../src/findings.ts";
import { policyOf } from "../src/policy.ts";
import { type SetupDeps, setup } from "../src/setup/host/apply.ts";
import { writeRunEvidence, isoOf } from "../src/setup/host/evidence.ts";
import { holdsCredential, missingToolVersions, optionNames, runRules } from "../src/setup/evidence.ts";
import { INCLUDE_BEGIN, INCLUDE_END, changeShown, includeBlock, withInclude, withoutInclude } from "../src/setup/gitconfig.ts";
import { parseSetupArgs, stepChangesHost, type SetupArgs } from "../src/setup/plan.ts";
import { LONG_PATH_STEPS, LONG_PATHS_OFF, longPathFindings, longPathsCommand } from "../src/setup/windows.ts";
import { starterManifest } from "../src/setup/starter.ts";
import { judgeProbe } from "../src/tools/probe.ts";
import type { ToolArch, ToolOs } from "../src/tools/catalog.ts";
import { repoPath } from "../src/portable.ts";
import { artifactServer, catalogOf, pinned, tarball } from "./ergonex-tools-fixtures.ts";
import { git, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

const OS: ToolOs = build.os === "darwin" ? "macos" : build.os === "windows" ? "windows" : "linux";
const ARCH: ToolArch = build.arch === "aarch64" ? "arm64" : "x64";
const TODAY = "2026-11-17";
const NONE: SetupArgs = { apply: false, gitInclude: false, yes: false };
const APPLY: SetupArgs = { apply: true, gitInclude: false, yes: false };
const PATH = "/releases/hello-1.0.0.tar.gz";
const probesOk = (): Promise<ReturnType<typeof judgeProbe>[]> =>
  Promise.resolve([judgeProbe("git", "git version 2.43.0"), judgeProbe("bun", "1.4.4"), judgeProbe("node", "v26.0.0")]);

const repo = (text: string) => {
  const r = repoPath(text.split("/"));
  assert(r.kind === "ok", text);
  return r.value;
};

async function listing(dir: string): Promise<readonly string[]> {
  return (await exists(dir)) ? walkFiles(dir) : [];
}

proves(
  ["0001-ergonex FR-017"],
  "setup takes --apply or --dry-run, not both; saying nothing is the dry run; an unknown option is a usage error",
  () => {
    assertEquals(parseSetupArgs([]), ok({ apply: false, gitInclude: false, yes: false }));
    assertEquals(parseSetupArgs(["--dry-run"]), ok({ apply: false, gitInclude: false, yes: false }));
    assertEquals(parseSetupArgs(["--apply", "--git-include", "--yes"]), ok({ apply: true, gitInclude: true, yes: true }));
    const both = parseSetupArgs(["--apply", "--dry-run"]);
    assert(both.kind === "err");
    assertStringIncludes(both.error.message, "not both");
    assert(parseSetupArgs(["--install"]).kind === "err");
  },
);

proves(
  ["0001-ergonex FR-017", "0002-workspace-model FR-030"],
  "a dry run shows the plan and changes NOTHING: no root, no tool, no request to the host",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    const art = tarball("hello", "1.0.0");
    const { server, base, requests } = await artifactServer(new Map([[PATH, art.bytes]]));
    try {
      const root = join(parent, "ws");
      const tool = await pinned("hello", "1.0.0", art, `${base}${PATH}`, OS, ARCH);
      const said: string[] = [];
      const deps: SetupDeps = {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(tool),
        transport: liveTransport(),
        loopbackHttp: true,
        probe: probesOk,
        repos: [],
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "git.auto.conf"),
        say: (t) => void said.push(t),
      };
      const r = await setup({ ...NONE, gitInclude: true }, deps);
      assert(r.kind === "ok");
      assertEquals(r.value.applied, false);
      assertEquals(r.value.outcomes, []);
      assertEquals(await exists(root), false);
      assertEquals(await exists(join(parent, "gitconfig")), false);
      assertEquals(requests, []);
      assertEquals(
        r.value.plan.steps.map((s) => s.kind),
        ["CreateRoot", "WriteStarterManifest", "VerifyTool", "VerifyTool", "VerifyTool", "InstallTool", "AddGitInclude"],
      );
      assertStringIncludes(r.value.shown, "dry run");
      assertStringIncludes(r.value.shown, `install hello 1.0.0 for ${OS} ${ARCH}`);
      assertStringIncludes(r.value.shown, "ergonex setup --apply");
      assertEquals(said.join(""), r.value.shown);
      assertEquals(r.value.exit, "Ok");
      // the run is recorded as a setup that was not applied, with its reason for what did not run
      assertEquals(
        r.value.facts.notRun.map((n) => n.name),
        ["ergonex/setup-apply"],
      );
    } finally {
      await server.shutdown();
      await remove(parent, { recursive: true });
    }
  },
);

proves(
  ["0001-ergonex FR-018", "0002-workspace-model FR-039"],
  "setup --apply creates the root and a starter manifest, installs only the pinned artifact into .ergonex/tools/, and only probes git, bun and node",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    const art = tarball("hello", "1.0.0");
    const { server, base, requests } = await artifactServer(new Map([[PATH, art.bytes]]));
    try {
      const root = join(parent, "ws");
      const tool = await pinned("hello", "1.0.0", art, `${base}${PATH}`, OS, ARCH);
      const deps: SetupDeps = {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(tool),
        transport: liveTransport(),
        loopbackHttp: true,
        probe: probesOk,
        repos: [],
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "git.auto.conf"),
      };
      const r = await setup(APPLY, deps);
      assert(r.kind === "ok", JSON.stringify(r));
      assertEquals(r.value.applied, true);
      assertEquals(r.value.exit, "Ok");
      assertEquals(requests, [`GET ${PATH}`]);
      assertEquals(await readTextFile(join(root, "workspace.ts")), starterManifest());
      assert(await exists(join(root, ".ergonex", "tools", "hello", "1.0.0", "hello-1.0.0", "bin", "hello")));
      // the three probed tools are told and never installed
      assertEquals(
        r.value.outcomes.filter((o) => o.step.kind === "VerifyTool").map((o) => o.result),
        ["skipped", "skipped", "skipped"],
      );
      assertEquals(await exists(join(root, ".ergonex", "tools", "git")), false);
      assertEquals(await exists(join(root, ".ergonex", "tools", "bun")), false);
      assertEquals(await exists(join(root, ".ergonex", "tools", "node")), false);
      assertEquals(r.value.facts.tools["hello"], "1.0.0");
      assertEquals(r.value.facts.tools["git"], "2.43.0");
      // a second apply installs nothing and fetches nothing, and keeps the manifest
      await writeTextFile(join(root, "workspace.ts"), "// mine\n");
      const again = await setup(APPLY, deps);
      assert(again.kind === "ok");
      assertEquals(requests.length, 1);
      assertEquals(await readTextFile(join(root, "workspace.ts")), "// mine\n");
      assertEquals(
        again.value.plan.steps.filter((s) => s.kind === "InstallTool"),
        [],
      );
    } finally {
      await server.shutdown();
      await remove(parent, { recursive: true });
    }
  },
);

proves(
  ["0001-ergonex FR-018", "0002-workspace-model FR-039"],
  "setup --apply refuses an artifact whose hash differs from the pin, writes nothing of it, and ends with an error finding",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    const art = tarball("hello", "1.0.0");
    const { server, base } = await artifactServer(new Map([[PATH, art.bytes]]));
    try {
      const root = join(parent, "ws");
      const tool = await pinned("hello", "1.0.0", art, `${base}${PATH}`, OS, ARCH, "f".repeat(64));
      const r = await setup(APPLY, {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(tool),
        transport: liveTransport(),
        loopbackHttp: true,
        probe: probesOk,
        repos: [],
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "g"),
      });
      assert(r.kind === "ok");
      assertEquals(r.value.exit, "Findings");
      assertEquals(r.value.applied, false);
      assertEquals(
        r.value.findings.map((f) => [f.ruleId, f.severity, f.subject]),
        [["ergonex/setup-install", "Error", "hello"]],
      );
      assertStringIncludes(r.value.findings[0]?.message ?? "", "nothing was written");
      assertEquals(await listing(join(root, ".ergonex", "tools")), []);
      assertEquals(await exists(join(root, ".ergonex", "bin")), false);
    } finally {
      await server.shutdown();
      await remove(parent, { recursive: true });
    }
  },
);

proves(
  ["0001-ergonex FR-018"],
  "a probe that fails is a finding that says how to install the tool, and setup installs nothing for it",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    try {
      const root = join(parent, "ws");
      const probe = (): Promise<ReturnType<typeof judgeProbe>[]> =>
        Promise.resolve([judgeProbe("git", undefined), judgeProbe("bun", "1.4.4"), judgeProbe("node", "v22.1.0")]);
      const r = await setup(APPLY, {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(),
        transport: liveTransport(),
        probe,
        repos: [],
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "g"),
      });
      assert(r.kind === "ok");
      assertEquals(r.value.exit, "Findings");
      assertEquals(
        r.value.findings.map((f) => [f.ruleId, f.severity]),
        [
          ["ergonex/tool-missing", "Error"],
          ["ergonex/tool-too-old", "Error"],
        ],
      );
      assertStringIncludes(r.value.findings[0]?.message ?? "", "git-scm.com");
      assertStringIncludes(r.value.findings[1]?.message ?? "", "nodejs.org");
      assertEquals(await listing(join(root, ".ergonex", "tools")), []);
    } finally {
      await remove(parent, { recursive: true });
    }
  },
);

proves(
  ["0001-ergonex FR-019", "0002-workspace-model FR-012", "0002-workspace-model FR-036"],
  "on Windows setup sets core.longpaths in each cloned repository and, not elevated, prints the exact steps and ends with findings without touching the system setting",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    try {
      const root = join(parent, "ws");
      const cloned = join(root, "github.com", "octo", "repo");
      await mkdir(cloned, { recursive: true });
      await repositoryWithCommit(cloned);
      const calls: string[] = [];
      const deps: SetupDeps = {
        root,
        os: "windows",
        arch: "x64",
        today: TODAY,
        catalog: catalogOf(),
        transport: liveTransport(),
        probe: probesOk,
        repos: [repo("github.com/octo/repo"), repo("github.com/octo/not-cloned")],
        windows: { longPathsEnabled: false, elevated: false },
        setSystemLongPaths: () => {
          calls.push("system");
          return Promise.resolve(ok(undefined));
        },
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "g"),
      };
      const dry = await setup(NONE, deps);
      assert(dry.kind === "ok");
      assertEquals(await git(cloned, "config", "--local", "--get-all", "core.longpaths").catch(() => ""), "");
      const r = await setup(APPLY, deps);
      assert(r.kind === "ok");
      assertEquals(await git(cloned, "config", "--local", "--get", "core.longpaths"), "true");
      assertEquals(calls, []);
      assertEquals(r.value.exit, "Findings");
      const explain = r.value.plan.steps.find((s) => s.kind === "ExplainLongPaths");
      assert(explain?.kind === "ExplainLongPaths");
      assertEquals(explain.steps, LONG_PATH_STEPS);
      assertStringIncludes(r.value.shown, "reg add");
      assertEquals(
        r.value.outcomes.filter((o) => o.step.kind === "SetRepoLongPaths").map((o) => o.result),
        ["skipped", "done"],
      );
      const off = r.value.findings.find((f) => f.ruleId === "ergonex/windows-long-paths");
      assertStringIncludes(off?.message ?? "", LONG_PATHS_OFF);
      assertStringIncludes(off?.message ?? "", "ergonex setup");
      assertEquals(off?.severity, "Informational");
    } finally {
      await remove(parent, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0001-ergonex FR-019"],
  "on Windows, elevated, setup turns the system setting on once, through the function that stands for `reg add`",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    try {
      const calls: string[] = [];
      const root = join(parent, "ws");
      const deps: SetupDeps = {
        root,
        os: "windows",
        arch: "x64",
        today: TODAY,
        catalog: catalogOf(),
        transport: liveTransport(),
        probe: probesOk,
        repos: [],
        windows: { longPathsEnabled: false, elevated: true },
        setSystemLongPaths: () => {
          calls.push("system");
          return Promise.resolve(ok(undefined));
        },
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "g"),
      };
      const dry = await setup(NONE, deps);
      assert(dry.kind === "ok");
      assertEquals(calls, []);
      const r = await setup(APPLY, deps);
      assert(r.kind === "ok");
      assertEquals(calls, ["system"]);
      assertEquals(
        r.value.plan.steps.some((s) => s.kind === "ExplainLongPaths"),
        false,
      );
      assertEquals(longPathsCommand().slice(0, 2), ["reg", "add"]);
      // where it fails, it is an error finding
      const failing = await setup(APPLY, {
        ...deps,
        setSystemLongPaths: () => Promise.resolve(err("access denied")),
      });
      assert(failing.kind === "ok");
      assertEquals(failing.value.exit, "Findings");
      assert(failing.value.findings.some((f) => f.ruleId === "ergonex/setup-longpaths" && f.severity === "Error"));
    } finally {
      await remove(parent, { recursive: true });
    }
  },
);

proves(
  ["0001-ergonex FR-019", "0002-workspace-model FR-012", "0002-workspace-model FR-036"],
  "doctor's message that long paths are not enabled is informational while no path is over the limit, an error naming the path once one is, and names ergonex setup",
  () => {
    const short = "C:\\ws\\github.com\\octo\\repo";
    const long = `C:\\ws\\github.com\\octo\\${"x".repeat(250)}`;
    const quiet = longPathFindings({ os: "windows", longPathsEnabled: false, paths: [short] }, TODAY);
    assertEquals(
      quiet.map((f) => [f.ruleId, f.severity]),
      [["ergonex/windows-long-paths", "Informational"]],
    );
    assertStringIncludes(quiet[0]?.message ?? "", "Windows long paths not enabled");
    assertStringIncludes(quiet[0]?.message ?? "", "ergonex setup");
    const loud = longPathFindings({ os: "windows", longPathsEnabled: false, paths: [short, long] }, TODAY);
    assertEquals(
      loud.map((f) => [f.ruleId, f.severity]),
      [
        ["ergonex/path-too-long", "Error"],
        ["ergonex/windows-long-paths", "Error"],
      ],
    );
    assertEquals(loud[0]?.subject, long);
    assertStringIncludes(loud[0]?.message ?? "", "ergonex setup");
    assertEquals(longPathFindings({ os: "windows", longPathsEnabled: true, paths: [long] }, TODAY), []);
    assertEquals(longPathFindings({ os: "linux", longPathsEnabled: false, paths: [long] }, TODAY), []);
    // 259 is the last good length and 260 the first too long
    assertEquals(
      longPathFindings({ os: "windows", longPathsEnabled: false, paths: ["C".repeat(259)] }, TODAY).map((f) => f.severity),
      ["Informational"],
    );
    assertEquals(
      longPathFindings({ os: "windows", longPathsEnabled: false, paths: ["C".repeat(260)] }, TODAY).map((f) => f.severity),
      ["Error", "Error"],
    );
  },
);

proves(
  ["0003-host FR-016", "0001-ergonex FR-020"],
  "setup --git-include shows the exact change and asks first; a no, or no terminal and no --yes, writes nothing; a yes adds one marked block that real git reads",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    try {
      const root = join(parent, "ws");
      const cfg = join(parent, "gitconfig");
      const original = "[user]\n\tname = Someone\n[core]\n\teditor = vi\n";
      await writeTextFile(cfg, original);
      const included = join(root, "git.auto.conf");
      const said: string[] = [];
      const questions: string[] = [];
      const base: SetupDeps = {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(),
        transport: liveTransport(),
        probe: probesOk,
        repos: [],
        globalGitConfig: cfg,
        gitIncludeFile: included,
        say: (t) => void said.push(t),
      };
      const args: SetupArgs = { apply: true, gitInclude: true, yes: false };

      // no terminal, no --yes: refused before anything changes
      const none = await setup(args, base);
      assert(none.kind === "err" && none.error.kind === "usage");
      assertEquals(await exists(root), false);
      assertEquals(await readTextFile(cfg), original);

      // a no
      const no = await setup(args, {
        ...base,
        confirm: (q) => {
          questions.push(q);
          return Promise.resolve(false);
        },
      });
      assert(no.kind === "ok");
      assertEquals(no.value.outcomes.find((o) => o.step.kind === "AddGitInclude")?.result, "declined");
      assertEquals(await readTextFile(cfg), original);
      assertEquals(questions.length, 1);
      assert(said.join("").includes("+[include]"), "the change was shown");
      assert(said.join("").includes(`+\tpath = "${included.replaceAll("\\", "/")}"`));

      // a yes
      const yes = await setup(args, {
        ...base,
        confirm: () => Promise.resolve(true),
      });
      assert(yes.kind === "ok");
      const after = await readTextFile(cfg);
      assert(after.startsWith(original));
      assertEquals(after.split("\n").filter((l) => l === INCLUDE_BEGIN).length, 1);
      const paths = await run(["git", "config", "--file", cfg, "--get-all", "include.path"]);
      assertEquals(paths.stdout.trim(), included.replaceAll("\\", "/"));
      // twice leaves one block, and --yes needs no terminal
      const twice = await setup({ ...args, yes: true }, base);
      assert(twice.kind === "ok");
      assertEquals(await readTextFile(cfg), after);
      assertEquals(twice.value.outcomes.find((o) => o.step.kind === "AddGitInclude")?.result, "skipped");
      // and the block comes out exactly
      const removed = withoutInclude(after);
      assertEquals(removed, ok(original));
    } finally {
      await remove(parent, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0003-host FR-016"],
  "the include block is one marked block that is replaced, never doubled, and that is removed leaving the text around it as it was",
  () => {
    const block = includeBlock("/w/git.auto.conf");
    assert(block.kind === "ok");
    assert(block.value.startsWith(INCLUDE_BEGIN) && block.value.endsWith(`${INCLUDE_END}\n`));
    const text = "[a]\n\tb = c\n";
    const once = withInclude(text, block.value);
    assert(once.kind === "ok");
    const other = includeBlock("/elsewhere/git.auto.conf");
    assert(other.kind === "ok");
    const replaced = withInclude(`${once.value}[z]\n\ty = 1\n`, other.value);
    assert(replaced.kind === "ok");
    assertEquals(replaced.value.split("\n").filter((l) => l === INCLUDE_BEGIN).length, 1);
    assertStringIncludes(replaced.value, "/elsewhere/git.auto.conf");
    assert(!replaced.value.includes("/w/git.auto.conf"));
    assertEquals(withoutInclude(replaced.value), ok(`${text}[z]\n\ty = 1\n`));
    assertEquals(withoutInclude(text), ok(text));
    assertEquals(withInclude("", block.value), ok(block.value));
    assert(withInclude(`${INCLUDE_BEGIN}\nx\n`, block.value).kind === "err", "an open block is not guessed at");
    assert(includeBlock('/w/"quote').kind === "err");
    assertEquals(changeShown("f", text, text), "");
    assertStringIncludes(changeShown("f", text, once.value), `+${INCLUDE_BEGIN}`);
  },
);

proves(
  ["0002-workspace-model FR-030", "0001-ergonex FR-017"],
  "only the kinds with a host change are InstallTool, SetSystemLongPaths and AddGitInclude, and a dry run carries none of them out",
  () => {
    const kinds: Record<string, boolean> = {
      CreateRoot: stepChangesHost({ kind: "CreateRoot", path: "/w" }),
      WriteStarterManifest: stepChangesHost({
        kind: "WriteStarterManifest",
        path: "/w/m",
      }),
      SetRepoLongPaths: stepChangesHost({
        kind: "SetRepoLongPaths",
        repo: repo("github.com/o/r"),
      }),
      InstallTool: stepChangesHost({
        kind: "InstallTool",
        tool: "t",
        version: "1.0.0",
        os: "linux",
        arch: "x64",
        url: "https://e.org/t",
        sha256: "a".repeat(64),
      }),
      SetSystemLongPaths: stepChangesHost({ kind: "SetSystemLongPaths" }),
      AddGitInclude: stepChangesHost({ kind: "AddGitInclude", file: "/f" }),
    };
    assertEquals(kinds, {
      CreateRoot: false,
      WriteStarterManifest: false,
      SetRepoLongPaths: false,
      InstallTool: true,
      SetSystemLongPaths: true,
      AddGitInclude: true,
    });
  },
);

proves(
  ["0002-workspace-model FR-041", "0002-workspace-model FR-042"],
  "a run's evidence is one record in the IFQS shape under .ergonex/evidence/, naming the command, the plan hash, the tools' versions, the findings and the exit, with no credential",
  async () => {
    const parent = await makeTempDir({ prefix: "ergonex-setup-" });
    const art = tarball("hello", "1.0.0");
    const { server, base } = await artifactServer(new Map([[PATH, art.bytes]]));
    try {
      const root = join(parent, "ws");
      const tool = await pinned("hello", "1.0.0", art, `${base}${PATH}`, OS, ARCH, "e".repeat(64));
      const r = await setup(APPLY, {
        root,
        os: OS,
        arch: ARCH,
        today: TODAY,
        catalog: catalogOf(tool),
        transport: liveTransport(),
        loopbackHttp: true,
        probe: probesOk,
        repos: [],
        globalGitConfig: join(parent, "gitconfig"),
        gitIncludeFile: join(root, "g"),
      });
      assert(r.kind === "ok");
      // a finding whose message was careless enough to hold a token: the record must not
      const token = ["ghp", "_", "aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6"].join("");
      const careless: Finding = {
        ruleId: "ergonex/x",
        severity: "Warning",
        message: `leaked ${token}`,
        subject: "f:1",
        firstSeen: TODAY,
      };
      const end = 1_800_000_000_000_000_000n;
      const deps = { home: root, start: end - 5_000_000_000n, end, env: {} };
      const w = await writeRunEvidence(deps, {
        ...r.value.facts,
        argv: ["--apply", "--home=/secret/place", "positional"],
        findings: [...r.value.facts.findings, careless],
        stateSha256: "c".repeat(64),
      });
      assert(w.kind === "ok", JSON.stringify(w));
      assertEquals(w.value.path.startsWith(join(root, ".ergonex", "evidence")), true);
      assert(/\d{8}T\d{6}(?:\.\d{3})?Z-[0-9a-f]{32}\.otlp\.json$/.test(w.value.path), w.value.path);
      assert(!w.value.text.includes(token), "the record holds the token");
      assert(!w.value.text.includes("/secret/place"), "the record holds an option's value");
      assertEquals(holdsCredential(w.value.text), false);
      const q = readQuality(JSON.parse(await readTextFile(w.value.path)));
      assert(q.kind === "ok", q.kind === "err" ? formatQualityError(q.error) : "");
      const names = q.value.cases.map((c) => c.name);
      assert(
        names.some((n) => n === "ergonex/run: ergonex setup --apply --home"),
        names.join("\n"),
      );
      assert(names.some((n) => n.startsWith("ergonex/plan: sha256 ")));
      assert(names.some((n) => n === `ergonex/state: sha256 ${"c".repeat(64)}`));
      assert(names.some((n) => n === "ergonex/tool: git 2.43.0"));
      assert(
        names.some((n) => n.startsWith("ergonex/setup-install")),
        "the failed install is a failed case",
      );
      assert(names.some((n) => n === "ergonex/exit: Findings"));
      assertEquals([q.value.counts.failed, q.value.counts.notRun], [2, 0]);
      // a second run is a second file: nothing is overwritten
      const w2 = await writeRunEvidence({ ...deps, end: end + 1_000_000_000n }, r.value.facts);
      assert(w2.kind === "ok");
      assert(w2.value.path !== w.value.path);
      assertEquals(await readTextFile(w.value.path), w.value.text);
      assertEquals((await walkFiles(join(root, ".ergonex", "evidence"))).length, 2);
      assertEquals(isoOf(end), "2027-01-15T08:00:00.000Z");
    } finally {
      await server.shutdown();
      await remove(parent, { recursive: true });
    }
  },
);

proves(["0002-workspace-model FR-041"], "a check that did not run is recorded as not_run with its reason, never as a pass", async () => {
  const parent = await makeTempDir({ prefix: "ergonex-setup-" });
  try {
    const root = join(parent, "ws");
    const r = await setup(NONE, {
      root,
      os: OS,
      arch: ARCH,
      today: TODAY,
      catalog: catalogOf(),
      transport: liveTransport(),
      probe: probesOk,
      repos: [],
      globalGitConfig: join(parent, "g"),
      gitIncludeFile: join(root, "g"),
    });
    assert(r.kind === "ok");
    const end = 1_800_000_000_000_000_000n;
    const w = await writeRunEvidence({ home: parent, start: end, end, env: {} }, r.value.facts);
    assert(w.kind === "ok", JSON.stringify(w));
    const q = readQuality(JSON.parse(w.value.text));
    assert(q.kind === "ok");
    assertEquals(q.value.counts.notRun, 1);
    const nr = q.value.cases.find((c) => c.outcome === "not_run");
    assertEquals(nr?.name, "ergonex/setup-apply");
    assertStringIncludes(nr?.reason ?? "", "--apply was not given");
  } finally {
    await remove(parent, { recursive: true });
  }
});

proves(
  ["0002-workspace-model FR-043"],
  "where a regulated domain is named the evidence must name the version of every tool used, and what is missing is told",
  () => {
    const regulated = policyOf({ regulatedDomain: ["medical-device"] });
    const facts = { tools: { git: "2.43.0", bun: "1.4.4" }, policy: regulated };
    assertEquals(missingToolVersions(facts, ["git", "bun", "node", "hello"]), ["node", "hello"]);
    assertEquals(missingToolVersions({ ...facts, policy: policyOf({}) }, ["git", "bun", "node", "hello"]), []);
    assertEquals(optionNames(["--apply", "--home=/x", "word", "-y"]), ["--apply", "--home", "-y"]);
    const rules = runRules({
      command: "setup",
      argv: ["--apply"],
      tools: { git: "2.43.0" },
      findings: [],
      exit: "Ok",
      notRun: [],
      policy: regulated,
    });
    assertEquals(
      rules.map((r) => r.id),
      ["ergonex/run: ergonex setup --apply", "ergonex/tool: git 2.43.0", "ergonex/exit: Ok"],
    );
  },
);
