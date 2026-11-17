/**
 * Tests of the `ifws` controller as a real program (commons 0025-ifws FR-001 to FR-011, FR-021 to FR-024, 0024-ifws-host FR-017 to FR-019, 0023-if-workspaces FR-041, FR-042): the help and its scope
 * statement, the list of modules with their sources, a typo answered with the nearest names and exit status 2, a name that is not a module name refused and never run, the modules of the three sources
 * found in their order (an executable `ifws-*` on the `PATH`, listed and not run until `--probe`, typed where it answers `--ifws-manifest` and opaque where it does not, a registered module checked
 * against its pinned hash), the four exit statuses, an evidence record for every run (a usage failure recorded as `not_run` with its reason) holding no credential, the shell snippet printed with nothing
 * written and installed and removed as one block, and the same report on Bun and on Node 26. The programs are real: `sh` scripts for the external modules, the runtimes installed here.
 *
 * @module
 */
import { chmod, existsSync, readDirSync, readTextFile, writeTextFile, mkdir } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { execPath, run, which } from "../runtime/proc.ts";
import { sha256 } from "../kernel/sha256.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { readQuality } from "../quality/pure/record.ts";
import { BEGIN, END } from "../workspaces/shell/block.ts";
import { BUILTIN_MODULES } from "../workspaces/commands/mod.ts";
import { evidenceFiles, IFWS, LAUNCHER, needsWorld, ONE_REPOSITORY, REMOTE, withWorld, type World } from "./ifws-fixtures.ts";

/** The modules a JSON `list` names, by name. */
async function modules(w: World, ...extra: string[]): Promise<{ name: string; source: string; summary: string }[]> {
  const r = await w.ifws("list", "--json", ...extra);
  assertEquals(r.code, 0, r.stderr);
  return (JSON.parse(r.stdout) as { data: { modules: { name: string; source: string; summary: string }[] } }).data.modules;
}

