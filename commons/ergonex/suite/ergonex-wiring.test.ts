/**
 * Tests of `ergonex setup`, `ergonex tools`, the policy scans in `ergonex doctor` and in the hooks, end to end, with `ergonex` run as a real program (commons 0001-ergonex FR-015, FR-017 to FR-020, 0002-workspace-model
 * FR-030 to FR-033, FR-037, FR-039, 0003-host FR-016) on the runtime that runs this file (Bun or Node 26): a real temporary workspace and real Git repositories, a real HTTP server on the loopback
 * interface that serves a real gzipped tar (a stand-in for the host that publishes an artifact, which is outside the code under test), the catalog in the manifest with the real SHA-256 of the bytes, a
 * real global Git configuration file, and tokens assembled in the test so that no token is in the repository. Windows' own steps are not run here.
 *
 * @module
 */
import { chmod, existsSync, mkdir, readDirSync, readTextFile, writeTextFile } from "../src/platform/r-fs.ts";
import { acquireLock } from "../src/platform/r-lock.ts";
import { join } from "../src/platform/r-path.ts";
import { build, execPath, run, which } from "../src/platform/r-proc.ts";
import { sha256 } from "@intellectual-frontiers/commons/ts/kernel";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { hostTarget } from "../src/commands/tools.ts";
import { evidenceFiles, Ergonex, needsWorld, ONE_REPOSITORY, withWorld, type World } from "./ergonex-fixtures.ts";
import { artifactServer, tarball } from "./ergonex-tools-fixtures.ts";

const needs =
  "skip" in needsWorld || which("bun") === undefined || which("node") === undefined
    ? {
        skip: "needs git, sh, bun and node, on Unix paths (the Windows job runs the pure tests)",
      }
    : {};

const LOOPBACK = { ERGONEX_ALLOW_LOOPBACK_HTTP: "1" };
const target = hostTarget({ os: build.os, arch: build.arch, windows: false });
const day = (ago: number): string => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
/** A token of the shape of a GitHub personal access token, made here from parts so that none is written in a file. */
const fakeToken = (): string => `${"gh"}${"p_"}${"Ab1Cd2Ef3G".repeat(4)}`;

/** The manifest of a world with a catalog of one tool pinned to what the server serves. */
async function withTool(
  w: World,
  options: {
    readonly pin?: string;
    readonly provides?: readonly string[];
    readonly extra?: Record<string, unknown>;
  } = {},
): Promise<{
  readonly requests: string[];
  readonly stop: () => Promise<void>;
  readonly dir: string;
}> {
  assert(target !== undefined, "a system the catalog names");
  const served = tarball("hello-tool", "1.0.0");
  const server = await artifactServer(new Map([["/hello-tool-1.0.0.tar.gz", served.bytes]]));
  await w.manifest({
    ...ONE_REPOSITORY,
    ...(options.extra ?? {}),
    tools: [
      {
        name: "hello-tool",
        version: "1.0.0",
        ...(options.provides === undefined ? {} : { provides: options.provides }),
        artifacts: [
          {
            os: target.os,
            arch: target.arch,
            url: `${server.base}/hello-tool-1.0.0.tar.gz`,
            sha256: options.pin ?? (await sha256(served.bytes)),
            kind: served.kind,
            bin: served.bin,
          },
        ],
      },
    ],
  });
  return {
    requests: server.requests,
    stop: () => server.server.shutdown(),
    dir: join(w.tools, "hello-tool", "1.0.0"),
  };
}

const on = (w: World, ...words: string[]) => w.ergonexOn(execPath(), Ergonex, words, LOOPBACK);

