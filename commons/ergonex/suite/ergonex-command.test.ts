/**
 * Tests of the `ergonex` controller as a real program (commons 0001-ergonex FR-001 to FR-011, FR-021 to FR-024, 0003-host FR-017 to FR-019, 0002-workspace-model FR-041, FR-042): the help and its scope
 * statement, the list of modules with their sources, a typo answered with the nearest names and exit status 2, a name that is not a module name refused and never run, the modules of the three sources
 * found in their order (an executable `ergonex-*` on the `PATH`, listed and not run until `--probe`, typed where it answers `--ergonex-manifest` and opaque where it does not, a registered module checked
 * against its pinned hash), the four exit statuses, an evidence record for every run (a usage failure recorded as `not_run` with its reason) holding no credential, the shell snippet printed with nothing
 * written and installed and removed as one block, and the same report on Bun and on Node 26. The programs are real: `sh` scripts for the external modules, the runtimes installed here.
 *
 * @module
 */
import { chmod, existsSync, readDirSync, readTextFile, writeTextFile, mkdir } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { execPath, run, which } from "../src/platform/r-proc.ts";
import { sha256 } from "@intellectual-frontiers/crypto";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { readQuality } from "@intellectual-frontiers/commons/ts/quality";
import { BEGIN, END } from "../src/shell/block.ts";
import { BUILTIN_MODULES } from "../src/commands/mod.ts";
import { evidenceFiles, Ergonex, LAUNCHER, needsWorld, ONE_REPOSITORY, REMOTE, withWorld, type World } from "./ergonex-fixtures.ts";

/** The modules a JSON `list` names, by name. */
async function modules(w: World, ...extra: string[]): Promise<{ name: string; source: string; summary: string }[]> {
  const r = await w.ergonex("list", "--json", ...extra);
  assertEquals(r.code, 0, r.stderr);
  return (
    JSON.parse(r.stdout) as {
      data: { modules: { name: string; source: string; summary: string }[] };
    }
  ).data.modules;
}

/** An executable `ergonex-<name>` in `dir`: a script that records that it ran, says what it is given and exits with `code`. */
async function program(dir: string, name: string, body: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `ergonex-${name}`);
  await writeTextFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

const MANIFEST_OK = JSON.stringify({
  contract: 1,
  name: "hello",
  summary: "Says hello.",
  commands: [{ name: "greet", summary: "Greets." }],
});