/** An executable `ifws-<name>` in `dir`: a script that records that it ran, says what it is given and exits with `code`. */
async function program(dir: string, name: string, body: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `ifws-${name}`);
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
  ["0025-ifws FR-002", "0025-ifws FR-003", "0025-ifws FR-001", "0023-if-workspaces FR-004"],
  "ifws --help says it manages only Intellectual Frontiers Workspaces and is not an IFC or Mizan controller, and list names every module with its source",
  async () => {
    await withWorld(async (w) => {
      const help = await w.ifws("--help");
      assertEquals(help.code, 0);
      assertStringIncludes(
        help.stdout,
        "ifws manages only Intellectual Frontiers Workspaces. It is not a general IFC or Mizan controller and does not front ifc.",
      );
      for (const m of BUILTIN_MODULES) assertStringIncludes(help.stdout, m.name);
      const fromHelp = await w.ifws("help");
      assertStringIncludes(fromHelp.stdout, "does not front ifc");
      const one = await w.ifws("help", "worktree");
      assertStringIncludes(one.stdout, "ifws worktree create");
      const listed = await modules(w);
      assertEquals(
        listed.map((m) => m.name),
        BUILTIN_MODULES.map((m) => m.name).sort(),
      );
      assert(listed.every((m) => m.source === "ifws:BuiltIn" && m.summary !== ""));
      // every command accepts --help and runs nothing
      for (const m of BUILTIN_MODULES) {
        const r = await w.ifws(m.name, "--help");
        assertEquals(r.code, 0, `${m.name}: ${r.stderr}`);
        assertStringIncludes(r.stdout, "ifws");
      }
      assert(!existsSync(w.home), "help made the root");
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-005", "0025-ifws FR-006", "0025-ifws FR-010", "0025-ifws FR-022"],
  "a typo of a module name is exit status 2 with the nearest names, a name that is not a module name and an unknown option are refused and nothing is run",
  async () => {
    await withWorld(async (w) => {
      const typo = await w.ifws("plna");
      assertEquals(typo.code, 2);
      assertStringIncludes(typo.stderr, "did you mean plan");
      const far = await w.ifws("zzzzzzzz");
      assertEquals(far.code, 2);
      assertStringIncludes(far.stderr, "none is near it");
      for (const bad of ["../x", "a b", "a/b", "A", "x;y", "$(id)", "a".repeat(33)]) {
        const r = await w.ifws(bad);
        assertEquals(r.code, 2, bad);
        assertStringIncludes(r.stderr, "not a module name");
        assertStringIncludes(r.stderr, "nothing was run");
      }
      assertEquals((await w.ifws()).code, 2);
      assertEquals((await w.ifws("--nope")).code, 2);
      const option = await w.ifws("list", "--nope");
      assertEquals(option.code, 2);
      assertStringIncludes(option.stderr, "--nope");
      for (const command of ["plan", "apply", "status", "doctor", "verify", "render", "init", "list", "shell"]) {
        const r = await w.ifws(command, "--not-an-option");
        assertEquals(r.code, 2, command);
      }
      const several = await w.ifws("worktree", "make");
      assertEquals(several.code, 2);
      assertStringIncludes(several.stderr, "create, list, prune");
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-010", "0023-if-workspaces FR-001", "0025-ifws FR-022", "0024-ifws-host FR-001", "0024-ifws-host FR-002"],
  "a root that does not exist is exit status 3, --home and $IFC_WORKSPACES_HOME choose the root, and --json and --sarif give the report and the findings as data",
  async () => {
    await withWorld(async (w) => {
      const none = await w.ifws("status");
      assertEquals(none.code, 3);
      assertStringIncludes(none.stderr, "ifws init");
      const mine = join(w.dir, "elsewhere");
      assertEquals((await w.ifws("init", "--home", mine)).code, 0);
      assert(existsSync(join(mine, ".if-workspaces", "workspace.ts")));
      assert(!existsSync(w.home), "the default root was made");
      // with neither, the root is $HOME/workspaces
      const bare = await w.ifwsOn(execPath(), IFWS, ["init"], { IFC_WORKSPACES_HOME: "" });
      assertEquals(bare.code, 0, bare.stderr);
      assert(existsSync(join(w.user, "workspaces", ".if-workspaces", "workspace.ts")));
      await w.ifws("init");
      await w.manifest({ repositories: [{ remote: REMOTE }, { remote: "not a remote" }] });
      const stopped = await w.ifws("plan", "--json");
      assertEquals(stopped.code, 1);
      const data = JSON.parse(stopped.stdout) as {
        status: string;
        exitCode: number;
        findings: { ruleId: string; severity: string; subject: string }[];
      };
      assertEquals([data.status, data.exitCode], ["Findings", 1]);
      assertEquals(
        data.findings.map((f) => [f.ruleId, f.severity, f.subject]),
        [["ifws/manifest-remote", "Error", "$.repositories[1].remote"]],
      );
      const sarif = JSON.parse((await w.ifws("plan", "--sarif")).stdout) as {
        version: string;
        runs: { results: { ruleId: string; level: string }[] }[];
      };
      assertEquals(sarif.version, "2.1.0");
      assertEquals(
        sarif.runs[0]?.results.map((r) => [r.ruleId, r.level]),
        [["ifws/manifest-remote", "error"]],
      );
      assert(!existsSync(w.repo), "a manifest that does not decode did not stop the run");
      // the starter manifest is written once and never rewritten (0024-ifws-host FR-002)
      await w.manifest(ONE_REPOSITORY);
      const written = await readTextFile(join(w.home, ".if-workspaces", "workspace.ts"));
      const again = await w.ifws("init");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "already a workspace");
      assertEquals(await readTextFile(join(w.home, ".if-workspaces", "workspace.ts")), written);
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-003", "0025-ifws FR-004", "0025-ifws FR-008", "0025-ifws FR-009", "0025-ifws FR-010"],
  "an executable ifws-* on the PATH is listed with the source ifws:Path and not run, run by ifws <name> with its exit status passed on, probed only with --probe (typed where its answer decodes, opaque where it does not), and a built-in hides it",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      const bin = join(w.dir, "bin");
      const marker = join(w.dir, "ran.txt");
      await program(
        bin,
        "hello",
        `if [ "$1" = "--ifws-manifest" ]; then echo ${JSON.stringify(MANIFEST_OK)} | cat; exit 0; fi\necho "ran $*" >> ${marker}\necho "hello from the module: $*"\nexit 1`,
      );
      await program(
        bin,
        "opaque",
        `if [ "$1" = "--ifws-manifest" ]; then echo "this is not json"; exit 0; fi\necho "ran" >> ${marker}\nexit 0`,
      );
      await program(bin, "silent", `if [ "$1" = "--ifws-manifest" ]; then exit 0; fi\nexit 0`);
      await program(bin, "doctor", `echo "the hidden module ran" >> ${marker}\nexit 0`);
      await program(bin, "Not_A_Name", "exit 0");
      const path = `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const on = (...words: string[]) => w.ifwsOn(execPath(), IFWS, words, { PATH: path });

      const listed = await on("list", "--json");
      assertEquals(listed.code, 0, listed.stderr);
      const parsed = JSON.parse(listed.stdout) as {
        data: { modules: { name: string; source: string; summary: string }[] };
        findings: { ruleId: string; severity: string; subject: string }[];
      };
      const hello = parsed.data.modules.find((m) => m.name === "hello");
      assertEquals(hello?.source, "ifws:Path");
      assertEquals(parsed.data.modules.find((m) => m.name === "doctor")?.source, "ifws:BuiltIn");
      assert(!existsSync(marker), "list ran a module found on the PATH");
      assert(
        parsed.findings.some((f) => f.ruleId === "ifws/module-hidden" && f.subject === "doctor" && f.severity === "Informational"),
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
      const probed = await on("list", "--probe", "--json");
      const rows = (
        JSON.parse(probed.stdout) as {
          data: { modules: { name: string; summary: string; opaque?: string; commands?: { name: string }[] }[] };
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
  ["0025-ifws FR-004", "0025-ifws FR-011"],
  "a module the workspace registers is found before the PATH, run, and checked against its pinned SHA-256: a program that changed is refused with exit status 3",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      const bin = join(w.dir, "tools");
      const file = await program(bin, "regd", `echo "registered module ran: $*"\nexit 0`);
      const onPath = await program(join(w.dir, "pathbin"), "regd", `echo "the PATH one ran"\nexit 0`);
      const hash = await sha256(await readTextFile(file));
      await w.manifest({ ...ONE_REPOSITORY, modules: [{ name: "regd", program: file, sha256: hash, summary: "A registered module." }] });
      assertEquals((await w.ifws("render")).code, 0);
      const registered = JSON.parse(await readTextFile(join(w.home, ".if-workspaces", "modules.auto.json"))) as {
        modules: { name: string }[];
      };
      assertEquals(
        registered.modules.map((m) => m.name),
        ["regd"],
      );
      const path = `${join(w.dir, "pathbin")}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`;
      const on = (...words: string[]) => w.ifwsOn(execPath(), IFWS, words, { PATH: path });
      const ran = await on("regd", "x");
      assertEquals(ran.code, 0, ran.stderr);
      assertStringIncludes(ran.stdout, "registered module ran: x");
      assert(onPath !== "");
      const listed = (JSON.parse((await on("list", "--json")).stdout) as { data: { modules: { name: string; source: string }[] } }).data
        .modules;
      assertEquals(listed.find((m) => m.name === "regd")?.source, "ifws:Registered");
      // a program named without a folder is below the root, so that the manifest is the same on every computer
      await program(join(w.home, "bin"), "rel", `echo "relative module ran"\nexit 0`);
      await w.manifest({
        ...ONE_REPOSITORY,
        modules: [
          { name: "regd", program: file, sha256: hash },
          { name: "rel", program: "bin/ifws-rel" },
        ],
      });
      assertEquals((await w.ifws("render")).code, 0);
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
  ["0023-if-workspaces FR-041", "0023-if-workspaces FR-042", "0023-if-workspaces FR-043", "0025-ifws FR-023"],
  "every run writes one evidence record in the shape of an IFQS record, a run that ends in usage is not_run with its reason, and none holds a credential",
  async () => {
    await withWorld(async (w) => {
      const token = `ghp_${"a1B2c3D4e5".repeat(4)}`;
      const env = { GITHUB_TOKEN: token, GITLAB_TOKEN: `glpat-${"x9Y8z7".repeat(4)}` };
      const on = (...words: string[]) => w.ifwsOn(execPath(), IFWS, words, env);
      assertEquals((await on("init")).code, 0);
      await w.manifest(ONE_REPOSITORY);
      const before = evidenceFiles(w.home).length;
      assertEquals((await on("plan")).code, 0);
      assertEquals((await on("plan", "--nope")).code, 2);
      assertEquals((await on("list")).code, 0);
      assertEquals((await on("verify")).code, 1);
      const files = evidenceFiles(w.home);
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
      for (const key of ["ifws.plan.sha256", "ifws.command", "ifws.exit.status", "ifws.exit.code"]) assertStringIncludes(planText, key);
      // the tool versions of a regulated workspace are named (0023 FR-043)
      await w.manifest({ ...ONE_REPOSITORY, policy: { regulatedDomain: ["FDA"] } });
      await on("status");
      const last = await readTextFile(evidenceFiles(w.home).at(-1) ?? "");
      assertStringIncludes(last, "ifws.tool.git.version");
      assertStringIncludes(last, "ifws.regulated");
    });
  },
  needsWorld,
);

proves(
  ["0024-ifws-host FR-017", "0024-ifws-host FR-018", "0025-ifws FR-021", "0025-ifws FR-026"],
  "ifws shell <shell> prints the snippet on standard output and writes nothing, no file and no evidence record, and a shell it does not know is exit status 2",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      const digest = await w.userDigest();
      const evidence = evidenceFiles(w.home).length;
      const files = readDirSync(w.home)
        .map((e) => e.name)
        .sort();
      for (const shell of ["bash", "zsh", "fish", "pwsh", "nu"]) {
        const r = await w.ifws("shell", shell);
        assertEquals(r.code, 0, shell);
        assertStringIncludes(r.stdout, "IFC_WORKSPACES_HOME");
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
      assertEquals(evidenceFiles(w.home).length, evidence, "printing a snippet wrote an evidence record");
      const bad = await w.ifws("shell", "tcsh");
      assertEquals(bad.code, 2);
      assertStringIncludes(bad.stderr, "bash, zsh, fish, pwsh, nu");
      assertEquals((await w.ifws("shell")).code, 2);
      // the snippet is the same as the one a person's rc file would hold
      const bash = await w.ifws("shell", "bash");
      assertStringIncludes(bash.stdout, `"\${IFC_WORKSPACES_HOME:-$HOME/workspaces}"`);
      const named = await w.ifws("shell", "bash", "--home", "/srv/ws");
      assertStringIncludes(named.stdout, "'/srv/ws'");
    });
  },
  needsWorld,
);

proves(
  ["0024-ifws-host FR-019", "0025-ifws FR-020", "0024-ifws-host FR-020"],
  "ifws shell --install shows a diff and writes one block only after a yes (or --yes), twice leaves one, --uninstall removes exactly it, and with no terminal and no --yes it is a usage failure that writes nothing",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      const rc = join(w.dir, "my.bashrc");
      const original = "# mine\nexport EDITOR=vi\nalias ll='ls -l'\n";
      await writeTextFile(rc, original);
      const noTerminal = await w.ifws("shell", "bash", "--install", "--rc", rc);
      assertEquals(noTerminal.code, 2);
      assertStringIncludes(noTerminal.stderr, "no terminal");
      assertStringIncludes(noTerminal.stderr, "+# >>> ifws >>>");
      assertEquals(await readTextFile(rc), original);

      const installed = await w.ifws("shell", "bash", "--install", "--rc", rc, "--yes");
      assertEquals(installed.code, 0, installed.stderr);
      assertStringIncludes(installed.stderr, "--- a/");
      const text = await readTextFile(rc);
      assert(text.startsWith(original));
      assertEquals(text.split("\n").filter((l) => l === BEGIN).length, 1);
      assertEquals(text.split("\n").filter((l) => l === END).length, 1);
      const again = await w.ifws("shell", "bash", "--install", "--rc", rc, "--yes");
      assertEquals(again.code, 0);
      assertStringIncludes(again.stdout, "already has");
      assertEquals(await readTextFile(rc), text);
      // sourced by a real bash, the installed file defines wcd
      const sourced = await run([which("bash") ?? "bash", "-c", `. ${JSON.stringify(rc)}; type wcd`], { env: { HOME: w.user } });
      assertStringIncludes(sourced.stdout, "wcd is a function");
      // text the person adds after the block is kept by --uninstall
      await writeTextFile(rc, `${text}export AFTER=1\n`);
      const gone = await w.ifws("shell", "bash", "--uninstall", "--rc", rc, "--yes");
      assertEquals(gone.code, 0, gone.stderr);
      assertEquals(await readTextFile(rc), `${original}export AFTER=1\n`);
      assertStringIncludes((await w.ifws("shell", "bash", "--uninstall", "--rc", rc, "--yes")).stdout, "has no ifws block");
      // a start-up file that is not there is not made (0024-ifws-host FR-026): nothing is written and the way to make it is said
      const fish = join(w.dir, "config", "fish", "conf.d", "ifws.fish");
      const absent = await w.ifws("shell", "fish", "--install", "--rc", fish, "--yes");
      assertEquals(absent.code, 3, absent.stderr);
      assertStringIncludes(absent.stderr, "never creates a start-up file");
      assertStringIncludes(absent.stderr, `touch '${fish}'`);
      assert(!existsSync(fish) && !existsSync(join(w.dir, "config")), "a start-up file or its folder was made");
      // made by the person, it is written like any other
      await mkdir(join(w.dir, "config", "fish", "conf.d"), { recursive: true });
      await writeTextFile(fish, "");
      assertEquals((await w.ifws("shell", "fish", "--install", "--rc", fish, "--yes")).code, 0);
      assertStringIncludes(await readTextFile(fish), BEGIN);
      assertEquals((await w.ifws("shell", "bash", "--install", "--uninstall", "--rc", rc, "--yes")).code, 2);
      // nothing else of the user's home was written
      assertEquals(await w.userDigest().then((d) => d.length), 64);
    });
  },
  needsWorld,
);

proves(
  ["0024-ifws-host FR-026"],
  "ifws shell --install, run as a program, never creates the shell's own start-up file or its folder: it writes nothing, says the command and the path, and --uninstall does not create one either",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      const before = await w.userDigest();
      // the default start-up file of zsh is not in the user's home of the world
      const zshrc = join(w.user, ".zshrc");
      assert(!existsSync(zshrc));
      const refused = await w.ifws("shell", "zsh", "--install", "--yes");
      assertEquals(refused.code, 3, refused.stderr);
      assertStringIncludes(refused.stderr, "never creates a start-up file");
      assertStringIncludes(refused.stderr, `touch '${zshrc}'`);
      assert(!existsSync(zshrc), "the start-up file was made");
      assertEquals(await w.userDigest(), before, "the user's home changed");
      // no terminal and no --yes: the refusal is the same and nothing is asked
      assertEquals((await w.ifws("shell", "zsh", "--install")).code, 3);
      // uninstall of a file that is not there: nothing to remove, nothing made
      const gone = await w.ifws("shell", "zsh", "--uninstall", "--yes");
      assertEquals(gone.code, 0, gone.stderr);
      assert(!existsSync(zshrc), "uninstall made the start-up file");
      // what the command says works: made by the person, it takes the block
      await writeTextFile(zshrc, "");
      assertEquals((await w.ifws("shell", "zsh", "--install", "--yes")).code, 0);
      assertStringIncludes(await readTextFile(zshrc), BEGIN);
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-024", "0025-ifws FR-001"],
  "the same report comes from Bun and from Node 26, through the controller and through the launcher the package's bin names, whichever runtime is installed",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ifws("apply")).code, 0);
      const runtimes = ["bun", "node"].flatMap((name) => {
        const program = which(name);
        return program === undefined ? [] : [{ name, program }];
      });
      const reports: { runtime: string; entry: string; stdout: string; code: number }[] = [];
      for (const r of runtimes) {
        for (const entry of [IFWS, LAUNCHER]) {
          const out = await w.ifwsOn(r.program, entry, ["status"]);
          reports.push({ runtime: r.name, entry, stdout: out.stdout, code: out.code });
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
        text.indexOf('register.mjs";') > 0 && text.indexOf('register.mjs";') < text.indexOf('import("../workspaces/ifws.ts")'),
        "the hook is registered first",
      );
    });
  },
  needsWorld,
);