proves(
  [
    "0001-ergonex FR-015",
    "0001-ergonex FR-017",
    "0001-ergonex FR-018",
    "0002-workspace-model FR-030",
    "0002-workspace-model FR-037",
    "0002-workspace-model FR-039",
  ],
  "ergonex tools lists, verifies and exports the catalog and installs nothing; ergonex setup shows its plan and changes nothing by default, installs the pinned artifact only with --apply, refuses a hash that differs and writes nothing, and --apply with --dry-run is a usage error",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const tool = await withTool(w);
      try {
        const listed = await on(w, "tools");
        assertEquals(listed.code, 0, listed.stderr + listed.stdout);
        assertStringIncludes(listed.stdout, "hello-tool 1.0.0  not-installed");
        assertEquals((await on(w, "tools", "install", "hello-tool")).code, 2);
        assertEquals((await on(w, "tools", "export", "nope")).code, 2);

        const dry = await on(w, "setup");
        assertEquals(dry.code, 0, dry.stderr + dry.stdout);
        assertStringIncludes(dry.stdout, "dry run: nothing is changed");
        assertStringIncludes(dry.stdout, "install hello-tool 1.0.0");
        assertEquals(tool.requests, [], "a dry run fetched something");
        assert(!existsSync(tool.dir));
        // the plan of apply holds no install: only setup --apply carries one out
        assert(!(await on(w, "plan")).stdout.includes("install hello-tool"));
        const both = await on(w, "setup", "--apply", "--dry-run");
        assertEquals(both.code, 2);
        assertEquals(tool.requests, []);
        // the first of the two files of this run's evidence is the dry run's: not_run for the apply
        assertEquals(evidenceFiles(w.state).filter((f) => f.includes("otlp")).length >= 3, true);

        const applied = await on(w, "setup", "--apply");
        assertEquals(applied.code, 0, applied.stderr + applied.stdout);
        assert(existsSync(join(tool.dir, "hello-tool-1.0.0", "bin", "hello-tool")), "the pinned tool was not installed");
        assertEquals(tool.requests, ["GET /hello-tool-1.0.0.tar.gz"]);
        const again = await on(w, "setup", "--apply");
        assertEquals(again.code, 0, again.stderr + again.stdout);
        assertEquals(tool.requests.length, 1, "an installed tool was fetched again");

        const row = await on(w, "tools");
        assertStringIncludes(row.stdout, "hello-tool 1.0.0  installed");
        assertEquals((await on(w, "tools", "verify")).code, 0);
        const spdx = await on(w, "tools", "export", "spdx");
        assertEquals(spdx.code, 0, spdx.stderr);
        assertStringIncludes(spdx.stdout, "hello-tool");
        assertEquals(JSON.parse((await on(w, "tools", "export", "oscal")).stdout) !== null, true);
        // what setup and tools did is in their own records, which name no credential
        const records = await Promise.all(evidenceFiles(w.state).map((f) => readTextFile(f)));
        assert(records.some((t) => t.includes("ergonex/run: ergonex setup --apply")));
        assert(records.some((t) => t.includes("ergonex/run: ergonex tools")));
        assert(records.some((t) => t.includes("ergonex/tool: hello-tool 1.0.0")));
        // a tool changed since its record is an error
        await writeTextFile(join(tool.dir, "hello-tool-1.0.0", "bin", "hello-tool"), "#!/bin/sh\necho changed\n");
        const drift = await on(w, "tools", "verify");
        assertEquals(drift.code, 1);
        assertStringIncludes(drift.stdout, "hello-tool");
        // the catalog is in tools.auto.json
        assertEquals((await on(w, "render")).code, 0);
        assertStringIncludes(await readTextFile(join(w.home, ".ergonex", "tools.auto.json")), '"name": "hello-tool"');
      } finally {
        await tool.stop();
      }
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-039", "0001-ergonex FR-018"],
  "an artifact whose bytes are not the pin is refused and nothing is written, and git, bun and node are probed, never installed",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const tool = await withTool(w, { pin: "a".repeat(64) });
      try {
        const r = await on(w, "setup", "--apply");
        assertEquals(r.code, 1, r.stdout + r.stderr);
        assertStringIncludes(r.stdout, "failed");
        assert(!existsSync(tool.dir), "a wrong hash wrote something");
        assert(!existsSync(w.tools) || readDirSync(w.tools).length === 0);
        assertStringIncludes(r.stdout, "verify git");
        assertStringIncludes(r.stdout, "never installed");
        assertEquals((await on(w, "tools", "export", "cyclonedx")).code, 0);
      } finally {
        await tool.stop();
      }
    });
  },
  needs,
);