proves(
  ["0001-ergonex FR-002", "0001-ergonex FR-003", "0001-ergonex FR-001", "0002-workspace-model FR-004"],
  "ergonex --help says it manages only Intellectual Frontiers Workspaces and is not an IFC or Mizan controller, and list names every module with its source",
  async () => {
    await withWorld(async (w) => {
      const help = await w.ergonex("--help");
      assertEquals(help.code, 0);
      assertStringIncludes(
        help.stdout,
        "ergonex manages only Intellectual Frontiers Workspaces. It is not a general IFC or Mizan controller and does not front ifc.",
      );
      for (const m of BUILTIN_MODULES) assertStringIncludes(help.stdout, m.name);
      const fromHelp = await w.ergonex("help");
      assertStringIncludes(fromHelp.stdout, "does not front ifc");
      const one = await w.ergonex("help", "worktree");
      assertStringIncludes(one.stdout, "ergonex worktree create");
      const listed = await modules(w);
      assertEquals(
        listed.map((m) => m.name),
        BUILTIN_MODULES.map((m) => m.name).sort(),
      );
      assert(listed.every((m) => m.source === "ergonex:BuiltIn" && m.summary !== ""));
      // every command accepts --help and runs nothing
      for (const m of BUILTIN_MODULES) {
        const r = await w.ergonex(m.name, "--help");
        assertEquals(r.code, 0, `${m.name}: ${r.stderr}`);
        assertStringIncludes(r.stdout, "ergonex");
      }
      assert(!existsSync(w.home), "help made the root");
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-005", "0001-ergonex FR-006", "0001-ergonex FR-010", "0001-ergonex FR-022"],
  "a typo of a module name is exit status 2 with the nearest names, a name that is not a module name and an unknown option are refused and nothing is run",
  async () => {
    await withWorld(async (w) => {
      const typo = await w.ergonex("plna");
      assertEquals(typo.code, 2);
      assertStringIncludes(typo.stderr, "did you mean plan");
      const far = await w.ergonex("zzzzzzzz");
      assertEquals(far.code, 2);
      assertStringIncludes(far.stderr, "none is near it");
      for (const bad of ["../x", "a b", "a/b", "A", "x;y", "$(id)", "a".repeat(33)]) {
        const r = await w.ergonex(bad);
        assertEquals(r.code, 2, bad);
        assertStringIncludes(r.stderr, "not a module name");
        assertStringIncludes(r.stderr, "nothing was run");
      }
      // no command at all is not an error: it says what to do next, in plain words (0004-onboarding FR-003)
      const bare = await w.ergonex();
      assertEquals(bare.code, 0);
      assertStringIncludes(bare.stdout, "ergonex");
      assertEquals((await w.ergonex("--nope")).code, 2);
      const option = await w.ergonex("list", "--nope");
      assertEquals(option.code, 2);
      assertStringIncludes(option.stderr, "--nope");
      for (const command of ["plan", "apply", "status", "doctor", "verify", "render", "init", "list", "shell"]) {
        const r = await w.ergonex(command, "--not-an-option");
        assertEquals(r.code, 2, command);
      }
      const several = await w.ergonex("worktree", "make");
      assertEquals(several.code, 2);
      assertStringIncludes(several.stderr, "create, list, prune");
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-010", "0002-workspace-model FR-001", "0001-ergonex FR-022", "0003-host FR-001", "0003-host FR-002"],
  "a root that does not exist is exit status 3, --home and $ERGONEX_HOME choose the root, and --json and --sarif give the report and the findings as data",
  async () => {
    await withWorld(async (w) => {
      const none = await w.ergonex("status");
      assertEquals(none.code, 3);
      assertStringIncludes(none.stderr, "ergonex init");
      const mine = join(w.dir, "elsewhere");
      assertEquals((await w.ergonex("init", "--home", mine)).code, 0);
      assert(existsSync(join(mine, ".ergonex", "workspace.ts")));
      assert(!existsSync(w.home), "the default root was made");
      // with neither, the root is $HOME/workspaces
      const bare = await w.ergonexOn(execPath(), Ergonex, ["init"], {
        ERGONEX_HOME: "",
      });
      assertEquals(bare.code, 0, bare.stderr);
      assert(existsSync(join(w.user, "workspaces", ".ergonex", "workspace.ts")));
      await w.ergonex("init");
      await w.manifest({
        repositories: [{ remote: REMOTE }, { remote: "not a remote" }],
      });
      const stopped = await w.ergonex("plan", "--json");
      assertEquals(stopped.code, 1);
      const data = JSON.parse(stopped.stdout) as {
        status: string;
        exitCode: number;
        findings: { ruleId: string; severity: string; subject: string }[];
      };
      assertEquals([data.status, data.exitCode], ["Findings", 1]);
      assertEquals(
        data.findings.map((f) => [f.ruleId, f.severity, f.subject]),
        [["ergonex/manifest-remote", "Error", "$.repositories[1].remote"]],
      );
      const sarif = JSON.parse((await w.ergonex("plan", "--sarif")).stdout) as {
        version: string;
        runs: { results: { ruleId: string; level: string }[] }[];
      };
      assertEquals(sarif.version, "2.1.0");
      assertEquals(
        sarif.runs[0]?.results.map((r) => [r.ruleId, r.level]),
        [["ergonex/manifest-remote", "error"]],
      );
      assert(!existsSync(w.repo), "a manifest that does not decode did not stop the run");
      // the starter manifest is written once and never rewritten (0003-host FR-002)
      await w.manifest(ONE_REPOSITORY);
      const written = await readTextFile(join(w.home, ".ergonex", "workspace.ts"));
      const again = await w.ergonex("init");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "already a workspace");
      assertEquals(await readTextFile(join(w.home, ".ergonex", "workspace.ts")), written);
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-003", "0001-ergonex FR-004", "0001-ergonex FR-008", "0001-ergonex FR-009", "0001-ergonex FR-010"],
  "an executable ergonex-* on the PATH is listed with the source ergonex:Path and not run, run by ergonex <name> with its exit status passed on, probed only with --probe (typed where its answer decodes, opaque where it does not), and a built-in hides it",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const bin = join(w.dir, "bin");
      const marker = join(w.dir, "ran.txt");
      await program(
        bin,
        "hello",
        `if [ "$1" = "--ergonex-manifest" ]; then echo ${JSON.stringify(MANIFEST_OK)} | cat; exit 0; fi\necho "ran $*" >> ${marker}\necho "hello from the module: $*"\nexit 1`,
      );
      await program(
        bin,
        "opaque",
        `if [ "$1" = "--ergonex-manifest" ]; then echo "this is not json"; exit 0; fi\necho "ran" >> ${marker}\nexit 0`,
      );
      await program(bin, "silent", `if [ "$1" = "--ergonex-manifest" ]; then exit 0; fi\nexit 0`);
      await program(bin, "doctor", `echo "the hidden module ran" >> ${marker}\nexit 0`);
      await program(bin, "Not_A_Name", "exit 0");
      const path = `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const on = (...words: string[]) => w.ergonexOn(execPath(), Ergonex, words, { PATH: path });

      const listed = await on("list", "--json");
      assertEquals(listed.code, 0, listed.stderr);
      const parsed = JSON.parse(listed.stdout) as {
        data: { modules: { name: string; source: string; summary: string }[] };
        findings: { ruleId: string; severity: string; subject: string }[];
      };
      const hello = parsed.data.modules.find((m) => m.name === "hello");
      assertEquals(hello?.source, "ergonex:Path");
      assertEquals(parsed.data.modules.find((m) => m.name === "doctor")?.source, "ergonex:BuiltIn");
      assert(!existsSync(marker), "list ran a module found on the PATH");
      assert(
        parsed.findings.some((f) => f.ruleId === "ergonex/module-hidden" && f.subject === "doctor" && f.severity === "Informational"),
        JSON.stringify(parsed.findings),
      );
      assertEquals(listed.code, 0, "an informational finding alone made the status 1");
      assertEquals((await on("help")).code, 0);
      assertEquals((await on("help", "hello")).code, 0);
      assert(!existsSync(marker), "help ran a module found on the PATH");

      // run: its words, its output and its own status are passed on
      const ran = await on("hello", "a", "--b");
      assertEquals(ran.code, 1);
      assertStringIncludes(ran.stdout, "hello from the module: a --b");
      assertStringIncludes(await readTextFile(marker), "ran a --b");
      // the built-in runs where an executable of the same name is on the PATH
      const doctor = await on("doctor");
      assert(!(await readTextFile(marker)).includes("the hidden module ran"), "the hidden module ran");
      assertStringIncludes(doctor.stdout, "ok");

      // probe: typed where it answers, opaque where it does not
      const probed = await on("list", "--probe", "--yes", "--json");
      const rows = (
        JSON.parse(probed.stdout) as {
          data: {
            modules: {
              name: string;
              summary: string;
              opaque?: string;
              commands?: { name: string }[];
            }[];
          };
        }
      ).data.modules;
      const typed = rows.find((m) => m.name === "hello");
      assertEquals(typed?.summary, "Says hello.");
      assertEquals(
        typed?.commands?.map((c) => c.name),
        ["greet"],
      );
      assert(rows.find((m) => m.name === "opaque")?.opaque !== undefined);
      assert(rows.find((m) => m.name === "silent")?.opaque !== undefined);
      assert(!rows.some((m) => m.name === "not_a_name" || m.name === "Not_A_Name"), "a name that is not a module name is listed");
      assert(!(await readTextFile(marker)).includes("ran\n"), "probing ran the module's own command");
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-004", "0001-ergonex FR-011"],
  "a module the workspace registers is found before the PATH, run, and checked against its pinned SHA-256: a program that changed is refused with exit status 3",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const bin = join(w.dir, "tools");
      const file = await program(bin, "regd", `echo "registered module ran: $*"\nexit 0`);
      const onPath = await program(join(w.dir, "pathbin"), "regd", `echo "the PATH one ran"\nexit 0`);
      const hash = await sha256(await readTextFile(file));
      await w.manifest({
        ...ONE_REPOSITORY,
        modules: [
          {
            name: "regd",
            program: file,
            sha256: hash,
            summary: "A registered module.",
          },
        ],
      });
      assertEquals((await w.ergonex("render")).code, 0);
      const registered = JSON.parse(await readTextFile(join(w.home, ".ergonex", "modules.auto.json"))) as {
        modules: { name: string }[];
      };
      assertEquals(
        registered.modules.map((m) => m.name),
        ["regd"],
      );
      const path = `${join(w.dir, "pathbin")}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const on = (...words: string[]) => w.ergonexOn(execPath(), Ergonex, words, { PATH: path });
      const ran = await on("regd", "x");
      assertEquals(ran.code, 0, ran.stderr);
      assertStringIncludes(ran.stdout, "registered module ran: x");
      assert(onPath !== "");
      const listed = (
        JSON.parse((await on("list", "--json")).stdout) as {
          data: { modules: { name: string; source: string }[] };
        }
      ).data.modules;
      assertEquals(listed.find((m) => m.name === "regd")?.source, "ergonex:Registered");
      // a program named without a folder is below the root, so that the manifest is the same on every computer
      await program(join(w.home, "bin"), "rel", `echo "relative module ran"\nexit 0`);
      await w.manifest({
        ...ONE_REPOSITORY,
        modules: [
          { name: "regd", program: file, sha256: hash },
          { name: "rel", program: "bin/ergonex-rel" },
        ],
      });
      assertEquals((await w.ergonex("render")).code, 0);
      const relative = await on("rel");
      assertEquals(relative.code, 0, relative.stderr);
      assertStringIncludes(relative.stdout, "relative module ran");
      // the program changes: refused, not run
      await writeTextFile(file, `#!/bin/sh\necho "a changed program ran"\n`);
      await chmod(file, 0o755);
      const refused = await on("regd");
      assertEquals(refused.code, 3);
      assertStringIncludes(refused.stderr, "SHA-256 differs");
      assert(!refused.stdout.includes("changed program ran"));
    });
  },
  needsWorld,
);

proves(
  ["0002-workspace-model FR-041", "0002-workspace-model FR-042", "0002-workspace-model FR-043", "0001-ergonex FR-023"],
  "every run writes one evidence record in the shape of an IFQS record, a run that ends in usage is not_run with its reason, and none holds a credential",
  async () => {
    await withWorld(async (w) => {
      const token = `ghp_${"a1B2c3D4e5".repeat(4)}`;
      const env = {
        GITHUB_TOKEN: token,
        GITLAB_TOKEN: `glpat-${"x9Y8z7".repeat(4)}`,
      };
      const on = (...words: string[]) => w.ergonexOn(execPath(), Ergonex, words, env);
      assertEquals((await on("init")).code, 0);
      await w.manifest(ONE_REPOSITORY);
      const before = evidenceFiles(w.state).length;
      assertEquals((await on("plan")).code, 0);
      assertEquals((await on("plan", "--nope")).code, 2);
      assertEquals((await on("list")).code, 0);
      assertEquals((await on("verify")).code, 1);
      const files = evidenceFiles(w.state);
      assertEquals(files.length, before + 4, "a run did not write exactly one record");
      const names = new Set(files);
      assertEquals(names.size, files.length, "a record was overwritten or named twice");
      for (const f of files) {
        const text = await readTextFile(f);
        assert(!text.includes(token) && !text.includes("glpat-"), `${f} holds a credential`);
        assert(!text.includes("README"), "a record holds the content of a file");
        const q = readQuality(text);
        assert(q.kind === "ok", q.kind === "err" ? JSON.stringify(q.error) : "");
      }
      const reads = await Promise.all(files.slice(before).map(async (f) => readQuality(await readTextFile(f))));
      const [plan, usage, list, verify] = reads.map((r) => (r.kind === "ok" ? r.value : undefined));
      assertEquals(plan?.counts.passed, 1);
      assertEquals(usage?.counts.notRun, 1);
      assertStringIncludes(JSON.stringify(await readTextFile(files[before + 1] ?? "")), "--nope");
      assertEquals(list?.counts.passed, 1);
      assert((verify?.counts.failed ?? 0) > 0, "verify found what it should (nothing rendered yet) and recorded it");
      // the plan's hash and the exit status are in the record
      const planText = await readTextFile(files[before] ?? "");
      for (const key of ["ergonex.plan.sha256", "ergonex.command", "ergonex.exit.status", "ergonex.exit.code"])
        assertStringIncludes(planText, key);
      // the tool versions of a regulated workspace are named (0023 FR-043)
      await w.manifest({
        ...ONE_REPOSITORY,
        policy: { regulatedDomain: ["FDA"] },
      });
      await on("status");
      const last = await readTextFile(evidenceFiles(w.state).at(-1) ?? "");
      assertStringIncludes(last, "ergonex.tool.git.version");
      assertStringIncludes(last, "ergonex.regulated");
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-017", "0003-host FR-018", "0001-ergonex FR-021", "0001-ergonex FR-026"],
  "ergonex shell <shell> prints the snippet on standard output and writes nothing, no file and no evidence record, and a shell it does not know is exit status 2",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const digest = await w.userDigest();
      const evidence = evidenceFiles(w.state).length;
      const files = readDirSync(w.home)
        .map((e) => e.name)
        .sort();
      for (const shell of ["bash", "zsh", "fish", "pwsh", "nu"]) {
        const r = await w.ergonex("shell", shell);
        assertEquals(r.code, 0, shell);
        assertStringIncludes(r.stdout, "ERGONEX_HOME");
        assertStringIncludes(r.stdout, "wcd");
        assertEquals(r.stderr, "");
      }
      assertEquals(await w.userDigest(), digest);
      assertEquals(
        readDirSync(w.home)
          .map((e) => e.name)
          .sort(),
        files,
      );
      assertEquals(evidenceFiles(w.state).length, evidence, "printing a snippet wrote an evidence record");
      const bad = await w.ergonex("shell", "tcsh");
      assertEquals(bad.code, 2);
      assertStringIncludes(bad.stderr, "bash, zsh, fish, pwsh, nu");
      assertEquals((await w.ergonex("shell")).code, 2);
      // the snippet is the same as the one a person's rc file would hold
      const bash = await w.ergonex("shell", "bash");
      assertStringIncludes(bash.stdout, `"\${ERGONEX_HOME:-$HOME/workspaces}"`);
      const named = await w.ergonex("shell", "bash", "--home", "/srv/ws");
      assertStringIncludes(named.stdout, "'/srv/ws'");
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-019", "0001-ergonex FR-020", "0003-host FR-020"],
  "ergonex shell --install shows a diff and writes one block only after a yes (or --yes), twice leaves one, --uninstall removes exactly it, and with no terminal and no --yes it is a usage failure that writes nothing",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const rc = join(w.dir, "my.bashrc");
      const original = "# mine\nexport EDITOR=vi\nalias ll='ls -l'\n";
      await writeTextFile(rc, original);
      const noTerminal = await w.ergonex("shell", "bash", "--install", "--rc", rc);
      assertEquals(noTerminal.code, 2);
      assertStringIncludes(noTerminal.stderr, "no terminal");
      assertStringIncludes(noTerminal.stderr, "+# >>> ergonex >>>");
      assertEquals(await readTextFile(rc), original);

      const installed = await w.ergonex("shell", "bash", "--install", "--rc", rc, "--yes");
      assertEquals(installed.code, 0, installed.stderr);
      assertStringIncludes(installed.stderr, "--- a/");
      const text = await readTextFile(rc);
      assert(text.startsWith(original));
      assertEquals(text.split("\n").filter((l) => l === BEGIN).length, 1);
      assertEquals(text.split("\n").filter((l) => l === END).length, 1);
      const again = await w.ergonex("shell", "bash", "--install", "--rc", rc, "--yes");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "already has");
      assertEquals(await readTextFile(rc), text);
      // sourced by a real bash, the installed file defines wcd
      const sourced = await run([which("bash") ?? "bash", "-c", `. ${JSON.stringify(rc)}; type wcd`], { env: { HOME: w.user } });
      assertStringIncludes(sourced.stdout, "wcd is a function");
      // text the person adds after the block is kept by --uninstall
      await writeTextFile(rc, `${text}export AFTER=1\n`);
      const gone = await w.ergonex("shell", "bash", "--uninstall", "--rc", rc, "--yes");
      assertEquals(gone.code, 0, gone.stderr);
      assertEquals(await readTextFile(rc), `${original}export AFTER=1\n`);
      assertStringIncludes((await w.ergonex("shell", "bash", "--uninstall", "--rc", rc, "--yes")).stdout, "has no ergonex block");
      // a start-up file that is not there is not made (0003-host FR-026): nothing is written and the way to make it is said
      const fish = join(w.dir, "config", "fish", "conf.d", "ergonex.fish");
      const absent = await w.ergonex("shell", "fish", "--install", "--rc", fish, "--yes");
      assertEquals(absent.code, 3, absent.stderr);
      assertStringIncludes(absent.stderr, "never creates a start-up file");
      assertStringIncludes(absent.stderr, `touch '${fish}'`);
      assert(!existsSync(fish) && !existsSync(join(w.dir, "config")), "a start-up file or its folder was made");
      // made by the person, it is written like any other
      await mkdir(join(w.dir, "config", "fish", "conf.d"), { recursive: true });
      await writeTextFile(fish, "");
      assertEquals((await w.ergonex("shell", "fish", "--install", "--rc", fish, "--yes")).code, 0);
      assertStringIncludes(await readTextFile(fish), BEGIN);
      assertEquals((await w.ergonex("shell", "bash", "--install", "--uninstall", "--rc", rc, "--yes")).code, 2);
      // nothing else of the user's home was written
      assertEquals(await w.userDigest().then((d) => d.length), 64);
    });
  },
  needsWorld,
);

proves(
  ["0003-host FR-026"],
  "ergonex shell --install, run as a program, never creates the shell's own start-up file or its folder: it writes nothing, says the command and the path, and --uninstall does not create one either",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      const before = await w.userDigest();
      // the default start-up file of zsh is not in the user's home of the world
      const zshrc = join(w.user, ".zshrc");
      assert(!existsSync(zshrc));
      const refused = await w.ergonex("shell", "zsh", "--install", "--yes");
      assertEquals(refused.code, 3, refused.stderr);
      assertStringIncludes(refused.stderr, "never creates a start-up file");
      assertStringIncludes(refused.stderr, `touch '${zshrc}'`);
      assert(!existsSync(zshrc), "the start-up file was made");
      assertEquals(await w.userDigest(), before, "the user's home changed");
      // no terminal and no --yes: the refusal is the same and nothing is asked
      assertEquals((await w.ergonex("shell", "zsh", "--install")).code, 3);
      // uninstall of a file that is not there: nothing to remove, nothing made
      const gone = await w.ergonex("shell", "zsh", "--uninstall", "--yes");
      assertEquals(gone.code, 0, gone.stderr);
      assert(!existsSync(zshrc), "uninstall made the start-up file");
      // what the command says works: made by the person, it takes the block
      await writeTextFile(zshrc, "");
      assertEquals((await w.ergonex("shell", "zsh", "--install", "--yes")).code, 0);
      assertStringIncludes(await readTextFile(zshrc), BEGIN);
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-024", "0001-ergonex FR-001"],
  "the same report comes from Bun and from Node 26, through the controller and through the launcher the package's bin names, whichever runtime is installed",
  async () => {
    await withWorld(async (w) => {
      await w.ergonex("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      const runtimes = ["bun", "node"].flatMap((name) => {
        const program = which(name);
        return program === undefined ? [] : [{ name, program }];
      });
      const reports: {
        runtime: string;
        entry: string;
        stdout: string;
        code: number;
      }[] = [];
      for (const r of runtimes) {
        for (const entry of [Ergonex, LAUNCHER]) {
          const out = await w.ergonexOn(r.program, entry, ["status"]);
          reports.push({
            runtime: r.name,
            entry,
            stdout: out.stdout,
            code: out.code,
          });
        }
      }
      assert(reports.length >= 2, "a runtime ran it");
      for (const r of reports) {
        assertEquals(r.code, 0, `${r.runtime} ${r.entry}`);
        assertEquals(r.stdout, reports[0]?.stdout, `${r.runtime} ${r.entry} reports differently`);
      }
      assertStringIncludes(reports[0]?.stdout ?? "", "git.example.org/team/tool");
      const text = await readTextFile(LAUNCHER);
      assert(text.startsWith("#!/usr/bin/env node\n"), "the launcher runs from a shebang");
      assert(
        text.indexOf('commons/ts/node";') > 0 && text.indexOf('commons/ts/node";') < text.indexOf('import("../src/ergonex.ts")'),
        "the hook is registered first",
      );
    });
  },
  needsWorld,
);