proves(
  ["0001-ergonex FR-020", "0003-host FR-016", "0002-workspace-model FR-003"],
  "ergonex setup --git-include adds one marked include of the generated file to the global Git configuration only after the exact change is shown and --yes (or a yes) is said, never on a dry run, and twice leaves one",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest({
        ...ONE_REPOSITORY,
        identity: { name: "Workspace Person", email: "workspace@example.org" },
      });
      assertEquals((await w.ergonex("render")).code, 0);
      const included = join(w.home, ".ergonex", "git.auto.conf");
      assertStringIncludes(await readTextFile(included), 'name = "Workspace Person"');
      const global = w.env["GIT_CONFIG_GLOBAL"] ?? "";
      const before = await readTextFile(global);
      assertEquals((await w.ergonex("setup", "--git-include")).code, 0);
      assertEquals(await readTextFile(global), before, "a dry run wrote the global configuration");
      const asked = await w.ergonex("setup", "--apply", "--git-include");
      assertEquals(asked.code, 2, asked.stdout + asked.stderr);
      assertStringIncludes(asked.stderr, "--yes");
      assertEquals(await readTextFile(global), before, "the global configuration changed without a yes");
      const yes = await w.ergonex("setup", "--apply", "--git-include", "--yes");
      assertEquals(yes.code, 0, yes.stderr + yes.stdout);
      assertStringIncludes(yes.stderr, "+# >>> ergonex git-include >>>");
      const after = await readTextFile(global);
      assertStringIncludes(after, before.trimEnd());
      assertEquals(after.split("\n").filter((l) => l === "# >>> ergonex git-include >>>").length, 1);
      assertEquals(await w.git(w.dir, "config", "--global", "--get", "include.path"), included);
      assertEquals(await w.git(w.dir, "config", "--get", "user.email"), "workspace@example.org");
      assertEquals((await w.ergonex("setup", "--apply", "--git-include", "--yes")).code, 0);
      assertEquals((await readTextFile(global)).split("\n").filter((l) => l === "# >>> ergonex git-include >>>").length, 1);
      // nothing else of the user's home changed
      assertEquals(await readTextFile(join(w.user, ".bashrc")), "# a person's own start-up file\nexport EDITOR=vi\n");
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-028", "0001-ergonex FR-017"],
  "setup and apply take the same lock file of the workspace: while another run holds it, setup --apply and apply both refuse with exit status 3 and a dry run still runs",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      const held = await acquireLock(join(w.state, "ergonex.lock"), {
        wait: false,
        command: "the first run",
      });
      assert(held !== undefined);
      try {
        const setup = await on(w, "setup", "--apply");
        assertEquals(setup.code, 3, setup.stdout + setup.stderr);
        assertStringIncludes(setup.stderr, "holds the workspace");
        assertEquals((await w.ergonex("apply")).code, 3);
        assertEquals((await on(w, "setup")).code, 0);
        assert(!existsSync(w.repo));
      } finally {
        held?.release();
      }
      assertEquals((await w.ergonex("apply")).code, 0);
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-031", "0001-ergonex FR-014"],
  "doctor finds a plaintext token in a repository's local Git configuration as an error that names the file and the line and never prints the token",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const clean = await w.ergonex("doctor");
      assertEquals(clean.code, 0, clean.stdout + clean.stderr);
      assertStringIncludes(clean.stdout, "no plaintext token");
      const token = fakeToken();
      await w.git(w.repo, "config", "--local", "remote.origin.url", `https://x-access-token:${token}@git.example.org/team/tool.git`);
      const found = await w.ergonex("doctor");
      assertEquals(found.code, 1, found.stdout + found.stderr);
      assertStringIncludes(found.stdout, "error");
      assertStringIncludes(found.stdout, ".git/config");
      assert(!found.stdout.includes(token) && !found.stderr.includes(token), "doctor printed the token");
      for (const f of evidenceFiles(w.state)) assert(!(await readTextFile(f)).includes(token), "a record holds the token");
      const sarif = JSON.parse((await w.ergonex("doctor", "--sarif")).stdout) as {
        runs: { results: { ruleId: string; level: string }[] }[];
      };
      assert(sarif.runs[0]?.results.some((r) => r.ruleId === "ergonex/plaintext-token" && r.level === "error"));
      // the token in the manifest is found too
      await w.git(w.repo, "config", "--local", "remote.origin.url", "https://git.example.org/team/tool.git");
      await writeTextFile(join(w.home, ".ergonex", "workspace.ts"), `// ${token}\nexport default ${JSON.stringify(ONE_REPOSITORY)};\n`);
      const manifest = await w.ergonex("doctor");
      assertEquals(manifest.code, 1);
      assertStringIncludes(manifest.stdout, "workspace.ts");
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-032"],
  "doctor reports a commit of a managed repository that is not signed and verified as an error where a regulated domain is named and as a warning elsewhere",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      await writeTextFile(join(w.repo, "mine.txt"), "mine\n");
      await w.git(w.repo, "add", ".");
      await w.git(w.repo, "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", "an unsigned commit");
      const warned = await w.ergonex("doctor");
      assertEquals(warned.code, 1, warned.stdout);
      assertStringIncludes(warned.stdout, "warn    git.example.org/team/tool@");
      assertStringIncludes(warned.stdout, "is not signed and verified");
      await w.manifest({
        ...ONE_REPOSITORY,
        policy: { regulatedDomain: ["FDA"] },
      });
      assertEquals((await w.ergonex("render", "--force")).code, 0);
      const stopped = await w.ergonex("doctor", "--json");
      assertEquals(stopped.code, 1);
      const checks = (
        JSON.parse(stopped.stdout) as {
          data: { checks: { id: string; level: string }[] };
        }
      ).data.checks;
      assert(
        checks.some((c) => c.id === "ergonex/commit-not-signed" && c.level === "error"),
        JSON.stringify(checks),
      );
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-033", "0001-ergonex FR-011"],
  "an ergonex-* module on the PATH that the catalog does not list is informational from the day first seen and a warning once it is more than 90 days old, the day is kept in the state record and never restarted, and a catalog tool that provides it ends the finding",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const bin = join(w.dir, "bin");
      await mkdir(bin, { recursive: true });
      await writeTextFile(join(bin, "ergonex-foo"), "#!/bin/sh\nexit 0\n");
      await chmod(join(bin, "ergonex-foo"), 0o755);
      const path = `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const doctor = () =>
        w.ergonexOn(execPath(), Ergonex, ["doctor"], {
          ...LOOPBACK,
          PATH: path,
        });
      const record = join(w.state, "state.auto.json");
      const seenOf = async (): Promise<string | undefined> =>
        (
          JSON.parse(await readTextFile(record)) as {
            firstSeen: Record<string, string>;
          }
        ).firstSeen["ergonex-foo"];
      const setSeen = async (d: string): Promise<void> => {
        const s = JSON.parse(await readTextFile(record)) as {
          firstSeen: Record<string, string>;
        };
        s.firstSeen["ergonex-foo"] = d;
        await writeTextFile(record, `${JSON.stringify(s, null, 2)}\n`);
      };

      const first = await doctor();
      assertEquals(first.code, 0, first.stdout + first.stderr);
      assertStringIncludes(first.stdout, "suggest ergonex-foo:");
      assertEquals(await seenOf(), day(0));
      await setSeen(day(89));
      assertEquals((await doctor()).code, 0);
      await setSeen(day(91));
      const late = await doctor();
      assertEquals(late.code, 1, late.stdout);
      assertStringIncludes(late.stdout, "warn    ergonex-foo:");
      assertEquals(await seenOf(), day(91), "the day was restarted");
      // a tool of the catalog that provides it
      const tool = await withTool(w, {
        provides: ["hello-tool", "ergonex-foo"],
      });
      try {
        await on(w, "render");
        const ok = await doctor();
        assertEquals(ok.code, 0, ok.stdout);
        assert(!ok.stdout.includes("ergonex-foo:"), "a module the catalog provides was found outside it");
      } finally {
        await tool.stop();
      }
      // a tool put in the tools folder by hand is told by ergonex tools, with its day kept in the same record
      await mkdir(join(w.tools, "stranger"), {
        recursive: true,
      });
      const t = await on(w, "tools");
      assertStringIncludes(t.stdout, "stranger");
      const kept = JSON.parse(await readTextFile(record)) as {
        firstSeen: Record<string, string>;
      };
      assertEquals(kept.firstSeen["stranger"], day(0));
    });
  },
  needs,
);

proves(
  ["0002-workspace-model FR-031", "0003-host FR-014"],
  "the pre-commit hook scans the staged changes and stops a commit that stages a token, naming the file and the line and not the token; a commit with none passes without a word about a missing scanner",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const bin = join(w.dir, "path");
      await mkdir(bin, { recursive: true });
      await writeTextFile(join(bin, "ergonex"), `#!/bin/sh\nexec ${JSON.stringify(execPath())} ${JSON.stringify(Ergonex)} "$@"\n`);
      await chmod(join(bin, "ergonex"), 0o755);
      const env = {
        ...w.env,
        PATH: `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`,
      };
      const token = fakeToken();
      await writeTextFile(join(w.repo, "notes.txt"), `a line\nthe key: ${token}\n`);
      await run(["git", "-C", w.repo, "add", "."], { env });
      const stopped = await run(["git", "-C", w.repo, "commit", "-q", "-m", "a change\n\nRefs #10"], { env });
      assertEquals(stopped.code !== 0, true, stopped.stderr);
      assertStringIncludes(stopped.stderr, "notes.txt:2");
      assert(!stopped.stderr.includes(token) && !stopped.stdout.includes(token), "the hook printed the token");
      await writeTextFile(join(w.repo, "notes.txt"), "a line\nno secret here\n");
      await run(["git", "-C", w.repo, "add", "."], { env });
      const passed = await run(["git", "-C", w.repo, "commit", "-q", "-m", "a clean change\n\nRefs #10"], { env });
      assertEquals(passed.code, 0, passed.stderr);
      assert(!passed.stderr.includes("scanner"), passed.stderr);
    });
  },
  needs,
);
